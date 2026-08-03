import {inject, type BeforeSendEvent} from "@vercel/analytics";

const ANALYTICS_HOSTS = new Set(["the0612.com", "www.the0612.com"]);

export function isProductionAnalyticsHost(hostname: string): boolean {
  return ANALYTICS_HOSTS.has(hostname.toLocaleLowerCase("en-US"));
}

export function redactAnalyticsUrl(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  url.search = "";
  url.hash = "";

  return {
    ...event,
    url: url.toString(),
  };
}

export function initializeWebAnalytics(): void {
  if (
    !import.meta.env.PROD
    || window.self !== window.top
    || !document.body
    || !isProductionAnalyticsHost(location.hostname)
  ) {
    return;
  }

  inject({
    mode: "production",
    beforeSend: redactAnalyticsUrl,
  });
}
