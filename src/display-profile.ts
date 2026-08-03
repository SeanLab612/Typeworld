export type DisplayPlatform = "windows" | "standard";

export const DISPLAY_EXPOSURE_MULTIPLIER: Readonly<Record<DisplayPlatform, number>> = {
  windows: 1.15,
  standard: 1.07,
};

export function resolveDisplayPlatform(platformDescription: string): DisplayPlatform {
  return /\bwin(?:dows|32|64)?\b/iu.test(platformDescription)
    ? "windows"
    : "standard";
}

export function currentDisplayPlatform(): DisplayPlatform {
  if (typeof navigator === "undefined") return "standard";
  const navigatorWithUserAgentData = navigator as Navigator & {
    readonly userAgentData?: {readonly platform?: string};
  };
  return resolveDisplayPlatform([
    navigatorWithUserAgentData.userAgentData?.platform,
    navigator.platform,
    navigator.userAgent,
  ].filter(Boolean).join(" "));
}

export function calibratedExposure(
  baseExposure: number,
  platform = currentDisplayPlatform(),
): number {
  return baseExposure * DISPLAY_EXPOSURE_MULTIPLIER[platform];
}
