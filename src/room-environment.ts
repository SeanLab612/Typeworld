import * as THREE from "three";
import {createProjectBook} from "./project-book";
import {PROJECT_BOOKS} from "./project-books-data";
import {selectLibraryShelfIndices} from "./library-shelf-layout";
import {createShelfBookLayout} from "./shelf-book-layout";

export interface RoomNote {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly keyword: "library" | null;
}

export interface RoomTextureSet {
  readonly typewriterStudy: THREE.Texture;
  readonly wordRecord: THREE.Texture;
  readonly projectBookCovers?: ReadonlyMap<string, THREE.Texture>;
  readonly bookcase?: THREE.Object3D;
}

export interface RoomTimeState {
  readonly label: "黎明" | "白昼" | "黄昏" | "深夜";
  readonly localTime: string;
}

export interface RoomEnvironment {
  readonly group: THREE.Group;
  readonly hitTargets: ReadonlyArray<THREE.Mesh>;
  readonly libraryJourneyBooks: ReadonlyArray<THREE.Object3D>;
  attachBookcase(
    source: THREE.Object3D,
    projectBookCovers?: ReadonlyMap<string, THREE.Texture>,
  ): void;
  setCompactWallLayout(compact: boolean): void;
  setLocalTime(date: Date): RoomTimeState;
}

interface TimeKeyframe {
  readonly hour: number;
  readonly label: RoomTimeState["label"];
  readonly lightColor: THREE.Color;
  readonly lightIntensity: number;
  readonly fillColor: THREE.Color;
  readonly fillIntensity: number;
}

const TIME_KEYFRAMES: ReadonlyArray<TimeKeyframe> = [
  {
    hour: 0,
    label: "深夜",
    lightColor: new THREE.Color(0x8094c4),
    lightIntensity: 0.16,
    fillColor: new THREE.Color(0x53678e),
    fillIntensity: 0.18,
  },
  {
    hour: 6,
    label: "黎明",
    lightColor: new THREE.Color(0xffc59b),
    lightIntensity: 1.2,
    fillColor: new THREE.Color(0xa9b7cf),
    fillIntensity: 0.52,
  },
  {
    hour: 12,
    label: "白昼",
    lightColor: new THREE.Color(0xffefd0),
    lightIntensity: 3.35,
    fillColor: new THREE.Color(0xc6d7e5),
    fillIntensity: 0.92,
  },
  {
    hour: 18,
    label: "黄昏",
    lightColor: new THREE.Color(0xff985f),
    lightIntensity: 1.65,
    fillColor: new THREE.Color(0x8c6f76),
    fillIntensity: 0.48,
  },
  {
    hour: 24,
    label: "深夜",
    lightColor: new THREE.Color(0x8094c4),
    lightIntensity: 0.16,
    fillColor: new THREE.Color(0x53678e),
    fillIntensity: 0.18,
  },
];

function seededNoiseTexture(
  base: readonly [number, number, number],
  variation: number,
  direction: "cloud" | "grain",
): THREE.DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const hash = ((x * 73856093) ^ (y * 19349663) ^ ((x + y) * 83492791)) >>> 0;
      const random = (hash % 997) / 997 - 0.5;
      const wave = direction === "grain"
        ? Math.sin(y * 0.34 + Math.sin(x * 0.08) * 1.8) * 0.42
        : Math.sin(x * 0.11) * Math.sin(y * 0.08) * 0.28;
      const amount = (random * 0.62 + wave) * variation;
      data[index] = THREE.MathUtils.clamp(base[0] + amount, 0, 255);
      data[index + 1] = THREE.MathUtils.clamp(base[1] + amount, 0, 255);
      data[index + 2] = THREE.MathUtils.clamp(base[2] + amount, 0, 255);
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function addBox(
  group: THREE.Group,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  material: THREE.Material,
  name?: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  if (name) mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addWallPaper(
  group: THREE.Group,
  hitTargets: THREE.Mesh[],
  note: RoomNote,
  x: number,
  y: number,
  texture: THREE.Texture,
  size: readonly [number, number],
  framed: boolean,
): THREE.Mesh {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (framed) {
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c180f,
      roughness: 0.7,
      metalness: 0.05,
    });
    addBox(
      group,
      [size[0] + 0.08, size[1] + 0.08, 0.035],
      [x, y, -1.123],
      frameMaterial,
    );
  }
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(size[0], size[1]),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.93,
      metalness: 0,
      emissive: 0xb88b55,
      emissiveMap: texture,
      emissiveIntensity: 0.18,
    }),
  );
  paper.name = `ROOM_NOTE_${note.id.toUpperCase()}`;
  paper.position.set(x, y, -1.098);
  paper.rotation.z = framed ? 0 : (note.id.length % 2 === 0 ? -0.025 : 0.018);
  paper.userData.interactive = "room-note";
  paper.userData.note = note;
  group.add(paper);
  hitTargets.push(paper);
  return paper;
}

