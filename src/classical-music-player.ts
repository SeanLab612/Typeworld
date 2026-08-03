export interface ClassicalTrack {
  readonly title: string;
  readonly composer: string;
  readonly performer: string;
  readonly src: string;
}

export interface MusicPlayerPreferences {
  readonly trackIndex: number;
  readonly volume: number;
}

export const CLASSICAL_TRACKS: readonly ClassicalTrack[] = [
  {
    title: "Nocturne in E-flat major",
    composer: "Frédéric Chopin · Op. 9 No. 2",
    performer: "Musopen recording",
    src: "/audio/music/chopin-nocturne-op9-no2.mp3",
  },
  {
    title: "Prelude in C minor",
    composer: "J. S. Bach · BWV 847",
    performer: "Kimiko Ishizaka",
    src: "/audio/music/bach-prelude-bwv847.mp3",
  },
  {
    title: "Adagio cantabile",
    composer: "L. van Beethoven · Op. 13",
    performer: "Paul Pitman",
    src: "/audio/music/beethoven-pathetique-adagio.mp3",
  },
  {
    title: "Minuet in G major",
    composer: "L. van Beethoven · WoO 10 No. 2",
    performer: "Peter Johnston",
    src: "/audio/music/beethoven-minuet-g.mp3",
  },
  {
    title: "Goldberg Variations · Aria",
    composer: "J. S. Bach · BWV 988",
    performer: "Shelley Katz",
    src: "/audio/music/bach-goldberg-aria.mp3",
  },
  {
    title: "Waltz in A minor",
    composer: "Frédéric Chopin · B. 150",
    performer: "Aya Higuchi",
    src: "/audio/music/chopin-waltz-a-minor-b150.mp3",
  },
] as const;

const STORAGE_KEY = "typeworld-classical-player-v1";
const DEFAULT_PREFERENCES: MusicPlayerPreferences = {
  trackIndex: 0,
  volume: 0.34,
};

export function wrapTrackIndex(index: number, trackCount: number): number {
  if (trackCount <= 0) return 0;
  const integer = Number.isFinite(index) ? Math.trunc(index) : 0;
  return ((integer % trackCount) + trackCount) % trackCount;
}

export function parseMusicPlayerPreferences(
  raw: string | null,
  trackCount = CLASSICAL_TRACKS.length,
): MusicPlayerPreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<MusicPlayerPreferences>;
    const volume = typeof parsed.volume === "number" && Number.isFinite(parsed.volume)
      ? Math.min(1, Math.max(0, parsed.volume))
      : DEFAULT_PREFERENCES.volume;
    return {
      trackIndex: wrapTrackIndex(
        typeof parsed.trackIndex === "number" ? parsed.trackIndex : 0,
        trackCount,
      ),
      volume,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function formatMusicTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

function readPreferences(trackCount: number): MusicPlayerPreferences {
  if (typeof localStorage === "undefined") return DEFAULT_PREFERENCES;
  return parseMusicPlayerPreferences(localStorage.getItem(STORAGE_KEY), trackCount);
}

function writePreferences(preferences: MusicPlayerPreferences): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // The active page remains usable when private browsing blocks storage.
  }
}

export class ClassicalMusicPlayer {
  readonly #root: HTMLElement;
  readonly #tracks: readonly ClassicalTrack[];
  readonly #audio = new Audio();
  readonly #title: HTMLElement;
  readonly #composer: HTMLElement;
  readonly #performer: HTMLElement;
  readonly #position: HTMLElement;
  readonly #time: HTMLElement;
  readonly #playButton: HTMLButtonElement;
  readonly #previousButton: HTMLButtonElement;
  readonly #nextButton: HTMLButtonElement;
  readonly #progress: HTMLInputElement;
  readonly #volume: HTMLInputElement;
  #trackIndex: number;

