import {describe, expect, it} from "vitest";
import {resolveSafeProjectHref} from "../src/safe-project-link";

describe("project book external links", () => {
  const baseHref = "https://the0612.com/project.html";

  it("allows HTTPS and same-origin relative destinations", () => {
    expect(resolveSafeProjectHref("https://example.com/work", baseHref))
      .toBe("https://example.com/work");
    expect(resolveSafeProjectHref("/projects.html", baseHref))
      .toBe("https://the0612.com/projects.html");
  });

  it("rejects executable, data, malformed, and insecure external destinations", () => {
    expect(resolveSafeProjectHref("javascript:alert(1)", baseHref)).toBeNull();
    expect(resolveSafeProjectHref("data:text/html,unsafe", baseHref)).toBeNull();
    expect(resolveSafeProjectHref("https://[invalid", baseHref)).toBeNull();
    expect(resolveSafeProjectHref("http://example.com/work", baseHref)).toBeNull();
  });
});
