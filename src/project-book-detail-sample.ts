import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {RectAreaLightUniformsLib} from "three/addons/lights/RectAreaLightUniformsLib.js";
import {createArcaneBookMagic} from "./book-magic-effect";
import {createProjectBookDetail} from "./project-book-detail";
import {loadProjectCover} from "./project-cover-loader";
import {calibratedExposure} from "./display-profile";
import {
  currentRenderPixelRatio,
  currentShadowMapSize,
  resizeThreeViewport,
} from "./render-quality";
import {
  clampProjectBookPageIndex,
  getProjectBookPageLabel,
  parseProjectBookDetailQuery,
  PROJECT_BOOK_DETAIL_LEAF_COUNT,
  type ProjectBookDetailMode,
} from "./project-book-detail-state";
import {PROJECT_BOOKS} from "./project-books-data";
import {
  hasStudyOrigin,
  projectBooksIndexUrl,
  type ProjectBooksSurface,
} from "./project-books-routing";
import {
  PROJECT_BOOK_REVIEW_VIEWS,
  type ProjectBookReviewView,
} from "./project-book-spec";
import {
  canReturnThroughHistory,
  prefetchUrl,
  prefersReducedMotion,
  restoreAfterPageShow,
} from "./project-experience";
import {
  readSitePreferences,
  writeSitePreferences,
} from "./site-preferences";
import {resolveSafeProjectHref} from "./safe-project-link";
import "./project-transition.css";
import "./project-book-detail-sample.css";

const PAGE_TURN_AUDIO_URL = "/audio/paper/page-turn.mp3";

const root = document.querySelector<HTMLElement>("#book-detail-sample");
if (!root) throw new Error("Project book detail sample root was not found");
const surface: ProjectBooksSurface = root.dataset.mode === "formal" ? "formal" : "sample";
const formalMode = surface === "formal";
const fromStudy = formalMode && hasStudyOrigin(location.search);
const requestedDetailState = parseProjectBookDetailQuery(location.search);
const reducedMotion = prefersReducedMotion();

const requestedBookId = new URLSearchParams(location.search).get("book");
const selectedBook = PROJECT_BOOKS.find((book) => book.id === requestedBookId)
  ?? PROJECT_BOOKS[0]!;

root.innerHTML = `
  <main class="book-detail-study">
    <p class="book-detail-study__brand">TYPEWORLD LIBRARY · READING ROOM</p>
    <p class="book-detail-study__gate" data-detail-gate></p>
    <section class="book-detail-study__title">
      <p data-detail-kind></p>
      <h1 data-detail-title></h1>
      <span data-detail-subtitle></span>
      <nav class="book-detail-study__links" data-detail-links aria-label="书籍链接"></nav>
    </section>
    <nav class="book-detail-study__views" data-detail-views aria-label="单本书观察视角"></nav>
    <nav class="book-detail-study__controls" aria-label="书籍控制">
      <button type="button" data-return-index>RETURN TO INDEX</button>
      <button type="button" data-open-book>OPEN BOOK</button>
      <button type="button" data-previous-page hidden>PREVIOUS PAGE</button>
      <button type="button" data-next-page hidden>NEXT PAGE</button>
      <button type="button" data-close-book hidden>CLOSE BOOK</button>
      <button type="button" data-project-sound aria-pressed="false">SOUND ON</button>
    </nav>
    <p class="book-detail-study__hint">拖动旋转 · 滚轮缩放 · 点击封面打开 · ← / → 翻页</p>
    <p class="book-detail-study__page" data-page-label>01 / 04</p>
    <div class="book-detail-study__loading" data-detail-loading></div>
  </main>
`;

