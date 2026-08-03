import * as THREE from "three";
import {RectAreaLightUniformsLib} from "three/addons/lights/RectAreaLightUniformsLib.js";
import {createArcaneBookMagic} from "./book-magic-effect";
import {createProjectBook} from "./project-book";
import {loadProjectCover} from "./project-cover-loader";
import {calibratedExposure} from "./display-profile";
import {
  currentRenderPixelRatio,
  currentShadowMapSize,
  resizeThreeViewport,
} from "./render-quality";
import {
  getRelativeProjectBookIndex,
  normalizeProjectBookIndex,
  PROJECT_BOOKS,
} from "./project-books-data";
import {projectBookIndexPose} from "./project-book-index-layout";
import {
  canReturnThroughHistory,
  prefetchUrl,
  prefersReducedMotion,
  restoreAfterPageShow,
} from "./project-experience";
import {
  hasStudyOrigin,
  projectBookDetailUrl,
  projectBooksRoomReturnUrl,
  type ProjectBooksSurface,
} from "./project-books-routing";
import "./project-transition.css";
import "./project-books-sample.css";

const root = document.querySelector<HTMLElement>("#books-sample");
if (!root) throw new Error("Project books sample root was not found");
const surface: ProjectBooksSurface = root.dataset.mode === "formal" ? "formal" : "sample";
const formalMode = surface === "formal";
const fromStudy = formalMode && hasStudyOrigin(location.search);
const reducedMotion = prefersReducedMotion();

root.innerHTML = `
  <main class="books-study${formalMode ? " is-formal" : ""}">
    <p class="books-study__brand">TYPEWORLD LIBRARY<span>Words for curious hands</span></p>
    <p class="books-study__gate">${
      formalMode ? "LIBRARY INDEX<br>SELECT A VOLUME" : "P2 INTERACTION GATE<br>LIBRARY BOOKS"
    } · ${String(PROJECT_BOOKS.length).padStart(2, "0")}</p>
    <section class="books-study__details" aria-live="polite">
      <p class="books-study__eyebrow" data-book-volume></p>
      <h1 data-book-title></h1>
      <p class="books-study__subtitle" data-book-subtitle></p>
      <p class="books-study__description" data-book-description></p>
    </section>
    <nav class="books-study__controls" aria-label="书籍选择">
      ${formalMode ? '<button type="button" data-return-study>RETURN TO STUDY</button>' : ""}
      <button type="button" data-book-previous>PREVIOUS</button>
      <button type="button" data-book-open>OPEN BOOK</button>
      <button type="button" data-book-next>NEXT</button>
    </nav>
    <p class="books-study__hint">滚轮 / 上下拖动 / 方向键 / 点击书本</p>
    <p class="books-study__counter"><strong data-book-current>01</strong> / ${String(PROJECT_BOOKS.length).padStart(2, "0")}</p>
    <div class="books-study__loading" data-books-loading>${
      formalMode ? "OPENING THE TYPEWORLD LIBRARY" : "PREPARING THE LIBRARY INDEX"
    }</div>
  </main>
`;

const stage = root.querySelector<HTMLElement>(".books-study");
const loading = root.querySelector<HTMLElement>("[data-books-loading]");
const previousButton = root.querySelector<HTMLButtonElement>("[data-book-previous]");
const returnStudyButton = root.querySelector<HTMLButtonElement>("[data-return-study]");
const openButton = root.querySelector<HTMLButtonElement>("[data-book-open]");
const nextButton = root.querySelector<HTMLButtonElement>("[data-book-next]");
const volumeElement = root.querySelector<HTMLElement>("[data-book-volume]");
const titleElement = root.querySelector<HTMLElement>("[data-book-title]");
const subtitleElement = root.querySelector<HTMLElement>("[data-book-subtitle]");
const descriptionElement = root.querySelector<HTMLElement>("[data-book-description]");
const currentElement = root.querySelector<HTMLElement>("[data-book-current]");
if (
  !stage
  || !loading
  || !previousButton
  || !openButton
  || !nextButton
  || !volumeElement
  || !titleElement
  || !subtitleElement
  || !descriptionElement
  || !currentElement
) {
  throw new Error("Project books review scaffold is incomplete");
}
restoreAfterPageShow(stage, "is-leaving");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10090a);
scene.fog = new THREE.FogExp2(0x10090a, 0.065);

const camera = new THREE.PerspectiveCamera(33, innerWidth / innerHeight, 0.01, 30);
camera.position.set(0.15, 0.2, 5.4);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({antialias: true, alpha: false});
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute("aria-label", "Typeworld 书库；可用方向键选书");
renderer.setPixelRatio(currentRenderPixelRatio());
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = calibratedExposure(0.98);
stage.prepend(renderer.domElement);

RectAreaLightUniformsLib.init();
scene.add(new THREE.HemisphereLight(0x8c7898, 0x24100d, 0.5));

