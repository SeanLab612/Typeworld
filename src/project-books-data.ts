export interface ProjectBookLink {
  readonly label: string;
  readonly href: string;
}

export interface ProjectBookMedia {
  readonly kind: "image" | "video";
  readonly src: string;
  readonly alt: string;
  readonly caption?: string;
}

export interface ProjectBookPage {
  readonly section: string;
  readonly heading: string;
  readonly paragraphs: ReadonlyArray<string>;
}

interface ProjectBookBase {
  readonly id: string;
  readonly volumeLabel: string;
  readonly coverUrl: string;
  readonly coverColor: number;
  readonly foilColor: number;
}

export interface PopulatedProjectBookRecord extends ProjectBookBase {
  readonly kind: "project";
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly pages: ReadonlyArray<ProjectBookPage>;
  readonly links: ReadonlyArray<ProjectBookLink>;
  readonly media: ReadonlyArray<ProjectBookMedia>;
}

export interface BlankProjectBookRecord extends ProjectBookBase {
  readonly kind: "blank";
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly pages: readonly [];
  readonly links: readonly [];
  readonly media: readonly [];
}

export type ProjectBookRecord =
  | PopulatedProjectBookRecord
  | BlankProjectBookRecord;

export const PROJECT_BOOKS: ReadonlyArray<ProjectBookRecord> = [
  {
    kind: "project",
    id: "guide",
    title: "The Guide",
    volumeLabel: "Volume 01",
    subtitle: "How to use the Typeworld typewriter",
    description: "A short bilingual guide to typing, keywords, drawers, and the library. / 关于输入、关键词、抽屉与书架的双语指南。",
    coverUrl: "/textures/projects/typeworld-volume-01-cover-base-v1.jpg",
    coverColor: 0x7c1b25,
    foilColor: 0xe0ba76,
    pages: [
      {
        section: "Welcome / 欢迎",
        heading: "Typeworld",
        paragraphs: [
          "A mechanical typewriter for words, paper, and small transformations.",
          "一台关于文字、纸张与微小变化的机械打字机。",
        ],
      },
      {
        section: "Type / 输入",
        heading: "Use the keys",
        paragraphs: [
          "Use your keyboard, or press the keys on the machine. Press Enter to submit a word.",
          "使用实体键盘输入，也可以直接点击打字机键帽。输入完成后按下回车。",
        ],
      },
      {
        section: "Words / 词语",
        heading: "A few may react",
        paragraphs: [
          "Most words stay on the paper. A few may change the machine, the sheet, or the room.",
          "大多数文字会留在纸上，少数英文词语会改变打字机、纸张或房间。",
        ],
      },
      {
        section: "Drawers / 抽屉",
        heading: "Keep the first print",
        paragraphs: [
          "Discovered words are kept on the left. Your own writing is kept on the right.",
          "首次发现的词语保存在左抽屉；你的自由书写保存在右抽屉。",
        ],
      },
      {
        section: "English / 英文输入",
        heading: "Type keywords in English",
        paragraphs: [
          "The books are bilingual, but the mechanical keyboard recognizes English keywords only.",
          "书本提供中英文双语阅读，但机械打字机只识别英文关键词。",
        ],
      },
      {
        section: "Library / 书架",
        heading: "More words live here",
        paragraphs: [
          "Scroll down from the study to return to the library. New reaction types may appear as new volumes.",
          "从书房向下滚动即可回到书架；新的变化类型会以新卷册出现。",
        ],
      },
      {
        section: "Return / 返回",
        heading: "Follow the paper trail",
        paragraphs: [
          "Press Escape to close a book, return to the library, and then return to the study.",
          "按下 Esc 可依次合上书本、返回书库，再回到书房。",
        ],
      },
    ],
    links: [],
    media: [],
  },
  {
    kind: "project",
    id: "machine",
    title: "Machine",
    volumeLabel: "Volume 02",
    subtitle: "Reactions that transform the typewriter",
    description: "Three reversible transformations across the frame: GREEN, SNOW, and FLOWER. / 三种作用于打字机机身的可逆变化。",
    coverUrl: "/textures/projects/typeworld-volume-02-cover-base-v1.jpg",
    coverColor: 0x172846,
    foilColor: 0xd3a663,
    pages: [
      {
        section: "Machine / 机身变化",
        heading: "Transform the frame",
        paragraphs: [
          "These words change the typewriter while keeping the study and the current sheet in place.",
          "这些词语会改变打字机本身，同时保留书房和当前纸张。",
        ],
      },
      {
        section: "Green / 绿色",
        heading: "A remembered color",
        paragraphs: [
          "Old vines wake along the frame. Type GREEN and press Enter.",
          "古老藤蔓会沿着机身生长。输入英文 GREEN，然后按下回车。",
        ],
      },
      {
        section: "Snow / 雪",
        heading: "Winter beneath the keys",
        paragraphs: [
          "Cold light and drifting snow settle across the machine. Type SNOW and press Enter.",
          "冷色霜光与飘雪会覆盖机身。输入英文 SNOW，然后按下回车。",
        ],
      },
      {
        section: "Flower / 花",
        heading: "Iron learns to bloom",
        paragraphs: [
          "Branches open along the frame and a few petals fall. Type FLOWER and press Enter.",
          "花枝会沿机身展开，并落下少量花瓣。输入英文 FLOWER，然后按下回车。",
        ],
      },
      {
        section: "First print / 首印",
        heading: "Keep each discovery",
        paragraphs: [
          "The first successful print of each keyword is preserved in the left drawer.",
          "每个关键词第一次成功触发后，首印会保存在左抽屉。",
        ],
      },
      {
        section: "Repeat / 再次触发",
        heading: "Return whenever you like",
        paragraphs: [
          "A discovered word can always be typed again. Start a new word to let the current transformation rest.",
          "已经发现的词仍可再次输入；输入新内容时，当前变化会退去。",
        ],
      },
      {
        section: "Try / 试试看",
        heading: "Choose one word",
        paragraphs: [
          "Return to the study and try GREEN, SNOW, or FLOWER.",
          "回到书房，试着输入 GREEN、SNOW 或 FLOWER。",
        ],
      },
    ],
    links: [],
    media: [],
  },
  {
    kind: "project",
    id: "paper",
    title: "Paper",
    volumeLabel: "Volume 03",
    subtitle: "Reactions that transform the current sheet",
    description: "FIRE burns and replaces the sheet; SMILE draws a reply. / FIRE 与 SMILE 会以不同方式改变当前纸张。",
    coverUrl: "/textures/projects/typeworld-volume-03-cover-base-v1.jpg",
    coverColor: 0x274332,
    foilColor: 0xc6a765,
    pages: [
      {
        section: "Paper / 纸张变化",
        heading: "The sheet can react",
        paragraphs: [
          "Some words do not change the room. They change the paper waiting in the machine.",
          "有些词不会改变房间，而会改变打字机中正在等待的纸张。",
        ],
      },
      {
        section: "Fire / 火",
        heading: "This word burns",
        paragraphs: [
          "The old sheet burns away and a clean sheet takes its place. Type FIRE and press Enter.",
          "旧纸燃烧消失后会自动换入新纸。输入英文 FIRE，然后按下回车。",
        ],
      },
      {
        section: "Archive / 归档",
        heading: "Nothing is lost",
        paragraphs: [
          "Your writing is archived before the flame appears. The effect destroys the sheet, not the archive.",
          "火焰出现前，已有文字会先被安全归档；燃烧不会删除抽屉记录。",
        ],
      },
      {
        section: "Smile / 微笑",
        heading: "A small reply",
        paragraphs: [
          "The paper may answer with a hand-drawn face. Type SMILE and press Enter.",
          "纸张会用一张手绘笑脸回应你。输入英文 SMILE，然后按下回车。",
        ],
      },
      {
        section: "Pet seal / 宠物印章",
        heading: "Mark the archive",
        paragraphs: [
          "Archived sheets can carry the Typeworld pet seal when you download or print them.",
          "下载或打印归档纸张时，可以留下 Typeworld 的宠物档案印章。",
        ],
      },
      {
        section: "Continue / 继续",
        heading: "Load a clean sheet",
        paragraphs: [
          "After SMILE, start typing again to load a clean sheet. Both reactions may be repeated.",
          "SMILE 完成后再次输入即可换入干净纸张；两种效果都能重复触发。",
        ],
      },
      {
        section: "Try / 试试看",
        heading: "Choose one word",
        paragraphs: [
          "Return to the study and try FIRE or SMILE.",
          "回到书房，试着输入 FIRE 或 SMILE。",
        ],
      },
    ],
    links: [],
    media: [],
  },
  {
    kind: "project",
    id: "your-words",
    title: "Your Words",
    volumeLabel: "Volume 04",
    subtitle: "Free writing and the right drawer",
    description: "The typewriter is also a place for notes, sentences, and anything worth keeping. / 这台打字机同样保存你的自由书写。",
    coverUrl: "/textures/projects/typeworld-volume-04-cover-base-v1.jpg",
    coverColor: 0x30243a,
    foilColor: 0xc59273,
    pages: [
      {
        section: "Your words / 你的文字",
        heading: "Not only keywords",
        paragraphs: [
          "The typewriter is not only waiting for keywords.",
          "这台打字机并不只等待关键词。",
        ],
      },
      {
        section: "Write / 书写",
        heading: "Leave something on paper",
        paragraphs: [
          "Type a note, a sentence, or anything you would like to keep.",
          "写下一条笔记、一句话，或者任何你想留下的内容。",
        ],
      },
      {
        section: "Right drawer / 右抽屉",
        heading: "Archive the sheet",
        paragraphs: [
          "Load a new sheet to send your free writing to the right drawer.",
          "点击换纸，你的自由书写便会进入右抽屉。",
        ],
      },
      {
        section: "Left drawer / 左抽屉",
        heading: "Discoveries live apart",
        paragraphs: [
          "Keyword discoveries stay in the left drawer, separate from your free writing.",
          "关键词发现保存在左抽屉，与右抽屉中的自由书写分开。",
        ],
      },
      {
        section: "Return / 重开",
        heading: "Open it again",
        paragraphs: [
          "Archived paper can be opened, downloaded, or printed again.",
          "已经归档的纸张可以重新打开、下载或打印。",
        ],
      },
      {
        section: "Pet seal / 宠物印章",
        heading: "Leave a small mark",
        paragraphs: [
          "The border collie and Devon rex remain as the archive's friendly seal.",
          "边牧与德文猫会继续作为档案中的友好印记。",
        ],
      },
      {
        section: "Blank page / 空白页",
        heading: "What will you leave?",
        paragraphs: [
          "What would you like to leave on the paper?",
          "你想在纸上留下什么？",
        ],
      },
    ],
    links: [],
    media: [],
  },
] as const;

export function normalizeProjectBookIndex(index: number): number {
  const count = PROJECT_BOOKS.length;
  return ((index % count) + count) % count;
}

export function getRelativeProjectBookIndex(index: number, activeIndex: number): number {
  const count = PROJECT_BOOKS.length;
  const direct = normalizeProjectBookIndex(index) - normalizeProjectBookIndex(activeIndex);
  if (direct > count / 2) return direct - count;
  if (direct < -count / 2) return direct + count;
  return direct;
}
