import {FREEFORM_ARCHIVE_SIGNATURE} from "./archive-paper-layout";

export type ArchiveDrawer = "left" | "right";
export type ArchiveDocumentKind = "command" | "freeform";

export interface CommandDefinition {
  readonly keyword: string;
  readonly title: string;
  readonly body: string;
  readonly mock: boolean;
}

export interface ArchiveDocument {
  readonly id: string;
  readonly kind: ArchiveDocumentKind;
  readonly keyword: string | null;
  readonly title: string;
  readonly text: string;
  readonly drawer: ArchiveDrawer;
  readonly createdAt: string;
  readonly mock: boolean;
}

export interface ArchiveSnapshot {
  readonly version: 2;
  readonly documents: ReadonlyArray<ArchiveDocument>;
  readonly discovered: ReadonlyArray<string>;
}

export const TOTAL_DISCOVERABLE_COMMANDS = 50;
export const ARCHIVE_VISIBLE_CAPACITY: Readonly<Record<ArchiveDrawer, number>> = {
  left: TOTAL_DISCOVERABLE_COMMANDS,
  right: 60,
};
export const ARCHIVE_STORAGE_KEY = "typeworld.phase7.archive.v1";
export const LEGACY_ARCHIVE_STORAGE_KEY = "typeword.phase7.archive.v1";
export const ARCHIVE_MAX_DOCUMENTS = 1_000;
export const ARCHIVE_MAX_TEXT_LENGTH = 4_096;
export const ARCHIVE_MAX_SERIALIZED_LENGTH = 4_500_000;
const ARCHIVE_MAX_ID_LENGTH = 180;
const ARCHIVE_MAX_TITLE_LENGTH = 160;
const ARCHIVE_MAX_KEYWORD_LENGTH = 64;

export const PHASE7_COMMANDS: ReadonlyArray<CommandDefinition> = [];

const RETIRED_PERSONAL_COMMANDS = new Set(["about", "contact", "projects"]);

const commandByKeyword = new Map(PHASE7_COMMANDS.map((command) => [command.keyword, command]));

export function normalizeCommand(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/gu, " ");
}

export function findCommand(value: string): CommandDefinition | null {
  return commandByKeyword.get(normalizeCommand(value)) ?? null;
}

export function createEmptyArchive(): ArchiveSnapshot {
  return {version: 2, documents: [], discovered: []};
}

function isDrawer(value: unknown): value is ArchiveDrawer {
  return value === "left" || value === "right";
}

function boundedString(value: string, maximumLength: number): string {
  return value.slice(0, maximumLength);
}

function normalizeStoredDocument(value: unknown): ArchiveDocument | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ArchiveDocument>;
  if (
    typeof candidate.id !== "string"
    || typeof candidate.title !== "string"
    || typeof candidate.text !== "string"
    || !isDrawer(candidate.drawer)
    || typeof candidate.createdAt !== "string"
    || typeof candidate.mock !== "boolean"
  ) {
    return null;
  }
  const id = boundedString(candidate.id.trim(), ARCHIVE_MAX_ID_LENGTH);
  const title = boundedString(candidate.title.trim(), ARCHIVE_MAX_TITLE_LENGTH);
  const text = boundedString(candidate.text, ARCHIVE_MAX_TEXT_LENGTH);
  if (!id || !title) return null;
  const keyword = typeof candidate.keyword === "string"
    ? boundedString(normalizeCommand(candidate.keyword), ARCHIVE_MAX_KEYWORD_LENGTH)
    : null;
  if (keyword && RETIRED_PERSONAL_COMMANDS.has(keyword)) return null;
  const registeredCommand = keyword ? findCommand(keyword) : null;
  const kind: ArchiveDocumentKind = candidate.kind === "command" || registeredCommand
    ? "command"
    : "freeform";
  return {
    id,
    kind,
    keyword: kind === "command" ? keyword : null,
    title: registeredCommand?.title ?? title,
    text: registeredCommand?.body ?? text,
    drawer: kind === "command" ? "left" : "right",
    createdAt: candidate.createdAt,
    mock: registeredCommand?.mock ?? candidate.mock,
  };
}

