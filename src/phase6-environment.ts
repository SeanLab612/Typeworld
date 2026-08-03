export function smoothEnvironmentProgress(current: number, target: number, deltaSeconds: number): number {
  const clampedTarget = Math.min(1, Math.max(0, target));
  const response = 1 - Math.exp(-Math.max(0, deltaSeconds) * 7.5);
  return current + (clampedTarget - current) * response;
}

export function drawerTravel(openAmount: number, travelMeters: number): number {
  const t = Math.min(1, Math.max(0, openAmount));
  const eased = t * t * (3 - 2 * t);
  return eased * Math.max(0, travelMeters);
}

export function lampFlicker(timeSeconds: number): number {
  const slow = Math.sin(timeSeconds * 7.7) * 0.035;
  const quick = Math.sin(timeSeconds * 19.3 + 0.8) * 0.018;
  return 1 + slow + quick;
}
