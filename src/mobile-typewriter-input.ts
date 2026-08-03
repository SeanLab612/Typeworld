export type MobileInputEdit =
  | {readonly kind: "insert"; readonly text: string}
  | {readonly kind: "backspace"; readonly count: number};

export interface MobileInputReconciliation {
  readonly accepted: boolean;
  readonly value: string;
  readonly edit: MobileInputEdit | null;
  readonly reason: "accepted" | "unsupported-character" | "mid-line-edit";
}

const TYPEWRITER_ASCII = /^[\x20-\x7e]*$/u;

export function reconcileMobileInput(
  previousValue: string,
  nextValue: string,
): MobileInputReconciliation {
  if (!TYPEWRITER_ASCII.test(nextValue)) {
    return {
      accepted: false,
      value: previousValue,
      edit: null,
      reason: "unsupported-character",
    };
  }

  if (nextValue.startsWith(previousValue)) {
    const inserted = nextValue.slice(previousValue.length);
    return {
      accepted: true,
      value: nextValue,
      edit: inserted ? {kind: "insert", text: inserted} : null,
      reason: "accepted",
    };
  }

  if (previousValue.startsWith(nextValue)) {
    return {
      accepted: true,
      value: nextValue,
      edit: {
        kind: "backspace",
        count: previousValue.length - nextValue.length,
      },
      reason: "accepted",
    };
  }

  return {
    accepted: false,
    value: previousValue,
    edit: null,
    reason: "mid-line-edit",
  };
}

export function mobileKeyboardInset(
  layoutViewportHeight: number,
  visualViewportHeight: number,
  visualViewportOffsetTop: number,
): number {
  return Math.max(
    0,
    Math.round(
      layoutViewportHeight
      - visualViewportHeight
      - visualViewportOffsetTop,
    ),
  );
}