const stage = root.querySelector<HTMLElement>(".book-detail-study");
const gate = root.querySelector<HTMLElement>("[data-detail-gate]");
const detailKind = root.querySelector<HTMLElement>("[data-detail-kind]");
const detailTitle = root.querySelector<HTMLElement>("[data-detail-title]");
const detailSubtitle = root.querySelector<HTMLElement>("[data-detail-subtitle]");
const detailLinks = root.querySelector<HTMLElement>("[data-detail-links]");
const detailViews = root.querySelector<HTMLElement>("[data-detail-views]");
const loading = root.querySelector<HTMLElement>("[data-detail-loading]");
const returnButton = root.querySelector<HTMLButtonElement>("[data-return-index]");
const openButton = root.querySelector<HTMLButtonElement>("[data-open-book]");
const previousButton = root.querySelector<HTMLButtonElement>("[data-previous-page]");
const nextButton = root.querySelector<HTMLButtonElement>("[data-next-page]");
const closeButton = root.querySelector<HTMLButtonElement>("[data-close-book]");
const soundButton = root.querySelector<HTMLButtonElement>("[data-project-sound]");
const pageLabel = root.querySelector<HTMLElement>("[data-page-label]");
if (
  !stage
  || !gate
  || !detailKind
  || !detailTitle
  || !detailSubtitle
  || !detailLinks
  || !detailViews
  || !loading
  || !returnButton
  || !openButton
  || !previousButton
  || !nextButton
  || !closeButton
  || !soundButton
  || !pageLabel
) {
  throw new Error("Project book detail review scaffold is incomplete");
}
stage.classList.toggle("is-formal", formalMode);
gate.append(
  document.createTextNode(formalMode ? "TYPEWORLD LIBRARY" : "P3 OPEN BOOK GATE"),
  document.createElement("br"),
  document.createTextNode(selectedBook.volumeLabel.toUpperCase()),
);
detailKind.textContent = selectedBook.kind === "project"
  ? "SELECTED LIBRARY VOLUME"
  : "RESERVED LIBRARY VOLUME";
detailTitle.textContent = selectedBook.title;
detailSubtitle.textContent = selectedBook.subtitle;
for (const link of selectedBook.links) {
  const safeHref = resolveSafeProjectHref(link.href, location.href);
  if (!safeHref) continue;
  const anchor = document.createElement("a");
  anchor.href = safeHref;
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  anchor.textContent = link.label;
  detailLinks.append(anchor);
}
const viewButtons = PROJECT_BOOK_REVIEW_VIEWS.map((view) => {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.detailView = view;
  button.setAttribute("aria-pressed", String(view === "three-quarter"));
  button.textContent = view === "three-quarter" ? "3/4" : view.toUpperCase();
  detailViews.append(button);
  return button;
});
loading.textContent = formalMode
  ? "RETRIEVING THE LIBRARY VOLUME"
  : "PREPARING THE LIBRARY VOLUME";
restoreAfterPageShow(stage, "is-leaving");
prefetchUrl(projectBooksIndexUrl(surface, selectedBook.id, {fromStudy}));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10090a);
scene.fog = new THREE.FogExp2(0x10090a, 0.058);

const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.01, 30);
camera.position.set(0.25, 0.35, 5.1);
const cameraTarget = new THREE.Vector3(0, 0, 0);
camera.lookAt(cameraTarget);

const renderer = new THREE.WebGLRenderer({antialias: true, alpha: false});
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute("aria-label", "Typeworld 书籍详情；可旋转、缩放或打开阅读");
renderer.setPixelRatio(currentRenderPixelRatio());
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = calibratedExposure(1);
stage.prepend(renderer.domElement);

RectAreaLightUniformsLib.init();
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.enablePan = false;
controls.minDistance = 2.15;
controls.maxDistance = 5.6;
controls.target.copy(cameraTarget);

scene.add(new THREE.HemisphereLight(0x9d8ba7, 0x28130e, 0.62));

const keyTarget = new THREE.Object3D();
keyTarget.position.set(0, -0.2, 0);
scene.add(keyTarget);
const keyLight = new THREE.SpotLight(0xffd5a2, 23, 10, 0.56, 0.8, 1.3);
keyLight.position.set(2.8, 3.8, 4.1);
keyLight.target = keyTarget;
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(currentShadowMapSize(), currentShadowMapSize());
scene.add(keyLight);

const fillLight = new THREE.RectAreaLight(0xa6badb, 4.2, 3.2, 2.6);
fillLight.position.set(-2.7, 1.2, 2.1);
fillLight.lookAt(0, -0.2, 0);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xd88d62, 2.4);
rimLight.position.set(-2.4, 2.4, -2.8);
scene.add(rimLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 16),
  new THREE.MeshStandardMaterial({color: 0x21100e, roughness: 0.92, metalness: 0}),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.83;
floor.receiveShadow = true;
scene.add(floor);

const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 8),
  new THREE.MeshStandardMaterial({color: 0x190b0d, roughness: 1, metalness: 0}),
);
backdrop.position.set(0, 1.6, -2.6);
scene.add(backdrop);