function firstCommandDocuments(
  documents: ReadonlyArray<ArchiveDocument>,
): ReadonlyArray<ArchiveDocument> {
  const earliestByKeyword = new Map<string, ArchiveDocument>();
  const freeform: ArchiveDocument[] = [];
  for (const document of documents) {
    if (document.kind === "freeform" || !document.keyword) {
      freeform.push(document);
      continue;
    }
    const existing = earliestByKeyword.get(document.keyword);
    if (!existing || document.createdAt < existing.createdAt) {
      earliestByKeyword.set(document.keyword, document);
    }
  }
  return [...earliestByKeyword.values(), ...freeform]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function parseArchiveSnapshot(raw: string | null): ArchiveSnapshot {
  if (!raw) return createEmptyArchive();
  if (raw.length > ARCHIVE_MAX_SERIALIZED_LENGTH) return createEmptyArchive();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return createEmptyArchive();
    const candidate = parsed as {
      version?: unknown;
      documents?: unknown;
      discovered?: unknown;
    };
    if (candidate.version !== 1 && candidate.version !== 2) return createEmptyArchive();
    const documents = firstCommandDocuments(
      Array.isArray(candidate.documents)
        ? candidate.documents.slice(0, ARCHIVE_MAX_DOCUMENTS)
          .map(normalizeStoredDocument)
          .filter((item): item is ArchiveDocument => item !== null)
        : [],
    );
    const discoveredFromDocuments = documents
      .filter((document) => document.kind === "command" && document.keyword)
      .map((document) => document.keyword as string);
    const storedDiscovered = Array.isArray(candidate.discovered)
      ? candidate.discovered
        .filter((item): item is string => typeof item === "string")
        .map((item) => boundedString(normalizeCommand(item), ARCHIVE_MAX_KEYWORD_LENGTH))
        .filter((item) => !RETIRED_PERSONAL_COMMANDS.has(item))
        .filter(Boolean)
        .slice(0, TOTAL_DISCOVERABLE_COMMANDS)
      : [];
    return {
      version: 2,
      documents,
      discovered: [...new Set([...storedDiscovered, ...discoveredFromDocuments])],
    };
  } catch {
    return createEmptyArchive();
  }
}

export function createCommandDocument(
  command: CommandDefinition,
  createdAt = new Date().toISOString(),
  id = `${command.keyword}-${createdAt}`,
): ArchiveDocument {
  return {
    id,
    kind: "command",
    keyword: command.keyword,
    title: command.title,
    text: command.body,
    drawer: "left",
    createdAt,
    mock: command.mock,
  };
}

export function createFreeformDocument(
  text: string,
  createdAt = new Date().toISOString(),
  id = `freeform-${createdAt}`,
): ArchiveDocument {
  const normalizedText = boundedString(text.trim(), ARCHIVE_MAX_TEXT_LENGTH);
  return {
    id,
    kind: "freeform",
    keyword: null,
    title: FREEFORM_ARCHIVE_SIGNATURE,
    text: normalizedText,
    drawer: "right",
    createdAt,
    mock: false,
  };
}

export function hasArchivedCommand(snapshot: ArchiveSnapshot, keyword: string): boolean {
  const normalizedKeyword = normalizeCommand(keyword);
  return snapshot.documents.some(
    (document) => document.kind === "command" && document.keyword === normalizedKeyword,
  );
}

export function archiveDocument(
  snapshot: ArchiveSnapshot,
  document: ArchiveDocument,
): ArchiveSnapshot {
  if (
    document.kind === "command"
    && document.keyword
    && hasArchivedCommand(snapshot, document.keyword)
  ) {
    return {
      ...snapshot,
      discovered: snapshot.discovered.includes(document.keyword)
        ? [...snapshot.discovered]
        : [...snapshot.discovered, document.keyword],
    };
  }
  const documents = [
    document,
    ...snapshot.documents.filter((item) => item.id !== document.id),
  ].slice(0, ARCHIVE_MAX_DOCUMENTS);
  const discovered = (
    document.kind === "command"
    && document.keyword
    && !snapshot.discovered.includes(document.keyword)
  )
    ? [...snapshot.discovered, document.keyword]
    : [...snapshot.discovered];
  return {version: 2, documents, discovered};
}

export function documentsForDrawer(
  snapshot: ArchiveSnapshot,
  drawer: ArchiveDrawer,
): ReadonlyArray<ArchiveDocument> {
  return snapshot.documents.filter((document) => document.drawer === drawer);
}

export function visiblePaperCount(
  snapshot: ArchiveSnapshot,
  drawer: ArchiveDrawer,
): number {
  return Math.min(
    documentsForDrawer(snapshot, drawer).length,
    ARCHIVE_VISIBLE_CAPACITY[drawer],
  );
}

export function isDrawerVisuallyFull(
  snapshot: ArchiveSnapshot,
  drawer: ArchiveDrawer,
): boolean {
  return documentsForDrawer(snapshot, drawer).length >= ARCHIVE_VISIBLE_CAPACITY[drawer];
}