const keyTarget = new THREE.Object3D();
keyTarget.position.set(0.55, 0.04, 0);
scene.add(keyTarget);
const keyLight = new THREE.SpotLight(0xffd2a0, 19, 10, 0.5, 0.78, 1.3);
keyLight.position.set(2.7, 3.5, 4.2);
keyLight.target = keyTarget;
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(currentShadowMapSize(), currentShadowMapSize());
scene.add(keyLight);

const fillLight = new THREE.RectAreaLight(0x9eb4d5, 3.4, 2.2, 3.4);
fillLight.position.set(-2.8, 0.8, 2.1);
fillLight.lookAt(-0.35, 0, 0);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xd58d63, 2.5);
rimLight.position.set(-2.5, 2.7, -2.8);
scene.add(rimLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 16),
  new THREE.MeshStandardMaterial({color: 0x21100e, roughness: 0.92, metalness: 0}),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.38;
floor.receiveShadow = true;
scene.add(floor);

const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 8),
  new THREE.MeshStandardMaterial({color: 0x180b0d, roughness: 1, metalness: 0}),
);
backdrop.position.set(0, 1.6, -2.6);
scene.add(backdrop);

interface BookInstance {
  readonly root: THREE.Group;
  readonly hitProxy: THREE.Object3D;
  readonly index: number;
  readonly targetPosition: THREE.Vector3;
  readonly targetRotation: THREE.Euler;
  readonly targetScale: THREE.Vector3;
}

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();
const uniqueCoverUrls = Array.from(new Set(PROJECT_BOOKS.map((book) => book.coverUrl)));
const loadedTextures = await Promise.all(
  uniqueCoverUrls.map(async (url) => {
    const fallbackColor = PROJECT_BOOKS.find((book) => book.coverUrl === url)?.coverColor
      ?? 0x3b2024;
    const result = await loadProjectCover(textureLoader, url, fallbackColor);
    const texture = result.texture;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(url, texture);
    return result;
  }),
);
if (loadedTextures.length !== uniqueCoverUrls.length) {
  throw new Error("Not all project book covers were loaded");
}
if (loadedTextures.some((result) => result.degraded)) {
  stage.dataset.assetState = "degraded";
  loading.textContent = "ARCHIVE READY · SIMPLIFIED COVER FALLBACK";
}

const bookInstances: BookInstance[] = PROJECT_BOOKS.map((book, index) => {
  const sourceTexture = textureCache.get(book.coverUrl);
  if (!sourceTexture) throw new Error(`Missing cover texture for ${book.id}`);
  const bookRoot = createProjectBook({
    coverArtwork: sourceTexture.clone(),
    id: book.id,
    title: book.title,
    volumeLabel: book.volumeLabel,
    subtitle: book.subtitle,
    coverColor: book.coverColor,
    foilColor: book.foilColor,
  });
  bookRoot.userData.bookIndex = index;
  scene.add(bookRoot);
  const hitProxy = bookRoot.getObjectByName(
    `BOOK_${book.id.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}_HIT_PROXY`,
  );
  if (!hitProxy) throw new Error(`Missing hit proxy for ${book.id}`);
  return {
    root: bookRoot,
    hitProxy,
    index,
    targetPosition: new THREE.Vector3(),
    targetRotation: new THREE.Euler(),
    targetScale: new THREE.Vector3(1, 1, 1),
  };
});
const arcaneBookMagic = createArcaneBookMagic({
  reducedMotion,
  hardwareConcurrency: navigator.hardwareConcurrency,
});

const requestedBookId = new URLSearchParams(location.search).get("book");
let activeIndex = Math.max(
  0,
  PROJECT_BOOKS.findIndex((book) => book.id === requestedBookId),
);
let magicBookIndex = -1;

function updateBookDetails(): void {
  const activeBook = PROJECT_BOOKS[activeIndex]!;
  if (magicBookIndex !== activeIndex) {
    arcaneBookMagic.attachTo(bookInstances[activeIndex]!.root);
    magicBookIndex = activeIndex;
  }
  stage!.dataset.bookKind = activeBook.kind;
  volumeElement!.textContent = `${activeBook.volumeLabel.toUpperCase()} · LIBRARY INDEX`;
  titleElement!.textContent = activeBook.title;
  subtitleElement!.textContent = activeBook.subtitle;
  descriptionElement!.textContent = activeBook.description;
  currentElement!.textContent = String(activeIndex + 1).padStart(2, "0");
  const url = new URL(location.href);
  url.searchParams.set("book", activeBook.id);
  history.replaceState(null, "", url);
  prefetchUrl(projectBookDetailUrl(surface, activeBook.id, {fromStudy}));
}

function selectBook(nextIndex: number): void {
  activeIndex = normalizeProjectBookIndex(nextIndex);
  updateBookDetails();
}

previousButton.addEventListener("click", () => selectBook(activeIndex - 1));
let navigationLocked = false;
addEventListener("pageshow", () => {
  navigationLocked = false;
});

