export interface SitePreferences {
  readonly soundEnabled: boolean;
  readonly volume: number;
}

const STORAGE_KEY = "typeworld-site-preferences-v1";
const DEFAULT_PREFERENCES: SitePreferences = {
  soundEnabled: true,
  volume: 0.58,
};

function clampVolume(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : DEFAULT_PREFERENCES.volume));
}

export function parseSitePreferences(raw: string | null): SitePreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<SitePreferences>;
    return {
      soundEnabled: typeof parsed.soundEnabled === "boolean"
        ? parsed.soundEnabled
        : DEFAULT_PREFERENCES.soundEnabled,
      volume: clampVolume(
        typeof parsed.volume === "number" ? parsed.volume : DEFAULT_PREFERENCES.volume,
      ),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function readSitePreferences(): SitePreferences {
  if (typeof localStorage === "undefined") return DEFAULT_PREFERENCES;
  return parseSitePreferences(localStorage.getItem(STORAGE_KEY));
}

export function writeSitePreferences(preferences: SitePreferences): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      soundEnabled: preferences.soundEnabled,
      volume: clampVolume(preferences.volume),
    }));
  } catch {
    // Keep the preference active for this page when storage is unavailable.
  }
}
