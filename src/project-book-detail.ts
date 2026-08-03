import * as THREE from "three";
import {RoundedBoxGeometry} from "three/addons/geometries/RoundedBoxGeometry.js";
import type {
  ProjectBookPage,
  ProjectBookRecord,
} from "./project-books-data";
import {PROJECT_BOOK_DIMENSIONS} from "./project-book-spec";
import {wrapBookTextLines} from "./book-text-wrap";

export interface ProjectBookDetail {
  readonly root: THREE.Group;
  readonly coverPivot: THREE.Group;
  readonly leftPagePivot: THREE.Group;
  readonly leafPivots: ReadonlyArray<THREE.Group>;
  readonly hitProxy: THREE.Mesh;
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

function drawPaperBase(context: CanvasRenderingContext2D): void {
  context.fillStyle = "#e6d7b8";
  context.fillRect(0, 0, 1024, 1536);
  context.globalAlpha = 0.09;
  for (let line = 0; line < 1536; line += 5) {
    context.strokeStyle = line % 35 === 0 ? "#81684a" : "#f5ead0";
    context.beginPath();
    context.moveTo(0, line + Math.sin(line * 0.03));
    context.lineTo(1024, line + Math.cos(line * 0.025));
    context.stroke();
  }
  context.globalAlpha = 1;
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 12,
): number {
  const lines = wrapBookTextLines(
    text,
    maxWidth,
    (value) => context.measureText(value).width,
    maxLines,
  );
  lines.forEach((line, lineIndex) => {
    context.fillText(line, x, y + lineIndex * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function pageTexture(
  book: ProjectBookRecord,
  page: ProjectBookPage,
  pageNumber: number,
): THREE.CanvasTexture {
  return makeCanvasTexture(1024, 1536, (context) => {
    drawPaperBase(context);
    context.fillStyle = "#6f1e24";
    context.font = '600 27px "Courier New", monospace';
    context.letterSpacing = "6px";
    context.fillText(page.section.toUpperCase(), 92, 102);
    context.fillStyle = "#261a15";
    context.font = '500 86px "Iowan Old Style", Baskerville, Georgia, serif';
    context.letterSpacing = "1px";
    const headingBottom = wrapText(context, page.heading, 88, 210, 840, 91, 4);
    context.fillStyle = "#9e7745";
    context.fillRect(90, headingBottom + 28, 300, 4);
    context.fillStyle = "#32231b";
    context.letterSpacing = "1px";
    let paragraphY = headingBottom + 100;
    for (const paragraph of page.paragraphs) {
      context.font = /\p{Script=Han}/u.test(paragraph)
        ? '500 38px "Songti SC", "STSong", "Noto Serif CJK SC", serif'
        : '500 35px "Courier New", monospace';
      paragraphY = wrapText(context, paragraph, 92, paragraphY, 820, 55, 9) + 46;
    }
    context.fillStyle = "#855f39";
    context.font = '600 23px "Courier New", monospace';
    context.letterSpacing = "4px";
    context.fillText(book.volumeLabel.toUpperCase(), 90, 1420);
    context.textAlign = "right";
    context.fillText(String(pageNumber).padStart(2, "0"), 930, 1420);
  });
}

function blankPageTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(1024, 1536, drawPaperBase);
}

function coverFoilTexture(book: ProjectBookRecord): THREE.CanvasTexture {
  return makeCanvasTexture(1024, 1536, (context) => {
    context.clearRect(0, 0, 1024, 1536);
    context.fillStyle = "#d7b16f";
    context.font = '600 31px "Iowan Old Style", Baskerville, Georgia, serif';
    context.letterSpacing = "8px";
    context.fillText("TYPEWORLD LIBRARY", 76, 105);
    context.font = '500 85px "Iowan Old Style", Baskerville, Georgia, serif';
    context.letterSpacing = "2px";
    wrapText(context, book.title.toUpperCase(), 72, 270, 850, 90, 3);
    context.font = 'italic 48px "Iowan Old Style", Baskerville, Georgia, serif';
    context.fillText(book.volumeLabel, 76, 560);
    context.font = '600 22px "Courier New", monospace';
    context.letterSpacing = "4px";
    context.fillText(book.subtitle.toUpperCase(), 76, 665, 820);
  });
}

function curvedPageGeometry(width: number, height: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(width, height, 30, 4);
  const position = geometry.getAttribute("position");
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const ratio = x / width + 0.5;
    position.setZ(index, Math.sin(ratio * Math.PI) * 0.018 + ratio * 0.006);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function paperMaterial(texture: THREE.Texture, side: THREE.Side): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xfff8e7,
    roughness: 0.94,
    metalness: 0,
    side,
    bumpMap: texture,
    bumpScale: 0.004,
  });
}

export function createProjectBookDetail(
  book: ProjectBookRecord,
  coverArtwork: THREE.Texture,
  options: {readonly singlePage?: boolean} = {},
): ProjectBookDetail {
  const {width, height, pageDepth, coverThickness, coverOverhang} = PROJECT_BOOK_DIMENSIONS;
  const pageWidth = width - coverOverhang * 2;
  const pageHeight = height - coverOverhang * 2;
  const prefix = `BOOK_DETAIL_${book.id.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}`;
  const root = new THREE.Group();
  root.name = `${prefix}_ROOT`;

  const clothMaterial = new THREE.MeshPhysicalMaterial({
    color: book.coverColor,
    roughness: 0.76,
    metalness: 0,
    clearcoat: 0.06,
    clearcoatRoughness: 0.82,
  });
  const pageEdgeMaterial = new THREE.MeshStandardMaterial({
    color: 0xe3d2ad,
    roughness: 0.96,
    metalness: 0,
  });

  const boardGeometry = new RoundedBoxGeometry(
    width,
    height,
    coverThickness,
    8,
    0.018,
  );
  const backCover = new THREE.Mesh(boardGeometry, clothMaterial);
  backCover.name = `${prefix}_COVER_BACK`;
  backCover.position.set(width / 2, 0, coverThickness / 2);
  backCover.castShadow = true;
  backCover.receiveShadow = true;
  root.add(backCover);

  const rightPageBlock = new THREE.Mesh(
    new RoundedBoxGeometry(
      pageWidth,
      pageHeight,
      pageDepth,
      7,
      0.012,
    ),
    pageEdgeMaterial,
  );
  rightPageBlock.name = `${prefix}_PAGES_RIGHT`;
  rightPageBlock.position.set(pageWidth / 2, 0, coverThickness + pageDepth / 2);
  rightPageBlock.castShadow = true;
  rightPageBlock.receiveShadow = true;
  root.add(rightPageBlock);

  const leftPagePivot = new THREE.Group();
  leftPagePivot.name = `${prefix}_PAGES_LEFT_PIVOT`;
  leftPagePivot.scale.x = 0;
  root.add(leftPagePivot);

  const leftPageBlock = new THREE.Mesh(
    new RoundedBoxGeometry(
      pageWidth,
      pageHeight,
      0.018,
      5,
      0.008,
    ),
    pageEdgeMaterial.clone(),
  );
  leftPageBlock.name = `${prefix}_PAGES_LEFT`;
  leftPageBlock.position.set(-pageWidth / 2, 0, coverThickness + 0.014);
  leftPageBlock.castShadow = true;
  leftPageBlock.receiveShadow = true;
  leftPagePivot.add(leftPageBlock);

  const coverPivot = new THREE.Group();
  coverPivot.name = `${prefix}_COVER_FRONT_PIVOT`;
  coverPivot.position.set(0, 0, coverThickness + pageDepth + 0.006);
  root.add(coverPivot);

  const frontCover = new THREE.Mesh(boardGeometry, clothMaterial.clone());
  frontCover.name = `${prefix}_COVER_FRONT`;
  frontCover.position.set(width / 2, 0, coverThickness / 2);
  frontCover.castShadow = true;
  frontCover.receiveShadow = true;
  coverPivot.add(frontCover);

  coverArtwork.colorSpace = THREE.SRGBColorSpace;
  coverArtwork.anisotropy = 8;
  const artwork = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.035, height - 0.035),
    new THREE.MeshPhysicalMaterial({
      map: coverArtwork,
      roughness: 0.76,
      clearcoat: 0.04,
      clearcoatRoughness: 0.86,
    }),
  );
  artwork.name = `${prefix}_FRONT_ARTWORK`;
  artwork.position.set(width / 2, 0, coverThickness + 0.001);
  coverPivot.add(artwork);

