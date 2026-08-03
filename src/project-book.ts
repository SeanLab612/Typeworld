import * as THREE from "three";
import {RoundedBoxGeometry} from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  createProjectBookNodeNames,
  PROJECT_BOOK_DIMENSIONS,
  PROJECT_BOOK_NODE_NAMES,
} from "./project-book-spec";

export interface ProjectBookOptions {
  readonly coverArtwork: THREE.Texture;
  readonly decorated?: boolean;
  readonly id?: string;
  readonly title?: string;
  readonly volumeLabel?: string;
  readonly seriesLabel?: string;
  readonly subtitle?: string;
  readonly coverColor?: THREE.ColorRepresentation;
  readonly foilColor?: THREE.ColorRepresentation;
}

function makeCanvasTexture(
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable");
  draw(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function clothTexture(baseColor: THREE.ColorRepresentation): THREE.CanvasTexture {
  const color = new THREE.Color(baseColor);
  const texture = makeCanvasTexture(512, 512, (context) => {
    context.fillStyle = color.getStyle();
    context.fillRect(0, 0, 512, 512);
    for (let line = 0; line < 512; line += 2) {
      const alpha = 0.045 + ((line * 17) % 11) / 240;
      context.strokeStyle = `rgba(244, 193, 136, ${alpha})`;
      context.beginPath();
      context.moveTo(0, line + Math.sin(line * 0.17) * 0.7);
      context.lineTo(512, line + Math.cos(line * 0.11) * 0.7);
      context.stroke();
    }
    for (let line = 0; line < 512; line += 3) {
      context.strokeStyle = `rgba(32, 5, 8, ${0.05 + ((line * 13) % 7) / 180})`;
      context.beginPath();
      context.moveTo(line, 0);
      context.lineTo(line + Math.sin(line) * 0.8, 512);
      context.stroke();
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.5, 3.8);
  return texture;
}

function pageEdgeTexture(): THREE.CanvasTexture {
  const texture = makeCanvasTexture(512, 1024, (context) => {
    context.fillStyle = "#e7dcc2";
    context.fillRect(0, 0, 512, 1024);
    for (let y = 2; y < 1024; y += 3) {
      const drift = Math.sin(y * 0.071) * 1.4;
      const darkness = 0.055 + ((y * 19) % 29) / 420;
      context.strokeStyle = `rgba(92, 67, 43, ${darkness})`;
      context.lineWidth = y % 17 === 0 ? 1.5 : 0.55;
      context.beginPath();
      context.moveTo(0, y + drift);
      context.bezierCurveTo(150, y - drift, 350, y + drift, 512, y);
      context.stroke();
    }
    context.globalAlpha = 0.12;
    for (let mark = 0; mark < 90; mark += 1) {
      const x = (mark * 137) % 512;
      const y = (mark * 311) % 1024;
      context.fillStyle = mark % 3 === 0 ? "#7d5f3b" : "#f4e8cb";
      context.fillRect(x, y, 1 + (mark % 2), 3 + (mark % 6));
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function frontFoilTexture(
  title: string,
  volumeLabel: string,
  seriesLabel: string,
  subtitle: string,
): THREE.CanvasTexture {
  return makeCanvasTexture(1024, 1536, (context) => {
    context.clearRect(0, 0, 1024, 1536);
    context.fillStyle = "#d6ae6c";
    context.textBaseline = "top";
    context.font = '600 34px "Iowan Old Style", Baskerville, Georgia, serif';
    context.letterSpacing = "9px";
    context.fillText(seriesLabel.toUpperCase(), 78, 92);

    const words = title.toUpperCase().split(/\s+/);
    const titleLines: string[] = [];
    let currentLine = "";
    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (candidate.length > 17 && currentLine) {
        titleLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    }
    if (currentLine) titleLines.push(currentLine);
    const titleSize = titleLines.length > 1 ? 76 : title.length > 13 ? 88 : 118;
    context.font = `500 ${titleSize}px "Iowan Old Style", Baskerville, Georgia, serif`;
    context.letterSpacing = "4px";
    titleLines.slice(0, 3).forEach((line, index) => {
      context.fillText(line, 70, 250 + index * (titleSize * 1.02), 880);
    });
    const titleBottom = 250 + Math.min(titleLines.length, 3) * titleSize * 1.02;
    context.font = 'italic 58px "Iowan Old Style", Baskerville, Georgia, serif';
    context.letterSpacing = "2px";
    context.fillText(volumeLabel, 76, titleBottom + 22);
    context.fillRect(78, titleBottom + 122, 386, 3);
    context.font = '600 24px "Courier New", monospace';
    context.letterSpacing = "5px";
    context.fillText(subtitle.toUpperCase(), 78, titleBottom + 158, 820);
    context.font = '500 22px "Courier New", monospace';
    context.letterSpacing = "3px";
    context.fillText("INTERACTIVE TYPE EDITIONS", 78, 1362);
  });
}

function spineFoilTexture(title: string, volumeLabel: string): THREE.CanvasTexture {
  return makeCanvasTexture(256, 1536, (context) => {
    context.clearRect(0, 0, 256, 1536);
    context.save();
    context.translate(126, 1390);
    context.rotate(-Math.PI / 2);
    context.fillStyle = "#d6ae6c";
    context.font = '600 48px "Iowan Old Style", Baskerville, Georgia, serif';
    context.letterSpacing = "11px";
    context.fillText(`${title.toUpperCase()} · ${volumeLabel.toUpperCase()}`, 0, 0, 1230);
    context.restore();
    context.fillStyle = "#d6ae6c";
    context.fillRect(57, 90, 142, 4);
    context.fillRect(57, 1440, 142, 4);
  });
}

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name: string,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

export function createProjectBook({
  coverArtwork,
  decorated = true,
  id = "typeworld",
  title = "Typeworld",
  volumeLabel = "Volume 01",
  seriesLabel = "Typeworld Library",
  subtitle = "Mechanical Stories",
  coverColor = 0x7c1b25,
  foilColor = 0xe0ba76,
}: ProjectBookOptions): THREE.Group {
  const {
    width,
    height,
    pageDepth,
    coverThickness,
    coverOverhang,
    spineWidth,
  } = PROJECT_BOOK_DIMENSIONS;
  const nodeNames = id === "typeworld"
    ? PROJECT_BOOK_NODE_NAMES
    : createProjectBookNodeNames(id);
  const root = new THREE.Group();
  root.name = nodeNames.root;

  const clothMap = clothTexture(coverColor);
  const pagesMap = pageEdgeTexture();
  coverArtwork.colorSpace = THREE.SRGBColorSpace;
  coverArtwork.anisotropy = 8;

  const clothMaterial = new THREE.MeshPhysicalMaterial({
    map: clothMap,
    color: coverColor,
    roughness: 0.72,
    metalness: 0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.78,
    bumpMap: clothMap,
    bumpScale: 0.012,
  });
  const pageMaterial = new THREE.MeshStandardMaterial({
    map: pagesMap,
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0,
    bumpMap: pagesMap,
    bumpScale: 0.014,
  });
  const artworkMaterial = new THREE.MeshPhysicalMaterial({
    map: coverArtwork,
    roughness: 0.73,
    metalness: 0,
    clearcoat: 0.04,
    clearcoatRoughness: 0.84,
  });
  const foilMaterial = new THREE.MeshPhysicalMaterial({
    map: frontFoilTexture(title, volumeLabel, seriesLabel, subtitle),
    transparent: true,
    alphaTest: 0.08,
    color: foilColor,
    roughness: 0.32,
    metalness: 0.68,
    clearcoat: 0.15,
    clearcoatRoughness: 0.35,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

  const boardGeometry = new RoundedBoxGeometry(
    width,
    height,
    coverThickness,
    8,
    0.018,
  );
  const boardOffset = pageDepth / 2 + coverThickness / 2;
  const frontCover = mesh(
    boardGeometry,
    clothMaterial,
    nodeNames.frontCover,
  );
  frontCover.position.z = boardOffset;
  root.add(frontCover);

  const backCover = mesh(
    boardGeometry,
    clothMaterial.clone(),
    nodeNames.backCover,
  );
  backCover.position.z = -boardOffset;
  root.add(backCover);

  const pageBlock = mesh(
    new RoundedBoxGeometry(
      width - coverOverhang * 2,
      height - coverOverhang * 2,
      pageDepth,
      7,
      0.012,
    ),
    pageMaterial,
    nodeNames.pages,
  );
  pageBlock.position.x = coverOverhang * 0.38;
  root.add(pageBlock);

  const spineMaterial = clothMaterial.clone();
  spineMaterial.color.copy(new THREE.Color(coverColor).offsetHSL(0, 0.03, 0.08));
  spineMaterial.emissive.copy(new THREE.Color(coverColor).multiplyScalar(0.14));
  spineMaterial.emissiveIntensity = 0.18;
  const spine = mesh(
    new RoundedBoxGeometry(
      spineWidth,
      height - 0.012,
      pageDepth + coverThickness * 1.7,
      10,
      0.034,
    ),
    spineMaterial,
    nodeNames.spine,
  );
  spine.position.x = -width / 2 + spineWidth * 0.44;
  root.add(spine);

  const frontSurfaceZ = boardOffset + coverThickness / 2 + 0.0012;
  const artwork = mesh(
    new THREE.PlaneGeometry(width - 0.035, height - 0.035),
    artworkMaterial,
    nodeNames.frontArtwork,
  );
  artwork.position.z = frontSurfaceZ;
  if (decorated) root.add(artwork);

  const foil = mesh(
    new THREE.PlaneGeometry(width - 0.035, height - 0.035),
    foilMaterial,
    nodeNames.frontFoil,
  );
  foil.position.z = frontSurfaceZ + 0.0012;
  if (decorated) root.add(foil);

  const spineFoil = mesh(
    new THREE.PlaneGeometry(pageDepth + coverThickness * 1.42, height - 0.06),
    new THREE.MeshPhysicalMaterial({
      map: spineFoilTexture(title, volumeLabel),
      transparent: true,
      alphaTest: 0.08,
      color: foilColor,
      roughness: 0.3,
      metalness: 0.7,
      side: THREE.DoubleSide,
    }),
    nodeNames.spineFoil,
  );
  spineFoil.position.x = -width / 2 - 0.009;
  spineFoil.rotation.y = -Math.PI / 2;
  if (decorated) root.add(spineFoil);

  const foreEdge = mesh(
    new THREE.PlaneGeometry(pageDepth - 0.012, height - coverOverhang * 2.5),
    new THREE.MeshStandardMaterial({
      map: pagesMap,
      color: 0xfffbef,
      roughness: 0.94,
      bumpMap: pagesMap,
      bumpScale: 0.02,
      side: THREE.DoubleSide,
    }),
    nodeNames.foreEdge,
  );
  foreEdge.position.x = width / 2 - coverOverhang - 0.001;
  foreEdge.rotation.y = Math.PI / 2;
  root.add(foreEdge);

  const headbandMaterial = new THREE.MeshStandardMaterial({
    color: 0xb98b4e,
    roughness: 0.56,
    metalness: 0.18,
  });
  for (const [name, y] of [
    [nodeNames.headbandTop, height / 2 - coverOverhang * 1.45],
    [nodeNames.headbandBottom, -height / 2 + coverOverhang * 1.45],
  ] as const) {
    const headband = mesh(
      new THREE.CylinderGeometry(0.012, 0.012, pageDepth * 0.94, 20),
      headbandMaterial,
      name,
    );
    headband.position.set(-width / 2 + spineWidth * 0.8, y, 0);
    headband.rotation.x = Math.PI / 2;
    root.add(headband);
  }

  const ribbon = mesh(
    new THREE.PlaneGeometry(0.045, 0.25),
    new THREE.MeshStandardMaterial({
      color: 0x54121b,
      roughness: 0.82,
      side: THREE.DoubleSide,
    }),
    nodeNames.ribbon,
  );
  ribbon.position.set(0.13, -height / 2 + 0.16, 0.014);
  ribbon.rotation.x = -0.06;
  root.add(ribbon);

  const hitProxy = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.03, height * 1.03, pageDepth + coverThickness * 2),
    new THREE.MeshBasicMaterial({visible: false}),
  );
  hitProxy.name = nodeNames.hitProxy;
  hitProxy.userData.interactive = "project-book";
  hitProxy.userData.bookId = id;
  root.add(hitProxy);

  return root;
}
