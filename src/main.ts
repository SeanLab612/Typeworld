import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";
import {mergeVertices} from "three/addons/utils/BufferGeometryUtils.js";
import keyboardSpec from "../specs/keyboard-layout.json";
import {
  drawerTravel,
  lampFlicker,
  smoothEnvironmentProgress,
} from "./phase6-environment";
import {samplePaperDeformation} from "./paper-surface";
import {
  createFirePaperEffect,
  type FirePaperEffectRuntime,
} from "./fire-paper-effect";
import {
  applyFireArchiveTransaction,
  createFireTriggerSnapshot,
  sampleFirePaperTimeline,
  type FireTriggerSnapshot,
} from "./fire-paper-state";
import {
  applySmileArchiveTransaction,
  createSmileTriggerSnapshot,
  sampleSmilePaperTimeline,
  shouldDismissSmilePaperForInput,
  type SmileTriggerSnapshot,
} from "./smile-paper-state";
import {sampleMechanismPose} from "./phase2-motion";
import type {GreenOvergrowthRuntime} from "./green-overgrowth";
import type {SnowFrostRuntime} from "./snow-frost";
import type {FlowerBloomRuntime} from "./flower-bloom";
import {
  buildRoomEnvironment,
  type RoomEnvironment,
  type RoomNote,
} from "./room-environment";
import {
  ARCHIVE_VISIBLE_CAPACITY,
  archiveDocument,
  createCommandDocument,
  createFreeformDocument,
  documentsForDrawer,
  findCommand,
  hasArchivedCommand,
  isDrawerVisuallyFull,
  visiblePaperCount,
  type ArchiveDocument,
  type ArchiveDrawer,
  type ArchiveSnapshot,
  type CommandDefinition,
} from "./phase7-content";
import {
  formatDiscoveredWords,
  formatKeywordArchiveSummary,
} from "./award-copy";
import {
  loadArchiveSnapshot,
  persistArchiveSnapshot,
} from "./archive-runtime";
import {soundPlanForKey, TypewriterAudioController} from "./typewriter-audio";
import {
  applyTypewriterKey,
  createTypewriterState,
  InputQueue,
  paperText,
  type QueuedInput,
  type TypewriterKey,
  type TypewriterState,
} from "./typewriter-state";
import {
  canRouteTypewriterExperienceInput,
  shouldRouteTypewriterKey,
  type TypewriterFocusTarget,
} from "./typewriter-focus";
import {
  extendPaperFromBottom,
  glyphHorizontalScale,
  isSafariBrowser,
  mobileTypingPaperRowWindow,
  typingPaperLayoutForBrowser,
  typingPaperRowWindow,
} from "./typing-paper-layout";
import {
  ExperienceDirector,
  findSceneCommand,
  resolveSceneInputHandoff,
  sceneCommandArchiveDefinition,
  type SceneCommandDefinition,
  type SceneTransitionPhase,
} from "./phase8-experience";
import {calibratedExposure} from "./display-profile";
import {currentRenderPixelRatio, resizeThreeViewport} from "./render-quality";
import {restoreAfterPageShow} from "./project-experience";
import {
  readSitePreferences,
  writeSitePreferences,
} from "./site-preferences";
import {shouldCloseSelectedDrawer} from "./site-section-state";
import {drawerHitTargetLayout} from "./drawer-hit-target";
import {mechanismDurationMs} from "./typewriter-input-timing";
import {
  ARCHIVE_PRINT_PAGE_CSS,
  archivePaperFilename,
} from "./archive-paper-export";
import {
  archiveDisplayTitle,
  archiveDocumentPages,
  archiveDocumentSerial,
  archiveListTitle,
  archivePageLabel,
  archiveTextExcerpt,
} from "./archive-paper-layout";
import {
  FIRST_VISIT_GREETING,
  FIRST_VISIT_MOBILE_GREETING,
  FIRST_VISIT_DESKTOP_READY_MESSAGE,
  FIRST_VISIT_MOBILE_READY_MESSAGE,
  firstVisitMechanismDuration,
  isFirstVisitSpotlightActive,
  markFirstVisitOnboardingSeen,
  shouldRunFirstVisitOnboarding,
  shouldDismissFirstVisitForLibrary,
  type FirstVisitOnboardingPhase,
} from "./first-visit-onboarding";
import {
  immersiveChromeMessage,
  isShellActivityMessage,
  shouldHideImmersiveChrome,
} from "./immersive-chrome-state";
import {
  DEFAULT_HOME_ENTRIES,
  findDefaultHomeEntry,
  type DefaultHomeEntry,
} from "./home-library-content";
import {hasVisitedLibrary, markLibraryVisited} from "./library-visit";
import {
  mobileKeyboardInset,
  reconcileMobileInput,
} from "./mobile-typewriter-input";
import {
  mobileLibrarySelectionDirection,
  sampleMobileLibraryPageDrag,
  shouldCommitMobileLibraryPage,
  type MobileLibraryPageDirection,
} from "./mobile-library-gesture";
import {
  canBeginLibraryJourney,
  libraryJourneyAutoplayProgress,
  libraryJourneyBookProgress,
  libraryJourneyCameraProgress,
  nextLibraryJourneyTarget,
  shouldCompleteLibraryJourney,
  shouldRestoreLibraryHero,
} from "./library-journey";
import {getRelativeProjectBookIndex, PROJECT_BOOKS} from "./project-books-data";
import {projectBookIndexPose} from "./project-book-index-layout";
import {createProjectBookDetail, type ProjectBookDetail} from "./project-book-detail";
import {PROJECT_BOOK_DIMENSIONS} from "./project-book-spec";
import {loadProjectCover} from "./project-cover-loader";
import {
  clampProjectBookPageIndex,
  getProjectBookPageLabel,
} from "./project-book-detail-state";
import "./project-transition.css";
import "./style.css";

const MODEL_URL = "/models/typewriter-interactive.glb";
const VENDOR_DESK_URL = "/models/vendor/wooden-retro-desk.glb";
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ROOM_BOOKCASE_URL = "/models/vendor/poly-haven-shelf-01/Shelf_01_1k.gltf";
const PET_SEAL_URL = "/textures/ui/pet-archive-seal-runtime-v2.png";
const ROOM_TYPEWRITER_STUDY_URL = "/textures/room/typewriter-study-runtime.jpg";
const ROOM_WORD_RECORD_URL = "/textures/room/word-record-runtime-v1.jpg";
const CARRIAGE_STEP_METERS = 0.00455;
const PAPER_COLUMNS = 35;
const PAPER_ROWS = 12;
const PAPER_MAX_ROWS = 60;
const keys = keyboardSpec.keys as TypewriterKey[];
const keysByCode = new Map(keys.map((key) => [key.code, key]));
const keysById = new Map(keys.map((key) => [key.id, key]));

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app not found");

app.innerHTML = `
  <main class="viewport">
    <section class="experience-loader" data-experience-loader aria-live="polite">
      <div>
        <p>TYPEWORLD · INTERACTIVE ARCHIVE</p>
        <strong data-loading-line>正在唤醒打字机</strong>
        <span><i data-loading-progress></i></span>
      </div>
    </section>
    <section class="experience-entry" data-experience-entry hidden aria-label="进入 Typeworld">
      <button type="button" data-experience-enter>
        <strong>CLICK TO WAKE THE TYPEWRITER</strong>
        <span>点击唤醒打字机</span>
      </button>
    </section>
    <button type="button" class="first-visit-accelerate" data-first-visit-accelerate hidden>
      FINISH THE NOTE <span>快速完成短笺</span>
    </button>
    <nav class="site-view-nav" aria-label="场景视角">
      <button type="button" data-site-view="default" aria-pressed="true">
        <span>01</span> 默认
      </button>
      <button type="button" data-site-view="left" aria-pressed="false">
        <span>02</span> 左抽屉
      </button>
      <button type="button" data-site-view="right" aria-pressed="false">
        <span>03</span> 右抽屉
      </button>
    </nav>
    <section class="site-controls" aria-label="打字机控制">
      <p id="status" aria-live="polite">正在检查交互模型…</p>
      <div class="site-control-actions">
        <button type="button" data-library-enter>OPEN LIBRARY · 打开书架</button>
        <button type="button" data-reset disabled>换一张纸</button>
        <button type="button" data-audio-toggle>声音开启</button>
        <label class="volume-control" aria-label="音量">
          <input id="volume" type="range" min="0" max="1" step="0.01" value="0.58">
        </label>
      </div>
    </section>
    <section class="mobile-typewriter-input" data-mobile-typewriter-input aria-label="移动端英文输入">
      <label>
        <span>TYPE AN ENGLISH WORD</span>
        <input
          type="text"
          data-mobile-typewriter-field
          inputmode="text"
          enterkeyhint="go"
          lang="en"
          autocapitalize="none"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          aria-describedby="mobile-typewriter-feedback"
          placeholder="Tap here to type / 点击输入"
        >
      </label>
      <button type="button" data-mobile-typewriter-enter>ENTER</button>
      <p id="mobile-typewriter-feedback" data-mobile-typewriter-feedback aria-live="polite">
        英文系统键盘输入 · 机械结构会逐字响应
      </p>
    </section>
    <button type="button" class="library-cue" data-library-cue aria-label="向下滚动进入书库">
      <span>SCROLL TO THE LIBRARY</span>
      <small>向下滚动，走近书架</small>
      <i aria-hidden="true"></i>
    </button>
    <section class="library-selection" data-library-selection hidden aria-live="polite">
      <p>TYPEWORLD LIBRARY · ${String(PROJECT_BOOKS.length).padStart(2, "0")} VOLUMES</p>
      <span data-library-volume>VOLUME 01</span>
      <h2 data-library-title></h2>
      <p data-library-subtitle></p>
      <small>滚动选择 · 点击书本打开 · Esc 返回书房</small>
    </section>
    <button
      type="button"
      class="library-mobile-back"
      data-library-touch-back
      aria-label="返回"
      hidden
    >BACK</button>
    <div class="engineering-hooks" hidden aria-hidden="true">
      <p id="paper-preview">纸张为空</p>
      <p id="performance">FPS -- · Draw -- · Triangles --</p>
      <button type="button" data-demo disabled>演示 green</button>
      <button type="button" data-return disabled>回车换行</button>
      <button type="button" data-drawer-left disabled>打开左抽屉</button>
      <button type="button" data-drawer-right disabled>打开右抽屉</button>
    </div>
    <div class="discovery-progress" aria-live="polite">
      <strong data-discovery-count>0 WORDS DISCOVERED</strong>
    </div>
    <p class="typing-hint">敲击键帽，或直接使用键盘输入</p>
    <p class="asset-credit">
      <a href="https://sketchfab.com/3d-models/wooden-retro-desk-1f0eb4285d4d4745955083df1031996d" target="_blank" rel="noreferrer">Wooden Retro Desk</a>
      · Evan Petrov ·
      <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>
      · textures resized and interaction-bound
    </p>
    <section class="paper-presentation" data-paper-presentation hidden aria-label="打印完成的纸张">
      <article class="presented-paper">
        <header>
          <p>TYPEWORLD ARCHIVE</p>
          <span data-paper-mock>ARCHIVE COPY</span>
        </header>
        <h2 data-paper-title></h2>
        <pre data-paper-content></pre>
        <div class="paper-actions">
          <div class="paper-pagination" data-paper-pagination hidden>
            <button type="button" data-paper-previous aria-label="上一页">PREV</button>
            <span data-paper-page-label>01 / 01</span>
            <button type="button" data-paper-next aria-label="下一页">NEXT</button>
          </div>
          <button type="button" data-paper-download hidden>下载 PNG</button>
          <button type="button" data-paper-print hidden>打印</button>
          <button type="button" data-paper-archive>收进抽屉并换纸</button>
        </div>
      </article>
    </section>
    <aside class="archive-panel" data-archive-panel aria-label="纸张与档案导航">
      <header>
        <div>
          <p>TYPEWORLD ARCHIVE</p>
          <h2 data-archive-title>选择一张纸</h2>
        </div>
        <button type="button" data-archive-close hidden aria-label="返回默认">返回</button>
      </header>
      <div class="archive-list" data-archive-list></div>
    </aside>
    <aside class="room-note" data-room-note hidden aria-live="polite">
      <p>WALL ARCHIVE</p>
      <strong data-room-note-title></strong>
      <span data-room-note-body></span>
    </aside>
    <div class="scene-transition" data-scene-transition aria-hidden="true"></div>
    <section class="scene-hud" data-scene-hud hidden aria-label="沉浸式场景控制">
      <div>
        <p>TYPEWRITER SKIN</p>
        <strong>GREEN · OVERGROWTH</strong>
      </div>
      <button type="button" data-scene-exit>返回桌面</button>
    </section>
  </main>
`;

const viewport = document.querySelector<HTMLElement>(".viewport");
const statusElement = document.querySelector<HTMLElement>("#status");
const paperPreview = document.querySelector<HTMLElement>("#paper-preview");
const performanceElement = document.querySelector<HTMLElement>("#performance");
const volumeInput = document.querySelector<HTMLInputElement>("#volume");
const audioToggle = document.querySelector<HTMLButtonElement>("[data-audio-toggle]");
const drawerLeftButton = document.querySelector<HTMLButtonElement>("[data-drawer-left]");
const drawerRightButton = document.querySelector<HTMLButtonElement>("[data-drawer-right]");
const libraryEnterButton = document.querySelector<HTMLButtonElement>("[data-library-enter]");
const libraryCue = document.querySelector<HTMLButtonElement>("[data-library-cue]");
const librarySelection = document.querySelector<HTMLElement>("[data-library-selection]");
const libraryVolume = document.querySelector<HTMLElement>("[data-library-volume]");
const libraryTitle = document.querySelector<HTMLElement>("[data-library-title]");
const librarySubtitle = document.querySelector<HTMLElement>("[data-library-subtitle]");
const libraryTouchBack = document.querySelector<HTMLButtonElement>("[data-library-touch-back]");
const discoveryCount = document.querySelector<HTMLElement>("[data-discovery-count]");
const paperPresentation = document.querySelector<HTMLElement>("[data-paper-presentation]");
const presentedPaper = document.querySelector<HTMLElement>(".presented-paper");
const presentedTitle = document.querySelector<HTMLElement>("[data-paper-title]");
const presentedContent = document.querySelector<HTMLElement>("[data-paper-content]");
const presentedMock = document.querySelector<HTMLElement>("[data-paper-mock]");
const paperPagination = document.querySelector<HTMLElement>("[data-paper-pagination]");
const paperPreviousButton = document.querySelector<HTMLButtonElement>("[data-paper-previous]");
const paperNextButton = document.querySelector<HTMLButtonElement>("[data-paper-next]");
const paperPageLabel = document.querySelector<HTMLElement>("[data-paper-page-label]");
const paperArchiveButton = document.querySelector<HTMLButtonElement>("[data-paper-archive]");
const paperDownloadButton = document.querySelector<HTMLButtonElement>("[data-paper-download]");
const paperPrintButton = document.querySelector<HTMLButtonElement>("[data-paper-print]");
const archivePanel = document.querySelector<HTMLElement>("[data-archive-panel]");
const archiveTitle = document.querySelector<HTMLElement>("[data-archive-title]");
const archiveList = document.querySelector<HTMLElement>("[data-archive-list]");
const archiveClose = document.querySelector<HTMLButtonElement>("[data-archive-close]");
const siteViewButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-site-view]"),
);
const sceneTransition = document.querySelector<HTMLElement>("[data-scene-transition]");
const sceneHud = document.querySelector<HTMLElement>("[data-scene-hud]");
const sceneExit = document.querySelector<HTMLButtonElement>("[data-scene-exit]");
const experienceLoader = document.querySelector<HTMLElement>("[data-experience-loader]");
const loadingLine = document.querySelector<HTMLElement>("[data-loading-line]");
const loadingProgress = document.querySelector<HTMLElement>("[data-loading-progress]");
const experienceEntry = document.querySelector<HTMLElement>("[data-experience-entry]");
const experienceEnter = document.querySelector<HTMLButtonElement>("[data-experience-enter]");
const firstVisitAccelerate = document.querySelector<HTMLButtonElement>("[data-first-visit-accelerate]");
const mobileTypewriterInput = document.querySelector<HTMLElement>("[data-mobile-typewriter-input]");
const mobileTypewriterField = document.querySelector<HTMLInputElement>("[data-mobile-typewriter-field]");
const mobileTypewriterEnter = document.querySelector<HTMLButtonElement>("[data-mobile-typewriter-enter]");
const mobileTypewriterFeedback = document.querySelector<HTMLElement>("[data-mobile-typewriter-feedback]");
const roomNote = document.querySelector<HTMLElement>("[data-room-note]");
const roomNoteTitle = document.querySelector<HTMLElement>("[data-room-note-title]");
const roomNoteBody = document.querySelector<HTMLElement>("[data-room-note-body]");
if (
  !viewport
  || !statusElement
  || !paperPreview
  || !performanceElement
  || !volumeInput
  || !audioToggle
  || !drawerLeftButton
  || !drawerRightButton
  || !libraryEnterButton
  || !libraryCue
  || !librarySelection
  || !libraryVolume
  || !libraryTitle
  || !librarySubtitle
  || !libraryTouchBack
  || !discoveryCount
  || !paperPresentation
  || !presentedPaper
  || !presentedTitle
  || !presentedContent
  || !presentedMock
  || !paperPagination
  || !paperPreviousButton
  || !paperNextButton
  || !paperPageLabel
  || !paperArchiveButton
  || !paperDownloadButton
  || !paperPrintButton
  || !archivePanel
  || !archiveTitle
  || !archiveList
  || !archiveClose
  || siteViewButtons.length !== 3
  || !sceneTransition
  || !sceneHud
  || !sceneExit
  || !experienceLoader
  || !loadingLine
  || !loadingProgress
  || !experienceEntry
  || !experienceEnter
  || !firstVisitAccelerate
  || !mobileTypewriterInput
  || !mobileTypewriterField
  || !mobileTypewriterEnter
  || !mobileTypewriterFeedback
  || !roomNote
  || !roomNoteTitle
  || !roomNoteBody
) {
  throw new Error("viewport scaffold not found");
}
const statusNode = statusElement;
const paperPreviewNode = paperPreview;
const performanceNode = performanceElement;
const volumeNode = volumeInput;
const audioToggleNode = audioToggle;
const drawerLeftButtonNode = drawerLeftButton;
const drawerRightButtonNode = drawerRightButton;
const libraryEnterButtonNode = libraryEnterButton;
const libraryCueNode = libraryCue;
const librarySelectionNode = librarySelection;
const libraryVolumeNode = libraryVolume;
const libraryTitleNode = libraryTitle;
const librarySubtitleNode = librarySubtitle;
const libraryTouchBackNode = libraryTouchBack;
const discoveryCountNode = discoveryCount;
const paperPresentationNode = paperPresentation;
const presentedPaperNode = presentedPaper;
const presentedTitleNode = presentedTitle;
const presentedContentNode = presentedContent;
const presentedMockNode = presentedMock;
const paperPaginationNode = paperPagination;
const paperPreviousButtonNode = paperPreviousButton;
const paperNextButtonNode = paperNextButton;
const paperPageLabelNode = paperPageLabel;
const paperArchiveButtonNode = paperArchiveButton;
const paperDownloadButtonNode = paperDownloadButton;
const paperPrintButtonNode = paperPrintButton;
const archivePanelNode = archivePanel;
const archiveTitleNode = archiveTitle;
const archiveListNode = archiveList;
const archiveCloseNode = archiveClose;
const siteViewButtonNodes = siteViewButtons;
const sceneTransitionNode = sceneTransition;
const sceneHudNode = sceneHud;
const sceneExitNode = sceneExit;
const experienceLoaderNode = experienceLoader;
const loadingLineNode = loadingLine;
const loadingProgressNode = loadingProgress;
const experienceEntryNode = experienceEntry;
const experienceEnterNode = experienceEnter;
const firstVisitAccelerateNode = firstVisitAccelerate;
const mobileTypewriterInputNode = mobileTypewriterInput;
const mobileTypewriterFieldNode = mobileTypewriterField;
const mobileTypewriterEnterNode = mobileTypewriterEnter;
const mobileTypewriterFeedbackNode = mobileTypewriterFeedback;
const roomNoteNode = roomNote;
const roomNoteTitleNode = roomNoteTitle;
const roomNoteBodyNode = roomNoteBody;
const viewportNode = viewport;
restoreAfterPageShow(viewportNode, "is-projects-departing");

interface MechanismBinding {
  key: THREE.Object3D;
  linkage: THREE.Object3D;
  typebar: THREE.Object3D | null;
  keyRestY: number;
  linkageRest: THREE.Quaternion;
  typebarRest: THREE.Quaternion | null;
  pressDepth: number;
  linkageAngle: number;
  strikeAngle: number;
}

interface PaperBinding {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  basePositions: Float32Array;
  horizontalCenter: number;
  horizontalHalfExtent: number;
  verticalAxis: 1 | 2;
  depthAxis: 1 | 2;
  verticalMinimum: number;
  verticalExtent: number;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
}

interface ActiveMechanism {
  input: QueuedInput;
  binding: MechanismBinding;
  startedAt: number;
  durationMs: number;
  committed: boolean;
  startCarriageX: number;
  startPaperFeedLines: number;
}

type DrawerSide = "left" | "right";

interface DrawerBinding {
  pivot: THREE.Object3D | null;
  restZ: number;
  openTravel: number;
  vendorBone: THREE.Object3D | null;
  vendorRestY: number;
  vendorOpenTravel: number;
  openTarget: number;
  openAmount: number;
  button: HTMLButtonElement;
}

const mechanismBindings = new Map<string, MechanismBinding>();
const hitProxies: THREE.Object3D[] = [];
const environmentHitProxies: THREE.Object3D[] = [];
const vendorDrawerHitTargets: Partial<Record<DrawerSide, THREE.Mesh>> = {};
const inputQueue = new InputQueue(24);
const deferredSceneInputQueue = new InputQueue(24);
const localXAxis = new THREE.Vector3(1, 0, 0);
const localYAxis = new THREE.Vector3(0, 1, 0);
const rotationDelta = new THREE.Quaternion();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerStart: {x: number; y: number} | null = null;
interface MobileLibraryGesture {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly startedAt: number;
  currentX: number;
  currentY: number;
}
let mobileLibraryGesture: MobileLibraryGesture | null = null;
let typewriterState = createTypewriterState(PAPER_COLUMNS, PAPER_ROWS, PAPER_MAX_ROWS);
let activeMechanism: ActiveMechanism | null = null;
type ExperienceMode =
  | "typing"
  | "presented"
  | "archiving"
  | "burning"
  | "smiling"
  | "scene-transition";
let experienceMode: ExperienceMode = "typing";
let pendingCommand: CommandDefinition | null = null;
let pendingSceneCommand: SceneCommandDefinition | null = null;
let pendingFireSnapshot: FireTriggerSnapshot | null = null;
let pendingSmileSnapshot: SmileTriggerSnapshot | null = null;
let presentedDocument: ArchiveDocument | null = null;
let presentedPageIndex = 0;
interface PresentedPageTurn {
  readonly targetIndex: number;
  readonly direction: -1 | 1;
  readonly startedAt: number;
  swapped: boolean;
}
let presentedPageTurn: PresentedPageTurn | null = null;
let presentedFromHistory = false;
let presentedShouldArchive = true;
type PresentedNavigation = "default" | "archive";
let presentedNavigation: PresentedNavigation = "archive";
type SiteSection = "default" | ArchiveDrawer;
let activeArchiveDrawer: ArchiveDrawer | null = null;
let pendingArchiveDocumentId: string | null = null;
let archiveDrawerTimer: number | null = null;
let archivePaperTimer: number | null = null;
let archivePanelAnimationTimer: number | null = null;
let archivePanelRestoreTimer: number | null = null;
let explicitLibraryEntryTimer: number | null = null;
let roomNoteTimer: number | null = null;
let roomEnvironment: RoomEnvironment | null = null;
interface LibraryAssetBundle {
  readonly bookcase: THREE.Object3D;
  readonly covers: readonly THREE.Texture[];
}
let libraryAssetBundlePromise: Promise<LibraryAssetBundle> | null = null;
let libraryAssetsAttached = false;
const initialSearchParams = new URLSearchParams(location.search);
const returningFromProjects = initialSearchParams.get("return") === "projects";
const archiveFullQaMode = initialSearchParams.get("qa") === "archive-full";
const greenOvergrowthQaMode = initialSearchParams.get("qa") === "green-overgrowth";
const snowFrostQaMode = initialSearchParams.get("qa") === "snow-frost";
const flowerBloomQaMode = initialSearchParams.get("qa") === "flower-bloom";
const firePaperQaMode = initialSearchParams.get("qa") === "fire-paper";
const smilePaperQaMode = initialSearchParams.get("qa") === "smile-paper";
const firstVisitOnboardingQaMode = initialSearchParams.get("qa") === "first-visit";
const roomTimeOverrideRaw = initialSearchParams.get("room-time");
const roomTimeOverrideValue = roomTimeOverrideRaw === null
  ? Number.NaN
  : Number(roomTimeOverrideRaw);
const roomTimeOverride = Number.isFinite(roomTimeOverrideValue)
  && roomTimeOverrideValue >= 0
  && roomTimeOverrideValue < 24
  ? roomTimeOverrideValue
  : null;

function currentRoomDate(): Date {
  const date = new Date();
  if (roomTimeOverride === null) return date;
  const hour = Math.floor(roomTimeOverride);
  const minute = Math.round((roomTimeOverride - hour) * 60);
  date.setHours(hour, minute, 0, 0);
  return date;
}

