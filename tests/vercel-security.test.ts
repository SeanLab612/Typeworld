import {describe, expect, it} from "vitest";
import vercelConfig from "../vercel.json";

const securityHeaders = new Map(
  vercelConfig.headers.flatMap((route) =>
    route.source === "/(.*)"
      ? route.headers.map((header) => [header.key, header.value] as const)
      : [],
  ),
);

describe("Vercel security headers", () => {
  it("builds the Vite site from the repository root", () => {
    expect(vercelConfig.buildCommand).toBe("npm run build");
    expect(vercelConfig.outputDirectory).toBe("dist");
  });

  it("protects every route with the expected baseline headers", () => {
    expect(securityHeaders.get("X-Content-Type-Options")).toBe("nosniff");
    expect(securityHeaders.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(securityHeaders.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(securityHeaders.get("Permissions-Policy")).toContain("camera=()");
    expect(securityHeaders.get("Permissions-Policy")).toContain("microphone=()");
    expect(securityHeaders.get("Permissions-Policy")).toContain("geolocation=()");
  });

  it("keeps executable content same-origin and only permits the persistent same-origin shell", () => {
    const policy = securityHeaders.get("Content-Security-Policy");

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("connect-src 'self' blob:");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'self'");
    expect(policy).toContain("frame-src 'self'");
    expect(policy).toContain("upgrade-insecure-requests");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/u);
  });
});