function addBookcase(
  group: THREE.Group,
  source: THREE.Object3D,
  hitTargets: THREE.Mesh[],
  libraryJourneyBooks: THREE.Object3D[],
  projectBookCovers?: ReadonlyMap<string, THREE.Texture>,
): void {
  const shelf = new THREE.Group();
  shelf.name = "ROOM_LEFT_BOOKCASE";
  shelf.position.set(-2.12, -0.89, -1.08);
  group.add(shelf);

  const model = source.clone(true);
  model.name = "ROOM_LEFT_BOOKCASE_MODEL";
  const initialBounds = new THREE.Box3().setFromObject(model);
  const initialSize = initialBounds.getSize(new THREE.Vector3());
  const targetHeight = 2.08;
  const scale = targetHeight / Math.max(initialSize.y, 0.001);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const scaledBounds = new THREE.Box3().setFromObject(model);
  const scaledMin = scaledBounds.min.clone();
  model.position.sub(scaledMin);
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
    const materials = sourceMaterials.map((sourceMaterial) => {
      const material = sourceMaterial.clone();
      if (material instanceof THREE.MeshStandardMaterial) {
        material.color.multiply(new THREE.Color(0x704a34));
        material.roughness = Math.max(material.roughness, 0.72);
        material.metalness = 0;
        material.envMapIntensity = 0.46;
      }
      return material;
    });
    object.material = Array.isArray(object.material) ? materials : materials[0]!;
  });
  shelf.add(model);

  const books = new THREE.Group();
  books.name = "ROOM_LEFT_BOOKCASE_BOOKS";
  shelf.add(books);
  const templates = PROJECT_BOOKS.map((record, index) => {
    const color = new THREE.Color(record.coverColor);
    const fallbackTexture = new THREE.DataTexture(
      new Uint8Array([
        Math.round(color.r * 255),
        Math.round(color.g * 255),
        Math.round(color.b * 255),
        255,
      ]),
      1,
      1,
      THREE.RGBAFormat,
    );
    const texture = projectBookCovers?.get(record.id) ?? fallbackTexture;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.max(texture.anisotropy, 8);
    texture.needsUpdate = true;
    return createProjectBook({
      coverArtwork: texture,
      id: `shelf-template-${index + 1}`,
      title: record.title,
      volumeLabel: record.volumeLabel,
      subtitle: record.subtitle,
      coverColor: record.coverColor,
      foilColor: record.foilColor,
    });
  });
  const journeyBookIndices = selectLibraryShelfIndices(PROJECT_BOOKS.length);
  const journeyBookOrder = new Map<number, number>(
    journeyBookIndices.map((shelfIndex, journeyIndex) => [shelfIndex, journeyIndex]),
  );
  createShelfBookLayout().forEach((placement, index) => {
    const journeyIndex = journeyBookOrder.get(index);
    const templateIndex = journeyIndex ?? placement.colorIndex;
    const book = templates[templateIndex % templates.length]!.clone(true);
    book.name = `ROOM_SHELF_BOOK_${String(index + 1).padStart(2, "0")}`;
    book.position.set(placement.x, placement.y, placement.z);
    book.rotation.set(0, Math.PI / 2, placement.lean);
    book.scale.set(
      placement.scale,
      placement.scale,
      placement.scale * placement.thicknessScale,
    );
    book.userData.projectBookColor = placement.colorIndex;
    if (journeyIndex !== undefined) {
      book.userData.libraryJourneyIndex = journeyIndex;
      book.userData.projectBookId = PROJECT_BOOKS[journeyIndex]?.id;
    }
    book.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      // Only the four independent journey books need animated hero shadows.
      // Decorative shelf books remain independent but avoid a second full
      // shadow pass for every cover, page block, hinge, and spine mesh.
      object.castShadow = journeyIndex !== undefined;
      object.receiveShadow = true;
      if (journeyIndex !== undefined) {
        object.userData.libraryJourneyIndex = journeyIndex;
        object.userData.projectBookId = PROJECT_BOOKS[journeyIndex]?.id;
      }
    });
    books.add(book);
    if (journeyIndex !== undefined) libraryJourneyBooks.push(book);
  });

  const shelfHit = new THREE.Mesh(
    new THREE.BoxGeometry(1.08, 2.08, 0.38),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  shelfHit.name = "HIT_ROOM_PROJECTS_BOOKCASE";
  shelfHit.position.set(0.50, 1.04, 0.14);
  shelfHit.userData.interactive = "projects-books";
  shelf.add(shelfHit);
  hitTargets.push(shelfHit);
}

