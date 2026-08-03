import {describe, expect, it} from "vitest";
import {canReturnThroughHistory} from "../src/project-experience";

describe("projects history restoration", () => {
  it("only restores a same-origin expected page", () => {
    expect(canReturnThroughHistory(
      "https://typeworld.test/projects.html?book=typeworld",
      "https://typeworld.test",
      ["/projects.html"],
    )).toBe(true);
    expect(canReturnThroughHistory(
      "https://example.com/projects.html",
      "https://typeworld.test",
      ["/projects.html"],
    )).toBe(false);
    expect(canReturnThroughHistory(
      "https://typeworld.test/project.html",
      "https://typeworld.test",
      ["/projects.html"],
    )).toBe(false);
  });
});
