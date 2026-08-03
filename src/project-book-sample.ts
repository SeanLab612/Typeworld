import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {RectAreaLightUniformsLib} from "three/addons/lights/RectAreaLightUniformsLib.js";
import {createProjectBook} from "./project-book";
import {calibratedExposure} from "./display-profile";
import {
  currentRenderPixelRatio,
  currentShadowMapSize,
  resizeThreeViewport,
} from "./render-quality";
import {
  PROJECT_BOOK_REVIEW_VIEWS,
  type ProjectBookReviewView,
} from "./project-book-spec";
import "./project-book-sample.css";

const COVER_URL = "/textures/projects/typeworld-volume-01-cover-base-v1.jpg";

const root = document.querySelector<HTMLElement>("#book-sample");
if (!root) throw new Error("Project book sample root was not found");

root.innerHTML = `
  <main class="book-study">
    <p class="book-study__brand">TYPEWORLD · PROJECT BOOK</p>
    <p class="book-study__gate">P1 MATERIAL GATE<br>ORIGINAL SAMPLE · 01</p>
    <section class="book-study__caption" aria-live="polite">
      <p>PROJECTS / MATERIAL STUDY</p>
      <h1>Typeworld, Volume 01</h1>
      <span>Book cloth · letterpress foil · warm page block<br>拖动旋转 · 滚轮缩放</span>
    </section>
    <nav class="book-study__views" aria-label="样书审核视角">
      ${PROJECT_BOOK_REVIEW_VIEWS.map((view) => `
        <button type="button" data-book-view="${view}" aria-pressed="${view === "three-quarter"}">
          ${view === "three-quarter" ? "3/4" : view.toUpperCase()}
        </button>
      `).join("")}
    </nav>
    <div class="book-study__loading" data-book-loading>PREPARING MATERIAL STUDY</div>
  </main>
`;

const stage = root.querySelector<HTMLElement>(".book-study");
const loading = root.querySelector<HTMLElement>("[data-book-loading]");
const viewButtons = Array.from(
  root.querySelectorAll<HTMLButtonElement>("[data-book-view]"),
);
if (!stage || !loading || viewButtons.length !== PROJECT_BOOK_REVIEW_VIEWS.length) {
  throw new Error("Project book review scaffold is incomplete");
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10090a);
scene.fog = new THREE.FogExp2(0x10090a, 0.075);

const camera = new THREE.PerspectiveCamera(31, innerWidth / innerHeight, 0.01, 30);
camera.position.set(2.42, 0.94, 3.22);

const renderer = new THREE.WebGLRenderer({antialias: true, alpha: false});
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute("aria-label", "Typeworld 项目书材质样本；可旋转和缩放");
renderer.setPixelRatio(currentRenderPixelRatio());
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = calibratedExposure(0.95);
stage.prepend(renderer.domElement);

RectAreaLightUniformsLib.init();
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.enablePan = false;
controls.minDistance = 2.15;
controls.maxDistance = 5.6;
controls.target.set(0, 0.04, 0);

scene.add(new THREE.HemisphereLight(0x9c86a0, 0x28130e, 0.58));

const keyLight = new THREE.SpotLight(0xffd5a0, 18, 9, 0.46, 0.72, 1.35);
keyLight.position.set(2.3, 3.4, 3.6);
keyLight.target.position.set(-0.1, 0.08, 0);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(currentShadowMapSize(), currentShadowMapSize());
keyLight.shadow.bias = -0.00015;
scene.add(keyLight, keyLight.target);

const fillLight = new THREE.RectAreaLight(0xb7c7e8, 3.2, 2.3, 3.2);
fillLight.position.set(-2.2, 0.65, 2.1);
fillLight.lookAt(0, 0.05, 0);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xd79866, 2.1);
rimLight.position.set(-2.8, 2.6, -2.8);
scene.add(rimLight);

