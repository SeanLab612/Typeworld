export const TYPING_PAPER_LAYOUT = Object.freeze({
  heightScale: 1.25,
  canvasWidth: 1536,
  canvasHeight: 1024,
  characterStep: 42,
  lineStep: 156,
  textTop: 195,
  fontSize: 150,
  glyphMaxWidth: 54,
  visibleRows: 5,
});

export const TYPING_PAPER_MOBILE_LAYOUT = Object.freeze({
  ...TYPING_PAPER_LAYOUT,
  canvasWidth: 768,
  canvasHeight: 512,
  characterStep: 21,
  lineStep: 47,
  textTop: 52,
  fontSize: 72,
  glyphMaxWidth: 27,
  visibleRows: 5,
});

export const TYPING_PAPER_SAFARI_LAYOUT = Object.freeze({
  ...TYPING_PAPER_LAYOUT,
});

export const TYPING_PAPER_SAFARI_MOBILE_LAYOUT = Object.freeze({
  ...TYPING_PAPER_MOBILE_LAYOUT,
  lineStep: 78,
  textTop: 98,
  fontSize: 84,
  glyphMaxWidth: 29,
});

export interface TypingPaperLayout {
  readonly heightScale: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly characterStep: number;
  readonly lineStep: number;
  readonly textTop: number;
  readonly fontSize: number;
  readonly glyphMaxWidth: number;
  readonly visibleRows: number;
}

export function isSafariBrowser(userAgent: string, vendor: string): boolean {
  return /Apple/iu.test(vendor)
    && /Safari/iu.test(userAgent)
    && !/(?:CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium|Android)/iu.test(userAgent);
}

export function typingPaperLayoutForBrowser(
  mobile: boolean,
  safari: boolean,
): TypingPaperLayout {
  if (safari) {
    return mobile
      ? TYPING_PAPER_SAFARI_MOBILE_LAYOUT
      : TYPING_PAPER_SAFARI_LAYOUT;
  }
  return mobile ? TYPING_PAPER_MOBILE_LAYOUT : TYPING_PAPER_LAYOUT;
}

export function glyphHorizontalScale(measuredWidth: number, maximumWidth: number): number {
  const safeMeasuredWidth = Math.max(1, measuredWidth);
  return Math.min(1, Math.max(0, maximumWidth) / safeMeasuredWidth);
}

export interface TypingPaperRowWindow {
  readonly firstRow: number;
  readonly lastRow: number;
}

export function mobileTypingPaperRowWindow(
  currentRow: number,
  totalRows: number,
  visibleRows = TYPING_PAPER_MOBILE_LAYOUT.visibleRows,
): TypingPaperRowWindow {
  return typingPaperRowWindow(currentRow, totalRows, visibleRows);
}

export function typingPaperRowWindow(
  currentRow: number,
  totalRows: number,
  visibleRows: number,
): TypingPaperRowWindow {
  const safeTotal = Math.max(0, Math.floor(totalRows));
  if (safeTotal === 0) return {firstRow: 0, lastRow: -1};
  const capacity = Math.max(1, Math.floor(visibleRows));
  const safeCurrent = Math.min(safeTotal - 1, Math.max(0, Math.floor(currentRow)));
  const firstRow = Math.max(0, safeCurrent - capacity + 1);
  return {
    firstRow,
    lastRow: Math.min(safeTotal - 1, firstRow + capacity - 1),
  };
}

export function extendPaperFromBottom(
  coordinate: number,
  minimum: number,
  scale = TYPING_PAPER_LAYOUT.heightScale,
): number {
  return minimum + (coordinate - minimum) * scale;
}
