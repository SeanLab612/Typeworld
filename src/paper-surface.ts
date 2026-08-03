export interface PaperDeformationSample {
  depthOffset: number;
  verticalOffset: number;
}

export function samplePaperDeformation(
  normalizedX: number,
  normalizedY: number,
  feedLines: number,
  activity: number,
): PaperDeformationSample {
  const x = Math.min(1, Math.max(-1, normalizedX));
  const y = Math.min(1, Math.max(0, normalizedY));
  const motion = Math.min(1, Math.max(0, activity));
  const edgeCurl = Math.pow(Math.abs(x), 3) * 0.00045;
  const feedSettle = Math.sin(y * Math.PI * 1.4 + feedLines * 0.42) * 0.00015;
  const carriageFlutter = Math.sin((x * 2.6 + y * 3.8) * Math.PI) * 0.0012 * motion;
  return {
    depthOffset: edgeCurl + feedSettle + carriageFlutter,
    verticalOffset: feedLines * 0.00018 * (0.25 + y * 0.75),
  };
}