const spineLightTarget = new THREE.Object3D();
spineLightTarget.position.set(-0.42, 0.02, 0);
scene.add(spineLightTarget);
const spineLight = new THREE.SpotLight(0xffbd7d, 8.6, 8, 0.55, 0.84, 1.45);
spineLight.position.set(-3.3, 1.65, 2.25);
spineLight.target = spineLightTarget;
scene.add(spineLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(16, 16),
  new THREE.MeshStandardMaterial({
    color: 0x21100e,
    roughness: 0.91,
    metalness: 0,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.005;
floor.receiveShadow = true;
scene.add(floor);

const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 8),
  new THREE.MeshStandardMaterial({
    color: 0x1a0b0d,
    roughness: 1,
    metalness: 0,
  }),
);
backdrop.position.set(0, 1.7, -2.5);
scene.add(backdrop);

const cameraViews: Readonly<Record<ProjectBookReviewView, {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
}>> = {
  "three-quarter": {
    position: new THREE.Vector3(2.42, 0.94, 3.22),
    target: new THREE.Vector3(-0.04, 0.04, 0),
  },
  front: {
    position: new THREE.Vector3(0, 0.08, 3.58),
    target: new THREE.Vector3(0, 0.03, 0),
  },
  spine: {
    position: new THREE.Vector3(-3.2, 0.42, 1.55),
    target: new THREE.Vector3(-0.25, 0.02, 0),
  },
  pages: {
    position: new THREE.Vector3(3.2, 0.42, 1.55),
    target: new THREE.Vector3(0.24, 0.02, 0),
  },
};

const desiredCameraPosition = camera.position.clone();
const desiredCameraTarget = controls.target.clone();
let cameraTransitionActive = false;
const currentOrbit = new THREE.Spherical();
const desiredOrbit = new THREE.Spherical();
const currentOrbitOffset = new THREE.Vector3();
const desiredOrbitOffset = new THREE.Vector3();

function selectView(view: ProjectBookReviewView, immediate = false): void {
  const preset = cameraViews[view];
  desiredCameraPosition.copy(preset.position);
  desiredCameraTarget.copy(preset.target);
  if (immediate) {
    camera.position.copy(desiredCameraPosition);
    controls.target.copy(desiredCameraTarget);
    cameraTransitionActive = false;
  } else {
    cameraTransitionActive = true;
  }
  for (const button of viewButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.bookView === view));
  }
  const url = new URL(location.href);
  url.searchParams.set("view", view);
  history.replaceState(null, "", url);
}

for (const button of viewButtons) {
  button.addEventListener("click", () => {
    const view = button.dataset.bookView as ProjectBookReviewView | undefined;
    if (view && PROJECT_BOOK_REVIEW_VIEWS.includes(view)) selectView(view);
  });
}

renderer.domElement.addEventListener("pointerdown", () => {
  cameraTransitionActive = false;
});

const requestedView = new URLSearchParams(location.search).get("view");
if (
  requestedView
  && PROJECT_BOOK_REVIEW_VIEWS.includes(requestedView as ProjectBookReviewView)
) {
  selectView(requestedView as ProjectBookReviewView, true);
}

const textureLoader = new THREE.TextureLoader();
void textureLoader.loadAsync(COVER_URL).then((coverArtwork) => {
  coverArtwork.minFilter = THREE.LinearMipmapLinearFilter;
  coverArtwork.magFilter = THREE.LinearFilter;
  coverArtwork.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const book = createProjectBook({coverArtwork});
  book.rotation.set(-0.035, -0.16, -0.018);
  book.position.y = -0.073;
  scene.add(book);
  requestAnimationFrame(() => {
    loading.classList.add("is-ready");
    window.setTimeout(() => {
      loading.hidden = true;
    }, 460);
  });
}).catch((error: unknown) => {
  loading.textContent = "MATERIAL STUDY FAILED TO LOAD";
  throw error;
});

const timer = new THREE.Timer();
timer.connect(document);
function animate(timestamp?: number): void {
  timer.update(timestamp);
  const delta = Math.min(timer.getDelta(), 0.05);
  if (cameraTransitionActive) {
    const amount = 1 - Math.exp(-delta * 4.8);
    controls.target.lerp(desiredCameraTarget, amount);
    currentOrbitOffset.subVectors(camera.position, controls.target);
    desiredOrbitOffset.subVectors(desiredCameraPosition, desiredCameraTarget);
    currentOrbit.setFromVector3(currentOrbitOffset);
    desiredOrbit.setFromVector3(desiredOrbitOffset);
    const thetaDelta = THREE.MathUtils.euclideanModulo(
      desiredOrbit.theta - currentOrbit.theta + Math.PI,
      Math.PI * 2,
    ) - Math.PI;
    currentOrbit.radius = THREE.MathUtils.lerp(
      currentOrbit.radius,
      desiredOrbit.radius,
      amount,
    );
    currentOrbit.phi = THREE.MathUtils.lerp(currentOrbit.phi, desiredOrbit.phi, amount);
    currentOrbit.theta += thetaDelta * amount;
    camera.position.copy(controls.target).add(currentOrbitOffset.setFromSpherical(currentOrbit));
    if (
      camera.position.distanceToSquared(desiredCameraPosition) < 0.00002
      && controls.target.distanceToSquared(desiredCameraTarget) < 0.00002
    ) {
      camera.position.copy(desiredCameraPosition);
      controls.target.copy(desiredCameraTarget);
      cameraTransitionActive = false;
    }
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

addEventListener("resize", () => {
  resizeThreeViewport(renderer, camera);
});
