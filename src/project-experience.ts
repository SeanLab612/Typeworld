const prefetchedUrls = new Set<string>();

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== "undefined"
    && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function prefetchUrl(url: string): void {
  if (typeof document === "undefined" || prefetchedUrls.has(url)) return;
  prefetchedUrls.add(url);
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = url;
  document.head.append(link);
}

export function canReturnThroughHistory(
  referrer: string,
  currentOrigin: string,
  expectedPathnames: ReadonlyArray<string>,
): boolean {
  if (!referrer) return false;
  try {
    const url = new URL(referrer);
    return url.origin === currentOrigin && expectedPathnames.includes(url.pathname);
  } catch {
    return false;
  }
}

export function restoreAfterPageShow(stage: HTMLElement, className: string): void {
  addEventListener("pageshow", () => {
    stage.classList.remove(className);
  });
}