function timeSegment(hour: number): {
  readonly before: TimeKeyframe;
  readonly after: TimeKeyframe;
  readonly amount: number;
} {
  for (let index = 0; index < TIME_KEYFRAMES.length - 1; index += 1) {
    const before = TIME_KEYFRAMES[index]!;
    const after = TIME_KEYFRAMES[index + 1]!;
    if (hour >= before.hour && hour <= after.hour) {
      return {
        before,
        after,
        amount: THREE.MathUtils.smoothstep(hour, before.hour, after.hour),
      };
    }
  }
  return {before: TIME_KEYFRAMES[0]!, after: TIME_KEYFRAMES[1]!, amount: 0};
}

export function buildRoomEnvironment(textures: RoomTextureSet): RoomEnvironment {
  const group = new THREE.Group();
  group.name = "ROOM_ENVIRONMENT";
  const hitTargets: THREE.Mesh[] = [];
  const libraryJourneyBooks: THREE.Object3D[] = [];

  const plasterTexture = seededNoiseTexture([82, 65, 58], 24, "cloud");
  plasterTexture.repeat.set(4.5, 2.5);
  const plasterMaterial = new THREE.MeshStandardMaterial({
    map: plasterTexture,
    color: 0x77635a,
    roughness: 0.98,
    metalness: 0,
  });
  const floorTexture = seededNoiseTexture([46, 25, 17], 28, "grain");
  floorTexture.repeat.set(6, 8);
  const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorTexture,
    color: 0x59301f,
    roughness: 0.9,
    metalness: 0,
  });
  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x29160f,
    roughness: 0.8,
    metalness: 0.02,
  });

  addBox(group, [4.8, 2.7, 0.08], [0, 0.44, -1.18], plasterMaterial, "ROOM_BACK_WALL");
  for (const side of [-1, 1] as const) {
    addBox(
      group,
      [0.08, 2.7, 4.8],
      [side < 0 ? -2.50 : 2.38, 0.44, 1.18],
      plasterMaterial,
      side < 0 ? "ROOM_LEFT_WALL" : "ROOM_RIGHT_WALL",
    );
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 4.8), floorMaterial);
  floor.name = "ROOM_FLOOR";
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.91, 0.72);
  floor.receiveShadow = true;
  group.add(floor);
  addBox(group, [4.78, 0.13, 0.09], [0, -0.80, -1.105], woodMaterial);
  addBox(group, [4.78, 0.055, 0.08], [0, 1.33, -1.105], woodMaterial);

  let bookcaseAttached = false;
  function attachBookcase(
    source: THREE.Object3D,
    projectBookCovers = textures.projectBookCovers,
  ): void {
    if (bookcaseAttached) return;
    bookcaseAttached = true;
    addBookcase(
      group,
      source,
      hitTargets,
      libraryJourneyBooks,
      projectBookCovers,
    );
  }
  if (textures.bookcase) attachBookcase(textures.bookcase);

  const machineStudyPaper = addWallPaper(group, hitTargets, {
    id: "machine-study",
    title: "Machine Study",
    body: "A fictional mechanical study of the Typeworld typewriter.",
    keyword: null,
  }, -0.62, 0.16, textures.typewriterStudy, [0.48, 0.70], false);
  const wordRecordPaper = addWallPaper(group, hitTargets, {
    id: "word-record",
    title: "Word Record",
    body: "GREEN · SNOW · FLOWER · FIRE · SMILE",
    keyword: null,
  }, 0.62, 0.17, textures.wordRecord, [0.42, 0.54], false);

  function setCompactWallLayout(compact: boolean): void {
    if (compact) {
      machineStudyPaper.position.set(-0.28, 0.18, -1.098);
      machineStudyPaper.scale.setScalar(0.72);
      wordRecordPaper.position.set(0.29, 0.19, -1.098);
      wordRecordPaper.scale.setScalar(0.72);
      return;
    }
    machineStudyPaper.position.set(-0.62, 0.16, -1.098);
    machineStudyPaper.scale.setScalar(1);
    wordRecordPaper.position.set(0.62, 0.17, -1.098);
    wordRecordPaper.scale.setScalar(1);
  }

  const roomTarget = new THREE.Object3D();
  roomTarget.position.set(0.08, -0.25, 0.16);
  group.add(roomTarget);
  const roomKeyLight = new THREE.SpotLight(0xffefd0, 2.15, 5.5, 0.72, 0.90, 1.18);
  roomKeyLight.name = "ROOM_TIME_KEY";
  roomKeyLight.position.set(1.55, 1.06, -0.76);
  roomKeyLight.target = roomTarget;
  roomKeyLight.castShadow = true;
  roomKeyLight.shadow.mapSize.set(1024, 1024);
  roomKeyLight.shadow.bias = -0.00018;
  group.add(roomKeyLight);
  const roomFill = new THREE.PointLight(0xc6d7e5, 0.68, 4.4, 1.55);
  roomFill.name = "ROOM_TIME_FILL";
  roomFill.position.set(1.42, 0.56, -0.76);
  group.add(roomFill);
  const warmBounce = new THREE.PointLight(0xd88f57, 0.42, 3.4, 1.8);
  warmBounce.position.set(-1.2, 0.18, -0.55);
  group.add(warmBounce);

  function setLocalTime(date: Date): RoomTimeState {
    const hour = date.getHours() + date.getMinutes() / 60;
    const {before, after, amount} = timeSegment(hour);
    roomKeyLight.color.copy(before.lightColor).lerp(after.lightColor, amount);
    roomKeyLight.intensity = THREE.MathUtils.lerp(
      before.lightIntensity * 0.64,
      after.lightIntensity * 0.64,
      amount,
    );
    roomFill.color.copy(before.fillColor).lerp(after.fillColor, amount);
    roomFill.intensity = THREE.MathUtils.lerp(
      before.fillIntensity * 0.74,
      after.fillIntensity * 0.74,
      amount,
    );
    warmBounce.intensity = hour >= 17 && hour < 21 ? 0.72 : hour < 6 ? 0.18 : 0.42;
    const active = amount < 0.5 ? before : after;
    return {
      label: active.label,
      localTime: date.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}),
    };
  }

  setLocalTime(new Date());
  return {
    group,
    hitTargets,
    libraryJourneyBooks,
    attachBookcase,
    setCompactWallLayout,
    setLocalTime,
  };
}