  const foil = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.035, height - 0.035),
    new THREE.MeshPhysicalMaterial({
      map: coverFoilTexture(book),
      transparent: true,
      alphaTest: 0.08,
      color: book.foilColor,
      roughness: 0.32,
      metalness: 0.68,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
  );
  foil.name = `${prefix}_FRONT_FOIL`;
  foil.position.set(width / 2, 0, coverThickness + 0.002);
  coverPivot.add(foil);

  const leafWidth = pageWidth;
  const leafHeight = pageHeight;
  const pageTextures = book.kind === "project"
    ? book.pages.map((page, index) => pageTexture(book, page, index + 1))
    : Array.from({length: 7}, () => blankPageTexture());
  if (pageTextures.length !== 7) {
    throw new Error(`Project book ${book.id} must provide exactly seven pages`);
  }
  const leafGeometry = curvedPageGeometry(leafWidth, leafHeight);
  const createLeaf = (
    frontTexture: THREE.Texture,
    backTexture: THREE.Texture,
    index: number,
    depthStep: number,
  ): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.name = `${prefix}_PAGE_${String(index + 1).padStart(2, "0")}_PIVOT`;
    pivot.position.set(0, 0, coverThickness + pageDepth + 0.017 - index * depthStep);
    const frontPage = new THREE.Mesh(
      leafGeometry,
      paperMaterial(frontTexture, THREE.FrontSide),
    );
    frontPage.name = `${prefix}_PAGE_${String(index + 1).padStart(2, "0")}_FRONT`;
    frontPage.position.x = leafWidth / 2;
    frontPage.castShadow = true;
    frontPage.receiveShadow = true;
    pivot.add(frontPage);
    const backPage = new THREE.Mesh(
      leafGeometry,
      paperMaterial(backTexture, THREE.BackSide),
    );
    backPage.name = `${prefix}_PAGE_${String(index + 1).padStart(2, "0")}_BACK`;
    backPage.position.x = leafWidth / 2;
    backPage.castShadow = true;
    backPage.receiveShadow = true;
    pivot.add(backPage);
    root.add(pivot);
    return pivot;
  };

  let leafPivots: THREE.Group[];
  if (options.singlePage) {
    leafPivots = pageTextures.map((frontTexture, index) => createLeaf(
      frontTexture,
      blankPageTexture(),
      index,
      0.0015,
    ));
  } else {
    const content = [
      [pageTextures[0]!, pageTextures[1]!],
      [pageTextures[2]!, pageTextures[3]!],
      [pageTextures[4]!, pageTextures[5]!],
    ] as const;
    for (const [, backTexture] of content) {
      backTexture.wrapS = THREE.RepeatWrapping;
      backTexture.repeat.x = -1;
      backTexture.offset.x = 1;
    }
    const finalPage = new THREE.Mesh(
      leafGeometry,
      paperMaterial(pageTextures[6]!, THREE.FrontSide),
    );
    finalPage.name = `${prefix}_PAGE_FINAL_FRONT`;
    finalPage.position.set(
      leafWidth / 2,
      0,
      coverThickness + pageDepth + 0.009,
    );
    finalPage.castShadow = true;
    finalPage.receiveShadow = true;
    root.add(finalPage);
    leafPivots = content.map(([frontTexture, backTexture], index) => createLeaf(
      frontTexture,
      backTexture,
      index,
      0.0025,
    ));
  }

  const hitProxy = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.04, height * 1.04, pageDepth + coverThickness * 2),
    new THREE.MeshBasicMaterial({visible: false}),
  );
  hitProxy.name = `${prefix}_HIT_PROXY`;
  hitProxy.position.set(width / 2, 0, pageDepth / 2);
  hitProxy.userData.interactive = "project-book-detail";
  root.add(hitProxy);

  return {root, coverPivot, leftPagePivot, leafPivots, hitProxy};
}