function navigateTo(url: string): void {
  if (navigationLocked) return;
  navigationLocked = true;
  stage!.classList.add("is-leaving");
  window.setTimeout(() => {
    location.href = url;
  }, reducedMotion ? 20 : 280);
}

function openSelectedBook(): void {
  navigateTo(projectBookDetailUrl(surface, PROJECT_BOOKS[activeIndex]!.id, {fromStudy}));
}

function returnToStudy(): void {
  if (
    fromStudy
    && canReturnThroughHistory(document.referrer, location.origin, ["/", "/index.html"])
  ) {
    if (navigationLocked) return;
    navigationLocked = true;
    stage!.classList.add("is-leaving");
    window.setTimeout(() => history.back(), reducedMotion ? 20 : 280);
    return;
  }
  navigateTo(projectBooksRoomReturnUrl());
}

returnStudyButton?.addEventListener("click", returnToStudy);
openButton.addEventListener("click", openSelectedBook);
nextButton.addEventListener("click", () => selectBook(activeIndex + 1));

let wheelLocked = false;
stage.addEventListener("wheel", (event) => {
  event.preventDefault();
  if (wheelLocked || Math.abs(event.deltaY) < 6) return;
  selectBook(activeIndex + (event.deltaY > 0 ? 1 : -1));
  wheelLocked = true;
  window.setTimeout(() => {
    wheelLocked = false;
  }, 380);
}, {passive: false});

let pointerStartY = 0;
let pointerStartX = 0;
let pointerMoved = false;
let activePointerId: number | null = null;
stage.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (target instanceof Element && target.closest("button")) return;
  activePointerId = event.pointerId;
  pointerStartY = event.clientY;
  pointerStartX = event.clientX;
  pointerMoved = false;
  stage.classList.add("is-dragging");
  stage.setPointerCapture(event.pointerId);
});
stage.addEventListener("pointermove", (event) => {
  if (activePointerId !== event.pointerId || !stage.hasPointerCapture(event.pointerId)) return;
  pointerMoved ||= Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY) > 8;
});
stage.addEventListener("pointerup", (event) => {
  if (activePointerId !== event.pointerId) return;
  activePointerId = null;
  stage.classList.remove("is-dragging");
  if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  const deltaY = event.clientY - pointerStartY;
  if (Math.abs(deltaY) > 34) {
    selectBook(activeIndex + (deltaY < 0 ? 1 : -1));
    return;
  }
  if (pointerMoved) return;
  const bounds = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(bookInstances.map((book) => book.hitProxy), false)[0];
  const bookIndex = hit?.object.userData.bookId
    ? PROJECT_BOOKS.findIndex((book) => book.id === hit.object.userData.bookId)
    : -1;
  if (bookIndex === activeIndex) {
    openSelectedBook();
  } else if (bookIndex >= 0) {
    selectBook(bookIndex);
  }
});
stage.addEventListener("pointercancel", () => {
  activePointerId = null;
  stage.classList.remove("is-dragging");
});

addEventListener("keydown", (event) => {
  if (event.target instanceof Element && event.target.closest("[data-music-player]")) return;
  if (event.key === "Escape" && formalMode) {
    event.preventDefault();
    returnToStudy();
  } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
    event.preventDefault();
    selectBook(activeIndex + 1);
  } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
    event.preventDefault();
    selectBook(activeIndex - 1);
  }
});

updateBookDetails();
requestAnimationFrame(() => {
  loading.classList.add("is-ready");
  window.setTimeout(() => {
    loading.hidden = true;
  }, reducedMotion ? 20 : 460);
});

const timer = new THREE.Timer();
timer.connect(document);
function animate(timestamp?: number): void {
  timer.update(timestamp);
  const delta = Math.min(timer.getDelta(), 0.05);
  const amount = reducedMotion ? 1 : 1 - Math.exp(-delta * 5.5);

  for (const instance of bookInstances) {
    const relativeIndex = getRelativeProjectBookIndex(instance.index, activeIndex);
    const pose = projectBookIndexPose(relativeIndex);
    instance.targetPosition.set(...pose.position);
    instance.targetRotation.set(...pose.rotation);
    instance.targetScale.setScalar(pose.scale);
    instance.root.position.lerp(instance.targetPosition, amount);
    instance.root.rotation.x = THREE.MathUtils.lerp(
      instance.root.rotation.x,
      instance.targetRotation.x,
      amount,
    );
    instance.root.rotation.y = THREE.MathUtils.lerp(
      instance.root.rotation.y,
      instance.targetRotation.y,
      amount,
    );
    instance.root.rotation.z = THREE.MathUtils.lerp(
      instance.root.rotation.z,
      instance.targetRotation.z,
      amount,
    );
    instance.root.scale.lerp(instance.targetScale, amount);
  }
  arcaneBookMagic.setIntensity(1);
  arcaneBookMagic.update(timestamp ?? performance.now());

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

addEventListener("resize", () => {
  resizeThreeViewport(renderer, camera);
});
