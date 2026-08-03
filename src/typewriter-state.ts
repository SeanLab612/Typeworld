export type KeyKind = "print" | "space" | "backspace" | "enter" | "modifier";

export interface TypewriterKey {
  id: string;
  code: string;
  base: string | null;
  shift: string | null;
  kind: KeyKind;
}

export interface QueuedInput {
  key: TypewriterKey;
  shifted: boolean;
  source: "physical" | "pointer" | "demo" | "auto";
}

export interface TypewriterState {
  readonly columns: number;
  readonly rows: number;
  readonly maximumRows: number;
  readonly warningColumn: number;
  readonly cells: ReadonlyArray<ReadonlyArray<string>>;
  readonly column: number;
  readonly row: number;
  readonly paperFeedLines: number;
  readonly bellRungThisLine: boolean;
  readonly shiftLatched: boolean;
}

export interface TypewriterEffects {
  imprint: string | null;
  bell: boolean;
  lineFeed: boolean;
  carriageMoved: boolean;
}

export interface TransitionResult {
  state: TypewriterState;
  effects: TypewriterEffects;
}

export function createTypewriterState(
  columns = 38,
  rows = 12,
  maximumRows = rows,
): TypewriterState {
  if (columns < 2 || rows < 2) throw new Error("Paper grid must be at least 2 × 2");
  if (maximumRows < rows) throw new Error("Maximum rows cannot be smaller than the initial grid");
  return {
    columns,
    rows,
    maximumRows,
    warningColumn: Math.max(1, columns - 5),
    cells: Array.from({length: rows}, () => Array.from({length: columns}, () => "")),
    column: 0,
    row: 0,
    paperFeedLines: 0,
    bellRungThisLine: false,
    shiftLatched: false,
  };
}

function unchanged(state: TypewriterState): TransitionResult {
  return {
    state,
    effects: {imprint: null, bell: false, lineFeed: false, carriageMoved: false},
  };
}

export function applyTypewriterKey(
  state: TypewriterState,
  key: TypewriterKey,
  shifted: boolean,
): TransitionResult {
  if (key.kind === "modifier") {
    return {
      state: {...state, shiftLatched: !state.shiftLatched},
      effects: {imprint: null, bell: false, lineFeed: false, carriageMoved: false},
    };
  }

  if (key.kind === "backspace") {
    if (state.column === 0) return unchanged(state);
    const cells = state.cells.map((row) => [...row]);
    const activeRow = cells[state.row];
    if (!activeRow) throw new Error(`Missing paper row ${state.row}`);
    activeRow[state.column - 1] = "";
    return {
      state: {...state, cells, column: state.column - 1},
      effects: {imprint: null, bell: false, lineFeed: false, carriageMoved: true},
    };
  }

  if (key.kind === "enter") {
    if (state.row >= state.maximumRows - 1) return unchanged(state);
    const nextRow = state.row + 1;
    const cells = nextRow >= state.cells.length
      ? [...state.cells, Array.from({length: state.columns}, () => "")]
      : state.cells;
    return {
      state: {
        ...state,
        cells,
        rows: cells.length,
        column: 0,
        row: nextRow,
        paperFeedLines: state.paperFeedLines + 1,
        bellRungThisLine: false,
      },
      effects: {imprint: null, bell: false, lineFeed: true, carriageMoved: true},
    };
  }

  const output = key.kind === "space"
    ? " "
    : ((shifted || state.shiftLatched) ? key.shift : key.base);
  if (output === null || state.column >= state.columns) return unchanged(state);

  const cells = state.cells.map((row) => [...row]);
  const activeRow = cells[state.row];
  if (!activeRow) throw new Error(`Missing paper row ${state.row}`);
  activeRow[state.column] = output;
  const nextColumn = state.column + 1;
  const bell = !state.bellRungThisLine && nextColumn >= state.warningColumn;
  return {
    state: {
      ...state,
      cells,
      column: nextColumn,
      bellRungThisLine: state.bellRungThisLine || bell,
      shiftLatched: false,
    },
    effects: {imprint: output, bell, lineFeed: false, carriageMoved: true},
  };
}

export function paperText(state: TypewriterState): string {
  return state.cells
    .map((row) => row.join("").replace(/\s+$/u, ""))
    .join("\n")
    .replace(/\n+$/u, "");
}

export class InputQueue {
  readonly maximumLength: number;
  #items: QueuedInput[] = [];

  constructor(maximumLength = 24) {
    if (maximumLength < 1) throw new Error("Queue capacity must be positive");
    this.maximumLength = maximumLength;
  }

  get length(): number {
    return this.#items.length;
  }

  enqueue(input: QueuedInput): boolean {
    if (this.#items.length >= this.maximumLength) return false;
    this.#items.push(input);
    return true;
  }

  dequeue(): QueuedInput | undefined {
    return this.#items.shift();
  }

  snapshot(): readonly QueuedInput[] {
    return [...this.#items];
  }

  clear(): void {
    this.#items.length = 0;
  }
}
