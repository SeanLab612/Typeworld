import {describe, expect, it} from "vitest";
import {
  hasStudyOrigin,
  projectBookDetailUrl,
  projectBooksIndexUrl,
  projectBooksRoomReturnUrl,
} from "../src/project-books-routing";

describe("project books routing", () => {
  it("keeps the approved sample gates independent", () => {
    expect(projectBooksIndexUrl("sample", "quiet systems"))
      .toBe("/books-sample.html?book=quiet%20systems");
    expect(projectBookDetailUrl("sample", "mechanical-archive"))
      .toBe("/book-detail-sample.html?book=mechanical-archive");
  });

  it("uses clean formal project routes", () => {
    expect(projectBooksIndexUrl("formal")).toBe("/projects.html");
    expect(projectBookDetailUrl("formal", "mechanical-archive"))
      .toBe("/project.html?book=mechanical-archive");
    expect(projectBooksIndexUrl("formal", "typeworld", {fromStudy: true}))
      .toBe("/projects.html?book=typeworld&from=study");
    expect(projectBookDetailUrl("formal", "typeworld", {fromStudy: true}))
      .toBe("/project.html?book=typeworld&from=study");
    expect(hasStudyOrigin("?book=typeworld&from=study")).toBe(true);
    expect(projectBooksRoomReturnUrl()).toBe("/?return=projects");
  });
});