let archiveSnapshot: ArchiveSnapshot = loadArchiveSnapshot(localStorage, archiveFullQaMode);
let libraryVisited = hasVisitedLibrary(localStorage);
viewportNode.classList.toggle("is-library-unvisited", !libraryVisited);
showDefaultNavigation();
let ribbonStrikeZone: THREE.Object3D | null = null;
let ribbonRestY = 0;
let carriage: THREE.Object3D | null = null;
let carriageRestX = 0;
let platen: THREE.Object3D | null = null;
let platenRest = new THREE.Quaternion();
let returnLever: THREE.Object3D | null = null;
let returnLeverRest = new THREE.Quaternion();
let bellHammer: THREE.Object3D | null = null;
let bellHammerRest = new THREE.Quaternion();
let bellStartedAt = Number.NEGATIVE_INFINITY;
let paperBinding: PaperBinding | null = null;
let firePaperEffect: FirePaperEffectRuntime | null = null;
let paperActivity = 0;
let currentPaperId = `paper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let activeFireSnapshot: FireTriggerSnapshot | null = null;
let fireStartedAt = Number.NEGATIVE_INFINITY;
let fireBurnProgress = 0;
let fireReplacementProgress = 1;
let fireReplacementLoaded = false;
let firstVisitOnboardingPhase: FirstVisitOnboardingPhase = "off";
let firstVisitOnboardingIndex = 0;
let firstVisitOnboardingStartsAt = Number.POSITIVE_INFINITY;
let firstVisitReplacementStartsAt = Number.POSITIVE_INFINITY;
let firstVisitReplacementProgress = 1;
let firstVisitAccelerated = false;
let firstVisitEnteredAt = Number.POSITIVE_INFINITY;
const firstVisitBufferedInputs: QueuedInput[] = [];
const fireBurnOrigin = new THREE.Vector2(-0.5, 0.72);
let activeSmileSnapshot: SmileTriggerSnapshot | null = null;
let smileStartedAt = Number.NEGATIVE_INFINITY;
let smileDrawProgress = 0;
let smilePaperActive = false;
const drawerBindings: Record<DrawerSide, DrawerBinding> = {
  left: {
    pivot: null,
    restZ: 0,
    openTravel: 0.34,
    vendorBone: null,
    vendorRestY: 0,
    vendorOpenTravel: 0.4224,
    openTarget: 0,
    openAmount: 0,
    button: drawerLeftButtonNode,
  },
  right: {
    pivot: null,
    restZ: 0,
    openTravel: 0.34,
    vendorBone: null,
    vendorRestY: 0,
    vendorOpenTravel: 0.2664,
    openTarget: 0,
    openAmount: 0,
    button: drawerRightButtonNode,
  },
};
type ViewMode = "hero" | "typing" | "archive" | "library" | "scene";
let viewMode: ViewMode = "hero";
const chromeIdleThresholdMs = 4000;
const coarsePointer = matchMedia("(pointer: coarse)").matches;
const mobileViewportQuery = matchMedia("(max-width: 720px)");
const safariPaperRendering = isSafariBrowser(navigator.userAgent, navigator.vendor);
let lastChromeActivityAt = performance.now();
let immersiveChromeHidden = false;
let mobileInputBuffer = "";
let mobileInputComposing = false;
let heroDeskY = 0;
const heroCameraPosition = new THREE.Vector3(0, 0.48, 1.55);
const heroCameraTarget = new THREE.Vector3(0, 0.04, 0);
const typingCameraPosition = new THREE.Vector3(0, 0.46, 0.98);
const typingCameraTarget = new THREE.Vector3(0, 0.16, 0.015);
const mobileHeroCameraPosition = new THREE.Vector3(0, 0.66, 1.82);
const mobileHeroCameraTarget = new THREE.Vector3(0, 0.12, 0.01);
const mobileTypingCameraPosition = new THREE.Vector3(0, 0.66, 1.48);
const mobileTypingCameraTarget = new THREE.Vector3(0, 0.26, 0.015);
const mobileWelcomeCameraPosition = new THREE.Vector3(0, 0.70, 2.04);
const mobileWelcomeCameraTarget = new THREE.Vector3(0, 0.22, 0.01);
const mobileSceneCameraPosition = new THREE.Vector3(0, 0.64, 2.04);
const mobileSceneCameraTarget = new THREE.Vector3(0, 0.12, 0.01);
const archiveCameraPosition = new THREE.Vector3(1.02, 0.70, 2.15);
const archiveCameraTarget = new THREE.Vector3(0.10, -0.16, 0.04);
const libraryCameraPosition = new THREE.Vector3(-1.62, 0.34, 1.36);
const libraryCameraTarget = new THREE.Vector3(-1.62, 0.10, -0.84);
const greenCameraPosition = new THREE.Vector3(0, 0.50, 1.26);
const greenCameraTarget = new THREE.Vector3(0, 0.17, 0);
const heroPointerTarget = new THREE.Vector3(0, 0.03, 0);
const heroLightTarget = new THREE.Vector3(0, 0.03, 0);
const firstVisitLightTarget = new THREE.Vector3(0, 0.11, 0.02);
const heroLightApex = new THREE.Vector3(0, 1.72, 0);
const coneAxis = new THREE.Vector3(0, -1, 0);
const coneDirection = new THREE.Vector3();
const heroDeskPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const heroPointerHit = new THREE.Vector3();
let previousFrameTime = performance.now();
let performanceWindowStartedAt = performance.now();
let performanceFrameCount = 0;
let sitePreferences = readSitePreferences();
const audioController = new TypewriterAudioController();
audioController.setMuted(!sitePreferences.soundEnabled);
audioController.setVolume(sitePreferences.volume);
volumeNode.value = String(sitePreferences.volume);
audioToggleNode.textContent = sitePreferences.soundEnabled ? "声音开启" : "声音关闭";
audioToggleNode.setAttribute("aria-pressed", String(!sitePreferences.soundEnabled));
void audioController.preload();
const experienceDirector = new ExperienceDirector(1600);
let previousSceneTransitionPhase: SceneTransitionPhase = "idle";
let greenRuntime: GreenOvergrowthRuntime | null = null;
let snowRuntime: SnowFrostRuntime | null = null;
let flowerRuntime: FlowerBloomRuntime | null = null;
let effectEnvironmentVisible = false;
let sceneLoadToken = 0;
let typewriterSceneRoot: THREE.Object3D | null = null;
const libraryJourneyStartPosition = new THREE.Vector3();
const libraryJourneyStartTarget = new THREE.Vector3();
let libraryJourneyTargetProgress = 0;
let libraryJourneyDisplayedProgress = 0;
const libraryJourneyAutoplayDurationMs = 3600;
let libraryJourneyAutoplayStartedAt: number | null = null;
let libraryJourneyAutoplayStartProgress = 0;
let libraryJourneySettled = false;
let librarySelectedIndex = 0;
let librarySelectionWheelDelta = 0;
let libraryJourneyReturnViewMode: "hero" | "typing" = "hero";

interface LibraryJourneyBookPose {
  readonly object: THREE.Object3D;
  readonly parent: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly scale: THREE.Vector3;
}

let libraryJourneyBookPoses: LibraryJourneyBookPose[] = [];
interface LibraryBookSlot {
  readonly position: readonly [number, number, number];
  readonly scale: number;
  readonly rotation: readonly [number, number, number];
}

const legacySelectedBookPose = projectBookIndexPose(0);
const librarySelectedBookScale = 2.34;

function libraryBookSlot(relativeIndex: number): LibraryBookSlot {
  const legacyPose = projectBookIndexPose(relativeIndex);
  return {
    position: [
      -0.01 + (legacyPose.position[0] - legacySelectedBookPose.position[0]) * 0.30,
      -0.01 + (legacyPose.position[1] - legacySelectedBookPose.position[1]) * 0.21,
      -1.30 + (legacyPose.position[2] - legacySelectedBookPose.position[2]) * 0.55,
    ],
    scale: legacyPose.scale * (librarySelectedBookScale / legacySelectedBookPose.scale),
    rotation: legacyPose.rotation,
  };
}
type LibraryStage = "index" | "focus" | "opening" | "reading" | "closing";
let libraryStage: LibraryStage = "index";
let libraryFocusProgress = 0;
let libraryDetail: ProjectBookDetail | null = null;
let libraryDetailIndex = -1;
let libraryDetailLoadToken = 0;
let libraryDetailOpenProgress = 0;
let libraryDetailTargetOpenProgress = 0;
let libraryDetailPageIndex = 0;
let libraryPageDragDirection: MobileLibraryPageDirection = 0;
let libraryPageDragProgress = 0;
let libraryDetailClosedCoverZ = 0;
let libraryDetailLeafRestingZ: number[] = [];
let libraryDetailLeafTurnedBaseZ = 0;
const libraryDetailTextureLoader = new THREE.TextureLoader();
const libraryDetailWorldPosition = new THREE.Vector3();
const libraryDetailWorldQuaternion = new THREE.Quaternion();
const libraryDetailTargetScale = new THREE.Vector3();
const libraryBookScreenPosition = new THREE.Vector3();
const libraryJourneyDestinationWorld = new THREE.Vector3();
const libraryJourneyDestinationLocal = new THREE.Vector3();
const libraryJourneyCameraQuaternion = new THREE.Quaternion();
const libraryJourneyParentQuaternion = new THREE.Quaternion();
const libraryJourneyDestinationQuaternion = new THREE.Quaternion();
const libraryJourneyTargetScale = new THREE.Vector3();
const libraryBookTargetPosition = new THREE.Vector3();
const libraryBookTargetQuaternion = new THREE.Quaternion();
const libraryBookSlotRotation = new THREE.Quaternion();
const libraryBookSlotEuler = new THREE.Euler();
const libraryMobileDetailScale = 0.42;
const libraryMobilePageWidth = PROJECT_BOOK_DIMENSIONS.width
  - PROJECT_BOOK_DIMENSIONS.coverOverhang * 2;
const libraryMobileDetailX = -(libraryMobilePageWidth * libraryMobileDetailScale) / 2;

const scene = new THREE.Scene();
const desktopBackground = new THREE.Color(0x100a09);
const desktopFog = new THREE.FogExp2(0x100a09, 0.26);
scene.background = desktopBackground;
scene.fog = desktopFog;

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.01, 20);
camera.position.set(
  innerWidth / innerHeight < 0.8 ? 0 : -1.02,
  innerWidth / innerHeight < 0.8 ? 0.66 : 0.62,
  innerWidth / innerHeight < 0.8 ? 1.82 : 1.52,
);

const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute("aria-label", "Typeworld 打字机输入区域");
renderer.setPixelRatio(currentRenderPixelRatio());
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = calibratedExposure(1.50);
renderer.shadowMap.enabled = true;
viewport.prepend(renderer.domElement);

function focusTypewriterInput(force = false): void {
  if (document.visibilityState !== "visible") return;
  const activeElement = document.activeElement;
  if (activeElement === mobileTypewriterFieldNode) return;
  const pageIsIdle = activeElement === null
    || activeElement === document.body
    || activeElement === document.documentElement;
  if (!force && !pageIsIdle) return;
  renderer.domElement.focus({preventScroll: true});
}

function typewriterFocusTarget(target: EventTarget | null): TypewriterFocusTarget {
  if (!(target instanceof Element)) return "other";
  if (
    target.closest(
      "textarea, select, [contenteditable='true'], input:not([type='button']):not([type='submit']):not([type='reset']):not([type='range'])",
    )
  ) {
    return "editing";
  }
  if (target.closest("button, a, input, [role='button'], [role='slider']")) {
    return "control";
  }
  return "other";
}

function currentProjectedLine(): string {
  const projected = projectedTypewriterState();
  return projected.cells[projected.row]?.join("").replace(/\s+$/u, "") ?? "";
}

function setMobileInputFeedback(message: string, state: "idle" | "error" = "idle"): void {
  mobileTypewriterFeedbackNode.textContent = message;
  mobileTypewriterInputNode.dataset.feedback = state;
}

function keepMobileCaretAtEnd(): void {
  const end = mobileTypewriterFieldNode.value.length;
  mobileTypewriterFieldNode.setSelectionRange(end, end);
}

function syncMobileInputFromPaper(): void {
  const replacesWelcomePaper = firstVisitOnboardingPhase === "typing"
    || firstVisitOnboardingPhase === "waiting"
    || firstVisitOnboardingPhase === "replacing";
  const replacesCompletedSmile = experienceMode === "smiling" && smilePaperActive;
  mobileInputBuffer = replacesWelcomePaper || replacesCompletedSmile
    ? ""
    : currentProjectedLine();
  mobileTypewriterFieldNode.value = mobileInputBuffer;
  requestAnimationFrame(keepMobileCaretAtEnd);
}

function focusMobileTypewriterInput(): void {
  if (!mobileViewportQuery.matches) return;
  syncMobileInputFromPaper();
  mobileTypewriterFieldNode.focus({preventScroll: true});
  keepMobileCaretAtEnd();
}

function updateMobileViewportMetrics(): void {
  const visualViewport = window.visualViewport;
  const visualHeight = visualViewport?.height ?? window.innerHeight;
  const visualOffsetTop = visualViewport?.offsetTop ?? 0;
  const keyboardInset = mobileKeyboardInset(
    window.innerHeight,
    visualHeight,
    visualOffsetTop,
  );
  viewportNode.style.setProperty("--mobile-visual-height", `${Math.round(visualHeight)}px`);
  viewportNode.style.setProperty("--mobile-visual-top", `${Math.round(visualOffsetTop)}px`);
  viewportNode.style.setProperty("--mobile-keyboard-inset", `${keyboardInset}px`);
}

function mobileQueuedInputsForEdit(edit: ReturnType<typeof reconcileMobileInput>["edit"]): QueuedInput[] | null {
  if (!edit) return [];
  if (edit.kind === "backspace") {
    const backspace = keysById.get("BACKSPACE");
    if (!backspace) return null;
    return Array.from({length: edit.count}, () => ({
      key: backspace,
      shifted: false,
      source: "physical" as const,
    }));
  }
  const resolvedInputs: QueuedInput[] = [];
  for (const character of edit.text) {
    const resolved = keyForCharacter(character);
    if (!resolved) return null;
    resolvedInputs.push({...resolved, source: "physical"});
  }
  return resolvedInputs;
}

function routeMobileFieldValue(nextValue: string): boolean {
  const reconciliation = reconcileMobileInput(mobileInputBuffer, nextValue);
  const queuedInputs = mobileQueuedInputsForEdit(reconciliation.edit);
  if (!reconciliation.accepted || queuedInputs === null) {
    mobileTypewriterFieldNode.value = mobileInputBuffer;
    keepMobileCaretAtEnd();
    setMobileInputFeedback(
      reconciliation.reason === "unsupported-character" || queuedInputs === null
        ? "请输入英文字符 · Please switch to an English keyboard"
        : "机械打字机只支持从当前行末继续输入",
      "error",
    );
    return false;
  }
  if (inputQueue.length + queuedInputs.length > inputQueue.maximumLength) {
    mobileTypewriterFieldNode.value = mobileInputBuffer;
    keepMobileCaretAtEnd();
    setMobileInputFeedback("输入稍快 · 请等待机械结构完成当前动作", "error");
    return false;
  }
  mobileInputBuffer = reconciliation.value;
  for (const input of queuedInputs) enqueueInput(input);
  mobileInputBuffer = currentProjectedLine();
  mobileTypewriterFieldNode.value = mobileInputBuffer;
  keepMobileCaretAtEnd();
  setMobileInputFeedback("英文系统键盘输入 · 机械结构会逐字响应");
  return true;
}

function submitMobileInput(): void {
  const enter = keysById.get("ENTER");
  if (!enter) return;
  mobileInputComposing = false;
  if (!routeMobileFieldValue(mobileTypewriterFieldNode.value)) return;
  enqueueInput({key: enter, shifted: false, source: "physical"});
  mobileInputBuffer = "";
  mobileTypewriterFieldNode.value = "";
  mobileTypewriterFieldNode.blur();
  setMobileInputFeedback("已回车 · 正在检查当前英文词语");
}

scene.environment = null;
const cameraTarget = new THREE.Vector3(0, 0.09, 0);

const hemisphereLight = new THREE.HemisphereLight(0xcac7c0, 0x1b1110, 1.75);
scene.add(hemisphereLight);
const ambientFill = new THREE.DirectionalLight(0xe6e8ef, 2.60);
ambientFill.position.set(-2.6, 3.8, 2.5);
scene.add(ambientFill);
const roomBounce = new THREE.DirectionalLight(0xffe3c8, 1.62);
roomBounce.position.set(2.4, 1.7, 1.8);
scene.add(roomBounce);

const heroSpotTarget = new THREE.Object3D();
scene.add(heroSpotTarget);
const heroSpotLight = new THREE.SpotLight(0xffd29a, 7.2, 4.2, 0.36, 0.86, 1.35);
heroSpotLight.castShadow = true;
heroSpotLight.shadow.mapSize.set(1024, 1024);
heroSpotLight.shadow.bias = -0.00012;
heroSpotLight.target = heroSpotTarget;
scene.add(heroSpotLight);

const archiveSpotTarget = new THREE.Object3D();
scene.add(archiveSpotTarget);
const archiveDefaultLightTarget = new THREE.Vector3();
const archiveSpotLight = new THREE.SpotLight(0xffc67f, 0, 5.2, 0.42, 0.72, 1.15);
archiveSpotLight.castShadow = true;
archiveSpotLight.shadow.mapSize.set(1024, 1024);
archiveSpotLight.shadow.bias = -0.00012;
archiveSpotLight.target = archiveSpotTarget;
scene.add(archiveSpotLight);
const libraryBookLight = new THREE.PointLight(0xffd1a1, 0, 3.2, 1.55);
scene.add(libraryBookLight);

const heroConeMaterial = new THREE.MeshBasicMaterial({
  color: 0xffd6a3,
  transparent: true,
  opacity: 0.022,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const heroCone = new THREE.Mesh(
  new THREE.CylinderGeometry(0.012, 0.29, 1, 48, 1, true),
  heroConeMaterial,
);
heroCone.name = "HERO_MOUSE_LIGHT_CONE";
heroCone.renderOrder = 4;
scene.add(heroCone);

interface ArchivePaperStack {
  readonly group: THREE.Group;
  readonly papers: THREE.Mesh[];
  readonly fullBand: THREE.Mesh;
}

type PaperFlightPhase = "hidden" | "extracting" | "presented" | "archiving" | "discarding";

const archiveSheetGeometry = new THREE.BoxGeometry(0.205, 0.0007, 0.16);
const archiveSheetMaterial = new THREE.MeshStandardMaterial({
  color: 0xd9c79e,
  roughness: 0.96,
  metalness: 0,
});
const archiveBandMaterial = new THREE.MeshStandardMaterial({
  color: 0x5d2530,
  roughness: 0.82,
  metalness: 0,
});
const archivePaperStacks: Record<ArchiveDrawer, ArchivePaperStack> = {
  left: {
    group: new THREE.Group(),
    papers: [],
    fullBand: new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.002, 0.16), archiveBandMaterial),
  },
  right: {
    group: new THREE.Group(),
    papers: [],
    fullBand: new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.002, 0.16), archiveBandMaterial),
  },
};
for (const side of ["left", "right"] as const) {
  const stack = archivePaperStacks[side];
  stack.group.name = `ARCHIVE_PAPER_STACK_${side.toUpperCase()}`;
  stack.fullBand.name = `ARCHIVE_PAPER_${side.toUpperCase()}_FULL_BAND`;
  stack.fullBand.visible = false;
  stack.group.add(stack.fullBand);
  stack.group.visible = false;
  scene.add(stack.group);
}

const presentationCanvas = document.createElement("canvas");
presentationCanvas.width = 1024;
presentationCanvas.height = 1448;
const presentationTexture = new THREE.CanvasTexture(presentationCanvas);
presentationTexture.colorSpace = THREE.SRGBColorSpace;
presentationTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
const presentationGeometry = new THREE.PlaneGeometry(0.28, 0.40, 24, 32);
const presentationBasePositions = new Float32Array(
  presentationGeometry.getAttribute("position").array,
);
const presentationPaperMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  map: presentationTexture,
  roughness: 0.95,
  metalness: 0,
  emissive: 0x130d08,
  emissiveIntensity: 0.10,
  side: THREE.DoubleSide,
});
const presentationPaper3D = new THREE.Mesh(presentationGeometry, presentationPaperMaterial);
presentationPaper3D.name = "PRESENTED_PAPER_3D";
presentationPaper3D.castShadow = true;
presentationPaper3D.receiveShadow = true;
presentationPaper3D.visible = false;
presentationPaper3D.renderOrder = 3;
scene.add(presentationPaper3D);

const paperStampGroup = new THREE.Group();
paperStampGroup.name = "PAPER_STAMP_PET_ARCHIVE";
const stampWoodMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a2417,
  roughness: 0.66,
  metalness: 0.03,
});
const stampBrassMaterial = new THREE.MeshStandardMaterial({
  color: 0x8a6030,
  roughness: 0.58,
  metalness: 0.58,
});
const stampRubberMaterial = new THREE.MeshStandardMaterial({
  color: 0x7a1f22,
  roughness: 0.88,
  metalness: 0,
});
const stampBase = new THREE.Mesh(
  new THREE.CylinderGeometry(0.032, 0.032, 0.010, 36),
  stampRubberMaterial,
);
stampBase.rotation.x = Math.PI / 2;
const stampFerrule = new THREE.Mesh(
  new THREE.CylinderGeometry(0.022, 0.028, 0.021, 28),
  stampBrassMaterial,
);
stampFerrule.rotation.x = Math.PI / 2;
stampFerrule.position.z = 0.015;
const stampStem = new THREE.Mesh(
  new THREE.CylinderGeometry(0.008, 0.010, 0.028, 24),
  stampWoodMaterial,
);
stampStem.rotation.x = Math.PI / 2;
stampStem.position.z = 0.034;
const stampHandle = new THREE.Mesh(
  new THREE.SphereGeometry(0.019, 28, 18),
  stampWoodMaterial,
);
stampHandle.scale.set(0.82, 0.82, 1.18);
stampHandle.position.z = 0.058;
for (const mesh of [stampBase, stampFerrule, stampStem, stampHandle]) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  paperStampGroup.add(mesh);
}
paperStampGroup.position.set(0.065, -0.105, 0.15);
paperStampGroup.visible = false;
presentationPaper3D.add(paperStampGroup);

let petSealTexture: THREE.Texture | null = null;
let petSealTexturePromise: Promise<THREE.Texture | null> | null = null;
let paperStampStartedAt = 0;
let paperStampApplied = false;
let paperStampActive = false;

function ensurePetSealTexture(): Promise<THREE.Texture | null> {
  if (petSealTexture) return Promise.resolve(petSealTexture);
  if (petSealTexturePromise) return petSealTexturePromise;
  petSealTexturePromise = new THREE.TextureLoader().loadAsync(PET_SEAL_URL)
    .then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      petSealTexture = texture;
      if (paperStampApplied && presentedDocument) {
        drawPresentationDocument(presentedDocument, true);
      }
      return texture;
    })
    .catch((error: unknown) => {
      console.warn("Pet archive seal could not be loaded", error);
      petSealTexturePromise = null;
      return null;
    });
  return petSealTexturePromise;
}

let paperFlightPhase: PaperFlightPhase = "hidden";
let paperFlightStartedAt = 0;
const paperFlightStartPosition = new THREE.Vector3();
const paperFlightStartQuaternion = new THREE.Quaternion();
const paperFlightStartScale = new THREE.Vector3(1, 1, 1);
const paperFlightTargetPosition = new THREE.Vector3();
const paperFlightTargetQuaternion = new THREE.Quaternion();
const paperFlightTargetScale = new THREE.Vector3(1, 1, 1);
const paperFlightControlPositionA = new THREE.Vector3();
const paperFlightControlPositionB = new THREE.Vector3();
const paperFlightForward = new THREE.Vector3();
const paperFlightUp = new THREE.Vector3();
const paperFlightRight = new THREE.Vector3();
let paperFlightUsesArc = false;
const horizontalPaperQuaternion = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(-Math.PI / 2, 0, 0),
);

function requireNode(root: THREE.Object3D, name: string): THREE.Object3D {
  const object = root.getObjectByName(name);
  if (!object) throw new Error(`Missing Phase 4 node: ${name}`);
  return object;
}

function requireEnvironmentNode(root: THREE.Object3D, name: string): THREE.Object3D {
  const object = root.getObjectByName(name);
  if (!object) throw new Error(`Missing Phase 6 environment node: ${name}`);
  return object;
}

function shouldCastModelShadow(name: string): boolean {
  return !(
    name.startsWith("HIT_KEY_")
    || name.includes("_LEGEND")
    || name.includes("_GLASS")
    || name.includes("_GASKET")
    || name.includes("_JOINT")
    || name.includes("_SCREW")
    || name.includes("_RIVET")
    || name.includes("_WASHER")
    || name.includes("_CHIP")
    || name.includes("_GRIME")
    || name.includes("_WEAR")
  );
}

function alignFeetToGround(root: THREE.Object3D): void {
  const footNames = [
    "FOOT_FRONT_LEFT",
    "FOOT_FRONT_RIGHT",
    "FOOT_REAR_LEFT",
    "FOOT_REAR_RIGHT",
  ];
  root.updateMatrixWorld(true);
  let lowestFootY = Number.POSITIVE_INFINITY;
  for (const name of footNames) {
    const foot = requireNode(root, name);
    lowestFootY = Math.min(lowestFootY, new THREE.Box3().setFromObject(foot).min.y);
  }
  if (!Number.isFinite(lowestFootY)) throw new Error("Unable to resolve foot ground plane");
  root.position.y -= lowestFootY;
  root.updateMatrixWorld(true);
}

function smoothstep(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function pulse(value: number): number {
  return Math.sin(Math.min(1, Math.max(0, value)) * Math.PI);
}

function carriagePosition(column: number): number {
  return carriageRestX + ((PAPER_COLUMNS - 1) * 0.5 - column) * CARRIAGE_STEP_METERS;
}

function drawProgressiveStroke(
  context: CanvasRenderingContext2D,
  progress: number,
  start: number,
  end: number,
  draw: () => void,
): void {
  if (progress <= start) return;
  const localProgress = Math.min(1, (progress - start) / (end - start));
  context.save();
  context.globalAlpha *= 0.28 + localProgress * 0.72;
  context.setLineDash([Math.max(1, localProgress * 1_000), 1_000]);
  context.lineDashOffset = 0;
  draw();
  context.restore();
}

function drawHandDrawnSmile(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  progress: number,
): void {
  const centerX = canvas.width * 0.51;
  const centerY = canvas.height * 0.48;
  const radius = Math.min(canvas.width, canvas.height) * 0.225;
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#20120c";
  context.fillStyle = "#20120c";
  context.lineWidth = Math.max(5, canvas.width * 0.006);

  drawProgressiveStroke(context, progress, 0, 0.48, () => {
    context.beginPath();
    context.ellipse(
      centerX,
      centerY,
      radius * 0.94,
      radius * 1.03,
      -0.045,
      -Math.PI * 0.18,
      Math.PI * 1.82,
    );
    context.stroke();
  });
  drawProgressiveStroke(context, progress, 0.12, 0.58, () => {
    context.globalAlpha *= 0.42;
    context.lineWidth *= 0.42;
    context.beginPath();
    context.ellipse(
      centerX + radius * 0.018,
      centerY - radius * 0.012,
      radius * 0.97,
      radius,
      0.018,
      -Math.PI * 0.12,
      Math.PI * 1.88,
    );
    context.stroke();
  });

  const eyeProgress = Math.min(1, Math.max(0, (progress - 0.42) / 0.25));
  if (eyeProgress > 0) {
    context.globalAlpha = 0.32 + eyeProgress * 0.68;
    for (const direction of [-1, 1]) {
      context.beginPath();
      context.ellipse(
        centerX + direction * radius * 0.34,
        centerY - radius * 0.24 + direction * 2,
        radius * 0.065,
        radius * 0.09,
        direction * 0.08,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }

  drawProgressiveStroke(context, progress, 0.58, 1, () => {
    context.globalAlpha *= 0.94;
    context.lineWidth *= 1.08;
    context.beginPath();
    context.moveTo(centerX - radius * 0.48, centerY + radius * 0.18);
    context.bezierCurveTo(
      centerX - radius * 0.26,
      centerY + radius * 0.54,
      centerX + radius * 0.22,
      centerY + radius * 0.61,
      centerX + radius * 0.52,
      centerY + radius * 0.13,
    );
    context.stroke();
  });
  context.restore();
}

function drawPaper(state: TypewriterState): void {
  if (!paperBinding) return;
  const {canvas, texture} = paperBinding;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D paper canvas is unavailable");

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#d8c59f");
  gradient.addColorStop(0.48, "#eee1c5");
  gradient.addColorStop(1, "#d3bc91");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.globalAlpha = 0.12;
  context.strokeStyle = "#765f42";
  context.lineWidth = 1;
  for (let index = 0; index < 72; index += 1) {
    const y = (index * 149 + 37) % canvas.height;
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(
      canvas.width * 0.28,
      y + (index % 5) - 2,
      canvas.width * 0.72,
      y - (index % 7) + 3,
      canvas.width,
      y,
    );
    context.stroke();
  }
  context.globalAlpha = 1;

  const mobilePaper = mobileViewportQuery.matches;
  const paperLayout = typingPaperLayoutForBrowser(
    mobilePaper,
    safariPaperRendering,
  );
  const characterStep = paperLayout.characterStep;
  const lineStep = paperLayout.lineStep;
  const left = Math.round((canvas.width - characterStep * state.columns) / 2);
  const top = paperLayout.textTop;
  const rowWindow = typingPaperRowWindow(
    state.row,
    state.rows,
    paperLayout.visibleRows,
  );
  context.textBaseline = "alphabetic";
  context.font = `700 ${paperLayout.fontSize}px "Courier New", monospace`;
  for (let row = rowWindow.firstRow; row <= rowWindow.lastRow; row += 1) {
    const cells = state.cells[row];
    if (!cells) continue;
    for (let column = 0; column < state.columns; column += 1) {
      const character = cells[column];
      if (!character || character === " ") continue;
      const seed = row * 101 + column * 37 + character.codePointAt(0)!;
      const jitterX = ((seed % 5) - 2) * 0.55;
      const jitterY = (((seed * 7) % 5) - 2) * 0.45;
      context.globalAlpha = 1;
      context.fillStyle = seed % 13 === 0 ? "#120b08" : "#050302";
      const glyphX = left + column * characterStep + jitterX;
      const glyphY = top + (row - rowWindow.firstRow) * lineStep + jitterY;
      if (safariPaperRendering) {
        // WebKit has had Canvas text refresh/disappearance regressions. Avoid
        // its fillText maxWidth path and apply the same horizontal compression
        // explicitly so subsequent glyphs cannot collapse or disappear.
        const horizontalScale = glyphHorizontalScale(
          context.measureText(character).width,
          paperLayout.glyphMaxWidth,
        );
        context.save();
        context.translate(glyphX, glyphY);
        context.scale(horizontalScale, 1);
        context.fillText(character, 0, 0);
        context.restore();
      } else {
        context.fillText(
          character,
          glyphX,
          glyphY,
          paperLayout.glyphMaxWidth,
        );
      }
    }
  }
  context.globalAlpha = 1;
  if (activeSmileSnapshot || smilePaperActive) {
    drawHandDrawnSmile(context, canvas, smileDrawProgress);
  }
  texture.needsUpdate = true;
  paperPreviewNode.textContent = smilePaperActive || activeSmileSnapshot
    ? "手绘笑脸 · 换纸继续"
    : paperText(state) || "纸张为空";
}

function forceSafariPaperTextureUpload(): void {
  if (!safariPaperRendering || !paperBinding) return;
  // Recreate the WebGL texture from the complete canvas. Safari can otherwise
  // keep an intermediate upload when the welcome note is typed in rapid
  // one-character updates, leaving the final lines visibly truncated.
  paperBinding.texture.dispose();
  paperBinding.texture.needsUpdate = true;
}

function syncArchivePaperStack(side: ArchiveDrawer): void {
  const stack = archivePaperStacks[side];
  const targetCount = visiblePaperCount(archiveSnapshot, side);
  while (stack.papers.length < targetCount) {
    const index = stack.papers.length;
    const sheet = new THREE.Mesh(archiveSheetGeometry, archiveSheetMaterial);
    sheet.name = `ARCHIVE_PAPER_${side.toUpperCase()}_${String(index + 1).padStart(3, "0")}`;
    sheet.userData.archiveIndex = index;
    const spacing = side === "left" ? 0.00115 : 0.00078;
    sheet.position.set(
      ((index * 17) % 7 - 3) * 0.00045,
      index * spacing,
      ((index * 11) % 5 - 2) * 0.00055,
    );
    sheet.rotation.y = ((index % 5) - 2) * 0.0025;
    sheet.castShadow = index === targetCount - 1;
    sheet.receiveShadow = true;
    stack.group.add(sheet);
    stack.papers.push(sheet);
  }
  while (stack.papers.length > targetCount) {
    const sheet = stack.papers.pop();
    if (sheet) stack.group.remove(sheet);
  }
  stack.fullBand.visible = isDrawerVisuallyFull(archiveSnapshot, side);
  const spacing = side === "left" ? 0.00115 : 0.00078;
  stack.fullBand.position.y = Math.max(0.0015, targetCount * spacing + 0.0012);
}

function syncArchivePaperStacks(): void {
  syncArchivePaperStack("left");
  syncArchivePaperStack("right");
}

function updateArchivePaperStacks(): void {
  for (const side of ["left", "right"] as const) {
    const stack = archivePaperStacks[side];
    const openAmount = drawerBindings[side].openAmount;
    const layout = side === "left"
      ? {x: -0.48, y: -0.155, z: -0.015, travel: 0.39}
      : {x: 0.48, y: -0.108, z: -0.015, travel: 0.325};
    stack.group.position.set(
      layout.x,
      heroDeskY + layout.y,
      layout.z + openAmount * layout.travel,
    );
    stack.group.visible = stack.papers.length > 0 && openAmount > 0.06;
  }
}

function archiveStackTarget(side: ArchiveDrawer): THREE.Vector3 {
  const stack = archivePaperStacks[side];
  const spacing = side === "left" ? 0.00115 : 0.00078;
  const visibleCount = visiblePaperCount(archiveSnapshot, side);
  stack.group.updateMatrixWorld(true);
  return stack.group.localToWorld(
    new THREE.Vector3(0, visibleCount * spacing + 0.004, 0),
  );
}

function drawPresentationDocument(
  documentRecord: ArchiveDocument,
  stamped = false,
  targetCanvas: HTMLCanvasElement = presentationCanvas,
  pageIndex = presentedPageIndex,
): void {
  const context = targetCanvas.getContext("2d");
  if (!context) throw new Error("Presentation paper canvas is unavailable");
  const pages = archiveDocumentPages(documentRecord);
  const safePageIndex = Math.min(pages.length - 1, Math.max(0, pageIndex));
  const pageLines = pages[safePageIndex] ?? [""];
  const serial = archiveDocumentSerial(documentRecord);
  const displayTitle = archiveDisplayTitle(documentRecord);
  const gradient = context.createLinearGradient(0, 0, targetCanvas.width, 0);
  gradient.addColorStop(0, "#cdb887");
  gradient.addColorStop(0.12, "#ead9b4");
  gradient.addColorStop(0.86, "#eddfbe");
  gradient.addColorStop(1, "#c8ae79");
  context.fillStyle = gradient;
  context.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
  context.globalAlpha = 0.065;
  context.strokeStyle = "#6f5534";
  for (let index = 0; index < 112; index += 1) {
    const y = (index * 83 + 31) % targetCanvas.height;
    context.beginPath();
    context.moveTo(36, y);
    context.bezierCurveTo(310, y + (index % 4) - 2, 730, y - (index % 5) + 2, 988, y);
    context.stroke();
  }
  context.globalAlpha = 1;
  context.strokeStyle = "rgba(70, 45, 24, 0.34)";
  context.strokeRect(60, 54, targetCanvas.width - 120, targetCanvas.height - 108);
  context.fillStyle = "#4b3421";
  context.font = '700 18px "Courier New", monospace';
  context.fillText(
    documentRecord.kind === "freeform"
      ? "TYPEWORLD / ROOM IMPRINT"
      : "TYPEWORLD / KEYWORD RECORD",
    92,
    104,
  );
  context.textAlign = "right";
  context.fillText(serial, 932, 104);
  context.textAlign = "left";
  context.beginPath();
  context.moveTo(92, 140);
  context.lineTo(932, 140);
  context.stroke();
  context.fillStyle = "#6b2c2c";
  context.font = documentRecord.kind === "freeform"
    ? '700 32px "Courier New", monospace'
    : '700 46px "Courier New", monospace';
  context.fillText(displayTitle, 92, 214, 840);
  context.fillStyle = "#1b120d";
  context.font = '700 34px "Courier New", monospace';
  let cursorY = 320;
  for (const line of pageLines) {
    if (line) context.fillText(line, 92, cursorY, 840);
    cursorY += 58;
  }
  if (stamped && petSealTexture?.image) {
    context.save();
    context.globalCompositeOperation = "multiply";
    context.globalAlpha = 0.82;
    context.translate(820, 1180);
    context.rotate(-0.055);
    context.drawImage(petSealTexture.image as CanvasImageSource, -104, -104, 208, 208);
    context.restore();
  }
  const created = new Date(documentRecord.createdAt);
  const createdLabel = Number.isNaN(created.getTime())
    ? documentRecord.createdAt
    : created.toISOString().slice(0, 16).replace("T", " ");
  context.fillStyle = "#5a422c";
  context.font = '700 16px "Courier New", monospace';
  context.fillText(`${serial} · ${createdLabel} UTC`, 92, 1362);
  context.textAlign = "right";
  context.fillText(`PAGE ${archivePageLabel(safePageIndex, pages.length)}`, 932, 1362);
  context.textAlign = "left";
  if (targetCanvas === presentationCanvas) presentationTexture.needsUpdate = true;
}

async function stampedArchiveCanvas(
  documentRecord: ArchiveDocument,
  pageIndex = presentedPageIndex,
): Promise<HTMLCanvasElement> {
  const seal = await ensurePetSealTexture();
  if (!seal) throw new Error("Archive seal is unavailable");
  const canvas = document.createElement("canvas");
  canvas.width = presentationCanvas.width;
  canvas.height = presentationCanvas.height;
  drawPresentationDocument(documentRecord, true, canvas, pageIndex);
  return canvas;
}

function canvasPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG export failed"));
    }, "image/png");
  });
}

function syncPresentedPage(): void {
  if (!presentedDocument) return;
  const pages = archiveDocumentPages(presentedDocument);
  presentedPageIndex = Math.min(pages.length - 1, Math.max(0, presentedPageIndex));
  presentedTitleNode.textContent = archiveDisplayTitle(presentedDocument);
  presentedContentNode.textContent = (pages[presentedPageIndex] ?? []).join("\n");
  paperPaginationNode.hidden = pages.length <= 1;
  paperPreviousButtonNode.disabled = presentedPageIndex <= 0;
  paperNextButtonNode.disabled = presentedPageIndex >= pages.length - 1;
  paperPageLabelNode.textContent = archivePageLabel(presentedPageIndex, pages.length);
  paperDownloadButtonNode.textContent = pages.length > 1 ? "保存本页 PNG" : "下载 PNG";
  drawPresentationDocument(presentedDocument, paperStampApplied, presentationCanvas, presentedPageIndex);
}

function beginPresentedPageTurn(direction: -1 | 1): void {
  if (!presentedDocument || presentedPageTurn || paperFlightPhase !== "presented") return;
  const pages = archiveDocumentPages(presentedDocument);
  const targetIndex = presentedPageIndex + direction;
  if (targetIndex < 0 || targetIndex >= pages.length) return;
  presentedPageTurn = {
    targetIndex,
    direction,
    startedAt: performance.now(),
    swapped: false,
  };
  paperPreviousButtonNode.disabled = true;
  paperNextButtonNode.disabled = true;
}

function updatePresentedPageTurn(now: number): void {
  if (!presentedPageTurn) return;
  const progress = Math.min(1, (now - presentedPageTurn.startedAt) / 520);
  if (!presentedPageTurn.swapped && progress >= 0.48) {
    presentedPageTurn.swapped = true;
    presentedPageIndex = presentedPageTurn.targetIndex;
    syncPresentedPage();
  }
  if (progress < 1) return;
  presentedPageTurn = null;
  syncPresentedPage();
}

function openMobileArchivePreview(filename: string): Window | null {
  const previewWindow = window.open("about:blank", "_blank");
  if (!previewWindow) return null;
  const previewDocument = previewWindow.document;
  previewDocument.title = filename;
  const style = previewDocument.createElement("style");
  style.textContent = `
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: #120d0b;
      color: #ead9bb;
      font: 15px/1.6 Georgia, "Noto Serif SC", serif;
      text-align: center;
    }
  `;
  const loading = previewDocument.createElement("p");
  loading.textContent = "正在生成带印章 PNG…";
  previewDocument.head.append(style);
  previewDocument.body.replaceChildren(loading);
  return previewWindow;
}

function presentMobileArchivePng(
  previewWindow: Window,
  blob: Blob,
  filename: string,
): void {
  const previewDocument = previewWindow.document;
  const file = new File([blob], filename, {type: "image/png"});
  const url = URL.createObjectURL(file);
  const wrapper = previewDocument.createElement("main");
  wrapper.style.width = "min(100%, 560px)";
  const image = previewDocument.createElement("img");
  image.src = url;
  image.alt = filename;
  image.style.display = "block";
  image.style.width = "100%";
  image.style.height = "auto";
  image.style.boxShadow = "0 18px 56px #000a";
  const hint = previewDocument.createElement("p");
  hint.textContent = "长按纸张可保存图片，或使用下方按钮打开系统分享。";
  const saveButton = previewDocument.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "保存 / 分享 PNG";
  saveButton.style.cssText = "min-height:48px;padding:10px 20px;border:1px solid #b98a62;border-radius:999px;background:#3b171d;color:#f2dfbd;font:inherit";
  saveButton.addEventListener("click", () => {
    const shareData: ShareData = {files: [file], title: filename};
    if (typeof previewWindow.navigator.share === "function"
      && previewWindow.navigator.canShare?.(shareData)) {
      void previewWindow.navigator.share(shareData).catch(() => undefined);
      return;
    }
    const anchor = previewDocument.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    previewDocument.body.append(anchor);
    anchor.click();
    anchor.remove();
  });
  wrapper.append(image, hint, saveButton);
  previewDocument.body.replaceChildren(wrapper);
  previewWindow.addEventListener("pagehide", () => URL.revokeObjectURL(url), {once: true});
}

async function downloadPresentedArchive(): Promise<void> {
  if (!presentedDocument || !presentedFromHistory) return;
  const pages = archiveDocumentPages(presentedDocument);
  const filename = archivePaperFilename(
    `${archiveDocumentSerial(presentedDocument)}-page-${String(presentedPageIndex + 1).padStart(2, "0")}`,
  );
  const mobilePreview = mobileViewportQuery.matches
    ? openMobileArchivePreview(filename)
    : null;
  try {
    const canvas = await stampedArchiveCanvas(presentedDocument);
    const blob = await canvasPngBlob(canvas);
    if (mobilePreview) {
      presentMobileArchivePng(mobilePreview, blob, filename);
      statusNode.textContent = `${presentedDocument.keyword ?? "归档纸张"} · 已打开 PNG 保存页`;
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    statusNode.textContent = `${presentedDocument.keyword ?? "归档纸张"} · 第 ${presentedPageIndex + 1}/${pages.length} 页 PNG 已生成`;
  } catch (error) {
    console.error(error);
    if (mobilePreview && !mobilePreview.closed) {
      mobilePreview.document.body.textContent = "PNG 生成失败，请返回后重试。";
    }
    statusNode.textContent = "下载失败：档案印章未能完整载入";
  }
}

async function printPresentedArchive(): Promise<void> {
  if (!presentedDocument || !presentedFromHistory) return;
  try {
    const pages = archiveDocumentPages(presentedDocument);
    const canvases = await Promise.all(
      pages.map((_, pageIndex) => stampedArchiveCanvas(presentedDocument!, pageIndex)),
    );
    const frame = document.createElement("iframe");
    frame.title = "Typeworld 档案打印";
    frame.style.position = "fixed";
    frame.style.width = "1px";
    frame.style.height = "1px";
    frame.style.opacity = "0";
    frame.style.pointerEvents = "none";
    document.body.append(frame);
    const printDocument = frame.contentDocument;
    const printWindow = frame.contentWindow;
    if (!printDocument || !printWindow) throw new Error("Print frame is unavailable");
    printDocument.title = archiveDocumentSerial(presentedDocument);
    const viewport = printDocument.createElement("meta");
    viewport.name = "viewport";
    viewport.content = "width=device-width, initial-scale=1";
    const style = printDocument.createElement("style");
    style.textContent = ARCHIVE_PRINT_PAGE_CSS;
    printDocument.head.append(viewport, style);
    let loadedPages = 0;
    const handlePageLoad = (): void => {
      loadedPages += 1;
      if (loadedPages < canvases.length) return;
      printWindow.focus();
      printWindow.print();
      window.setTimeout(() => frame.remove(), 1_000);
    };
    for (const [pageIndex, canvas] of canvases.entries()) {
      const sheet = printDocument.createElement("section");
      sheet.className = "archive-print-page";
      const image = printDocument.createElement("img");
      image.alt = `${archiveDisplayTitle(presentedDocument)} · ${archivePageLabel(pageIndex, pages.length)}`;
      image.addEventListener("load", handlePageLoad, {once: true});
      image.src = canvas.toDataURL("image/png");
      sheet.append(image);
      printDocument.body.append(sheet);
    }
    statusNode.textContent = `${presentedDocument.keyword ?? "归档纸张"} · 已打开 ${pages.length} 页打印预览`;
  } catch (error) {
    console.error(error);
    statusNode.textContent = "打印失败：档案纸张未能完整生成";
  }
}

function cameraPaperTarget(): void {
  camera.getWorldDirection(paperFlightForward);
  paperFlightUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  paperFlightRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const archivePresentation = viewMode === "archive";
  const narrowArchivePresentation = archivePresentation && innerWidth / innerHeight < 0.8;
  paperFlightTargetPosition
    .copy(camera.position)
    .addScaledVector(
      paperFlightForward,
      narrowArchivePresentation ? 1.06 : archivePresentation ? 0.86 : 0.62,
    )
    .addScaledVector(
      paperFlightUp,
      narrowArchivePresentation ? 0.025 : archivePresentation ? -0.035 : -0.015,
    )
    .addScaledVector(
      paperFlightRight,
      narrowArchivePresentation ? 0 : archivePresentation ? 0.22 : 0,
    );
  paperFlightTargetQuaternion.copy(camera.quaternion);
  paperFlightTargetScale.setScalar(
    narrowArchivePresentation ? 1.02 : archivePresentation ? 1.04 : 1,
  );
}

function configurePaperDrawerArc(side: ArchiveDrawer): void {
  const sideDirection = side === "left" ? -1 : 1;
  const highestY = Math.max(
    paperFlightStartPosition.y,
    paperFlightTargetPosition.y,
  );
  const nearestZ = Math.max(
    paperFlightStartPosition.z,
    paperFlightTargetPosition.z,
  );
  paperFlightControlPositionA.set(
    sideDirection * 0.39,
    highestY + 0.28,
    nearestZ + 0.10,
  );
  paperFlightControlPositionB.set(
    sideDirection * 0.44,
    paperFlightTargetPosition.y + 0.18,
    paperFlightTargetPosition.z + 0.10,
  );
  paperFlightUsesArc = true;
}

function beginPaperPresentation3D(
  documentRecord: ArchiveDocument,
  fromHistory: boolean,
): void {
  void ensurePetSealTexture();
  drawPresentationDocument(documentRecord);
  paperStampGroup.visible = false;
  paperStampActive = false;
  paperStampApplied = false;
  presentationPaper3D.visible = true;
  if (fromHistory) {
    setDrawerOpen(documentRecord.drawer, true);
    updateArchivePaperStacks();
    presentationPaper3D.position.copy(archiveStackTarget(documentRecord.drawer));
    presentationPaper3D.quaternion.copy(horizontalPaperQuaternion);
    presentationPaper3D.scale.set(0.73, 0.40, 0.73);
  } else if (paperBinding) {
    paperBinding.mesh.getWorldPosition(presentationPaper3D.position);
    presentationPaper3D.position.z += 0.015;
    presentationPaper3D.quaternion.copy(camera.quaternion);
    presentationPaper3D.scale.set(0.42, 0.42, 0.42);
  } else {
    presentationPaper3D.position.set(0, heroDeskY + 0.24, 0);
    presentationPaper3D.quaternion.copy(camera.quaternion);
    presentationPaper3D.scale.set(0.42, 0.42, 0.42);
  }
  paperFlightStartPosition.copy(presentationPaper3D.position);
  paperFlightStartQuaternion.copy(presentationPaper3D.quaternion);
  paperFlightStartScale.copy(presentationPaper3D.scale);
  cameraPaperTarget();
  paperFlightUsesArc = false;
  if (fromHistory) configurePaperDrawerArc(documentRecord.drawer);
  paperFlightPhase = "extracting";
  paperFlightStartedAt = performance.now();
}

function beginPaperExit3D(record: ArchiveDocument, shouldArchive: boolean): void {
  paperStampGroup.visible = false;
  paperStampActive = false;
  paperFlightStartPosition.copy(presentationPaper3D.position);
  paperFlightStartQuaternion.copy(presentationPaper3D.quaternion);
  paperFlightStartScale.copy(presentationPaper3D.scale);
  if (shouldArchive) {
    updateArchivePaperStacks();
    paperFlightTargetPosition.copy(archiveStackTarget(record.drawer));
    paperFlightTargetQuaternion.copy(horizontalPaperQuaternion);
    paperFlightTargetScale.set(0.73, 0.40, 0.73);
    configurePaperDrawerArc(record.drawer);
    paperFlightPhase = "archiving";
  } else {
    camera.getWorldDirection(paperFlightForward);
    paperFlightTargetPosition
      .copy(camera.position)
      .addScaledVector(paperFlightForward, 0.78)
      .addScaledVector(paperFlightUp, 0.16);
    paperFlightTargetQuaternion.copy(camera.quaternion);
    paperFlightTargetScale.set(0.06, 0.06, 0.06);
    paperFlightUsesArc = false;
    paperFlightPhase = "discarding";
  }
  paperFlightStartedAt = performance.now();
}

function updatePresentationPaperGeometry(now: number): void {
  const positions = presentationGeometry.getAttribute("position");
  if (!(positions instanceof THREE.BufferAttribute)) return;
  const activeFlight = paperFlightPhase === "extracting" || paperFlightPhase === "archiving";
  const pageTurnProgress = presentedPageTurn
    ? Math.min(1, (now - presentedPageTurn.startedAt) / 520)
    : 0;
  const pageTurnAmount = Math.sin(pageTurnProgress * Math.PI);
  for (let index = 0; index < positions.count; index += 1) {
    const offset = index * 3;
    const x = presentationBasePositions[offset] ?? 0;
    const y = presentationBasePositions[offset + 1] ?? 0;
    const normalizedX = x / 0.14;
    const normalizedY = y / 0.20;
    const curl = 0.0065 * normalizedX * normalizedX;
    const flutter = activeFlight
      ? Math.sin(now * 0.012 + normalizedY * 4.2) * 0.0045 * (1 - Math.abs(normalizedX))
      : Math.sin(normalizedY * Math.PI) * 0.0012;
    const turningEdge = presentedPageTurn?.direction === -1
      ? (1 - normalizedX) * 0.5
      : (normalizedX + 1) * 0.5;
    const pageCurl = pageTurnAmount * turningEdge * turningEdge * 0.045;
    const pagePull = (presentedPageTurn?.direction ?? 0)
      * pageTurnAmount
      * turningEdge
      * 0.014;
    positions.setXYZ(index, x - pagePull, y, curl + flutter + pageCurl);
  }
  positions.needsUpdate = true;
  presentationGeometry.computeVertexNormals();
}

function updatePaperStamp(now: number): void {
  if (!paperStampActive || !presentedDocument || paperFlightPhase !== "presented") {
    paperStampGroup.visible = false;
    return;
  }
  const elapsed = now - paperStampStartedAt;
  if (elapsed < 0) {
    paperStampGroup.visible = false;
    return;
  }
  const progress = Math.min(1, elapsed / 1180);
  paperStampGroup.visible = progress < 0.88;
  const down = smoothstep(progress / 0.30);
  const up = smoothstep((progress - 0.43) / 0.38);
  paperStampGroup.position.z = THREE.MathUtils.lerp(0.15, 0.014, down);
  paperStampGroup.position.z = THREE.MathUtils.lerp(paperStampGroup.position.z, 0.18, up);
  paperStampGroup.rotation.z = Math.sin(progress * Math.PI) * -0.05;
  const impact = pulse((progress - 0.24) / 0.22);
  const stampScale = 0.76;
  paperStampGroup.scale.set(
    stampScale * (1 + impact * 0.04),
    stampScale * (1 + impact * 0.04),
    stampScale * (1 - impact * 0.07),
  );
  if (!paperStampApplied && progress >= 0.30) {
    paperStampApplied = true;
    drawPresentationDocument(presentedDocument, true);
    statusNode.textContent = `${presentedDocument.keyword ?? "纸张"} · 宠物档案印章已落下`;
  }
  if (progress >= 1) {
    paperStampGroup.visible = false;
    paperStampActive = false;
  }
}

function updatePaperFlight(now: number): void {
  if (paperFlightPhase === "hidden") return;
  updatePresentedPageTurn(now);
  updatePresentationPaperGeometry(now);
  if (paperFlightPhase === "presented") {
    cameraPaperTarget();
    presentationPaper3D.position.lerp(paperFlightTargetPosition, 0.14);
    presentationPaper3D.quaternion.slerp(paperFlightTargetQuaternion, 0.14);
    updatePaperStamp(now);
    return;
  }
  if (paperFlightPhase === "extracting") cameraPaperTarget();
  const duration = paperFlightPhase === "extracting" ? 900 : 760;
  const t = smoothstep((now - paperFlightStartedAt) / duration);
  if (paperFlightUsesArc) {
    const inverseT = 1 - t;
    presentationPaper3D.position
      .copy(paperFlightStartPosition)
      .multiplyScalar(inverseT * inverseT * inverseT)
      .addScaledVector(
        paperFlightControlPositionA,
        3 * inverseT * inverseT * t,
      )
      .addScaledVector(
        paperFlightControlPositionB,
        3 * inverseT * t * t,
      )
      .addScaledVector(paperFlightTargetPosition, t * t * t);
  } else {
    presentationPaper3D.position.lerpVectors(
      paperFlightStartPosition,
      paperFlightTargetPosition,
      t,
    );
  }
  presentationPaper3D.quaternion.slerpQuaternions(
    paperFlightStartQuaternion,
    paperFlightTargetQuaternion,
    t,
  );
  presentationPaper3D.scale.lerpVectors(
    paperFlightStartScale,
    paperFlightTargetScale,
    t,
  );
  if (t >= 1 && paperFlightPhase === "extracting") {
    paperFlightPhase = "presented";
    paperStampStartedAt = now + 260;
    paperStampActive = true;
  }
}

function persistArchive(): void {
  if (!persistArchiveSnapshot(localStorage, archiveSnapshot, archiveFullQaMode)) {
    statusNode.textContent = "浏览器未允许本地保存；本次归档仅在当前页面有效";
  }
}

function updateDiscoveryProgress(): void {
  discoveryCountNode.textContent = formatDiscoveredWords(archiveSnapshot.discovered.length);
}

function setLoadingProgress(percent: number, label: string): void {
  loadingLineNode.textContent = label;
  loadingProgressNode.style.width = `${THREE.MathUtils.clamp(percent, 0, 100)}%`;
}

function finishLoadingSequence(): void {
  setLoadingProgress(100, "档案室已经准备好");
  window.setTimeout(() => {
    experienceLoaderNode.classList.add("is-ready");
    window.setTimeout(() => {
      experienceLoaderNode.hidden = true;
      if (experienceEntryNode.hidden) focusTypewriterInput(true);
      else experienceEnterNode.focus({preventScroll: true});
    }, 720);
  }, 360);
}

function showRoomNote(note: RoomNote): void {
  if (roomNoteTimer !== null) window.clearTimeout(roomNoteTimer);
  roomNoteTitleNode.textContent = note.title;
  roomNoteBodyNode.textContent = note.body;
  roomNoteNode.hidden = false;
  requestAnimationFrame(() => roomNoteNode.classList.add("is-visible"));
  roomNoteTimer = window.setTimeout(() => {
    roomNoteNode.classList.remove("is-visible");
    roomNoteTimer = window.setTimeout(() => {
      roomNoteNode.hidden = true;
      roomNoteTimer = null;
    }, 280);
  }, 3600);
}

function cancelPendingArchiveView(): void {
  pendingArchiveDocumentId = null;
  if (archiveDrawerTimer !== null) window.clearTimeout(archiveDrawerTimer);
  if (archivePaperTimer !== null) window.clearTimeout(archivePaperTimer);
  archiveDrawerTimer = null;
  archivePaperTimer = null;
}

function hideArchivePanelForPaper(): void {
  if (archivePanelAnimationTimer !== null) {
    window.clearTimeout(archivePanelAnimationTimer);
  }
  archivePanelNode.classList.add("is-paper-dismissing");
  archivePanelAnimationTimer = window.setTimeout(() => {
    archivePanelNode.hidden = true;
    archivePanelAnimationTimer = null;
  }, 220);
}

function syncSiteViewNavigation(section: SiteSection): void {
  for (const button of siteViewButtonNodes) {
    const active = button.dataset.siteView === section;
    button.setAttribute("aria-pressed", String(active));
  }
}

function showDefaultNavigation(): void {
  if (archivePanelAnimationTimer !== null) {
    window.clearTimeout(archivePanelAnimationTimer);
    archivePanelAnimationTimer = null;
  }
  activeArchiveDrawer = null;
  syncSiteViewNavigation("default");
  archivePanelNode.classList.remove("is-paper-browser");
  archiveTitleNode.textContent = "选择一个入口";
  archiveListNode.replaceChildren();
  for (const entry of DEFAULT_HOME_ENTRIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "archive-document archive-command";
    button.dataset.defaultEntry = entry.id;
    const index = document.createElement("span");
    index.className = "archive-index";
    index.textContent = String(archiveListNode.childElementCount + 1).padStart(2, "0");
    const title = document.createElement("strong");
    title.textContent = entry.label;
    const meta = document.createElement("span");
    meta.textContent = entry.meta;
    button.append(index, title, meta);
    archiveListNode.append(button);
  }
  archivePanelNode.hidden = false;
  requestAnimationFrame(() => archivePanelNode.classList.remove("is-paper-dismissing"));
}

function defaultHomeDocument(entry: DefaultHomeEntry): ArchiveDocument {
  return {
    id: `default-${entry.id}`,
    kind: "freeform",
    keyword: null,
    title: entry.title,
    text: entry.body,
    drawer: "left",
    createdAt: new Date().toISOString(),
    mock: false,
  };
}

function cancelProjectsNavigation(): void {
  viewportNode.classList.remove("is-projects-departing");
  viewportNode.classList.remove("is-library-journey");
  viewportNode.classList.remove("is-library-settled");
  viewportNode.style.removeProperty("--library-chrome-opacity");
  viewportNode.dataset.libraryProgress = "0.000";
  libraryJourneyTargetProgress = 0;
  libraryJourneyDisplayedProgress = 0;
  libraryJourneyAutoplayStartedAt = null;
  libraryJourneySettled = false;
  libraryStage = "index";
  libraryFocusProgress = 0;
  librarySelectionWheelDelta = 0;
  resetLibraryPageGesture();
  librarySelectionNode.hidden = true;
  libraryTouchBackNode.hidden = true;
  delete viewportNode.dataset.librarySelected;
  delete viewportNode.dataset.libraryStage;
  disposeLibraryDetail();
  for (const pose of libraryJourneyBookPoses) pose.object.visible = true;
  restoreLibraryJourneyBooks();
}

function syncLibrarySelection(): void {
  const record = PROJECT_BOOKS[librarySelectedIndex];
  if (!record) return;
  libraryVolumeNode.textContent = record.volumeLabel.toUpperCase();
  libraryTitleNode.textContent = record.title;
  librarySubtitleNode.textContent = record.subtitle;
  viewportNode.dataset.librarySelected = record.id;
  viewportNode.dataset.libraryStage = libraryStage;
  librarySelectionNode.hidden = !libraryJourneySettled;
  librarySelectionNode.dataset.stage = libraryStage;
  const instruction = librarySelectionNode.querySelector("small");
  if (instruction) {
    instruction.textContent = libraryStage === "reading"
      ? mobileViewportQuery.matches
        ? `${libraryDetailPageLabel()} · 左右滑动翻页`
        : `${getProjectBookPageLabel(libraryDetailPageIndex)} · ← / → 翻页 · Esc 合书`
      : libraryStage === "opening" || libraryStage === "focus"
        ? "正在将书带到阅读位置"
        : mobileViewportQuery.matches
          ? "上下滑动选书 · 点击当前书打开"
          : "滚动选择 · 点击书本在此展开 · Esc 返回书房";
  }
  libraryTouchBackNode.hidden = !libraryJourneySettled;
  libraryTouchBackNode.setAttribute(
    "aria-label",
    libraryStage === "index" ? "返回书房" : "返回书库",
  );
}

function libraryDetailMaximumPageIndex(): number {
  if (!mobileViewportQuery.matches) return 3;
  const record = PROJECT_BOOKS[libraryDetailIndex];
  return Math.max(0, (record?.kind === "project" ? record.pages.length : 7) - 1);
}

function libraryDetailPageLabel(): string {
  const total = libraryDetailMaximumPageIndex() + 1;
  return `${String(libraryDetailPageIndex + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
}

function setLibrarySelection(index: number): void {
  librarySelectedIndex = ((index % PROJECT_BOOKS.length) + PROJECT_BOOKS.length)
    % PROJECT_BOOKS.length;
  syncLibrarySelection();
  const record = PROJECT_BOOKS[librarySelectedIndex];
  if (record) statusNode.textContent = `${record.volumeLabel} · ${record.title}`;
}

function enterSettledLibrary(): void {
  if (libraryJourneySettled) return;
  libraryJourneySettled = true;
  libraryJourneyTargetProgress = 1;
  libraryJourneyDisplayedProgress = 1;
  viewportNode.classList.remove("is-projects-departing");
  viewportNode.classList.add("is-library-settled");
  libraryStage = "index";
  libraryTouchBackNode.hidden = false;
  if (!libraryVisited) {
    libraryVisited = true;
    markLibraryVisited(localStorage);
    viewportNode.classList.remove("is-library-unvisited");
  }
  setLibrarySelection(librarySelectedIndex);
}

function leaveSettledLibrary(): void {
  if (!libraryJourneySettled) return;
  libraryJourneySettled = false;
  librarySelectedIndex = 0;
  librarySelectionWheelDelta = 0;
  libraryStage = "index";
  libraryFocusProgress = 0;
  resetLibraryPageGesture();
  viewportNode.classList.remove("is-library-settled");
  librarySelectionNode.hidden = true;
  libraryTouchBackNode.hidden = true;
  disposeLibraryDetail();
  for (const pose of libraryJourneyBookPoses) pose.object.visible = true;
}

function returnLibraryToHero(): void {
  libraryJourneyAutoplayStartedAt = null;
  leaveSettledLibrary();
  libraryJourneyTargetProgress = 0;
  statusNode.textContent = "正在返回打字机";
}

function disposeLibraryDetail(): void {
  libraryDetailLoadToken += 1;
  resetLibraryPageGesture();
  if (!libraryDetail) return;
  libraryDetail.root.removeFromParent();
  libraryDetail.root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
  libraryDetail = null;
  libraryDetailIndex = -1;
  libraryDetailOpenProgress = 0;
  libraryDetailTargetOpenProgress = 0;
  libraryDetailPageIndex = 0;
  libraryDetailLeafRestingZ = [];
}

function playLibraryPageSound(): void {
  if (!sitePreferences.soundEnabled) return;
  const audio = new Audio("/audio/paper/page-turn.mp3");
  audio.volume = sitePreferences.volume * 0.8;
  void audio.play().catch(() => {
    // A blocked sound must not interrupt the in-page book transition.
  });
}

async function prepareLibraryDetail(index: number): Promise<void> {
  const record = PROJECT_BOOKS[index];
  if (!record) return;
  const token = ++libraryDetailLoadToken;
  const cover = await loadProjectCover(
    libraryDetailTextureLoader,
    record.coverUrl,
    record.coverColor,
  );
  if (token !== libraryDetailLoadToken || libraryStage !== "focus") {
    cover.texture.dispose();
    return;
  }
  cover.texture.minFilter = THREE.LinearMipmapLinearFilter;
  cover.texture.magFilter = THREE.LinearFilter;
  cover.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const detail = createProjectBookDetail(record, cover.texture, {
    singlePage: mobileViewportQuery.matches,
  });
  detail.root.visible = false;
  scene.add(detail.root);
  libraryDetail = detail;
  libraryDetailIndex = index;
  libraryDetailClosedCoverZ = detail.coverPivot.position.z;
  libraryDetailLeafRestingZ = detail.leafPivots.map((pivot) => pivot.position.z);
  libraryDetailLeafTurnedBaseZ = Math.max(...libraryDetailLeafRestingZ) + 0.002;
}

function openLibraryBook(index: number): void {
  if (libraryStage !== "index") return;
  setLibrarySelection(index);
  libraryStage = "focus";
  libraryFocusProgress = 0;
  libraryDetailPageIndex = 0;
  statusNode.textContent = `正在打开 ${PROJECT_BOOKS[index]!.volumeLabel} · ${PROJECT_BOOKS[index]!.title}`;
  syncLibrarySelection();
  void prepareLibraryDetail(index);
}

function closeLibraryBook(): void {
  if (libraryStage === "index") return;
  resetLibraryPageGesture();
  if (!libraryDetail) {
    libraryDetailLoadToken += 1;
    libraryStage = "index";
    libraryFocusProgress = 0;
    for (const pose of libraryJourneyBookPoses) pose.object.visible = true;
    syncLibrarySelection();
    return;
  }
  libraryStage = "closing";
  libraryDetailTargetOpenProgress = 0;
  playLibraryPageSound();
  syncLibrarySelection();
}

function turnLibraryPage(direction: -1 | 1): void {
  if (libraryStage !== "reading") return;
  const next = mobileViewportQuery.matches
    ? THREE.MathUtils.clamp(
        libraryDetailPageIndex + direction,
        0,
        libraryDetailMaximumPageIndex(),
      )
    : clampProjectBookPageIndex(libraryDetailPageIndex + direction);
  if (next === libraryDetailPageIndex) return;
  libraryDetailPageIndex = next;
  resetLibraryPageGesture();
  playLibraryPageSound();
  syncLibrarySelection();
  const record = PROJECT_BOOKS[libraryDetailIndex];
  if (record) {
    statusNode.textContent = `${record.title} · ${mobileViewportQuery.matches ? libraryDetailPageLabel() : getProjectBookPageLabel(libraryDetailPageIndex)}`;
  }
}

function resetLibraryPageGesture(): void {
  libraryPageDragDirection = 0;
  libraryPageDragProgress = 0;
  mobileLibraryGesture = null;
}

function libraryDetailCameraLocalPosition(target: THREE.Vector3): THREE.Vector3 {
  return target.set(
    mobileViewportQuery.matches ? libraryMobileDetailX : -0.01,
    0,
    -1.72,
  );
}

function libraryBookIndexFromObject(object: THREE.Object3D | undefined): number | null {
  let current = object;
  while (current) {
    const index: unknown = current.userData.libraryJourneyIndex;
    if (typeof index === "number" && Number.isInteger(index)) return index;
    current = current.parent ?? undefined;
  }
  return null;
}

function intersectLibraryBook(): number | null {
  const books = roomEnvironment?.libraryJourneyBooks ?? [];
  const hit = raycaster.intersectObjects([...books], true)[0]?.object;
  const raycastIndex = libraryBookIndexFromObject(hit);
  if (raycastIndex !== null) return raycastIndex;
  let nearestIndex: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  books.forEach((book, index) => {
    book.getWorldPosition(libraryBookScreenPosition);
    libraryBookScreenPosition.project(camera);
    const distance = Math.hypot(
      pointer.x - libraryBookScreenPosition.x,
      pointer.y - libraryBookScreenPosition.y,
    );
    const threshold = index === librarySelectedIndex ? 0.28 : 0.13;
    if (distance <= threshold && distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

function captureLibraryJourneyBooks(): void {
  const books = roomEnvironment?.libraryJourneyBooks ?? [];
  if (
    libraryJourneyBookPoses.length === books.length
    && libraryJourneyBookPoses.every((pose, index) => pose.object === books[index])
  ) return;
  restoreLibraryJourneyBooks();
  libraryJourneyBookPoses = books.flatMap((object) => {
    if (!object.parent) return [];
    return [{
      object,
      parent: object.parent,
      position: object.position.clone(),
      quaternion: object.quaternion.clone(),
      scale: object.scale.clone(),
    }];
  });
}

function restoreLibraryJourneyBooks(): void {
  for (const pose of libraryJourneyBookPoses) {
    pose.object.position.copy(pose.position);
    pose.object.quaternion.copy(pose.quaternion);
    pose.object.scale.copy(pose.scale);
  }
}

function updateLibraryJourneyBooks(progress: number): void {
  captureLibraryJourneyBooks();
  if (libraryJourneyBookPoses.length === 0) return;
  camera.updateMatrixWorld(true);
  camera.getWorldQuaternion(libraryJourneyCameraQuaternion);
  libraryJourneyBookPoses.forEach((pose, index) => {
    const amount = libraryJourneyBookProgress(
      progress,
      index,
      libraryJourneyBookPoses.length,
    );
    if (amount <= 0) {
      pose.object.position.copy(pose.position);
      pose.object.quaternion.copy(pose.quaternion);
      pose.object.scale.copy(pose.scale);
      return;
    }
    const slot = libraryBookSlot(getRelativeProjectBookIndex(index, 0));
    libraryJourneyDestinationWorld.set(...slot.position);
    camera.localToWorld(libraryJourneyDestinationWorld);
    pose.parent.updateMatrixWorld(true);
    libraryJourneyDestinationLocal.copy(libraryJourneyDestinationWorld);
    pose.parent.worldToLocal(libraryJourneyDestinationLocal);
    pose.object.position.lerpVectors(pose.position, libraryJourneyDestinationLocal, amount);

    pose.parent.getWorldQuaternion(libraryJourneyParentQuaternion);
    libraryJourneyParentQuaternion.invert();
    libraryJourneyDestinationQuaternion
      .copy(libraryJourneyParentQuaternion)
      .multiply(libraryJourneyCameraQuaternion);
    libraryBookSlotEuler.set(...slot.rotation);
    libraryBookSlotRotation.setFromEuler(libraryBookSlotEuler);
    libraryJourneyDestinationQuaternion.multiply(libraryBookSlotRotation);
    pose.object.quaternion.slerpQuaternions(
      pose.quaternion,
      libraryJourneyDestinationQuaternion,
      amount,
    );
    libraryJourneyTargetScale.setScalar(
      libraryJourneyBookPoses[0]!.scale.x * slot.scale,
    );
    pose.object.scale.lerpVectors(pose.scale, libraryJourneyTargetScale, amount);
  });
}

function updateSettledLibraryBooks(now: number, deltaSeconds: number): void {
  captureLibraryJourneyBooks();
  if (libraryJourneyBookPoses.length === 0) return;
  camera.updateMatrixWorld(true);
  camera.getWorldQuaternion(libraryJourneyCameraQuaternion);
  const response = reducedMotion ? 1 : 1 - Math.exp(-deltaSeconds * 7.8);
  libraryJourneyBookPoses.forEach((pose, index) => {
    const relativeIndex = getRelativeProjectBookIndex(index, librarySelectedIndex);
    const indexSlot = libraryBookSlot(relativeIndex);
    const isSelected = relativeIndex === 0;
    const slot = libraryStage === "focus" && isSelected
      ? {
          position: [0, 0, -1.08] as const,
          scale: 2.30,
          rotation: [-0.04, -0.18, -0.035] as const,
        }
      : libraryStage === "focus"
        ? {
            position: [indexSlot.position[0] - 0.32, indexSlot.position[1], indexSlot.position[2] - 0.92] as const,
            scale: indexSlot.scale * 0.68,
            rotation: indexSlot.rotation,
          }
        : indexSlot;
    libraryJourneyDestinationWorld.set(...slot.position);
    if (isSelected && libraryStage === "index") {
      libraryJourneyDestinationWorld.y += Math.sin(now * 0.0012) * 0.008;
    }
    camera.localToWorld(libraryJourneyDestinationWorld);
    pose.parent.updateMatrixWorld(true);
    libraryBookTargetPosition.copy(libraryJourneyDestinationWorld);
    pose.parent.worldToLocal(libraryBookTargetPosition);
    pose.object.position.lerp(libraryBookTargetPosition, response);

    pose.parent.getWorldQuaternion(libraryJourneyParentQuaternion);
    libraryJourneyParentQuaternion.invert();
    libraryBookTargetQuaternion
      .copy(libraryJourneyParentQuaternion)
      .multiply(libraryJourneyCameraQuaternion);
    libraryBookSlotEuler.set(...slot.rotation);
    libraryBookSlotRotation.setFromEuler(libraryBookSlotEuler);
    libraryBookTargetQuaternion.multiply(libraryBookSlotRotation);
    pose.object.quaternion.slerp(libraryBookTargetQuaternion, response);
    libraryJourneyTargetScale.setScalar(
      libraryJourneyBookPoses[0]!.scale.x * slot.scale,
    );
    pose.object.scale.lerp(libraryJourneyTargetScale, response);
  });
}

function updateLibraryDetail(deltaSeconds: number): void {
  if (libraryStage === "index" || !libraryDetail) return;
  const response = reducedMotion ? 1 : 1 - Math.exp(-deltaSeconds * 6.4);
  const detail = libraryDetail;
  if (libraryStage === "focus") {
    libraryFocusProgress = THREE.MathUtils.lerp(libraryFocusProgress, 1, response);
    if (libraryFocusProgress > 0.72) {
      for (const pose of libraryJourneyBookPoses) pose.object.visible = false;
      libraryDetailCameraLocalPosition(libraryDetailWorldPosition);
      camera.localToWorld(libraryDetailWorldPosition);
      detail.root.position.copy(libraryDetailWorldPosition);
      camera.getWorldQuaternion(libraryDetailWorldQuaternion);
      detail.root.quaternion.copy(libraryDetailWorldQuaternion);
      detail.root.scale.setScalar(
        mobileViewportQuery.matches ? libraryMobileDetailScale : 0.58,
      );
      detail.root.visible = true;
      libraryStage = "opening";
      libraryDetailTargetOpenProgress = 1;
      playLibraryPageSound();
      syncLibrarySelection();
    }
  }

  libraryDetailOpenProgress = THREE.MathUtils.lerp(
    libraryDetailOpenProgress,
    libraryDetailTargetOpenProgress,
    response,
  );
  detail.coverPivot.rotation.y = -Math.PI * 0.985 * libraryDetailOpenProgress;
  detail.coverPivot.position.z = THREE.MathUtils.lerp(
    libraryDetailClosedCoverZ,
    0.004,
    THREE.MathUtils.smoothstep(libraryDetailOpenProgress, 0.35, 0.92),
  );
  detail.leftPagePivot.scale.x = THREE.MathUtils.smoothstep(
    libraryDetailOpenProgress,
    0.22,
    0.82,
  );
  detail.leafPivots.forEach((pivot, index) => {
    let targetRotation = index < libraryDetailPageIndex ? -Math.PI * 0.985 : 0;
    let followsFinger = false;
    if (libraryPageDragDirection === 1 && index === libraryDetailPageIndex) {
      targetRotation = -Math.PI * 0.985 * libraryPageDragProgress;
      followsFinger = true;
    } else if (libraryPageDragDirection === -1 && index === libraryDetailPageIndex - 1) {
      targetRotation = -Math.PI * 0.985 * (1 - libraryPageDragProgress);
      followsFinger = true;
    }
    pivot.rotation.y = followsFinger
      ? targetRotation
      : THREE.MathUtils.lerp(pivot.rotation.y, targetRotation, response * 1.2);
    const targetZ = index < libraryDetailPageIndex
      ? libraryDetailLeafTurnedBaseZ + index * 0.0025
      : libraryDetailLeafRestingZ[index]!;
    pivot.position.z = THREE.MathUtils.lerp(pivot.position.z, targetZ, response * 1.2);
  });

  libraryDetailCameraLocalPosition(libraryDetailWorldPosition);
  camera.localToWorld(libraryDetailWorldPosition);
  detail.root.position.lerp(libraryDetailWorldPosition, response);
  camera.getWorldQuaternion(libraryDetailWorldQuaternion);
  detail.root.quaternion.slerp(libraryDetailWorldQuaternion, response);
  libraryDetailTargetScale.setScalar(
    mobileViewportQuery.matches ? libraryMobileDetailScale : 0.58,
  );
  detail.root.scale.lerp(libraryDetailTargetScale, response);

  if (libraryStage === "opening" && libraryDetailOpenProgress > 0.992) {
    libraryStage = "reading";
    statusNode.textContent = `${PROJECT_BOOKS[libraryDetailIndex]!.title} · ${mobileViewportQuery.matches ? libraryDetailPageLabel() : getProjectBookPageLabel(libraryDetailPageIndex)}`;
    syncLibrarySelection();
  } else if (libraryStage === "closing" && libraryDetailOpenProgress < 0.01) {
    disposeLibraryDetail();
    for (const pose of libraryJourneyBookPoses) pose.object.visible = true;
    libraryStage = "index";
    libraryFocusProgress = 0;
    statusNode.textContent = `${PROJECT_BOOKS[librarySelectedIndex]!.volumeLabel} · ${PROJECT_BOOKS[librarySelectedIndex]!.title}`;
    syncLibrarySelection();
  }
}

function preloadLibraryAssets(): Promise<LibraryAssetBundle> {
  if (libraryAssetBundlePromise) return libraryAssetBundlePromise;
  const loader = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();
  libraryAssetBundlePromise = Promise.all([
    loader.loadAsync(ROOM_BOOKCASE_URL),
    Promise.all(PROJECT_BOOKS.map((record) => textureLoader.loadAsync(record.coverUrl))),
  ]).then(([bookcase, covers]) => ({bookcase: bookcase.scene, covers}));
  libraryAssetBundlePromise.catch(() => {
    libraryAssetBundlePromise = null;
  });
  return libraryAssetBundlePromise;
}

async function ensureLibraryAssetsReady(): Promise<void> {
  if (libraryAssetsAttached) return;
  viewportNode.dataset.libraryAssets = "loading";
  const bundle = await preloadLibraryAssets();
  if (!roomEnvironment) throw new Error("Room environment is not ready");
  roomEnvironment.attachBookcase(
    bundle.bookcase,
    new Map(
      PROJECT_BOOKS.map((record, index) => [record.id, bundle.covers[index]!] as const),
    ),
  );
  libraryAssetsAttached = true;
  viewportNode.dataset.libraryAssets = "ready";
}

async function beginProjectsExperience(initialProgress = 0.06): Promise<void> {
  if (viewMode === "library") {
    libraryJourneyTargetProgress = Math.max(libraryJourneyTargetProgress, initialProgress);
    return;
  }
  if (!canBeginLibraryJourney({
    viewMode,
    experienceMode,
    loading: !experienceLoaderNode.hidden,
    firstVisitBlocking: firstVisitOnboardingPhase !== "off"
      && firstVisitOnboardingPhase !== "complete",
  })) {
    statusNode.textContent = "请先完成当前纸张";
    return;
  }
  if (!libraryAssetsAttached) {
    statusNode.textContent = "正在整理书架 · 首次进入只需加载一次";
    try {
      await ensureLibraryAssetsReady();
    } catch (error) {
      console.warn("Library assets could not be loaded", error);
      viewportNode.dataset.libraryAssets = "error";
      statusNode.textContent = "书架暂时无法打开 · 请检查网络后重试";
      return;
    }
    if (!canBeginLibraryJourney({
      viewMode,
      experienceMode,
      loading: !experienceLoaderNode.hidden,
      firstVisitBlocking: firstVisitOnboardingPhase !== "off"
        && firstVisitOnboardingPhase !== "complete",
    })) return;
  }
  cancelFirstVisitOnboarding(true);
  cancelPendingArchiveView();
  cancelProjectsNavigation();
  setDrawerOpen("right", false);
  setDrawerOpen("left", false);
  libraryJourneyReturnViewMode = viewMode === "typing" ? "typing" : "hero";
  libraryJourneyStartPosition.copy(camera.position);
  libraryJourneyStartTarget.copy(cameraTarget);
  libraryJourneyTargetProgress = reducedMotion ? 1 : initialProgress;
  libraryJourneyDisplayedProgress = 0;
  captureLibraryJourneyBooks();
  setViewMode("library");
  viewportNode.classList.add("is-library-journey");
  showDefaultNavigation();
  statusNode.textContent = "向下滚动推进镜头 · 向上滚动可返回";
}

function beginLibraryFromExplicitEntry(): void {
  if (shouldDismissFirstVisitForLibrary(firstVisitOnboardingPhase)) {
    cancelFirstVisitOnboarding(true);
  }
  const defaultPaperIsPresented = experienceMode === "presented"
    && presentedFromHistory
    && presentedNavigation === "default"
    && presentedDocument?.id.startsWith("default-");
  if (defaultPaperIsPresented) {
    if (explicitLibraryEntryTimer !== null) return;
    finishPaperPresentation();
    explicitLibraryEntryTimer = window.setTimeout(() => {
      explicitLibraryEntryTimer = null;
      void beginLibraryAutoplay();
    }, 780);
    return;
  }
  void beginLibraryAutoplay();
}

async function beginLibraryAutoplay(): Promise<void> {
  if (reducedMotion) {
    await beginProjectsExperience(1);
    if (viewMode === "library") statusNode.textContent = "正在前往书架";
    return;
  }
  await beginProjectsExperience(0.008);
  if (viewMode !== "library") return;
  libraryJourneyAutoplayStartProgress = Math.max(
    0.008,
    libraryJourneyDisplayedProgress,
  );
  libraryJourneyTargetProgress = libraryJourneyAutoplayStartProgress;
  libraryJourneyDisplayedProgress = libraryJourneyAutoplayStartProgress;
  libraryJourneyAutoplayStartedAt = performance.now();
  statusNode.textContent = "正在前往书架";
}

function selectSiteSection(section: SiteSection): void {
  if (experienceMode !== "typing" || viewMode === "scene") {
    statusNode.textContent = "请先完成当前纸张";
    return;
  }
  cancelFirstVisitOnboarding(true);
  cancelProjectsNavigation();
  cancelPendingArchiveView();
  if (
    section !== "default"
    && shouldCloseSelectedDrawer(
      activeArchiveDrawer,
      drawerBindings[section].openTarget >= 0.5,
      section,
    )
  ) {
    setDrawerOpen("left", false);
    setDrawerOpen("right", false);
    setViewMode("hero");
    showDefaultNavigation();
    return;
  }
  if (section === "default") {
    setDrawerOpen("left", false);
    setDrawerOpen("right", false);
    setViewMode("hero");
    showDefaultNavigation();
    return;
  }
  const otherSide: ArchiveDrawer = section === "left" ? "right" : "left";
  setDrawerOpen(otherSide, false);
  setDrawerOpen(section, true);
  setViewMode("archive");
  showArchivePanel(section);
}

function closeArchivePanel(): void {
  cancelPendingArchiveView();
  if (archivePanelAnimationTimer !== null) {
    window.clearTimeout(archivePanelAnimationTimer);
    archivePanelAnimationTimer = null;
  }
  if (archivePanelRestoreTimer !== null) {
    window.clearTimeout(archivePanelRestoreTimer);
    archivePanelRestoreTimer = null;
  }
  archivePanelNode.hidden = true;
  archivePanelNode.classList.remove("is-paper-dismissing", "is-paper-browser");
  activeArchiveDrawer = null;
  if (viewMode === "archive" && experienceMode === "typing") {
    setDrawerOpen("left", false);
    setDrawerOpen("right", false);
    setViewMode("hero");
  }
}

function showArchivePanel(drawer: ArchiveDrawer): void {
  if (archivePanelAnimationTimer !== null) {
    window.clearTimeout(archivePanelAnimationTimer);
    archivePanelAnimationTimer = null;
  }
  if (archivePanelRestoreTimer !== null) {
    window.clearTimeout(archivePanelRestoreTimer);
    archivePanelRestoreTimer = null;
  }
  activeArchiveDrawer = drawer;
  syncSiteViewNavigation(drawer);
  archivePanelNode.classList.remove("is-paper-browser");
  archiveListNode.replaceChildren();
  const documents = documentsForDrawer(archiveSnapshot, drawer);
  const fullLabel = drawer === "left"
    ? formatKeywordArchiveSummary(
      documents.length,
      isDrawerVisuallyFull(archiveSnapshot, drawer),
    )
    : isDrawerVisuallyFull(archiveSnapshot, drawer)
      ? `视觉已满 · ${documents.length} 条`
      : `${documents.length} / ${ARCHIVE_VISIBLE_CAPACITY[drawer]} 可见`;
  archiveTitleNode.textContent = drawer === "left"
    ? `关键词首印 · ${fullLabel}`
    : `自由纸张 · ${fullLabel}`;
  if (documents.length === 0) {
    const empty = document.createElement("p");
    empty.className = "archive-empty";
    empty.textContent = "抽屉里还没有纸张。";
    archiveListNode.append(empty);
  } else {
    for (const archived of documents) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "archive-document";
      button.dataset.archiveDocumentId = archived.id;
      const index = document.createElement("span");
      index.className = "archive-index";
      index.textContent = String(archiveListNode.childElementCount + 1).padStart(2, "0");
      const title = document.createElement("strong");
      title.textContent = archiveListTitle(archived);
      const meta = document.createElement("span");
      const date = new Date(archived.createdAt);
      meta.textContent = `${archived.keyword ?? archiveTextExcerpt(archived.text)} · ${
        Number.isNaN(date.getTime()) ? archived.createdAt : date.toLocaleString()
      }`;
      button.append(index, title, meta);
      archiveListNode.append(button);
    }
  }
  archivePanelNode.hidden = false;
  requestAnimationFrame(() => {
    archivePanelNode.classList.remove("is-paper-dismissing");
  });
}

function showPresentedDocument(
  documentRecord: ArchiveDocument,
  fromHistory: boolean,
  shouldArchive = true,
  navigation: PresentedNavigation = "archive",
): void {
  presentedDocument = documentRecord;
  presentedPageIndex = 0;
  presentedPageTurn = null;
  presentedFromHistory = fromHistory;
  presentedShouldArchive = shouldArchive;
  presentedNavigation = navigation;
  experienceMode = "presented";
  syncPresentedPage();
  presentedMockNode.hidden = !documentRecord.mock;
  paperArchiveButtonNode.textContent = fromHistory
    ? "放回抽屉"
    : shouldArchive
      ? `收进${documentRecord.drawer === "left" ? "左" : "右"}抽屉并换纸`
      : "结束展示并换纸（不重复归档）";
  paperDownloadButtonNode.hidden = !fromHistory;
  paperPrintButtonNode.hidden = !fromHistory;
  presentedPaperNode.classList.remove(
    "is-archiving-left",
    "is-archiving-right",
    "is-discarding",
  );
  paperPresentationNode.classList.add("uses-3d-paper");
  viewportNode.classList.add("is-paper-presented");
  paperPresentationNode.hidden = false;
  if (!fromHistory && paperBinding) paperBinding.mesh.visible = false;
  if (fromHistory) {
    archivePanelNode.hidden = false;
    archivePanelNode.classList.remove("is-paper-dismissing");
    archivePanelNode.classList.add("is-paper-browser");
    for (const button of archiveListNode.querySelectorAll<HTMLButtonElement>(
      "[data-archive-document-id]",
    )) {
      const active = button.dataset.archiveDocumentId === documentRecord.id;
      if (active) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    }
  } else {
    archivePanelNode.classList.remove("is-paper-browser");
    hideArchivePanelForPaper();
  }
  beginPaperPresentation3D(documentRecord, fromHistory);
  requestAnimationFrame(() => paperPresentationNode.classList.add("is-visible"));
  statusNode.textContent = fromHistory
    ? `正在查看归档：${documentRecord.keyword ?? "自由输入"}`
    : shouldArchive
      ? `${documentRecord.keyword ?? "自由输入"} 已完成 · 纸张等待归档`
      : `${documentRecord.keyword} 已再次打印 · 首次记录已在左抽屉`;
}

function openArchivedDocument(
  documentRecord: ArchiveDocument,
  navigation: PresentedNavigation = "archive",
): void {
  if (experienceMode !== "typing") {
    statusNode.textContent = "请先处理面前的纸张";
    return;
  }
  cancelPendingArchiveView();
  pendingArchiveDocumentId = documentRecord.id;
  setDrawerOpen("left", false);
  setDrawerOpen("right", false);
  setViewMode("archive");
  if (navigation === "default") showDefaultNavigation();
  else showArchivePanel(documentRecord.drawer);
  statusNode.textContent = `正在前往${documentRecord.drawer === "left" ? "左" : "右"}抽屉`;
  archiveDrawerTimer = window.setTimeout(() => {
    if (pendingArchiveDocumentId !== documentRecord.id || viewMode !== "archive") return;
    setDrawerOpen(documentRecord.drawer, true);
    statusNode.textContent = `${documentRecord.drawer === "left" ? "左" : "右"}抽屉正在打开`;
  }, 360);
  archivePaperTimer = window.setTimeout(() => {
    if (pendingArchiveDocumentId !== documentRecord.id || viewMode !== "archive") return;
    pendingArchiveDocumentId = null;
    archiveDrawerTimer = null;
    archivePaperTimer = null;
    showPresentedDocument(documentRecord, true, true, navigation);
  }, 1120);
}

function switchArchivedDocument(
  documentRecord: ArchiveDocument,
  navigation: PresentedNavigation = presentedNavigation,
): void {
  if (
    experienceMode !== "presented"
    || !presentedFromHistory
    || viewMode !== "archive"
  ) {
    openArchivedDocument(documentRecord, navigation);
    return;
  }
  if (presentedDocument?.id === documentRecord.id) return;
  cancelPendingArchiveView();
  setDrawerOpen(documentRecord.drawer === "left" ? "right" : "left", false);
  setDrawerOpen(documentRecord.drawer, true);
  if (navigation === "default") showDefaultNavigation();
  else showArchivePanel(documentRecord.drawer);
  showPresentedDocument(documentRecord, true, true, navigation);
}

function commandArchiveDocument(keyword: string): ArchiveDocument | null {
  const command = findCommand(keyword);
  if (!command) return null;
  const existing = archiveSnapshot.documents.find(
    (documentRecord) => documentRecord.kind === "command"
      && documentRecord.keyword === command.keyword,
  );
  if (existing) return existing;
  const record = createCommandDocument(
    command,
    new Date().toISOString(),
    `${command.keyword}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  archiveSnapshot = archiveDocument(archiveSnapshot, record);
  persistArchive();
  updateDiscoveryProgress();
  syncArchivePaperStacks();
  return record;
}

function finishPaperPresentation(): void {
  const record = presentedDocument;
  if (!record || experienceMode === "archiving") return;
  experienceMode = "archiving";
  paperPresentationNode.classList.remove("is-visible");
  beginPaperExit3D(record, presentedShouldArchive || presentedFromHistory);
  if (presentedShouldArchive || presentedFromHistory) {
    presentedPaperNode.classList.add(
      record.drawer === "left" ? "is-archiving-left" : "is-archiving-right",
    );
    setDrawerOpen(record.drawer, true);
  } else {
    presentedPaperNode.classList.add("is-discarding");
  }
  window.setTimeout(() => {
    paperPresentationNode.hidden = true;
    viewportNode.classList.remove("is-paper-presented");
    presentedPaperNode.classList.remove(
      "is-archiving-left",
      "is-archiving-right",
      "is-discarding",
    );
    if (paperBinding) paperBinding.mesh.visible = true;
    presentationPaper3D.visible = false;
    paperFlightPhase = "hidden";
    const wasHistory = presentedFromHistory;
    const wasArchived = presentedShouldArchive;
    presentedDocument = null;
    presentedPageIndex = 0;
    presentedPageTurn = null;
    presentedFromHistory = false;
    presentedShouldArchive = true;
    presentedNavigation = "archive";
    if (wasHistory) {
      experienceMode = "typing";
      setDrawerOpen(record.drawer, false);
      setViewMode("hero");
      statusNode.textContent = `${record.keyword ?? "自由纸张"} 已放回${
        record.drawer === "left" ? "左" : "右"
      }抽屉 · 返回 Hero`;
    } else {
      resetTypewriter();
      statusNode.textContent = wasArchived
        ? `${record.keyword ?? "普通纸张"} 已归档 · 已装入新纸`
        : `${record.keyword} 重复纸张未保存 · 已装入新纸`;
    }
    if (wasHistory) {
      syncArchivePaperStacks();
      archivePanelRestoreTimer = window.setTimeout(() => {
        archivePanelRestoreTimer = null;
        if (viewMode === "hero" && experienceMode === "typing") {
          showDefaultNavigation();
        }
      }, 680);
    } else if (wasArchived) {
      syncArchivePaperStacks();
      showArchivePanel(record.drawer);
    } else {
      showDefaultNavigation();
    }
  }, 760);
}

function initializePaper(root: THREE.Object3D): void {
  const object = requireNode(root, "PAPER_MESH");
  if (!(object instanceof THREE.Mesh) || !(object.geometry instanceof THREE.BufferGeometry)) {
    throw new Error("PAPER_MESH is not a deformable mesh");
  }
  object.geometry.deleteAttribute("normal");
  const geometry = mergeVertices(object.geometry, 0.00001);
  geometry.computeVertexNormals();
  object.geometry = geometry;
  const positions = geometry.getAttribute("position");
  if (!(positions instanceof THREE.BufferAttribute) || positions.count < 1000) {
    throw new Error(`PAPER_MESH needs subdivided topology; found ${positions.count} vertices`);
  }
  geometry.computeBoundingBox();
  const sourceBounds = geometry.boundingBox;
  if (!sourceBounds) throw new Error("PAPER_MESH has no local bounds");

  const sourceYExtent = sourceBounds.max.y - sourceBounds.min.y;
  const sourceZExtent = sourceBounds.max.z - sourceBounds.min.z;
  const verticalAxis: 1 | 2 = sourceYExtent > sourceZExtent ? 1 : 2;
  const sourceVerticalMinimum = verticalAxis === 1 ? sourceBounds.min.y : sourceBounds.min.z;
  for (let index = 0; index < positions.count; index += 1) {
    const coordinate = positions.getComponent(index, verticalAxis);
    positions.setComponent(
      index,
      verticalAxis,
      extendPaperFromBottom(coordinate, sourceVerticalMinimum),
    );
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) throw new Error("Extended PAPER_MESH has no local bounds");

  const paperLayout = typingPaperLayoutForBrowser(
    mobileViewportQuery.matches,
    safariPaperRendering,
  );
  const canvas = document.createElement("canvas");
  canvas.width = paperLayout.canvasWidth;
  canvas.height = paperLayout.canvasHeight;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  if (mobileViewportQuery.matches || safariPaperRendering) {
    // The paper changes once per mechanical imprint. Avoid rebuilding a full
    // mip chain for every character on Safari, where rapid uploads can leave
    // intermittent glyphs sampled from stale levels. Chrome desktop keeps its
    // existing anisotropic mipmapped path.
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 1;
  } else {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texture,
    emissive: 0x160f0b,
    emissiveIntensity: 0.08,
    roughness: 0.94,
    metalness: 0,
    side: THREE.FrontSide,
  });
  firePaperEffect?.dispose();
  firePaperEffect = createFirePaperEffect(material);
  object.material = firePaperEffect.material;
  material.dispose();
  // A single-sided thin sheet self-shadows along its triangulation under a strong
  // directional light, so it must not shadow itself.
  object.castShadow = false;
  // Re-enable tuned paper shadows with the Phase 6 lamp; the temporary validation
  // light otherwise projects the typebasket as distracting diagonal bands.
  object.receiveShadow = false;
  const depthAxis: 1 | 2 = verticalAxis === 1 ? 2 : 1;
  const verticalMinimum = verticalAxis === 1 ? bounds.min.y : bounds.min.z;
  const verticalMaximum = verticalAxis === 1 ? bounds.max.y : bounds.max.z;
  paperBinding = {
    mesh: object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>,
    basePositions: new Float32Array(positions.array),
    horizontalCenter: (bounds.min.x + bounds.max.x) * 0.5,
    horizontalHalfExtent: (bounds.max.x - bounds.min.x) * 0.5,
    verticalAxis,
    depthAxis,
    verticalMinimum,
    verticalExtent: verticalMaximum - verticalMinimum,
    canvas,
    texture,
  };
  drawPaper(typewriterState);
}

function updatePaper(): void {
  if (!paperBinding) return;
  const positions = paperBinding.mesh.geometry.getAttribute("position");
  if (!(positions instanceof THREE.BufferAttribute)) return;
  const base = paperBinding.basePositions;
  for (let index = 0; index < positions.count; index += 1) {
    const offset = index * 3;
    const baseX = base[offset];
    const baseY = base[offset + 1];
    const baseZ = base[offset + 2];
    if (baseX === undefined || baseY === undefined || baseZ === undefined) continue;
    const normalizedX = (baseX - paperBinding.horizontalCenter) / paperBinding.horizontalHalfExtent;
    const baseCoordinates = [baseX, baseY, baseZ];
    const baseVertical = baseCoordinates[paperBinding.verticalAxis];
    const baseDepth = baseCoordinates[paperBinding.depthAxis];
    if (baseVertical === undefined || baseDepth === undefined) continue;
    const normalizedY = (
      baseVertical - paperBinding.verticalMinimum
    ) / paperBinding.verticalExtent;
    const deformation = samplePaperDeformation(
      normalizedX,
      normalizedY,
      typewriterState.paperFeedLines,
      paperActivity,
    );
    const deformedCoordinates = [baseX, baseY, baseZ];
    const burnDistance = Math.hypot(
      normalizedX - fireBurnOrigin.x,
      (normalizedY - fireBurnOrigin.y) * 1.32,
    );
    const burnFront = fireBurnProgress * 1.48;
    const curlInfluence = fireBurnProgress > 0
      ? 1 - THREE.MathUtils.smoothstep(
          Math.abs(burnDistance - burnFront),
          0.025,
          0.2,
        )
      : 0;
    const replacementProgress = Math.min(
      fireReplacementProgress,
      firstVisitReplacementProgress,
    );
    const replacementOffset = (replacementProgress - 1)
      * paperBinding.verticalExtent
      * 0.82;
    deformedCoordinates[paperBinding.verticalAxis] = baseVertical
      + deformation.verticalOffset
      + replacementOffset
      + curlInfluence * Math.sin(normalizedX * 12 + normalizedY * 7) * 0.007;
    deformedCoordinates[paperBinding.depthAxis] = baseDepth
      + deformation.depthOffset
      + curlInfluence * (0.018 + fireBurnProgress * 0.026);
    positions.setXYZ(index, deformedCoordinates[0]!, deformedCoordinates[1]!, deformedCoordinates[2]!);
  }
  positions.needsUpdate = true;
  paperActivity *= 0.90;
}

function initializeMechanism(root: THREE.Object3D): void {
  for (const keyDefinition of keys) {
    const key = requireNode(root, `KEY_${keyDefinition.id}_PIVOT`);
    const linkage = requireNode(root, `LINK_${keyDefinition.id}_PIVOT`);
    const typebar = keyDefinition.kind === "print"
      ? requireNode(root, `TYPEBAR_${keyDefinition.id}_PIVOT`)
      : null;
    mechanismBindings.set(keyDefinition.id, {
      key,
      linkage,
      typebar,
      keyRestY: key.position.y,
      linkageRest: linkage.quaternion.clone(),
      typebarRest: typebar?.quaternion.clone() ?? null,
      pressDepth: Number(key.userData.pressDepthMeters ?? 0.006),
      linkageAngle: Number(linkage.userData.travelAngleRad ?? -0.34),
      strikeAngle: Number(typebar?.userData.strikeAngleRad ?? 0),
    });
    const hit = requireNode(root, `HIT_KEY_${keyDefinition.id}`);
    hit.userData.keyId = keyDefinition.id;
    hitProxies.push(hit);
  }

  ribbonStrikeZone = requireNode(root, "RIBBON_STRIKE_ZONE_PIVOT");
  ribbonRestY = ribbonStrikeZone.position.y;
  carriage = requireNode(root, "CARRIAGE_ROOT");
  carriageRestX = carriage.position.x;
  carriage.position.x = carriagePosition(typewriterState.column);
  platen = requireNode(root, "PLATEN_PIVOT");
  platenRest = platen.quaternion.clone();
  returnLever = requireNode(root, "RETURN_LEVER_PIVOT");
  returnLeverRest = returnLever.quaternion.clone();
  bellHammer = requireNode(root, "BELL_HAMMER_PIVOT");
  bellHammerRest = bellHammer.quaternion.clone();

  const paperRoot = requireNode(root, "PAPER_ROOT");
  carriage.attach(paperRoot);
  initializePaper(root);

  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "[data-demo], [data-return], [data-reset]",
  )) {
    button.disabled = false;
  }
}

function initializeVendorDesk(root: THREE.Object3D): void {
  // Match the 1.60 × 0.80 × 0.76 m homepage footprint without modifying the
  // downloaded source file. Resolve placement from the loaded world bounds
  // because the authored armature has a deliberately offset origin.
  root.scale.set(1.6 / 3.0557, 0.76 / 1.6226, 0.80 / 2.1339);
  root.rotation.set(0, 0, 0);
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
  root.position.set(-center.x, -bounds.max.y, -center.z);
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      if (object.name.includes("lamparaSSS")) {
        const shadeMaterial = object.material;
        if (shadeMaterial instanceof THREE.MeshStandardMaterial) {
          object.material = shadeMaterial.clone();
          object.material.color.multiplyScalar(0.58);
          object.material.emissiveIntensity = 0;
          object.material.roughness = Math.max(0.78, object.material.roughness);
        }
      }
    }
  });

  const leftBone = requireEnvironmentNode(root, "Drawer_L_Big_03");
  const rightBone = requireEnvironmentNode(root, "Drawer_R_Upper_01");
  const rightLowerBone = requireEnvironmentNode(root, "Drawer_R_Lower_02");
  const slidingDoorLeft = requireEnvironmentNode(root, "SlidingDoor_L_04");
  const slidingDoorRight = requireEnvironmentNode(root, "SlidingDoor_R_05");
  leftBone.position.y = -0.42397376894950867;
  rightBone.position.y = -0.4194371700286865;
  rightLowerBone.position.y = -0.41826367378234863;
  slidingDoorLeft.position.x = -0.9017324447631836;
  slidingDoorRight.position.x = 0.9011660218238831;
  drawerBindings.left.vendorBone = leftBone;
  drawerBindings.left.vendorRestY = leftBone.position.y;
  drawerBindings.right.vendorBone = rightBone;
  drawerBindings.right.vendorRestY = rightBone.position.y;
}

function initializeVendorDrawerHitTargets(): void {
  for (const side of ["left", "right"] as const) {
    const layout = drawerHitTargetLayout(side, heroDeskY, 0);
    const hitTarget = new THREE.Mesh(
      new THREE.BoxGeometry(...layout.size),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
      }),
    );
    hitTarget.name = `HIT_VENDOR_DRAWER_${side.toUpperCase()}`;
    hitTarget.position.set(...layout.position);
    hitTarget.userData.interactive = "drawer";
    hitTarget.userData.drawerSide = side;
    hitTarget.frustumCulled = false;
    scene.add(hitTarget);
    environmentHitProxies.push(hitTarget);
    vendorDrawerHitTargets[side] = hitTarget;
  }
}

function updateVendorDrawerHitTargets(): void {
  for (const side of ["left", "right"] as const) {
    const hitTarget = vendorDrawerHitTargets[side];
    if (!hitTarget) continue;
    const layout = drawerHitTargetLayout(side, heroDeskY, drawerBindings[side].openAmount);
    hitTarget.position.set(...layout.position);
  }
}

function deskSurfaceY(root: THREE.Object3D, x: number, z: number): number {
  root.updateMatrixWorld(true);
  const surfaceRay = new THREE.Raycaster(
    new THREE.Vector3(x, 3, z),
    new THREE.Vector3(0, -1, 0),
    0,
    6,
  );
  const hit = surfaceRay.intersectObject(root, true)[0];
  if (!hit) throw new Error(`Unable to resolve desk surface at ${x}, ${z}`);
  return hit.point.y;
}

function setDrawerOpen(side: DrawerSide, open: boolean): void {
  const binding = drawerBindings[side];
  binding.openTarget = open ? 1 : 0;
  const label = side === "left" ? "左" : "右";
  binding.button.textContent = open ? `关闭${label}抽屉` : `打开${label}抽屉`;
  binding.button.setAttribute("aria-pressed", String(open));
  statusNode.textContent = open
    ? `${label}抽屉开启 · 完成的纸张将存入独立档案槽`
    : `${label}抽屉关闭 · 打字机就绪`;
}

function setViewMode(mode: ViewMode): void {
  viewMode = mode;
  viewportNode.dataset.viewMode = mode;
  if (mode !== "hero" && mode !== "typing") mobileTypewriterFieldNode.blur();
  libraryEnterButtonNode.disabled = mode !== "hero";
  libraryCueNode.disabled = mode !== "hero";
  setImmersiveChromeHidden(false);
  statusNode.textContent = mode === "hero"
    ? "Hero 聚焦模式 · 顶部光束跟随鼠标"
    : mode === "typing"
      ? "打字近景 · 纸面与机械输入保持可读"
    : mode === "archive"
      ? "Archive 固定视角 · 抽屉与纸张叙事"
      : mode === "library"
        ? "镜头正在转向失落书库"
      : mode === "scene"
        ? experienceDirector.snapshot().scene === "snow"
          ? "SNOW · 霜雪换肤"
          : experienceDirector.snapshot().scene === "flower"
            ? "FLOWER · 花枝绽放换肤"
          : "GREEN · 藤蔓换肤"
        : "Typeworld";
}

function setImmersiveChromeHidden(hidden: boolean): void {
  const effectiveHidden = hidden || (
    mobileViewportQuery.matches
    && viewMode === "library"
  );
  if (immersiveChromeHidden === effectiveHidden) return;
  immersiveChromeHidden = effectiveHidden;
  viewportNode.classList.toggle("is-chrome-idle", effectiveHidden);
  if (window.parent !== window) {
    window.parent.postMessage(immersiveChromeMessage(effectiveHidden), location.origin);
  }
}

function noteChromeActivity(): void {
  lastChromeActivityAt = performance.now();
  setImmersiveChromeHidden(false);
}

function updateImmersiveChrome(now: number): void {
  const focusedTarget = typewriterFocusTarget(document.activeElement);
  setImmersiveChromeHidden(shouldHideImmersiveChrome({
    viewMode,
    experienceMode,
    idleForMs: now - lastChromeActivityAt,
    idleThresholdMs: chromeIdleThresholdMs,
    coarsePointer,
    controlFocused: focusedTarget === "control" || focusedTarget === "editing",
    loading: !experienceLoaderNode.hidden || !experienceEntryNode.hidden,
  }));
}

function updateViewAndLighting(now: number, deltaSeconds: number): void {
  const heroActive = viewMode === "hero" || viewMode === "typing";
  const typingActive = viewMode === "typing";
  const archiveActive = viewMode === "archive";
  const libraryActive = viewMode === "library";
  const effectActive = viewMode === "scene" && effectEnvironmentVisible;
  const response = 1 - Math.exp(-deltaSeconds * 6.5);
  const lightResponse = 1 - Math.exp(-deltaSeconds * 4.2);
  const flicker = lampFlicker(now / 1000);
  const firstVisitSpotlight = isFirstVisitSpotlightActive(firstVisitOnboardingPhase);
  const librarySettleAmount = libraryActive
    ? THREE.MathUtils.smoothstep(libraryJourneyDisplayedProgress, 0.72, 1)
    : 0;
  const libraryHemisphereTarget = THREE.MathUtils.lerp(0.92, 0.20, librarySettleAmount);
  const libraryAmbientTarget = THREE.MathUtils.lerp(1.35, 0.34, librarySettleAmount);
  const libraryBounceTarget = THREE.MathUtils.lerp(0.82, 0.16, librarySettleAmount);
  const libraryArchiveSpotTarget = THREE.MathUtils.lerp(7.4, 1.15, librarySettleAmount);

  hemisphereLight.intensity = THREE.MathUtils.lerp(
    hemisphereLight.intensity,
    firstVisitSpotlight ? 0.08 : heroActive ? 0.62 : libraryActive ? libraryHemisphereTarget : archiveActive ? 1.38 : 1.75,
    lightResponse,
  );
  ambientFill.intensity = THREE.MathUtils.lerp(
    ambientFill.intensity,
    firstVisitSpotlight ? 0.10 : heroActive ? 0.88 : libraryActive ? libraryAmbientTarget : archiveActive ? 1.82 : 2.60,
    lightResponse,
  );
  roomBounce.intensity = THREE.MathUtils.lerp(
    roomBounce.intensity,
    firstVisitSpotlight ? 0.06 : heroActive ? 0.46 : libraryActive ? libraryBounceTarget : archiveActive ? 1.08 : 1.62,
    lightResponse,
  );
  heroSpotLight.intensity = THREE.MathUtils.lerp(
    heroSpotLight.intensity,
    firstVisitSpotlight
      ? 10.4 * (0.985 + flicker * 0.015)
      : (heroActive || effectActive) ? 7.2 * flicker : 0,
    lightResponse,
  );
  const archivePaperActive = archiveActive
    && experienceMode === "presented"
    && presentedFromHistory;
  archiveSpotLight.intensity = THREE.MathUtils.lerp(
    archiveSpotLight.intensity,
    libraryActive
      ? libraryArchiveSpotTarget * (0.97 + flicker * 0.03)
      : archiveActive
      ? (archivePaperActive ? 8.8 : 12.8) * (0.97 + flicker * 0.03)
      : 0,
    lightResponse,
  );
  heroConeMaterial.opacity = THREE.MathUtils.lerp(
    heroConeMaterial.opacity,
    firstVisitSpotlight ? 0 : (heroActive || effectActive) ? 0.022 : 0,
    lightResponse,
  );
  heroCone.visible = heroConeMaterial.opacity > 0.002;
  libraryBookLight.intensity = THREE.MathUtils.lerp(
    libraryBookLight.intensity,
    libraryActive ? 5.4 * librarySettleAmount : 0,
    lightResponse,
  );
  libraryBookLight.position.copy(camera.position);
  libraryBookLight.position.y += 0.08;

  if (libraryActive) {
    if (libraryJourneyAutoplayStartedAt !== null) {
      const elapsedMs = now - libraryJourneyAutoplayStartedAt;
      const progress = libraryJourneyAutoplayProgress(
        libraryJourneyAutoplayStartProgress,
        elapsedMs,
        libraryJourneyAutoplayDurationMs,
      );
      libraryJourneyTargetProgress = progress;
      libraryJourneyDisplayedProgress = progress;
      if (elapsedMs >= libraryJourneyAutoplayDurationMs) {
        libraryJourneyAutoplayStartedAt = null;
      }
    } else {
      const journeyResponse = reducedMotion ? 1 : 1 - Math.exp(-deltaSeconds * 13.5);
      libraryJourneyDisplayedProgress = THREE.MathUtils.lerp(
        libraryJourneyDisplayedProgress,
        libraryJourneyTargetProgress,
        journeyResponse,
      );
      if (Math.abs(libraryJourneyDisplayedProgress - libraryJourneyTargetProgress) < 0.0001) {
        libraryJourneyDisplayedProgress = libraryJourneyTargetProgress;
      }
    }
    const journeyProgress = libraryJourneyCameraProgress(libraryJourneyDisplayedProgress);
    camera.position.lerpVectors(
      libraryJourneyStartPosition,
      libraryCameraPosition,
      journeyProgress,
    );
    cameraTarget.lerpVectors(
      libraryJourneyStartTarget,
      libraryCameraTarget,
      journeyProgress,
    );
    camera.lookAt(cameraTarget);
    if (libraryJourneySettled) {
      updateSettledLibraryBooks(now, deltaSeconds);
      updateLibraryDetail(deltaSeconds);
    } else {
      updateLibraryJourneyBooks(libraryJourneyDisplayedProgress);
    }
    const chromeOpacity = THREE.MathUtils.clamp(
      1 - libraryJourneyDisplayedProgress * 1.72,
      0,
      1,
    );
    viewportNode.style.setProperty("--library-chrome-opacity", chromeOpacity.toFixed(3));
    viewportNode.dataset.libraryProgress = libraryJourneyDisplayedProgress.toFixed(3);

    if (shouldRestoreLibraryHero(
      libraryJourneyTargetProgress,
      libraryJourneyDisplayedProgress,
    )) {
      const returnMode = libraryJourneyReturnViewMode;
      cancelProjectsNavigation();
      setViewMode(returnMode);
      statusNode.textContent = "已返回打字机";
    } else if (
      shouldCompleteLibraryJourney(
        libraryJourneyTargetProgress,
        libraryJourneyDisplayedProgress,
      )
      && !libraryJourneySettled
    ) {
      statusNode.textContent = "七册书已经离架";
      enterSettledLibrary();
    }
  } else if (heroActive || archiveActive || effectActive) {
    const mobileHeroActive = mobileViewportQuery.matches && heroActive;
    const mobileFieldFocused = viewportNode.classList.contains("is-mobile-input-focused");
    const mobileWelcomeActive = mobileViewportQuery.matches && (
      firstVisitOnboardingPhase === "typing"
      || firstVisitOnboardingPhase === "waiting"
    );
    camera.position.lerp(
      effectActive
        ? mobileViewportQuery.matches
          ? mobileSceneCameraPosition
          : greenCameraPosition
        : archiveActive
          ? archiveCameraPosition
          : mobileWelcomeActive
            ? mobileWelcomeCameraPosition
          : mobileFieldFocused
            ? mobileTypingCameraPosition
          : mobileHeroActive
            ? mobileHeroCameraPosition
          : typingActive
            ? typingCameraPosition
            : heroCameraPosition,
      response,
    );
    cameraTarget.lerp(
      effectActive
        ? mobileViewportQuery.matches
          ? mobileSceneCameraTarget
          : greenCameraTarget
        : archiveActive
          ? archiveCameraTarget
          : mobileWelcomeActive
            ? mobileWelcomeCameraTarget
          : mobileFieldFocused
            ? mobileTypingCameraTarget
          : mobileHeroActive
            ? mobileHeroCameraTarget
          : typingActive
            ? typingCameraTarget
            : heroCameraTarget,
      response,
    );
    camera.lookAt(cameraTarget);
  }

  firstVisitLightTarget.set(0, heroDeskY + 0.11, 0.02);
  heroLightTarget.lerp(
    firstVisitSpotlight ? firstVisitLightTarget : heroPointerTarget,
    response,
  );
  heroLightApex.set(
    heroLightTarget.x * 0.28,
    heroDeskY + 1.62,
    heroLightTarget.z * 0.22,
  );
  heroSpotLight.position.copy(heroLightApex);
  heroSpotTarget.position.copy(heroLightTarget);
  archiveSpotLight.position.set(
    libraryActive ? -1.12 : 0.18,
    heroDeskY + (libraryActive ? 1.34 : 1.58),
    libraryActive ? 0.72 : 1.34,
  );
  archiveDefaultLightTarget.set(0, heroDeskY + 0.11, 0.24);
  archiveSpotTarget.position.copy(
    libraryActive ? libraryCameraTarget : archiveDefaultLightTarget,
  );
  coneDirection.subVectors(heroLightTarget, heroLightApex);
  const coneLength = coneDirection.length();
  heroCone.position.copy(heroLightApex).addScaledVector(coneDirection, 0.5);
  heroCone.quaternion.setFromUnitVectors(coneAxis, coneDirection.normalize());
  heroCone.scale.set(1, coneLength, 1);
}

function updateEnvironment(now: number): void {
  const deltaSeconds = Math.min(0.05, Math.max(0, (now - previousFrameTime) / 1000));
  previousFrameTime = now;
  for (const side of ["left", "right"] as const) {
    const binding = drawerBindings[side];
    binding.openAmount = smoothEnvironmentProgress(
      binding.openAmount,
      binding.openTarget,
      deltaSeconds,
    );
    if (binding.pivot) {
      binding.pivot.position.z = binding.restZ + drawerTravel(
        binding.openAmount,
        binding.openTravel,
      );
    }
    if (binding.vendorBone) {
      binding.vendorBone.position.y = binding.vendorRestY
        - binding.vendorOpenTravel * binding.openAmount;
    }
  }
  updateVendorDrawerHitTargets();
  if (effectEnvironmentVisible) {
    archivePaperStacks.left.group.visible = false;
    archivePaperStacks.right.group.visible = false;
  } else {
    updateArchivePaperStacks();
  }
  updateViewAndLighting(now, deltaSeconds);
}

function resetBinding(binding: MechanismBinding): void {
  binding.key.position.y = binding.keyRestY;
  binding.linkage.quaternion.copy(binding.linkageRest);
  if (binding.typebar && binding.typebarRest) binding.typebar.quaternion.copy(binding.typebarRest);
}

function setRotatedPose(
  object: THREE.Object3D,
  rest: THREE.Quaternion,
  axis: THREE.Vector3,
  angle: number,
): void {
  rotationDelta.setFromAxisAngle(axis, angle);
  object.quaternion.copy(rest).multiply(rotationDelta);
}

function enqueueInput(input: QueuedInput): void {
  if (interceptFirstVisitInput(input)) return;
  if (shouldDismissSmilePaperForInput(experienceMode === "smiling", input.source)) {
    resetTypewriter();
  }
  const sceneInputHandoff = resolveSceneInputHandoff(
    experienceDirector.snapshot().phase,
    input.source,
  );
  if (sceneInputHandoff === "begin-exit" || sceneInputHandoff === "defer") {
    void audioController.start();
    if (!deferredSceneInputQueue.enqueue(input)) {
      statusNode.textContent = "场景退出中：输入缓存已满（24）";
      return;
    }
    if (sceneInputHandoff === "begin-exit") beginSceneExit();
    statusNode.textContent = `正在收起当前特效 · 已缓存输入 ${deferredSceneInputQueue.length}/24`;
    return;
  }
  if (experienceMode !== "typing" && input.source !== "auto") {
    statusNode.textContent = "请先处理面前的纸张";
    return;
  }
  void audioController.start();
  const projected = projectedTypewriterState();
  if (input.key.kind === "enter" && projected.row >= projected.maximumRows - 1) {
    statusNode.textContent = `纸张已达到 ${PAPER_MAX_ROWS} 行上限 · 请归档或换纸`;
    return;
  }
  if (
    (input.key.kind === "print" || input.key.kind === "space")
    && projected.column >= projected.columns
  ) {
    if (projected.row >= projected.maximumRows - 1) {
      statusNode.textContent = `纸张已达到 ${PAPER_MAX_ROWS} 行上限 · 请归档或换纸`;
      return;
    }
    const enter = keysById.get("ENTER");
    if (!enter || !inputQueue.enqueue({key: enter, shifted: false, source: "auto"})) {
      statusNode.textContent = "输入过快：机械队列已满（24）";
      return;
    }
  }
  const accepted = inputQueue.enqueue(input);
  if (!accepted) {
    statusNode.textContent = "输入过快：机械队列已满（24）";
    return;
  }
  if (
    viewMode === "hero"
    && input.source !== "auto"
    && input.source !== "demo"
    && input.key.kind !== "modifier"
  ) {
    setViewMode("typing");
  }
  if (input.source === "physical" || input.source === "pointer") {
    drawPaper(projectedTypewriterState());
  }
  statusNode.textContent = `机械队列 ${inputQueue.length}/24 · ${input.key.id}`;
}

function scheduleFirstVisitOnboarding(): void {
  const suppressed = returningFromProjects
    || (initialSearchParams.has("qa") && !firstVisitOnboardingQaMode);
  if (
    !firstVisitOnboardingQaMode
    && !shouldRunFirstVisitOnboarding(localStorage, suppressed)
  ) return;
  if (firstVisitOnboardingQaMode && returningFromProjects) return;
  if (!firstVisitOnboardingQaMode) markFirstVisitOnboardingSeen(localStorage);
  firstVisitOnboardingPhase = "scheduled";
  firstVisitOnboardingStartsAt = Number.POSITIVE_INFINITY;
  firstVisitAccelerated = false;
  firstVisitEnteredAt = Number.POSITIVE_INFINITY;
  viewportNode.dataset.firstVisitPhase = "scheduled";
  delete viewportNode.dataset.firstVisitCompleteMs;
  viewportNode.classList.add("is-first-visit-gate");
  experienceEntryNode.hidden = false;
  requestAnimationFrame(() => experienceEntryNode.classList.add("is-visible"));
  statusNode.textContent = "点击唤醒打字机与机械声音";
}

function enterFirstVisitExperience(): void {
  if (firstVisitOnboardingPhase !== "scheduled") return;
  noteChromeActivity();
  void audioController.start().catch((error: unknown) => {
    console.warn("Typewriter audio could not be resumed", error);
  });
  experienceEntryNode.classList.remove("is-visible");
  viewportNode.classList.remove("is-first-visit-gate");
  firstVisitEnteredAt = performance.now();
  firstVisitOnboardingStartsAt = firstVisitEnteredAt + (reducedMotion ? 1 : 320);
  viewportNode.dataset.firstVisitPhase = "starting";
  firstVisitAccelerateNode.hidden = false;
  requestAnimationFrame(() => firstVisitAccelerateNode.classList.add("is-visible"));
  window.setTimeout(() => {
    experienceEntryNode.hidden = true;
    focusTypewriterInput(true);
  }, reducedMotion ? 1 : 280);
  statusNode.textContent = "机械声音已唤醒 · 正在准备欢迎短笺";
}

function accelerateFirstVisitExperience(): void {
  if (firstVisitOnboardingPhase !== "typing") return;
  noteChromeActivity();
  firstVisitAccelerated = true;
  firstVisitAccelerateNode.disabled = true;
  firstVisitAccelerateNode.classList.add("is-accelerated");
  firstVisitAccelerateNode.innerHTML = "FINISHING THE NOTE <span>正在快速完成</span>";
  statusNode.textContent = "正在快速完成欢迎短笺 · 机械输入仍然保留";
}

function hideFirstVisitAccelerator(): void {
  firstVisitAccelerateNode.classList.remove("is-visible", "is-accelerated");
  firstVisitAccelerateNode.hidden = true;
}

function nextFirstVisitInput(): QueuedInput | null {
  const greeting = mobileViewportQuery.matches
    ? FIRST_VISIT_MOBILE_GREETING
    : FIRST_VISIT_GREETING;
  while (firstVisitOnboardingIndex < greeting.length) {
    const character = greeting[firstVisitOnboardingIndex];
    firstVisitOnboardingIndex += 1;
    if (character === "\n") {
      const enter = keysById.get("ENTER");
      if (enter) return {key: enter, shifted: false, source: "auto"};
      continue;
    }
    if (!character) continue;
    const resolved = keyForCharacter(character);
    if (resolved) return {...resolved, source: "auto"};
  }
  return null;
}

function resetFirstVisitPaper(): void {
  hideFirstVisitAccelerator();
  resetTypewriter();
  firstVisitReplacementProgress = 0;
  firstVisitReplacementStartsAt = performance.now();
  statusNode.textContent = "欢迎短笺已取下 · 正在装入你的纸张";
}

function interceptFirstVisitInput(input: QueuedInput): boolean {
  if (input.source !== "physical" && input.source !== "pointer") return false;
  if (firstVisitOnboardingPhase === "scheduled") {
    firstVisitOnboardingPhase = "complete";
    firstVisitOnboardingStartsAt = Number.POSITIVE_INFINITY;
    hideFirstVisitAccelerator();
    return false;
  }
  if (
    firstVisitOnboardingPhase === "typing"
    || firstVisitOnboardingPhase === "waiting"
  ) {
    firstVisitBufferedInputs.push(input);
    firstVisitOnboardingPhase = "replacing";
    resetFirstVisitPaper();
    return true;
  }
  if (firstVisitOnboardingPhase === "replacing") {
    if (firstVisitBufferedInputs.length < inputQueue.maximumLength) {
      firstVisitBufferedInputs.push(input);
    }
    return true;
  }
  return false;
}

function cancelFirstVisitOnboarding(resetPaper: boolean): void {
  const hadWelcomePaper = firstVisitOnboardingPhase === "typing"
    || firstVisitOnboardingPhase === "waiting"
    || firstVisitOnboardingPhase === "replacing";
  firstVisitOnboardingPhase = "complete";
  firstVisitOnboardingStartsAt = Number.POSITIVE_INFINITY;
  firstVisitBufferedInputs.length = 0;
  firstVisitReplacementProgress = 1;
  hideFirstVisitAccelerator();
  experienceEntryNode.classList.remove("is-visible");
  viewportNode.classList.remove("is-first-visit-gate");
  experienceEntryNode.hidden = true;
  if (resetPaper && hadWelcomePaper) resetTypewriter();
}

function updateFirstVisitOnboarding(now: number): void {
  if (
    firstVisitOnboardingPhase === "scheduled"
    && now >= firstVisitOnboardingStartsAt
  ) {
    firstVisitOnboardingPhase = "typing";
    viewportNode.dataset.firstVisitPhase = "typing";
    statusNode.textContent = "打字机正在写一封欢迎短笺";
  }
  if (
    firstVisitOnboardingPhase === "typing"
    && !activeMechanism
    && inputQueue.length === 0
  ) {
    const nextInput = nextFirstVisitInput();
    if (nextInput) {
      enqueueInput(nextInput);
    } else {
      firstVisitOnboardingPhase = "waiting";
      viewportNode.dataset.firstVisitPhase = "ready";
      if (Number.isFinite(firstVisitEnteredAt)) {
        viewportNode.dataset.firstVisitCompleteMs = String(Math.round(now - firstVisitEnteredAt));
      }
      hideFirstVisitAccelerator();
      // Commit a final full texture upload after the fast mobile welcome queue.
      // This redraw uses the settled state rather than the projected imprint.
      drawPaper(typewriterState);
      forceSafariPaperTextureUpload();
      requestAnimationFrame(() => {
        if (firstVisitOnboardingPhase !== "waiting") return;
        drawPaper(typewriterState);
        forceSafariPaperTextureUpload();
      });
      statusNode.textContent = mobileViewportQuery.matches
        ? FIRST_VISIT_MOBILE_READY_MESSAGE
        : FIRST_VISIT_DESKTOP_READY_MESSAGE;
    }
  }
  if (firstVisitOnboardingPhase !== "replacing") return;
  const durationMs = reducedMotion ? 1 : 680;
  firstVisitReplacementProgress = THREE.MathUtils.smoothstep(
    THREE.MathUtils.clamp((now - firstVisitReplacementStartsAt) / durationMs, 0, 1),
    0,
    1,
  );
  if (firstVisitReplacementProgress < 1) return;
  firstVisitOnboardingPhase = "complete";
  viewportNode.dataset.firstVisitPhase = "complete";
  const buffered = firstVisitBufferedInputs.splice(0);
  for (const input of buffered) enqueueInput(input);
}

function projectedTypewriterState(): TypewriterState {
  let projected = typewriterState;
  if (activeMechanism && !activeMechanism.committed) {
    projected = applyTypewriterKey(
      projected,
      activeMechanism.input.key,
      activeMechanism.input.shifted,
    ).state;
  }
  for (const pending of inputQueue.snapshot()) {
    projected = applyTypewriterKey(projected, pending.key, pending.shifted).state;
  }
  return projected;
}

function commitActiveMechanism(now: number): void {
  if (!activeMechanism || activeMechanism.committed) return;
  activeMechanism.committed = true;
  const shouldToggleModifier = !(
    activeMechanism.input.key.kind === "modifier"
    && activeMechanism.input.source === "physical"
  );
  if (!shouldToggleModifier) return;
  const enteredLine = typewriterState.cells[typewriterState.row]?.join("") ?? "";
  const shouldResolveCommand = (
    activeMechanism.input.key.kind === "enter"
    && activeMechanism.input.source !== "auto"
    && experienceMode === "typing"
  );
  const acceptedFireSnapshot = shouldResolveCommand
    ? createFireTriggerSnapshot(
        paperText(typewriterState),
        currentPaperId,
        hasArchivedCommand(archiveSnapshot, "fire"),
      )
    : null;
  const acceptedSmileSnapshot = shouldResolveCommand && !acceptedFireSnapshot
    ? createSmileTriggerSnapshot(
        paperText(typewriterState),
        currentPaperId,
        hasArchivedCommand(archiveSnapshot, "smile"),
      )
    : null;
  const acceptedSceneCommand = shouldResolveCommand
    && !acceptedFireSnapshot
    && !acceptedSmileSnapshot
    ? findSceneCommand(enteredLine)
    : null;
  const acceptedCommand = shouldResolveCommand
    && !acceptedFireSnapshot
    && !acceptedSmileSnapshot
    && !acceptedSceneCommand
    ? findCommand(enteredLine)
    : null;
  const transition = applyTypewriterKey(
    typewriterState,
    activeMechanism.input.key,
    activeMechanism.input.shifted,
  );
  typewriterState = transition.state;
  if (
    transition.effects.imprint !== null
    || transition.effects.lineFeed
    || activeMechanism.input.key.kind === "backspace"
  ) {
    drawPaper(projectedTypewriterState());
  }
  const soundPlan = soundPlanForKey(activeMechanism.input.key);
  if (soundPlan.imprint) audioController.play(soundPlan.imprint, activeMechanism.input.key.id.length);
  if (transition.effects.bell) {
    bellStartedAt = now;
    audioController.play("bell");
  }
  if (acceptedFireSnapshot) {
    pendingFireSnapshot = acceptedFireSnapshot;
    inputQueue.clear();
    statusNode.textContent = "识别关键词：fire · 正在保护当前纸张内容";
  } else if (acceptedSmileSnapshot) {
    pendingSmileSnapshot = acceptedSmileSnapshot;
    inputQueue.clear();
    statusNode.textContent = "识别关键词：smile · 正在保护当前纸张内容";
  } else if (acceptedSceneCommand) {
    pendingSceneCommand = acceptedSceneCommand;
    inputQueue.clear();
    statusNode.textContent = `识别场景：${acceptedSceneCommand.keyword}`;
  } else if (acceptedCommand) {
    pendingCommand = acceptedCommand;
    inputQueue.clear();
    statusNode.textContent = `识别命令：${acceptedCommand.keyword}`;
  }
  if (
    acceptedFireSnapshot
    || acceptedSmileSnapshot
    || acceptedSceneCommand
    || acceptedCommand
  ) {
    drawPaper(typewriterState);
  }
}

function updateBell(now: number): void {
  if (!bellHammer) return;
  const elapsed = now - bellStartedAt;
  const amount = elapsed >= 0 && elapsed <= 220 ? pulse(elapsed / 220) : 0;
  setRotatedPose(bellHammer, bellHammerRest, localYAxis, -0.42 * amount);
}

function updateMechanism(now: number): void {
  if (!activeMechanism) {
    const input = inputQueue.dequeue();
    const binding = input ? mechanismBindings.get(input.key.id) : undefined;
    if (input && binding) {
      const baseDurationMs = mechanismDurationMs(input, inputQueue.length);
      const welcomeDurationMs = input.source === "auto"
        && firstVisitOnboardingPhase === "typing"
        ? firstVisitMechanismDuration(
            baseDurationMs,
            mobileViewportQuery.matches,
            firstVisitAccelerated,
          )
        : baseDurationMs;
      activeMechanism = {
        input,
        binding,
        startedAt: now,
        durationMs: welcomeDurationMs,
        committed: false,
        startCarriageX: carriage?.position.x ?? 0,
        startPaperFeedLines: typewriterState.paperFeedLines,
      };
      audioController.play(soundPlanForKey(input.key).start, input.key.id.length);
    }
  }
  if (!activeMechanism || !ribbonStrikeZone || !carriage || !platen || !returnLever) {
    updateBell(now);
    return;
  }

  const {binding, input, durationMs} = activeMechanism;
  const elapsed = now - activeMechanism.startedAt;
  const normalized = Math.min(1, elapsed / durationMs);
  const pose = sampleMechanismPose(elapsed, durationMs);
  binding.key.position.y = binding.keyRestY - binding.pressDepth * pose.keyPress;
  setRotatedPose(binding.linkage, binding.linkageRest, localXAxis, binding.linkageAngle * pose.linkageTravel);
  if (binding.typebar && binding.typebarRest) {
    setRotatedPose(binding.typebar, binding.typebarRest, localXAxis, binding.strikeAngle * pose.typebarStrike);
  }
  ribbonStrikeZone.position.y = ribbonRestY + (
    input.key.kind === "print" ? 0.012 * pose.ribbonLift : 0
  );

  if (!activeMechanism.committed && normalized >= 0.36) {
    commitActiveMechanism(now);
    paperActivity = input.key.kind === "enter" ? 1 : 0.55;
  }

  const targetCarriageX = carriagePosition(typewriterState.column);
  const travel = input.key.kind === "enter"
    ? smoothstep((normalized - 0.24) / 0.62)
    : pose.carriageAdvance;
  carriage.position.x = THREE.MathUtils.lerp(
    activeMechanism.startCarriageX,
    targetCarriageX,
    travel,
  );

  const returnAmount = input.key.kind === "enter" ? pulse((normalized - 0.08) / 0.84) : 0;
  setRotatedPose(returnLever, returnLeverRest, localYAxis, -0.48 * returnAmount);
  const platenAngle = -THREE.MathUtils.lerp(
    activeMechanism.startPaperFeedLines,
    typewriterState.paperFeedLines,
    input.key.kind === "enter" ? smoothstep(normalized) : 1,
  ) * 0.105;
  setRotatedPose(platen, platenRest, localXAxis, platenAngle);

  statusNode.textContent = input.key.kind === "enter"
    ? `回车 · 第 ${typewriterState.row + 1} 行`
    : `敲击 ${input.key.id} · 列 ${typewriterState.column}/${PAPER_COLUMNS}`;

  if (elapsed >= durationMs) {
    resetBinding(binding);
    ribbonStrikeZone.position.y = ribbonRestY;
    carriage.position.x = targetCarriageX;
    setRotatedPose(returnLever, returnLeverRest, localYAxis, 0);
    const finishCue = soundPlanForKey(input.key).finish;
    if (finishCue) audioController.play(finishCue, input.key.id.length);
    activeMechanism = null;
    if (inputQueue.length === 0) {
      statusNode.textContent = typewriterState.shiftLatched
        ? "Shift 已锁定 · 等待字符"
        : `就绪 · 第 ${typewriterState.row + 1} 行，第 ${typewriterState.column + 1} 列`;
    }
  }
  updateBell(now);
}

function keyForCharacter(character: string): {key: TypewriterKey; shifted: boolean} | null {
  for (const key of keys) {
    if (key.base === character) return {key, shifted: false};
    if (key.shift === character && key.shift !== key.base) return {key, shifted: true};
  }
  return null;
}

function enqueueText(text: string): void {
  for (const character of text) {
    if (character === "\n") {
      const enter = keysById.get("ENTER");
      if (enter) enqueueInput({key: enter, shifted: false, source: "demo"});
      continue;
    }
    const resolved = keyForCharacter(character);
    if (resolved) enqueueInput({...resolved, source: "demo"});
  }
}

function setEffectEnvironmentVisible(visible: boolean): void {
  if (effectEnvironmentVisible === visible) return;
  effectEnvironmentVisible = visible;
  if (typewriterSceneRoot) typewriterSceneRoot.visible = true;
  const activeScene = experienceDirector.snapshot().scene;
  if (greenRuntime) greenRuntime.group.visible = visible && activeScene === "green";
  if (snowRuntime) snowRuntime.group.visible = visible && activeScene === "snow";
  if (flowerRuntime) flowerRuntime.group.visible = visible && activeScene === "flower";
  renderer.toneMappingExposure = calibratedExposure(1.50);
  syncArchivePaperStacks();
}

async function beginSceneCommand(command: SceneCommandDefinition): Promise<void> {
  const currentScene = experienceDirector.snapshot();
  if (currentScene.scene === command.scene && currentScene.phase !== "idle") {
    experienceMode = currentScene.inputLocked ? "scene-transition" : "typing";
    statusNode.textContent = command.scene === "green"
      ? "GREEN 藤蔓换肤已经开启"
      : command.scene === "snow"
        ? "SNOW 霜雪换肤已经开启"
        : "FLOWER 花枝换肤已经开启";
    return;
  }
  experienceMode = "scene-transition";
  closeArchivePanel();
  setDrawerOpen("left", false);
  setDrawerOpen("right", false);
  const archiveDefinition = sceneCommandArchiveDefinition(command);
  const qaMode = command.scene === "green"
    ? greenOvergrowthQaMode
    : command.scene === "snow"
      ? snowFrostQaMode
      : flowerBloomQaMode;
  const shouldArchive = !qaMode
    && !hasArchivedCommand(archiveSnapshot, command.keyword);
  if (shouldArchive) {
    archiveSnapshot = archiveDocument(
      archiveSnapshot,
      createCommandDocument(
        archiveDefinition,
        new Date().toISOString(),
        `${command.keyword}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ),
    );
    persistArchive();
    updateDiscoveryProgress();
    syncArchivePaperStacks();
  }
  statusNode.textContent = command.scene === "green"
    ? shouldArchive
      ? "GREEN 首次发现已存入左抽屉 · 藤蔓正在苏醒"
      : "GREEN 已发现 · 藤蔓正在重新生长"
    : command.scene === "snow"
      ? shouldArchive
        ? "SNOW 首次发现已存入左抽屉 · 霜雪正在凝结"
        : "SNOW 已发现 · 霜雪正在重新凝结"
      : shouldArchive
        ? "FLOWER 首次发现已存入左抽屉 · 花枝正在苏醒"
        : "FLOWER 已发现 · 花枝正在再次绽放";
  sceneHudNode.hidden = false;
  const sceneTitle = sceneHudNode.querySelector("strong");
  if (sceneTitle) {
    sceneTitle.textContent = command.scene === "green"
      ? "GREEN · OVERGROWTH"
      : command.scene === "snow"
        ? "SNOW · FROST"
        : "FLOWER · URSINIA";
  }
  sceneExitNode.disabled = true;
  if (!typewriterSceneRoot) {
    sceneHudNode.hidden = true;
    experienceMode = "typing";
    statusNode.textContent = `${command.keyword.toUpperCase()} 暂不可用 · 打字机仍在加载`;
    return;
  }
  const loadToken = ++sceneLoadToken;
  try {
    if (command.scene === "green" && !greenRuntime) {
      const {loadGreenOvergrowth} = await import("./green-overgrowth");
      greenRuntime = await loadGreenOvergrowth(typewriterSceneRoot);
    }
    if (command.scene === "snow" && !snowRuntime) {
      const {createSnowFrost} = await import("./snow-frost");
      snowRuntime = createSnowFrost(typewriterSceneRoot, reducedMotion);
    }
    if (command.scene === "flower" && !flowerRuntime) {
      const {loadFlowerBloom} = await import("./flower-bloom");
      flowerRuntime = await loadFlowerBloom(typewriterSceneRoot, reducedMotion);
    }
    if (loadToken !== sceneLoadToken) {
      if (command.scene === "green") {
        greenRuntime?.dispose();
        greenRuntime = null;
      } else if (command.scene === "snow") {
        snowRuntime?.dispose();
        snowRuntime = null;
      } else {
        flowerRuntime?.dispose();
        flowerRuntime = null;
      }
      return;
    }
    experienceDirector.enter(command.scene, performance.now());
    setViewMode("scene");
    statusNode.textContent = command.scene === "green"
      ? "GREEN · PBR 藤蔓正在沿静态外壳生长"
      : command.scene === "snow"
        ? "SNOW · 霜层与冰晶正在沿外壳凝结"
        : "FLOWER · CC0 野花正在沿静态外框绽放";
  } catch (error) {
    console.error(error);
    sceneHudNode.hidden = true;
    experienceMode = "typing";
    statusNode.textContent = `${command.keyword.toUpperCase()} 材质加载失败 · 已保留桌面状态`;
  }
}

function beginSceneExit(): void {
  const sceneId = experienceDirector.snapshot().scene;
  if (!experienceDirector.exit(performance.now())) return;
  experienceMode = "scene-transition";
  sceneExitNode.disabled = true;
  statusNode.textContent = `${sceneId?.toUpperCase() ?? "SCENE"} · 正在返回桌面`;
}

function replayDeferredSceneInputs(): void {
  const deferredInputs: QueuedInput[] = [];
  let input = deferredSceneInputQueue.dequeue();
  while (input) {
    deferredInputs.push(input);
    input = deferredSceneInputQueue.dequeue();
  }
  if (deferredInputs.length === 0) return;
  for (const deferredInput of deferredInputs) inputQueue.enqueue(deferredInput);
  if (
    deferredInputs.some((item) => (
      item.source !== "auto"
      && item.source !== "demo"
      && item.key.kind !== "modifier"
    ))
  ) {
    setViewMode("typing");
  }
  statusNode.textContent = `旧特效已退出 · 正在恢复 ${deferredInputs.length} 个输入`;
}

function updateImmersiveScene(now: number): void {
  const snapshot = experienceDirector.update(now);
  sceneTransitionNode.style.opacity = (snapshot.overlayOpacity * 0.18).toFixed(3);
  sceneTransitionNode.classList.toggle("is-active", snapshot.overlayOpacity > 0.002);
  if (snapshot.scene === "green") {
    const growth = snapshot.phase === "exiting"
      ? 1 - snapshot.progress
      : snapshot.phase === "active"
        ? 1
        : snapshot.progress;
    greenRuntime?.setProgress(growth);
    greenRuntime?.update(now);
  } else if (snapshot.scene === "snow") {
    const growth = snapshot.phase === "exiting"
      ? 1 - snapshot.progress
      : snapshot.phase === "active"
        ? 1
        : snapshot.progress;
    snowRuntime?.setProgress(growth);
    snowRuntime?.update(now);
  } else if (snapshot.scene === "flower") {
    const growth = snapshot.phase === "exiting"
      ? 1 - snapshot.progress
      : snapshot.phase === "active"
        ? 1
        : snapshot.progress;
    flowerRuntime?.setProgress(growth);
    flowerRuntime?.update(now);
  }
  setEffectEnvironmentVisible(snapshot.environmentVisible);

  if (snapshot.phase !== previousSceneTransitionPhase) {
    if (snapshot.phase === "active") {
      experienceMode = "typing";
      sceneExitNode.disabled = false;
      statusNode.textContent = snapshot.scene === "green"
        ? "GREEN · 藤蔓换肤已完成"
        : snapshot.scene === "snow"
          ? "SNOW · 霜雪换肤已完成"
          : "FLOWER · 花枝与飘落花瓣已经稳定";
    } else if (snapshot.phase === "idle" && previousSceneTransitionPhase === "exiting") {
      setEffectEnvironmentVisible(false);
      greenRuntime?.dispose();
      greenRuntime = null;
      snowRuntime?.dispose();
      snowRuntime = null;
      flowerRuntime?.dispose();
      flowerRuntime = null;
      sceneHudNode.hidden = true;
      experienceMode = "typing";
      setViewMode("hero");
      showDefaultNavigation();
      if (deferredSceneInputQueue.length > 0) {
        replayDeferredSceneInputs();
      } else {
        statusNode.textContent = "场景换肤已经退去 · 返回桌面 Hero";
      }
    }
    previousSceneTransitionPhase = snapshot.phase;
  }
}

function startCommand(command: CommandDefinition): void {
  const shouldArchive = !hasArchivedCommand(archiveSnapshot, command.keyword);
  const record = createCommandDocument(
    command,
    new Date().toISOString(),
    `${command.keyword}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  if (shouldArchive) {
    archiveSnapshot = archiveDocument(archiveSnapshot, record);
    persistArchive();
    updateDiscoveryProgress();
    syncArchivePaperStacks();
  }
  resetTypewriter();
  showPresentedDocument(record, false, shouldArchive);
  statusNode.textContent = `${command.keyword} 已接受 · 纸张已展开`;
}

function startFirePaper(snapshot: FireTriggerSnapshot): void {
  const createdAt = new Date().toISOString();
  const idSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const transaction = applyFireArchiveTransaction(
    archiveSnapshot,
    snapshot,
    createdAt,
    idSuffix,
  );
  archiveSnapshot = transaction.snapshot;
  persistArchive();
  updateDiscoveryProgress();
  syncArchivePaperStacks();

  const paperLayout = typingPaperLayoutForBrowser(
    mobileViewportQuery.matches,
    safariPaperRendering,
  );
  const characterStep = paperLayout.characterStep;
  const paperLeft = (
    paperLayout.canvasWidth
    - characterStep * typewriterState.columns
  ) / 2;
  const originU = (
    paperLeft + characterStep * 2
  ) / paperLayout.canvasWidth;
  const triggerRowWindow = mobileViewportQuery.matches
    ? mobileTypingPaperRowWindow(typewriterState.row, typewriterState.rows)
    : {firstRow: 0};
  const triggerBaseline = paperLayout.textTop
    + (typewriterState.row - triggerRowWindow.firstRow) * paperLayout.lineStep;
  const originV = 1 - (
    triggerBaseline - paperLayout.fontSize * 0.35
  ) / paperLayout.canvasHeight;
  firePaperEffect?.setBurnOrigin(originU, originV);
  fireBurnOrigin.set(originU * 2 - 1, originV);
  firePaperEffect?.setProgress(0);
  fireBurnProgress = 0;
  fireReplacementProgress = 1;
  fireReplacementLoaded = false;
  activeFireSnapshot = snapshot;
  fireStartedAt = performance.now();
  experienceMode = "burning";
  audioController.stop("fire", 0);
  audioController.play("fire");
  statusNode.textContent = transaction.ordinaryDocument
    ? "普通内容已存入右抽屉 · fire 首印已保护 · 准备燃烧"
    : transaction.keywordDocument
      ? "fire 首印已存入左抽屉 · 准备燃烧"
      : "fire 已发现 · 再次执行燃烧换纸";
}

function updateFirePaper(now: number): void {
  if (!activeFireSnapshot) return;
  const sample = sampleFirePaperTimeline(now - fireStartedAt, reducedMotion);
  fireBurnProgress = sample.burnProgress;
  firePaperEffect?.setProgress(sample.burnProgress);

  if (sample.phase === "replacing") {
    if (!fireReplacementLoaded) {
      typewriterState = createTypewriterState(PAPER_COLUMNS, PAPER_ROWS, PAPER_MAX_ROWS);
      currentPaperId = `paper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      firePaperEffect?.setProgress(0);
      fireBurnProgress = 0;
      fireReplacementLoaded = true;
      drawPaper(typewriterState);
      statusNode.textContent = "纸张已燃尽 · 滚筒正在送入新纸";
    }
    fireReplacementProgress = sample.replacementProgress;
  }

  if (!sample.complete) return;
  firePaperEffect?.setProgress(0);
  fireBurnProgress = 0;
  fireReplacementProgress = 1;
  fireReplacementLoaded = false;
  activeFireSnapshot = null;
  fireStartedAt = Number.NEGATIVE_INFINITY;
  experienceMode = "typing";
  if (viewMode === "typing") setViewMode("hero");
  drawPaper(typewriterState);
  statusNode.textContent = "fire 燃烧换纸完成 · 等待输入";
  audioController.stop("fire");
}

function recoverFirePaper(error: unknown): void {
  console.warn("Fire paper animation recovered with a forced replacement", error);
  audioController.stop("fire");
  try {
    firePaperEffect?.setProgress(0);
  } catch (resetError) {
    console.warn("Unable to reset fire paper material during recovery", resetError);
  }
  typewriterState = createTypewriterState(PAPER_COLUMNS, PAPER_ROWS, PAPER_MAX_ROWS);
  currentPaperId = `paper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  fireBurnProgress = 0;
  fireReplacementProgress = 1;
  fireReplacementLoaded = false;
  activeFireSnapshot = null;
  fireStartedAt = Number.NEGATIVE_INFINITY;
  experienceMode = "typing";
  if (viewMode === "typing") setViewMode("hero");
  try {
    drawPaper(typewriterState);
  } catch (drawError) {
    console.warn("Unable to redraw replacement paper during recovery", drawError);
  }
  statusNode.textContent = "燃烧动画已安全恢复 · 已装入新纸";
}

function startSmilePaper(snapshot: SmileTriggerSnapshot): void {
  const createdAt = new Date().toISOString();
  const idSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const transaction = applySmileArchiveTransaction(
    archiveSnapshot,
    snapshot,
    createdAt,
    idSuffix,
  );
  archiveSnapshot = transaction.snapshot;
  persistArchive();
  updateDiscoveryProgress();
  syncArchivePaperStacks();

  typewriterState = createTypewriterState(PAPER_COLUMNS, PAPER_ROWS, PAPER_MAX_ROWS);
  currentPaperId = `paper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  activeSmileSnapshot = snapshot;
  smileStartedAt = performance.now();
  smileDrawProgress = 0;
  smilePaperActive = false;
  experienceMode = "smiling";
  drawPaper(typewriterState);
  statusNode.textContent = transaction.ordinaryDocument
    ? "普通内容已存入右抽屉 · smile 首印已保护 · 正在手绘"
    : transaction.keywordDocument
      ? "smile 首印已存入左抽屉 · 正在手绘"
      : "smile 已发现 · 正在重新手绘笑脸";
}

function updateSmilePaper(now: number): void {
  if (!activeSmileSnapshot) return;
  const sample = sampleSmilePaperTimeline(now - smileStartedAt, reducedMotion);
  smileDrawProgress = sample.drawProgress;
  drawPaper(typewriterState);
  if (!sample.complete) return;
  activeSmileSnapshot = null;
  smileStartedAt = Number.NEGATIVE_INFINITY;
  smileDrawProgress = 1;
  smilePaperActive = true;
  experienceMode = "smiling";
  drawPaper(typewriterState);
  statusNode.textContent = "smile 手绘完成 · 直接输入即可在新纸上继续";
}

function updateExperience(): void {
  if (pendingFireSnapshot && !activeMechanism && inputQueue.length === 0) {
    const snapshot = pendingFireSnapshot;
    pendingFireSnapshot = null;
    startFirePaper(snapshot);
    return;
  }
  if (pendingSmileSnapshot && !activeMechanism && inputQueue.length === 0) {
    const snapshot = pendingSmileSnapshot;
    pendingSmileSnapshot = null;
    startSmilePaper(snapshot);
    return;
  }
  if (pendingSceneCommand && !activeMechanism && inputQueue.length === 0) {
    const command = pendingSceneCommand;
    pendingSceneCommand = null;
    void beginSceneCommand(command);
    return;
  }
  if (pendingCommand && !activeMechanism && inputQueue.length === 0) {
    const command = pendingCommand;
    pendingCommand = null;
    startCommand(command);
  }
}

function resetTypewriter(): void {
  inputQueue.clear();
  deferredSceneInputQueue.clear();
  activeMechanism = null;
  pendingCommand = null;
  pendingSceneCommand = null;
  pendingFireSnapshot = null;
  pendingSmileSnapshot = null;
  activeFireSnapshot = null;
  fireStartedAt = Number.NEGATIVE_INFINITY;
  fireBurnProgress = 0;
  fireReplacementProgress = 1;
  fireReplacementLoaded = false;
  audioController.stop("fire");
  firePaperEffect?.setProgress(0);
  activeSmileSnapshot = null;
  smileStartedAt = Number.NEGATIVE_INFINITY;
  smileDrawProgress = 0;
  smilePaperActive = false;
  currentPaperId = `paper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  experienceMode = "typing";
  for (const binding of mechanismBindings.values()) resetBinding(binding);
  typewriterState = createTypewriterState(PAPER_COLUMNS, PAPER_ROWS, PAPER_MAX_ROWS);
  if (carriage) carriage.position.x = carriagePosition(0);
  if (platen) platen.quaternion.copy(platenRest);
  if (returnLever) returnLever.quaternion.copy(returnLeverRest);
  if (ribbonStrikeZone) ribbonStrikeZone.position.y = ribbonRestY;
  paperActivity = 0;
  if (paperBinding) paperBinding.mesh.visible = true;
  paperPresentationNode.hidden = true;
  paperPresentationNode.classList.remove("is-visible");
  presentedPaperNode.classList.remove("is-archiving-left", "is-archiving-right", "is-discarding");
  presentationPaper3D.visible = false;
  paperFlightPhase = "hidden";
  presentedDocument = null;
  presentedPageIndex = 0;
  presentedPageTurn = null;
  presentedFromHistory = false;
  presentedShouldArchive = true;
  presentedNavigation = "archive";
  if (viewMode === "typing") setViewMode("hero");
  drawPaper(typewriterState);
  statusNode.textContent = "已装入新纸 · 等待输入";
}

function archiveFreeformAndLoadNewPaper(): void {
  if (
    firstVisitOnboardingPhase === "scheduled"
    || firstVisitOnboardingPhase === "typing"
    || firstVisitOnboardingPhase === "waiting"
    || firstVisitOnboardingPhase === "replacing"
  ) {
    cancelFirstVisitOnboarding(true);
    statusNode.textContent = "欢迎短笺已取下 · 已装入新纸";
    return;
  }
  if (experienceMode === "smiling") {
    resetTypewriter();
    statusNode.textContent = "笑脸纸已取下 · 已装入新纸";
    return;
  }
  if (experienceMode !== "typing") {
    statusNode.textContent = "请先处理面前的纸张";
    return;
  }
  const text = paperText(typewriterState).trim();
  if (!text) {
    resetTypewriter();
    statusNode.textContent = "空白纸未归档 · 已装入新纸";
    return;
  }
  const record = createFreeformDocument(
    text,
    new Date().toISOString(),
    `freeform-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  archiveSnapshot = archiveDocument(archiveSnapshot, record);
  persistArchive();
  if (viewMode === "typing") setViewMode("hero");
  showPresentedDocument(record, false, true);
  statusNode.textContent = "普通纸张正在送入右抽屉";
  window.setTimeout(() => {
    if (presentedDocument?.id === record.id && experienceMode === "presented") {
      finishPaperPresentation();
    }
  }, 420);
}

document.querySelector<HTMLButtonElement>("[data-demo]")?.addEventListener("click", () => {
  enqueueText("green\n");
});
experienceEnterNode.addEventListener("click", enterFirstVisitExperience);
firstVisitAccelerateNode.addEventListener("click", accelerateFirstVisitExperience);
mobileTypewriterFieldNode.addEventListener("focus", () => {
  noteChromeActivity();
  syncMobileInputFromPaper();
  viewportNode.classList.add("is-mobile-input-focused");
  updateMobileViewportMetrics();
  setMobileInputFeedback("英文系统键盘输入 · 机械结构会逐字响应");
});
mobileTypewriterFieldNode.addEventListener("blur", () => {
  requestAnimationFrame(() => {
    if (document.activeElement !== mobileTypewriterFieldNode) {
      viewportNode.classList.remove("is-mobile-input-focused");
      updateMobileViewportMetrics();
    }
  });
});
mobileTypewriterFieldNode.addEventListener("compositionstart", () => {
  mobileInputComposing = true;
});
mobileTypewriterFieldNode.addEventListener("compositionend", () => {
  mobileInputComposing = false;
  routeMobileFieldValue(mobileTypewriterFieldNode.value);
});
mobileTypewriterFieldNode.addEventListener("input", () => {
  if (!mobileInputComposing) routeMobileFieldValue(mobileTypewriterFieldNode.value);
});
mobileTypewriterFieldNode.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  event.stopPropagation();
  submitMobileInput();
});
mobileTypewriterFieldNode.addEventListener("select", keepMobileCaretAtEnd);
mobileTypewriterFieldNode.addEventListener("click", keepMobileCaretAtEnd);
mobileTypewriterEnterNode.addEventListener("pointerdown", (event) => {
  event.preventDefault();
});
mobileTypewriterEnterNode.addEventListener("click", () => {
  focusMobileTypewriterInput();
  submitMobileInput();
});
window.visualViewport?.addEventListener("resize", updateMobileViewportMetrics);
window.visualViewport?.addEventListener("scroll", updateMobileViewportMetrics);
mobileViewportQuery.addEventListener("change", () => {
  if (!mobileViewportQuery.matches) mobileTypewriterFieldNode.blur();
  roomEnvironment?.setCompactWallLayout(mobileViewportQuery.matches);
  updateMobileViewportMetrics();
});
updateMobileViewportMetrics();
document.querySelector<HTMLButtonElement>("[data-return]")?.addEventListener("click", () => {
  const enter = keysById.get("ENTER");
  if (enter) enqueueInput({key: enter, shifted: false, source: "pointer"});
});
document.querySelector<HTMLButtonElement>("[data-reset]")?.addEventListener(
  "click",
  archiveFreeformAndLoadNewPaper,
);
drawerLeftButtonNode.addEventListener("click", () => {
  selectSiteSection("left");
});
drawerRightButtonNode.addEventListener("click", () => {
  selectSiteSection("right");
});
libraryEnterButtonNode.addEventListener("click", beginLibraryFromExplicitEntry);
libraryCueNode.addEventListener("click", beginLibraryFromExplicitEntry);
libraryTouchBackNode.addEventListener("click", () => {
  if (libraryStage === "index") returnLibraryToHero();
  else closeLibraryBook();
});
audioToggleNode.addEventListener("click", () => {
  void audioController.start();
  const muted = audioController.toggleMuted();
  sitePreferences = {...sitePreferences, soundEnabled: !muted};
  writeSitePreferences(sitePreferences);
  audioToggleNode.textContent = muted ? "声音关闭" : "声音开启";
  audioToggleNode.setAttribute("aria-pressed", String(muted));
});
volumeNode.addEventListener("input", () => {
  void audioController.start();
  const volume = Number(volumeNode.value);
  audioController.setVolume(volume);
  sitePreferences = {...sitePreferences, volume};
  writeSitePreferences(sitePreferences);
});
paperArchiveButtonNode.addEventListener("click", finishPaperPresentation);
paperPreviousButtonNode.addEventListener("click", () => beginPresentedPageTurn(-1));
paperNextButtonNode.addEventListener("click", () => beginPresentedPageTurn(1));
paperDownloadButtonNode.addEventListener("click", () => void downloadPresentedArchive());
paperPrintButtonNode.addEventListener("click", () => void printPresentedArchive());
archiveCloseNode.addEventListener("click", () => selectSiteSection("default"));
sceneExitNode.addEventListener("click", beginSceneExit);
for (const button of siteViewButtonNodes) {
  button.addEventListener("click", () => {
    const section = button.dataset.siteView;
    if (section === "default" || section === "left" || section === "right") {
      selectSiteSection(section);
    }
  });
}
archiveListNode.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const defaultButton = target.closest<HTMLButtonElement>("[data-default-entry]");
  if (defaultButton?.dataset.defaultEntry) {
    const entry = findDefaultHomeEntry(defaultButton.dataset.defaultEntry);
    if (!entry) return;
    cancelFirstVisitOnboarding(true);
    if (entry.action === "library") {
      beginLibraryFromExplicitEntry();
      return;
    }
    const documentRecord = defaultHomeDocument(entry);
    if (experienceMode === "presented" && presentedFromHistory) {
      switchArchivedDocument(documentRecord, "default");
    } else {
      openArchivedDocument(documentRecord, "default");
    }
    return;
  }
  const commandButton = target.closest<HTMLButtonElement>("[data-command-keyword]");
  if (commandButton?.dataset.commandKeyword) {
    cancelFirstVisitOnboarding(true);
    const record = commandArchiveDocument(commandButton.dataset.commandKeyword);
    if (record) {
      if (experienceMode === "presented" && presentedFromHistory) {
        switchArchivedDocument(record, "default");
      } else {
        openArchivedDocument(record, "default");
      }
    }
    return;
  }
  const button = target.closest<HTMLButtonElement>("[data-archive-document-id]");
  if (!button) return;
  cancelFirstVisitOnboarding(true);
  const record = archiveSnapshot.documents.find(
    (documentRecord) => documentRecord.id === button.dataset.archiveDocumentId,
  );
  if (!record) return;
  switchArchivedDocument(record, "archive");
});

