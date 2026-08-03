import {describe, expect, it} from "vitest";
import {documentsForDrawer, findCommand, parseArchiveSnapshot} from "./phase7-content";

describe("retired personal command migration", () => {
  it("removes retired system papers while preserving free writing and effect discoveries", () => {
    const snapshot = parseArchiveSnapshot(JSON.stringify({
      version: 2,
      documents: [
        {
          id: "about-old",
          kind: "command",
          keyword: "about",
          title: "Retired profile",
          text: "Retired profile text",
          drawer: "left",
          createdAt: "2026-01-01T00:00:00.000Z",
          mock: false,
        },
        {
          id: "green-old",
          kind: "command",
          keyword: "green",
          title: "GREEN / OVERGROWTH",
          text: "Old vines woke along the frame.",
          drawer: "left",
          createdAt: "2026-01-02T00:00:00.000Z",
          mock: false,
        },
        {
          id: "free-writing",
          kind: "freeform",
          keyword: null,
          title: "FREEFORM PAPER",
          text: "Keep this user-authored page.",
          drawer: "right",
          createdAt: "2026-01-03T00:00:00.000Z",
          mock: false,
        },
      ],
      discovered: ["about", "contact", "projects", "green"],
    }));

    expect(snapshot.discovered).toEqual(["green"]);
    expect(documentsForDrawer(snapshot, "left").map((document) => document.keyword)).toEqual([
      "green",
    ]);
    expect(documentsForDrawer(snapshot, "right").map((document) => document.text)).toEqual([
      "Keep this user-authored page.",
    ]);
  });

  it("does not expose retired navigation words as typewriter commands", () => {
    expect(findCommand("about")).toBeNull();
    expect(findCommand("contact")).toBeNull();
    expect(findCommand("projects")).toBeNull();
  });
});
