export const PROJECT_BOOK_NODE_NAMES = {
  root: "BOOK_TYPEWORLD_ROOT",
  frontCover: "BOOK_TYPEWORLD_COVER_FRONT",
  backCover: "BOOK_TYPEWORLD_COVER_BACK",
  spine: "BOOK_TYPEWORLD_SPINE",
  pages: "BOOK_TYPEWORLD_PAGES",
  frontArtwork: "BOOK_TYPEWORLD_FRONT_ARTWORK",
  frontFoil: "BOOK_TYPEWORLD_FRONT_FOIL",
  spineFoil: "BOOK_TYPEWORLD_SPINE_FOIL",
  foreEdge: "BOOK_TYPEWORLD_FORE_EDGE",
  headbandTop: "BOOK_TYPEWORLD_HEADBAND_TOP",
  headbandBottom: "BOOK_TYPEWORLD_HEADBAND_BOTTOM",
  ribbon: "BOOK_TYPEWORLD_RIBBON",
  hitProxy: "BOOK_TYPEWORLD_HIT_PROXY",
} as const;

export interface ProjectBookNodeNames {
  readonly root: string;
  readonly frontCover: string;
  readonly backCover: string;
  readonly spine: string;
  readonly pages: string;
  readonly frontArtwork: string;
  readonly frontFoil: string;
  readonly spineFoil: string;
  readonly foreEdge: string;
  readonly headbandTop: string;
  readonly headbandBottom: string;
  readonly ribbon: string;
  readonly hitProxy: string;
}

export function createProjectBookNodeNames(id: string): ProjectBookNodeNames {
  const prefix = `BOOK_${id.replace(/[^a-z0-9]+/gi, "_").toUpperCase()}`;
  return {
    root: `${prefix}_ROOT`,
    frontCover: `${prefix}_COVER_FRONT`,
    backCover: `${prefix}_COVER_BACK`,
    spine: `${prefix}_SPINE`,
    pages: `${prefix}_PAGES`,
    frontArtwork: `${prefix}_FRONT_ARTWORK`,
    frontFoil: `${prefix}_FRONT_FOIL`,
    spineFoil: `${prefix}_SPINE_FOIL`,
    foreEdge: `${prefix}_FORE_EDGE`,
    headbandTop: `${prefix}_HEADBAND_TOP`,
    headbandBottom: `${prefix}_HEADBAND_BOTTOM`,
    ribbon: `${prefix}_RIBBON`,
    hitProxy: `${prefix}_HIT_PROXY`,
  };
}

export const PROJECT_BOOK_DIMENSIONS = {
  width: 1.24,
  height: 1.86,
  pageDepth: 0.16,
  coverThickness: 0.036,
  coverOverhang: 0.032,
  spineWidth: 0.112,
} as const;

export type ProjectBookReviewView = "three-quarter" | "front" | "spine" | "pages";

export const PROJECT_BOOK_REVIEW_VIEWS: ReadonlyArray<ProjectBookReviewView> = [
  "three-quarter",
  "front",
  "spine",
  "pages",
];