addEventListener("keydown", (event) => {
  noteChromeActivity();
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  if (viewMode === "library") {
    if (event.key === "Escape") {
      event.preventDefault();
      if (libraryStage !== "index") {
        closeLibraryBook();
        return;
      }
      returnLibraryToHero();
      return;
    }
    if (libraryStage === "reading" && event.key === "ArrowRight") {
      event.preventDefault();
      turnLibraryPage(1);
      return;
    }
    if (libraryStage === "reading" && event.key === "ArrowLeft") {
      event.preventDefault();
      turnLibraryPage(-1);
      return;
    }
    if (libraryJourneySettled && libraryStage === "index" && (event.key === "ArrowRight" || event.key === "ArrowDown")) {
      event.preventDefault();
      setLibrarySelection(librarySelectedIndex + 1);
      return;
    }
    if (libraryJourneySettled && libraryStage === "index" && (event.key === "ArrowLeft" || event.key === "ArrowUp")) {
      event.preventDefault();
      setLibrarySelection(librarySelectedIndex - 1);
      return;
    }
    return;
  }
  if (event.key === "Escape" && viewMode === "scene") {
    event.preventDefault();
    beginSceneExit();
    return;
  }
  if (experienceMode === "presented" && presentedDocument) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      beginPresentedPageTurn(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      beginPresentedPageTurn(1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finishPaperPresentation();
    }
    return;
  }
  const sceneExitBufferActive = experienceDirector.snapshot().phase === "exiting";
  const canRouteExperienceInput = canRouteTypewriterExperienceInput(
    experienceMode === "typing"
      ? "typing"
      : experienceMode === "smiling"
        ? "smiling"
        : "blocked",
    sceneExitBufferActive,
    smilePaperActive,
  );
  if (!canRouteExperienceInput) {
    if (event.key === "Escape" && experienceMode === "presented") finishPaperPresentation();
    return;
  }
  const key = keysByCode.get(event.code);
  if (!key) return;
  if (!shouldRouteTypewriterKey(typewriterFocusTarget(event.target), key.kind)) return;
  event.preventDefault();
  if (document.activeElement !== renderer.domElement) focusTypewriterInput(true);
  enqueueInput({key, shifted: event.shiftKey, source: "physical"});
});

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (!mobileViewportQuery.matches) focusTypewriterInput(true);
  pointerStart = {x: event.clientX, y: event.clientY};
  if (mobileViewportQuery.matches && viewMode === "library" && libraryJourneySettled) {
    mobileLibraryGesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      currentX: event.clientX,
      currentY: event.clientY,
    };
    renderer.domElement.setPointerCapture(event.pointerId);
  }
});

