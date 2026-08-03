function bookTextTokens(text: string): ReadonlyArray<string> {
  return text.match(/[A-Za-z0-9`]+(?:['’-][A-Za-z0-9]+)*|\s+|./gu) ?? [];
}

export function wrapBookTextLines(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
  maxLines = 12,
): ReadonlyArray<string> {
  const lines: string[] = [];
  let line = "";
  for (const token of bookTextTokens(text.trim())) {
    const candidate = `${line}${token}`;
    if (line.trim() && measure(candidate) > maxWidth) {
      lines.push(line.trimEnd());
      if (lines.length >= maxLines) return lines;
      line = token.trimStart();
    } else if (!line && /^\s+$/u.test(token)) {
      continue;
    } else {
      line = candidate;
    }
  }
  if (line.trim() && lines.length < maxLines) lines.push(line.trimEnd());
  return lines;
}
