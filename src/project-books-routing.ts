export type ProjectBooksSurface = "formal" | "sample";

export interface ProjectRouteOptions {
  readonly fromStudy?: boolean;
}

function withRouteParams(
  path: string,
  bookId?: string,
  options: ProjectRouteOptions = {},
): string {
  const params: string[] = [];
  if (bookId) params.push(`book=${encodeURIComponent(bookId)}`);
  if (options.fromStudy) params.push("from=study");
  const query = params.join("&");
  return query ? `${path}?${query}` : path;
}

export function projectBooksIndexUrl(
  surface: ProjectBooksSurface,
  bookId?: string,
  options?: ProjectRouteOptions,
): string {
  return withRouteParams(
    surface === "formal" ? "/projects.html" : "/books-sample.html",
    bookId,
    options,
  );
}

export function projectBookDetailUrl(
  surface: ProjectBooksSurface,
  bookId: string,
  options?: ProjectRouteOptions,
): string {
  return withRouteParams(
    surface === "formal" ? "/project.html" : "/book-detail-sample.html",
    bookId,
    options,
  );
}

export function projectBooksRoomReturnUrl(): string {
  return "/?return=projects";
}

export function hasStudyOrigin(search: string): boolean {
  return new URLSearchParams(search).get("from") === "study";
}