addEventListener("pageshow", () => {
  if (!mobileViewportQuery.matches) requestAnimationFrame(() => focusTypewriterInput());
});
renderer.domElement.addEventListener("pointermove", (event) => {
  if (viewMode !== "hero" && viewMode !== "typing" && viewMode !== "archive" && viewMode !== "library") return;
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  if (viewMode === "library") {
    if (
      mobileLibraryGesture
      && mobileLibraryGesture.pointerId === event.pointerId
      && libraryStage === "reading"
    ) {
      mobileLibraryGesture.currentX = event.clientX;
      mobileLibraryGesture.currentY = event.clientY;
      const drag = sampleMobileLibraryPageDrag(
        event.clientX - mobileLibraryGesture.startX,
        event.clientY - mobileLibraryGesture.startY,
        bounds.width,
        libraryDetailPageIndex > 0,
        libraryDetailPageIndex < libraryDetailMaximumPageIndex(),
      );
      libraryPageDragDirection = drag.direction;
      libraryPageDragProgress = drag.progress;
      if (drag.horizontal) event.preventDefault();
    }
    renderer.domElement.style.cursor = libraryJourneySettled
      && (libraryStage === "reading" || (libraryStage === "index" && intersectLibraryBook() !== null))
      ? "pointer"
      : "default";
    return;
  }
  if (
    (viewMode === "hero" || viewMode === "typing")
    && raycaster.ray.intersectPlane(heroDeskPlane, heroPointerHit)
  ) {
    heroPointerTarget.set(
      THREE.MathUtils.clamp(heroPointerHit.x, -0.18, 0.18),
      heroDeskY + 0.035,
      THREE.MathUtils.clamp(heroPointerHit.z, -0.08, 0.10),
    );
  }
  const environmentHover = raycaster.intersectObjects(environmentHitProxies, false)[0]?.object;
  const keyHover = (
    experienceMode === "typing"
    || (experienceMode === "smiling" && smilePaperActive)
  )
    ? raycaster.intersectObjects(hitProxies, false)[0]?.object
    : null;
  renderer.domElement.style.cursor = environmentHover || keyHover ? "pointer" : "default";
});
addEventListener("pointermove", noteChromeActivity, {passive: true});
addEventListener("pointerdown", noteChromeActivity, {passive: true});
addEventListener("focusin", noteChromeActivity);
addEventListener("focusout", noteChromeActivity);
addEventListener("wheel", (event) => {
  noteChromeActivity();
  if (coarsePointer) return;
  if (event.target instanceof Element && event.target.closest(
    "input, .archive-list, .paper-presentation",
  )) return;
  if (viewMode === "library") {
    event.preventDefault();
    libraryJourneyAutoplayStartedAt = null;
    if (libraryJourneySettled) {
      if (libraryStage !== "index") return;
      librarySelectionWheelDelta += event.deltaY;
      if (Math.abs(librarySelectionWheelDelta) < 72) return;
      const direction = librarySelectionWheelDelta > 0 ? 1 : -1;
      librarySelectionWheelDelta = 0;
      if (direction < 0 && librarySelectedIndex === 0) {
        leaveSettledLibrary();
        libraryJourneyTargetProgress = 0.94;
        statusNode.textContent = "继续向上滚动返回打字机";
      } else {
        setLibrarySelection(librarySelectedIndex + direction);
      }
      return;
    }
    libraryJourneyTargetProgress = nextLibraryJourneyTarget(
      libraryJourneyTargetProgress,
      event.deltaY,
    );
    statusNode.textContent = libraryJourneyTargetProgress > libraryJourneyDisplayedProgress
      ? "滚动推进书库镜头"
      : "正在倒放返回打字机";
    return;
  }
  if (event.deltaY > 0 && (viewMode === "hero" || viewMode === "typing")) {
    if (canBeginLibraryJourney({
      viewMode,
      experienceMode,
      loading: !experienceLoaderNode.hidden,
      firstVisitBlocking: firstVisitOnboardingPhase !== "off"
        && firstVisitOnboardingPhase !== "complete",
    })) {
      event.preventDefault();
      void beginProjectsExperience(nextLibraryJourneyTarget(0, event.deltaY));
    }
  }
}, {passive: false});
addEventListener("message", (event: MessageEvent<unknown>) => {
  if (
    event.origin === location.origin
    && event.source === window.parent
    && isShellActivityMessage(event.data)
  ) noteChromeActivity();
});
renderer.domElement.addEventListener("pointerup", (event) => {
  if (!pointerStart) return;
  const start = pointerStart;
  const movement = Math.hypot(event.clientX - start.x, event.clientY - start.y);
  pointerStart = null;
  if (experienceMode === "presented" && presentedDocument) {
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
      beginPresentedPageTurn(deltaX < 0 ? 1 : -1);
    }
    return;
  }
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
    -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  if (viewMode === "library") {
    if (!libraryJourneySettled) return;
    if (mobileLibraryGesture?.pointerId === event.pointerId) {
      const gesture = mobileLibraryGesture;
      gesture.currentX = event.clientX;
      gesture.currentY = event.clientY;
      const deltaX = gesture.currentX - gesture.startX;
      const deltaY = gesture.currentY - gesture.startY;
      if (libraryStage === "reading") {
        const direction = libraryPageDragDirection;
        const shouldCommit = direction !== 0 && shouldCommitMobileLibraryPage(
          libraryPageDragProgress,
          deltaX,
          performance.now() - gesture.startedAt,
        );
        if (shouldCommit) turnLibraryPage(direction as -1 | 1);
        else resetLibraryPageGesture();
        if (renderer.domElement.hasPointerCapture(event.pointerId)) {
          renderer.domElement.releasePointerCapture(event.pointerId);
        }
        return;
      }
      if (libraryStage === "index") {
        const selectionDirection = mobileLibrarySelectionDirection(deltaX, deltaY);
        resetLibraryPageGesture();
        if (renderer.domElement.hasPointerCapture(event.pointerId)) {
          renderer.domElement.releasePointerCapture(event.pointerId);
        }
        if (selectionDirection !== 0) {
          setLibrarySelection(librarySelectedIndex + selectionDirection);
          return;
        }
      }
    }
    if (movement > 5) return;
    if (libraryStage === "reading") {
      return;
    }
    if (libraryStage !== "index") return;
    const libraryBookIndex = intersectLibraryBook();
    if (libraryBookIndex !== null) {
      if (libraryBookIndex === librarySelectedIndex) openLibraryBook(libraryBookIndex);
      else setLibrarySelection(libraryBookIndex);
    }
    return;
  }
  if (movement > 5) return;
  const environmentHit = raycaster.intersectObjects(environmentHitProxies, false)[0]?.object;
  if (environmentHit?.userData.interactive === "projects-books") {
    beginLibraryFromExplicitEntry();
    return;
  }
  if (environmentHit?.userData.interactive === "room-note") {
    const note: unknown = environmentHit.userData.note;
    if (
      note
      && typeof note === "object"
      && "title" in note
      && "body" in note
    ) {
      const roomNoteRecord = note as RoomNote;
      showRoomNote(roomNoteRecord);
      if (roomNoteRecord.keyword && experienceMode === "typing") {
        if (roomNoteRecord.keyword === "library") {
          window.setTimeout(() => beginLibraryFromExplicitEntry(), 260);
        } else {
          const record = commandArchiveDocument(roomNoteRecord.keyword);
          if (record) window.setTimeout(() => openArchivedDocument(record, "default"), 260);
        }
      }
    }
    return;
  }
  if (environmentHit?.userData.interactive === "drawer") {
    const side: unknown = environmentHit.userData.drawerSide;
    if (side === "left" || side === "right") {
      selectSiteSection(side);
    }
    return;
  }
  if (
    !canRouteTypewriterExperienceInput(
      experienceMode === "typing"
        ? "typing"
        : experienceMode === "smiling"
          ? "smiling"
          : "blocked",
      experienceDirector.snapshot().phase === "exiting",
      smilePaperActive,
    )
  ) return;
  const hit = raycaster.intersectObjects(hitProxies, false)[0]?.object;
  const keyId = hit?.userData.keyId;
  if (typeof keyId !== "string") return;
  const key = keysById.get(keyId);
  if (!key) return;
  if (mobileViewportQuery.matches) {
    focusMobileTypewriterInput();
    return;
  }
  enqueueInput({key, shifted: typewriterState.shiftLatched, source: "pointer"});
});
renderer.domElement.addEventListener("pointercancel", (event) => {
  pointerStart = null;
  if (mobileLibraryGesture?.pointerId === event.pointerId) resetLibraryPageGesture();
  if (renderer.domElement.hasPointerCapture(event.pointerId)) {
    renderer.domElement.releasePointerCapture(event.pointerId);
  }
});

