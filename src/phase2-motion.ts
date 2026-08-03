export const MECHANISM_DURATION_MS = 760;

export interface MechanismPose {
  keyPress: number;
  linkageTravel: number;
  typebarStrike: number;
  ribbonLift: number;
  carriageAdvance: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function windowPulse(time: number, start: number, peak: number, end: number): number {
  if (time <= start || time >= end) return 0;
  if (time <= peak) return smoothstep((time - start) / (peak - start));
  return 1 - smoothstep((time - peak) / (end - peak));
}

export function sampleMechanismPose(
  elapsedMs: number,
  durationMs = MECHANISM_DURATION_MS,
): MechanismPose {
  const time = clamp01(elapsedMs / durationMs);
  return {
    keyPress: windowPulse(time, 0.0, 0.18, 0.72),
    linkageTravel: windowPulse(time, 0.05, 0.25, 0.74),
    typebarStrike: windowPulse(time, 0.13, 0.38, 0.64),
    ribbonLift: windowPulse(time, 0.20, 0.36, 0.58),
    carriageAdvance: smoothstep((time - 0.68) / 0.25),
  };
}
