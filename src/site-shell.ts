import {mountClassicalMusicPlayer} from "./classical-music-player";
import {initializeWebAnalytics} from "./web-analytics";
import {
  isImmersiveChromeMessage,
  SHELL_ACTIVITY_MESSAGE,
} from "./immersive-chrome-state";
import "./music-player.css";
import "./site-shell.css";

const ROOM_PATHS = new Set(["/", "/index.html"]);

async function loadEmbeddedPage(pathname: string): Promise<void> {
  if (ROOM_PATHS.has(pathname)) {
    await import("./main");
  } else if (pathname === "/projects.html" || pathname === "/books-sample.html") {
    await import("./project-books-sample");
  } else if (pathname === "/project.html" || pathname === "/book-detail-sample.html") {
    await import("./project-book-detail-sample");
  } else if (pathname === "/book-sample.html") {
    await import("./project-book-sample");
  } else {
    location.replace("/");
  }
}

function showRuntimeFallback(): void {
  document.body.innerHTML = `
    <main class="site-shell-fallback" role="alert">
      <p>TYPEWORLD ARCHIVE</p>
      <h1>场景未能完整打开</h1>
      <span>请检查网络或图形加速设置，然后重新载入。</span>
      <button type="button" data-runtime-reload>重新载入</button>
    </main>
  `;
  document.querySelector<HTMLButtonElement>("[data-runtime-reload]")
    ?.addEventListener("click", () => location.reload());
}

function syncShellLocation(
  frame: HTMLIFrameElement,
  player: HTMLElement,
  shell: HTMLElement,
): void {
  const frameWindow = frame.contentWindow;
  if (!frameWindow) return;
  try {
    const current = new URL(frameWindow.location.href);
    if (current.origin !== location.origin) return;
    const route = `${current.pathname}${current.search}${current.hash}`;
    const shellRoute = `${location.pathname}${location.search}${location.hash}`;
    if (route !== shellRoute) history.replaceState({typeworldRoute: route}, "", route);
    player.classList.toggle("is-global", !ROOM_PATHS.has(current.pathname));
    if (!ROOM_PATHS.has(current.pathname)) shell.classList.remove("is-room-chrome-idle");
    const frameTitle = frame.contentDocument?.title;
    if (frameTitle) document.title = frameTitle;
  } catch {
    // External documents are never loaded into this frame, but fail closed if that changes.
  }
}

function mountPersistentShell(): void {
  document.body.innerHTML = `
    <main class="site-shell">
      <iframe class="site-shell__page" title="Typeworld 当前页面"></iframe>
    </main>
  `;
  const shell = document.querySelector<HTMLElement>(".site-shell");
  const frame = document.querySelector<HTMLIFrameElement>(".site-shell__page");
  if (!shell || !frame) throw new Error("Persistent site shell scaffold was not found");

  mountClassicalMusicPlayer(shell, ROOM_PATHS.has(location.pathname) ? "room" : "global");
  const player = shell.querySelector<HTMLElement>("[data-music-player]");
  if (!player) throw new Error("Persistent music player was not found");

  addEventListener("message", (event: MessageEvent<unknown>) => {
    if (
      event.origin !== location.origin
      || event.source !== frame.contentWindow
      || !isImmersiveChromeMessage(event.data)
    ) return;
    shell.classList.toggle("is-room-chrome-idle", event.data.hidden);
  });
  const reportShellActivity = (): void => {
    frame.contentWindow?.postMessage({type: SHELL_ACTIVITY_MESSAGE}, location.origin);
  };
  player.addEventListener("pointermove", reportShellActivity, {passive: true});
  player.addEventListener("pointerdown", reportShellActivity, {passive: true});
  player.addEventListener("focusin", reportShellActivity);
  frame.addEventListener("load", () => {
    shell.classList.remove("is-room-chrome-idle");
    syncShellLocation(frame, player, shell);
  });
  frame.src = `${location.pathname}${location.search}${location.hash}`;
}

if (window.self === window.top) {
  mountPersistentShell();
  initializeWebAnalytics();
} else {
  void loadEmbeddedPage(location.pathname).catch((error: unknown) => {
    console.error(error);
    showRuntimeFallback();
  });
}