try {
  setLoadingProgress(14, "正在展开旧木桌与机械结构");
  const loader = new GLTFLoader();
  const textureLoader = new THREE.TextureLoader();
  const [
    gltf,
    vendorDesk,
    typewriterStudyTexture,
    wordRecordTexture,
  ] = await Promise.all([
    loader.loadAsync(MODEL_URL),
    loader.loadAsync(VENDOR_DESK_URL),
    textureLoader.loadAsync(ROOM_TYPEWRITER_STUDY_URL),
    textureLoader.loadAsync(ROOM_WORD_RECORD_URL),
  ]);
  setLoadingProgress(76, "正在点亮档案室");
  roomEnvironment = buildRoomEnvironment({
    typewriterStudy: typewriterStudyTexture,
    wordRecord: wordRecordTexture,
  });
  roomEnvironment.setCompactWallLayout(mobileViewportQuery.matches);
  const roomTimeState = roomEnvironment.setLocalTime(currentRoomDate());
  viewport.dataset.roomPeriod = roomTimeState.label;
  window.setInterval(() => {
    if (!roomEnvironment) return;
    const nextRoomTime = roomEnvironment.setLocalTime(currentRoomDate());
    viewport.dataset.roomPeriod = nextRoomTime.label;
  }, 60_000);
  scene.add(roomEnvironment.group);
  environmentHitProxies.push(...roomEnvironment.hitTargets);
  scene.add(vendorDesk.scene);
  initializeVendorDesk(vendorDesk.scene);
  drawerBindings.left.button.disabled = false;
  drawerBindings.right.button.disabled = false;
  heroDeskY = deskSurfaceY(vendorDesk.scene, 0, 0);
  initializeVendorDrawerHitTargets();
  heroDeskPlane.constant = -heroDeskY;
  heroPointerTarget.set(0, heroDeskY + 0.035, 0.02);
  heroLightTarget.copy(heroPointerTarget);
  gltf.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      if (object.name.startsWith("HIT_KEY_")) {
        object.visible = false;
        object.castShadow = false;
        object.receiveShadow = false;
      } else {
        object.castShadow = shouldCastModelShadow(object.name);
        object.receiveShadow = !object.name.includes("_GLASS");
      }
    }
  });
  alignFeetToGround(gltf.scene);
  gltf.scene.position.y += heroDeskY + 0.009;
  typewriterSceneRoot = gltf.scene;
  scene.add(gltf.scene);
  initializeMechanism(gltf.scene);
  setLoadingProgress(92, "正在装入纸张与宠物档案印章");
  syncArchivePaperStacks();
  persistArchive();
  updateDiscoveryProgress();
  setViewMode("hero");
  showDefaultNavigation();
  statusNode.textContent = archiveFullQaMode
    ? "QA 满容量模式 · 左 50 / 右 60 · 不写入本地存档"
    : greenOvergrowthQaMode
      ? "QA · 正在加载 GREEN PBR 藤蔓换肤"
    : snowFrostQaMode
      ? "QA · 正在加载 SNOW 霜雪换肤"
    : flowerBloomQaMode
      ? "QA · 正在加载 FLOWER 花枝换肤"
    : firePaperQaMode
      ? "QA · 正在输入普通内容并触发 FIRE 燃烧换纸"
    : smilePaperQaMode
      ? "QA · 正在输入普通内容并触发 SMILE 手绘换纸"
    : returningFromProjects
      ? "作品书已经归位 · 返回桌面 Hero"
      : "就绪 · 输入关键词，或从右侧选择一张纸";
  if (greenOvergrowthQaMode) {
    const greenQaCommand = findSceneCommand("green");
    if (greenQaCommand) void beginSceneCommand(greenQaCommand);
  }
  if (snowFrostQaMode) {
    const snowQaCommand = findSceneCommand("snow");
    if (snowQaCommand) void beginSceneCommand(snowQaCommand);
  }
  if (flowerBloomQaMode) {
    const flowerQaCommand = findSceneCommand("flower");
    if (flowerQaCommand) void beginSceneCommand(flowerQaCommand);
  }
  if (firePaperQaMode) enqueueText("note\nfire\n");
  if (smilePaperQaMode) enqueueText("note\nsmile\n");
  if (returningFromProjects) {
    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete("return");
    history.replaceState(null, "", cleanUrl);
  }
  scheduleFirstVisitOnboarding();
  finishLoadingSequence();
  const loadOptionalLibraryAssets = () => {
    void ensureLibraryAssetsReady().catch((error: unknown) => {
      console.warn("Optional room bookcase could not be loaded", error);
      viewportNode.dataset.libraryAssets = "error";
    });
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(loadOptionalLibraryAssets, {timeout: 2_000});
  } else {
    globalThis.setTimeout(loadOptionalLibraryAssets, 1_200);
  }
} catch (error) {
  console.error(error);
  statusNode.textContent = "场景加载失败；请重新载入页面";
  setLoadingProgress(100, "场景加载失败 · 请重新载入");
}