  constructor(root: HTMLElement, tracks: readonly ClassicalTrack[] = CLASSICAL_TRACKS) {
    if (tracks.length === 0) throw new Error("Classical music player requires at least one track");
    this.#root = root;
    this.#tracks = tracks;
    this.#title = this.#required("[data-music-title]");
    this.#composer = this.#required("[data-music-composer]");
    this.#performer = this.#required("[data-music-performer]");
    this.#position = this.#required("[data-music-position]");
    this.#time = this.#required("[data-music-time]");
    this.#playButton = this.#required("[data-music-play]");
    this.#previousButton = this.#required("[data-music-previous]");
    this.#nextButton = this.#required("[data-music-next]");
    this.#progress = this.#required("[data-music-progress]");
    this.#volume = this.#required("[data-music-volume]");

    const preferences = readPreferences(tracks.length);
    this.#trackIndex = preferences.trackIndex;
    this.#audio.volume = preferences.volume;
    this.#audio.preload = "metadata";
    this.#volume.value = String(preferences.volume);
    this.#loadTrack(false);

    this.#playButton.addEventListener("click", () => void this.#togglePlayback());
    this.#previousButton.addEventListener("click", () => void this.#changeTrack(-1));
    this.#nextButton.addEventListener("click", () => void this.#changeTrack(1));
    this.#progress.addEventListener("input", () => {
      if (Number.isFinite(this.#audio.duration)) {
        this.#audio.currentTime = Number(this.#progress.value) * this.#audio.duration;
      }
    });
    this.#volume.addEventListener("input", () => {
      this.#audio.volume = Number(this.#volume.value);
      this.#savePreferences();
    });
    this.#audio.addEventListener("loadedmetadata", () => this.#renderProgress());
    this.#audio.addEventListener("timeupdate", () => this.#renderProgress());
    this.#audio.addEventListener("play", () => this.#renderPlaybackState());
    this.#audio.addEventListener("pause", () => this.#renderPlaybackState());
    this.#audio.addEventListener("ended", () => void this.#changeTrack(1, true));
    this.#audio.addEventListener("error", () => {
      this.#root.dataset.musicState = "error";
      this.#playButton.textContent = "无法播放";
      this.#playButton.disabled = true;
    });
  }

  #required<T extends Element>(selector: string): T {
    const element = this.#root.querySelector<T>(selector);
    if (!element) throw new Error(`Music player control not found: ${selector}`);
    return element;
  }

  #savePreferences(): void {
    writePreferences({
      trackIndex: this.#trackIndex,
      volume: this.#audio.volume,
    });
  }

  #loadTrack(continuePlaying: boolean): void {
    const track = this.#tracks[this.#trackIndex];
    if (!track) return;
    this.#audio.src = track.src;
    this.#audio.load();
    this.#title.textContent = track.title;
    this.#composer.textContent = track.composer;
    this.#performer.textContent = track.performer;
    this.#position.textContent = `${String(this.#trackIndex + 1).padStart(2, "0")} / ${String(this.#tracks.length).padStart(2, "0")}`;
    this.#root.dataset.musicState = "ready";
    this.#playButton.disabled = false;
    this.#progress.value = "0";
    this.#renderProgress();
    this.#renderPlaybackState();
    this.#savePreferences();
    if (continuePlaying) void this.#play();
  }

  async #play(): Promise<void> {
    try {
      await this.#audio.play();
    } catch {
      this.#root.dataset.musicState = "paused";
      this.#renderPlaybackState();
    }
  }

  async #togglePlayback(): Promise<void> {
    if (this.#audio.paused) {
      await this.#play();
    } else {
      this.#audio.pause();
    }
  }

  async #changeTrack(delta: number, continuePlaying = !this.#audio.paused): Promise<void> {
    this.#trackIndex = wrapTrackIndex(this.#trackIndex + delta, this.#tracks.length);
    this.#loadTrack(continuePlaying);
  }

  #renderPlaybackState(): void {
    const playing = !this.#audio.paused;
    this.#root.dataset.musicState = playing ? "playing" : "paused";
    this.#playButton.textContent = playing ? "暂停" : "播放";
    this.#playButton.setAttribute("aria-label", playing ? "暂停古典音乐" : "播放古典音乐");
    this.#playButton.setAttribute("aria-pressed", String(playing));
  }

  #renderProgress(): void {
    const duration = Number.isFinite(this.#audio.duration) ? this.#audio.duration : 0;
    const current = Number.isFinite(this.#audio.currentTime) ? this.#audio.currentTime : 0;
    this.#progress.value = duration > 0 ? String(current / duration) : "0";
    this.#time.textContent = `${formatMusicTime(current)} / ${formatMusicTime(duration)}`;
  }
}

export function mountClassicalMusicPlayer(
  container: HTMLElement,
  placement: "room" | "global" = "global",
): ClassicalMusicPlayer {
  const player = document.createElement("section");
  player.className = `music-player${placement === "global" ? " is-global" : ""}`;
  player.dataset.musicPlayer = "";
  player.dataset.musicState = "paused";
  player.setAttribute("aria-label", "古典纯音乐播放器");
  player.innerHTML = `
    <div class="music-player-heading">
      <p>ROOM CONCERT</p>
      <span data-music-position>01 / 03</span>
    </div>
    <strong data-music-title></strong>
    <span data-music-composer></span>
    <small data-music-performer></small>
    <div class="music-player-controls">
      <button type="button" data-music-previous aria-label="上一首">上一首</button>
      <button type="button" data-music-play aria-label="播放古典音乐" aria-pressed="false">播放</button>
      <button type="button" data-music-next aria-label="下一首">下一首</button>
      <span data-music-time>0:00 / 0:00</span>
    </div>
    <label class="music-progress" aria-label="音乐播放进度">
      <input data-music-progress type="range" min="0" max="1" step="0.001" value="0">
    </label>
    <label class="music-volume">
      <span>音乐音量</span>
      <input data-music-volume type="range" min="0" max="1" step="0.01" value="0.34">
    </label>
  `;
  container.append(player);
  return new ClassicalMusicPlayer(player);
}
