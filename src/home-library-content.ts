export const PUBLIC_STARTER_WORDS = [
  "green",
  "snow",
  "flower",
  "fire",
  "smile",
] as const;

export type DefaultHomeEntryId = "guide" | "words" | "library";

export interface DefaultHomeEntry {
  readonly id: DefaultHomeEntryId;
  readonly label: string;
  readonly meta: string;
  readonly title: string;
  readonly body: string;
  readonly action: "present" | "library";
}

export const DEFAULT_HOME_ENTRIES: ReadonlyArray<DefaultHomeEntry> = [
  {
    id: "guide",
    label: "GUIDE",
    meta: "使用指南",
    title: "TYPEWORLD / GUIDE",
    body: [
      "TYPEWORLD / GUIDE",
      "",
      "TYPE WITH YOUR KEYBOARD.",
      "PRESS ENTER TO SUBMIT A WORD.",
      "",
      "使用键盘输入，按回车确认。",
      "首次发现保存在左抽屉，",
      "自由书写保存在右抽屉。",
    ].join("\n"),
    action: "present",
  },
  {
    id: "words",
    label: "WORDS",
    meta: "当前五个词语",
    title: "TYPEWORLD / WORDS",
    body: [
      "TYPEWORLD / STARTER WORDS",
      "",
      ...PUBLIC_STARTER_WORDS.map((word) => word.toUpperCase()),
      "",
      "TYPE A WORD AND PRESS ENTER.",
      "输入其中一个英文词语并按回车。",
      "更多变化可以在书架中发现。",
    ].join("\n"),
    action: "present",
  },
  {
    id: "library",
    label: "LIBRARY",
    meta: "进入书架",
    title: "TYPEWORLD / LIBRARY",
    body: "",
    action: "library",
  },
] as const;

export function findDefaultHomeEntry(value: string): DefaultHomeEntry | null {
  return DEFAULT_HOME_ENTRIES.find((entry) => entry.id === value) ?? null;
}