renderer.setAnimationLoop(() => {
  const now = performance.now();
  updateFirstVisitOnboarding(now);
  updateImmersiveChrome(now);
  updateImmersiveScene(now);
  updateEnvironment(now);
  updateExperience();
  try {
    updateFirePaper(now);
  } catch (error) {
    recoverFirePaper(error);
  }
  updateSmilePaper(now);
  updateMechanism(now);
  try {
    updatePaper();
  } catch (error) {
    if (activeFireSnapshot) {
      recoverFirePaper(error);
    } else {
      throw error;
    }
  }
  updatePaperFlight(now);
  renderer.render(scene, camera);
  performanceFrameCount += 1;
  const performanceElapsed = now - performanceWindowStartedAt;
  if (performanceElapsed >= 1000) {
    const fps = Math.round((performanceFrameCount * 1000) / performanceElapsed);
    const drawCalls = renderer.info.render.calls;
    const triangles = renderer.info.render.triangles;
    performanceNode.textContent = `FPS ${fps} · Draw ${drawCalls} · Triangles ${triangles.toLocaleString()}`;
    performanceNode.dataset.fps = String(fps);
    performanceNode.dataset.drawCalls = String(drawCalls);
    performanceNode.dataset.triangles = String(triangles);
    performanceFrameCount = 0;
    performanceWindowStartedAt = now;
  }
});

addEventListener("resize", () => {
  resizeThreeViewport(renderer, camera);
});
