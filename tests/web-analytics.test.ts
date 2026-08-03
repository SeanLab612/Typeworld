import {describe, expect, it} from "vitest";
import {
  isProductionAnalyticsHost,
  redactAnalyticsUrl,
} from "../src/web-analytics";

describe("privacy-safe web analytics", () => {
  it("keeps the page path while removing query parameters and fragments", () => {
    expect(redactAnalyticsUrl({
      type: "pageview",
      url: "https://the0612.com/archive?source=douyin#contact",
    })).toEqual({
      type: "pageview",
      url: "https://the0612.com/archive",
    });
  });

  it("runs only on the canonical public site, never localhost or preview hosts", () => {
    expect(isProductionAnalyticsHost("the0612.com")).toBe(true);
    expect(isProductionAnalyticsHost("www.the0612.com")).toBe(true);
    expect(isProductionAnalyticsHost("127.0.0.1")).toBe(false);
    expect(isProductionAnalyticsHost("typeworld-preview.vercel.app")).toBe(false);
  });
});
