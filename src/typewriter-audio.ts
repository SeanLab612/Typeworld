import type {TypewriterKey} from "./typewriter-state";

export type SoundCue =
  | "key"
  | "strike"
  | "space"
  | "backspace"
  | "carriage"
  | "return"
  | "paper"
  | "fire"
  | "bell";

export function soundPlanForKey(key: TypewriterKey): {
  start: SoundCue;
  imprint: SoundCue | null;
  finish: SoundCue | null;
} {
  if (key.kind === "print") return {start: "key", imprint: "strike", finish: "carriage"};
  if (key.kind === "space") return {start: "space", imprint: null, finish: "carriage"};
  if (key.kind === "backspace") return {start: "backspace", imprint: null, finish: null};
  if (key.kind === "enter") return {start: "return", imprint: "paper", finish: null};
  return {start: "key", imprint: null, finish: null};
}

function pseudoRandomBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const sampleCount = Math.ceil(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  let state = 0x9e3779b9;
  for (let index = 0; index < sampleCount; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    channel[index] = ((state >>> 0) / 0x7fffffff - 1) * 0.92;
  }
  return buffer;
}

const SAMPLE_URLS = {
  key: "/audio/typewriter/key.mp3",
  space: "/audio/typewriter/space.mp3",
  return: "/audio/typewriter/return.mp3",
  bell: "/audio/typewriter/bell.mp3",
  fire: "/audio/fire/burning-paper.mp3",
} as const;

type SampleName = keyof typeof SAMPLE_URLS;

const SAMPLE_PROFILES: Partial<
  Record<
    SoundCue,
    {
      sample: SampleName;
      gain: number;
      rate: number;
      offset?: number;
      duration?: number;
    }
  >
> = {
  key: {sample: "key", gain: 0.18, rate: 0.94, duration: 0.09},
  strike: {sample: "key", gain: 0.72, rate: 1},
  space: {sample: "space", gain: 0.66, rate: 1},
  backspace: {sample: "space", gain: 0.48, rate: 0.82},
  carriage: {sample: "key", gain: 0.16, rate: 0.78, offset: 0.055, duration: 0.12},
  return: {sample: "return", gain: 0.78, rate: 1},
  fire: {sample: "fire", gain: 0.48, rate: 1, duration: 3.05},
  bell: {sample: "bell", gain: 0.62, rate: 1},
};

interface ActiveVoice {
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
}

export class TypewriterAudioController {
  #context: AudioContext | null = null;
  #master: GainNode | null = null;
  #noise: AudioBuffer | null = null;
  #samples = new Map<SampleName, AudioBuffer>();
  #activeVoices = new Map<SoundCue, Set<ActiveVoice>>();
  #loadPromise: Promise<void> | null = null;
  #volume = 0.58;
  #muted = false;

  get volume(): number {
    return this.#volume;
  }

  get muted(): boolean {
    return this.#muted;
  }

  preload(): Promise<void> {
    this.#ensureContext();
    if (!this.#context) return Promise.resolve();
    if (!this.#loadPromise) {
      const context = this.#context;
      this.#loadPromise = Promise.all(
        Object.entries(SAMPLE_URLS).map(async ([name, url]) => {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Unable to load typewriter audio: ${url}`);
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
          this.#samples.set(name as SampleName, buffer);
        }),
      )
        .then(() => undefined)
        .catch((error: unknown) => {
          console.warn(error);
        });
    }
    return this.#loadPromise;
  }

  async start(): Promise<void> {
    this.#ensureContext();
    void this.preload();
    if (this.#context?.state === "suspended") await this.#context.resume();
  }

  #ensureContext(): void {
    if (!this.#context) {
      this.#context = new AudioContext({latencyHint: "interactive"});
      this.#master = this.#context.createGain();
      this.#master.connect(this.#context.destination);
      this.#noise = pseudoRandomBuffer(this.#context, 1);
      this.#applyGain();
    }
  }

  setVolume(value: number): void {
    this.#volume = Math.min(1, Math.max(0, value));
    this.#applyGain();
  }

  setMuted(muted: boolean): void {
    this.#muted = muted;
    this.#applyGain();
  }

  toggleMuted(): boolean {
    this.setMuted(!this.#muted);
    return this.#muted;
  }

  play(cue: SoundCue, variation = 0): void {
    if (!this.#context || !this.#master || !this.#noise || this.#muted) return;
    const profile = SAMPLE_PROFILES[cue];
    if (profile && this.#playSample(cue, profile, variation)) return;

    if (cue === "paper") {
      this.#noiseBurst(0.190, 1250, 0.075);
    } else {
      // The first interaction can arrive before decoding finishes. Keep that
      // edge case quiet and physical instead of falling back to an oscillator.
      this.#noiseBurst(0.035, 900 + (variation % 5) * 70, 0.06);
    }
  }

  stop(cue: SoundCue, fadeSeconds = 0.08): void {
    if (!this.#context) return;
    const voices = this.#activeVoices.get(cue);
    if (!voices) return;
    const now = this.#context.currentTime;
    for (const voice of voices) {
      if (fadeSeconds <= 0) {
        voice.source.stop(now);
        continue;
      }
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(
        Math.max(0.0001, voice.gain.gain.value),
        now,
      );
      voice.gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + fadeSeconds,
      );
      voice.source.stop(now + fadeSeconds + 0.01);
    }
    voices.clear();
    this.#activeVoices.delete(cue);
  }

  #applyGain(): void {
    if (!this.#context || !this.#master) return;
    const target = this.#muted ? 0 : this.#volume;
    this.#master.gain.setTargetAtTime(target, this.#context.currentTime, 0.012);
  }

  #playSample(
    cue: SoundCue,
    profile: NonNullable<(typeof SAMPLE_PROFILES)[SoundCue]>,
    variation: number,
  ): boolean {
    if (!this.#context || !this.#master) return false;
    const buffer = this.#samples.get(profile.sample);
    if (!buffer) return false;

    const start = this.#context.currentTime;
    const source = this.#context.createBufferSource();
    const gain = this.#context.createGain();
    const voice = {source, gain};
    const rateVariation = 0.97 + (Math.abs(variation) % 5) * 0.015;
    source.buffer = buffer;
    source.playbackRate.value = profile.rate * rateVariation;
    gain.gain.value = profile.gain;
    source.connect(gain).connect(this.#master);
    const activeVoices = this.#activeVoices.get(cue) ?? new Set<ActiveVoice>();
    activeVoices.add(voice);
    this.#activeVoices.set(cue, activeVoices);
    source.addEventListener("ended", () => {
      activeVoices.delete(voice);
      if (activeVoices.size === 0) this.#activeVoices.delete(cue);
    }, {once: true});

    const offset = Math.min(profile.offset ?? 0, Math.max(0, buffer.duration - 0.01));
    const available = Math.max(0.01, buffer.duration - offset);
    const duration = Math.min(profile.duration ?? available, available);
    source.start(start, offset, duration);
    source.stop(start + duration / source.playbackRate.value + 0.02);
    return true;
  }

  #noiseBurst(duration: number, frequency: number, level: number): void {
    if (!this.#context || !this.#master || !this.#noise) return;
    const start = this.#context.currentTime;
    const source = this.#context.createBufferSource();
    const filter = this.#context.createBiquadFilter();
    const gain = this.#context.createGain();
    source.buffer = this.#noise;
    filter.type = "bandpass";
    filter.frequency.value = frequency;
    filter.Q.value = 0.75;
    gain.gain.setValueAtTime(level, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.#master);
    source.start(start, (frequency % 500) / 1000, duration);
    source.stop(start + duration + 0.01);
  }
}