const coverResult = await loadProjectCover(
  new THREE.TextureLoader(),
  selectedBook.coverUrl,
  selectedBook.coverColor,
);
const coverArtwork = coverResult.texture;
if (coverResult.degraded) {
  stage.dataset.assetState = "degraded";
  loading.textContent = "LIBRARY VOLUME READY · SIMPLIFIED COVER FALLBACK";
}
coverArtwork.minFilter = THREE.LinearMipmapLinearFilter;
coverArtwork.magFilter = THREE.LinearFilter;
coverArtwork.anisotropy = renderer.capabilities.getMaxAnisotropy();
const detail = createProjectBookDetail(selectedBook, coverArtwork);
scene.add(detail.root);
const arcaneBookMagic = createArcaneBookMagic({
  reducedMotion,
  hardwareConcurrency: navigator.hardwareConcurrency,
});
arcaneBookMagic.attachTo(detail.root);

let mode: ProjectBookDetailMode = "closed";
let pageIndex = 0;
let openProgress = 0;
let targetOpenProgress = 0;
const desiredCameraPosition = camera.position.clone();
const desiredCameraTarget = cameraTarget.clone();
const inspectionCameraPosition = camera.position.clone();
const inspectionCameraTarget = cameraTarget.clone();
const desiredRootPosition = new THREE.Vector3(-0.62, -0.02, 0);
const desiredRootRotation = new THREE.Euler(-0.03, -0.18, -0.025);
const cameraViews: Readonly<Record<ProjectBookReviewView, {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
}>> = {
  "three-quarter": {
    position: new THREE.Vector3(2.15, 0.92, 3.35),
    target: new THREE.Vector3(0.02, 0.04, 0),
  },
  front: {
    position: new THREE.Vector3(-0.48, 0.10, 3.75),
    target: new THREE.Vector3(-0.48, 0.03, 0),
  },
  spine: {
    position: new THREE.Vector3(-3.20, 0.42, 1.55),
    target: new THREE.Vector3(-0.72, 0.02, 0),
  },
  pages: {
    position: new THREE.Vector3(2.70, 0.42, 1.75),
    target: new THREE.Vector3(-0.20, 0.02, 0),
  },
};
let cameraTransitionActive = false;
const closedCoverPivotZ = detail.coverPivot.position.z;
const leafRestingZ = detail.leafPivots.map((pivot) => pivot.position.z);
const leafTurnedBaseZ = Math.max(...leafRestingZ) + 0.002;
detail.root.position.copy(desiredRootPosition);
detail.root.rotation.copy(desiredRootRotation);
const pageTurnVoices = Array.from({length: 4}, () => {
  const audio = new Audio(PAGE_TURN_AUDIO_URL);
  audio.preload = "auto";
  return audio;
});
let sitePreferences = readSitePreferences();
for (const audio of pageTurnVoices) audio.volume = sitePreferences.volume * 0.8;
soundButton.textContent = sitePreferences.soundEnabled ? "SOUND ON" : "SOUND OFF";
soundButton.setAttribute("aria-pressed", String(sitePreferences.soundEnabled));
let pageTurnVoiceIndex = 0;

function selectView(view: ProjectBookReviewView, immediate = false): void {
  if (mode !== "closed") return;
  const preset = cameraViews[view];
  desiredCameraPosition.copy(preset.position);
  desiredCameraTarget.copy(preset.target);
  inspectionCameraPosition.copy(preset.position);
  inspectionCameraTarget.copy(preset.target);
  cameraTransitionActive = !immediate;
  controls.enabled = immediate;
  if (immediate) {
    camera.position.copy(desiredCameraPosition);
    cameraTarget.copy(desiredCameraTarget);
    controls.target.copy(desiredCameraTarget);
    camera.lookAt(cameraTarget);
  }
  for (const button of viewButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.detailView === view));
  }
  const url = new URL(location.href);
  url.searchParams.set("view", view);
  history.replaceState(null, "", url);
}

function updateControls(): void {
  const isOpen = mode === "open" || mode === "opening";
  stage!.classList.toggle("is-open", isOpen);
  openButton!.hidden = isOpen;
  previousButton!.hidden = !isOpen;
  nextButton!.hidden = !isOpen;
  closeButton!.hidden = !isOpen;
  previousButton!.disabled = pageIndex === 0;
  nextButton!.disabled = pageIndex === PROJECT_BOOK_DETAIL_LEAF_COUNT;
  pageLabel!.textContent = getProjectBookPageLabel(pageIndex);
  const url = new URL(location.href);
  if (isOpen) {
    url.searchParams.set("open", "1");
    url.searchParams.set("page", String(pageIndex));
  } else {
    url.searchParams.delete("open");
    url.searchParams.delete("page");
  }
  history.replaceState(null, "", url);
}

