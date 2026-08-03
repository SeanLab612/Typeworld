export function archivePaperFilename(title: string): string {
  const normalized = title
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001F]/gu, "-")
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 80);
  return `${normalized || "typeworld-archive"}.png`;
}

export const ARCHIVE_PRINT_PAGE_CSS = `
@page {
  size: A4 portrait;
  margin: 0;
}

html,
body {
  width: 210mm;
  margin: 0;
  padding: 0;
  background: #fff;
}

.archive-print-page {
  width: 210mm;
  height: 297mm;
  margin: 0;
  overflow: hidden;
  break-after: page;
  page-break-after: always;
}

.archive-print-page:last-child {
  break-after: auto;
  page-break-after: auto;
}

.archive-print-page img {
  display: block;
  width: 210mm;
  height: 297mm;
  object-fit: contain;
  break-inside: avoid;
  page-break-inside: avoid;
}
`;
