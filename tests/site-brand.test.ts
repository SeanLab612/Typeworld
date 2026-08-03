import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";

const pageFiles = [
  "index.html",
  "projects.html",
  "project.html",
  "book-sample.html",
  "books-sample.html",
  "book-detail-sample.html",
] as const;

describe("Typeworld site brand", () => {
  it.each(pageFiles)("%s uses the Typeworld title and favicon", (fileName) => {
    const html = readFileSync(fileName, "utf8");

    expect(html).toMatch(/<title>Typeworld(?: · [^<]+)?<\/title>/u);
    expect(html).toContain('rel="icon" href="/brand/typeworld-mark.svg"');
    expect(html).toContain('rel="manifest" href="/brand/site.webmanifest"');
    expect(html).not.toContain("<title>Typeword");
  });

  it("declares the Typeworld installable site identity", () => {
    const manifest = JSON.parse(
      readFileSync("assets/brand/site.webmanifest", "utf8"),
    ) as {
      name: string;
      short_name: string;
      icons: Array<{src: string; type: string}>;
    };

    expect(manifest.name).toBe("Typeworld");
    expect(manifest.short_name).toBe("Typeworld");
    expect(manifest.icons).toContainEqual({
      src: "/brand/typeworld-mark.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any",
    });
  });
});