function playPaperSound(): void {
  if (!sitePreferences.soundEnabled) return;
  const audio = pageTurnVoices[pageTurnVoiceIndex]!;
  pageTurnVoiceIndex = (pageTurnVoiceIndex + 1) % pageTurnVoices.length;
  audio.pause();
  audio.currentTime = 0;
  void audio.play().catch(() => {
    // Browser autoplay policies may reject non-user-triggered playback.
  });
}

function openBook(withSound = true): void {
  if (mode !== "closed" && mode !== "closing") return;
  inspectionCameraPosition.copy(camera.position);
  inspectionCameraTarget.copy(controls.target);
  mode = "opening";
  targetOpenProgress = 1;
  cameraTransitionActive = false;
  controls.enabled = false;
  desiredCameraPosition.set(0, 0, 4.15);
  desiredCameraTarget.set(0, 0, 0);
  desiredRootPosition.set(0, 0.04, 0);
  desiredRootRotation.set(0, 0, 0);
  if (withSound) playPaperSound();
  updateControls();
}

function closeBook(): void {
  if (mode === "closed" || mode === "closing") return;
  pageIndex = 0;
  mode = "closing";
  targetOpenProgress = 0;
  desiredCameraPosition.copy(inspectionCameraPosition);
  desiredCameraTarget.copy(inspectionCameraTarget);
  controls.enabled = false;
  desiredRootPosition.set(-0.62, -0.02, 0);
  desiredRootRotation.set(-0.03, -0.18, -0.025);
  playPaperSound();
  updateControls();
}

function turnPage(direction: 1 | -1): void {
  if (mode !== "open") return;
  const nextIndex = clampProjectBookPageIndex(pageIndex + direction);
  if (nextIndex === pageIndex) return;
  pageIndex = nextIndex;
  playPaperSound();
  updateControls();
}

function returnToIndex(): void {
  if (
    fromStudy
    && canReturnThroughHistory(document.referrer, location.origin, ["/projects.html"])
  ) {
    stage!.classList.add("is-leaving");
    window.setTimeout(() => history.back(), reducedMotion ? 20 : 280);
    return;
  }
  stage!.classList.add("is-leaving");
  window.setTimeout(() => {
    location.href = projectBooksIndexUrl(surface, selectedBook.id, {fromStudy});
  }, reducedMotion ? 20 : 280);
}

returnButton.addEventListener("click", returnToIndex);
openButton.addEventListener("click", () => openBook());
previousButton.addEventListener("click", () => turnPage(-1));
nextButton.addEventListener("click", () => turnPage(1));
closeButton.addEventListener("click", closeBook);
soundButton.addEventListener("click", () => {
  sitePreferences = {...sitePreferences, soundEnabled: !sitePreferences.soundEnabled};
  writeSitePreferences(sitePreferences);
  soundButton!.textContent = sitePreferences.soundEnabled ? "SOUND ON" : "SOUND OFF";
  soundButton!.setAttribute("aria-pressed", String(sitePreferences.soundEnabled));
});

for (const button of viewButtons) {
  button.addEventListener("click", () => {
    const view = button.dataset.detailView as ProjectBookReviewView | undefined;
    if (view && PROJECT_BOOK_REVIEW_VIEWS.includes(view)) selectView(view);
  });
}

let pointerOrigin: {x: number; y: number} | null = null;
let pointerTravel = 0;
renderer.domElement.addEventListener("pointerdown", (event) => {
  if (mode !== "closed") return;
  pointerOrigin = {x: event.clientX, y: event.clientY};
  pointerTravel = 0;
  cameraTransitionActive = false;
  controls.enabled = true;
});
renderer.domElement.addEventListener("pointermove", (event) => {
  if (!pointerOrigin) return;
  pointerTravel = Math.max(
    pointerTravel,
    Math.hypot(event.clientX - pointerOrigin.x, event.clientY - pointerOrigin.y),
  );
});
renderer.domElement.addEventListener("pointerup", () => {
  pointerOrigin = null;
});

renderer.domElement.addEventListener("click", (event) => {
  if (mode !== "closed") return;
  if (pointerTravel > 5) {
    pointerTravel = 0;
    return;
  }
  const bounds = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.intersectObject(detail.hitProxy, false).length > 0) openBook();
});

const requestedView = new URLSearchParams(location.search).get("view");
if (
  requestedView
  && PROJECT_BOOK_REVIEW_VIEWS.includes(requestedView as ProjectBookReviewView)
) {
  selectView(requestedView as ProjectBookReviewView, true);
} else {
  selectView("three-quarter", true);
}

addEventListener("keydown", (event) => {
  if (event.target instanceof Element && event.target.closest("[data-music-player]")) return;
  if (event.key === "Escape") {
    event.preventDefault();
    if (mode === "closed") returnToIndex();
    else closeBook();
  } else if (event.key === "Enter" && mode === "closed") {
    event.preventDefault();
    openBook();
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    turnPage(1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    turnPage(-1);
  }
});

if (requestedDetailState.open) {
  pageIndex = requestedDetailState.pageIndex;
  openBook(false);
} else {
  updateControls();
}
requestAnimationFrame(() => {
  loading.classList.add("is-ready");
  window.setTimeout(() => {
    loading.hidden = true;
  }, reducedMotion ? 20 : 460);
});

const timer = new THREE.Timer();
timer.connect(document);
const currentQuaternion = new THREE.Quaternion();
const desiredQuaternion = new THREE.Quaternion();

function animate(timestamp?: number): void {
  timer.update(timestamp);
  const delta = Math.min(timer.getDelta(), 0.05);
  const amount = reducedMotion ? 1 : 1 - Math.exp(-delta * 5.2);
  openProgress = THREE.MathUtils.lerp(openProgress, targetOpenProgress, amount);
  arcaneBookMagic.setIntensity(1 - openProgress);
  arcaneBookMagic.update(timestamp ?? performance.now());
  detail.coverPivot.rotation.y = -Math.PI * 0.985 * openProgress;
  detail.coverPivot.position.z = THREE.MathUtils.lerp(
    closedCoverPivotZ,
    0.004,
    THREE.MathUtils.smoothstep(openProgress, 0.35, 0.92),
  );
  detail.leftPagePivot.scale.x = THREE.MathUtils.smoothstep(openProgress, 0.22, 0.82);

  detail.leafPivots.forEach((pivot, index) => {
    const targetRotation = index < pageIndex ? -Math.PI * 0.985 : 0;
    pivot.rotation.y = THREE.MathUtils.lerp(pivot.rotation.y, targetRotation, amount * 1.2);
    const targetZ = index < pageIndex
      ? leafTurnedBaseZ + index * 0.0025
      : leafRestingZ[index]!;
    pivot.position.z = THREE.MathUtils.lerp(pivot.position.z, targetZ, amount * 1.2);
  });

  detail.root.position.lerp(desiredRootPosition, amount);
  currentQuaternion.setFromEuler(detail.root.rotation);
  desiredQuaternion.setFromEuler(desiredRootRotation);
  currentQuaternion.slerp(desiredQuaternion, amount);
  detail.root.rotation.setFromQuaternion(currentQuaternion);
  if (mode === "closed" && controls.enabled && !cameraTransitionActive) {
    controls.update();
    cameraTarget.copy(controls.target);
    inspectionCameraPosition.copy(camera.position);
    inspectionCameraTarget.copy(controls.target);
  } else {
    camera.position.lerp(desiredCameraPosition, amount);
    cameraTarget.lerp(desiredCameraTarget, amount);
    camera.lookAt(cameraTarget);
    if (
      mode === "closed"
      && cameraTransitionActive
      && camera.position.distanceToSquared(desiredCameraPosition) < 0.00002
      && cameraTarget.distanceToSquared(desiredCameraTarget) < 0.00002
    ) {
      camera.position.copy(desiredCameraPosition);
      cameraTarget.copy(desiredCameraTarget);
      controls.target.copy(desiredCameraTarget);
      controls.enabled = true;
      cameraTransitionActive = false;
    }
  }

  if (mode === "opening" && openProgress > 0.995) {
    mode = "open";
    updateControls();
  } else if (mode === "closing" && openProgress < 0.005) {
    mode = "closed";
    camera.position.copy(inspectionCameraPosition);
    cameraTarget.copy(inspectionCameraTarget);
    controls.target.copy(inspectionCameraTarget);
    controls.enabled = true;
    updateControls();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

addEventListener("resize", () => {
  resizeThreeViewport(renderer, camera);
});
