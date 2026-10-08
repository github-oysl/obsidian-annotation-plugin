/** 文档中的一个光标位置，行和列都从 0 开始。 */
export interface TextPoint {
  line: number;
  ch: number;
}

/** 一段可批注的源码范围。to 是结束位置，不包含该位置上的字符。 */
export interface TextSpan {
  text: string;
  from: TextPoint;
  to: TextPoint;
}

const SENTENCE_END = "。！？!?";
const CLOSERS = "\"'」』”’）)]》】";

/**
 * 决定这次批注覆盖哪一段文字。
 * 已有选区时用选区；否则按标题、代码行、当前句子、当前段落的顺序判断。
 */
export function resolveAnnotationTextRange(
  lines: readonly string[],
  cursor: TextPoint,
  selection: TextSpan | null,
): TextSpan | null {
  if (selection && selection.text.trim()) {
    return selection;
  }
  if (cursor.line < 0 || cursor.line >= lines.length) {
    return null;
  }
  const line = lines[cursor.line] ?? "";
  if (isInsideFence(lines, cursor.line)) {
    if (isBlankLine(line) || fenceInfo(line)) {
      return null;
    }
    return trimmedLineSpan(line, cursor.line);
  }
  if (isBlankLine(line) || fenceInfo(line)) {
    return null;
  }
  const heading = headingSpan(line, cursor.line);
  if (heading) {
    return heading;
  }
  const paragraph = findParagraph(lines, cursor.line);
  return sentenceInParagraph(lines, paragraph.start, paragraph.end, cursor);
}

function sentenceInParagraph(
  lines: readonly string[],
  startLine: number,
  endLine: number,
  cursor: TextPoint,
): TextSpan | null {
  const flat = flatten(lines, startLine, endLine);
  if (!flat.text.trim()) {
    return null;
  }
  const probe = anchorIndex(flat.text, indexForCursor(flat, cursor));
  if (probe < 0) {
    return null;
  }
  const skip = buildSkipMask(flat.text);
  const bounds = sentenceBounds(flat.text, skip, probe);
  const trimmed = trimBounds(flat.text, bounds.start, bounds.end);
  if (!trimmed) {
    return null;
  }
  return {
    text: flat.text.slice(trimmed.start, trimmed.end),
    from: pointAt(flat, trimmed.start, lines, endLine),
    to: pointAt(flat, trimmed.end, lines, endLine),
  };
}

function headingSpan(line: string, lineNo: number): TextSpan | null {
  const { body, prefixLength } = splitQuote(line);
  const match = /^([ \t]{0,3})(#{1,6}[ \t]+)(.*)$/.exec(body);
  if (!match) {
    return null;
  }
  let content = match[3] ?? "";
  const closing = /^(.*?)[ \t]+#+\s*$/.exec(content);
  if (closing?.[1]) {
    content = closing[1];
  }
  content = content.replace(/[ \t]+$/, "");
  if (!content.trim()) {
    return null;
  }
  const startCh = prefixLength + (match[1]?.length ?? 0) + (match[2]?.length ?? 0);
  return {
    text: content,
    from: { line: lineNo, ch: startCh },
    to: { line: lineNo, ch: startCh + content.length },
  };
}

function trimmedLineSpan(line: string, lineNo: number): TextSpan | null {
  const match = /^([ \t]*)(.*?)[ \t]*$/.exec(line);
  const content = match?.[2] ?? "";
  if (!content.trim()) {
    return null;
  }
  const startCh = match?.[1]?.length ?? 0;
  return {
    text: content,
    from: { line: lineNo, ch: startCh },
    to: { line: lineNo, ch: startCh + content.length },
  };
}

function findParagraph(lines: readonly string[], index: number): { start: number; end: number } {
  const item = findListItem(lines, index);
  if (item) {
    return item;
  }
  let start = index;
  while (start > 0 && !isParagraphBreak(lines[start] ?? "", lines[start - 1] ?? "")) {
    start--;
  }
  let end = index;
  while (end + 1 < lines.length && !isParagraphBreak(lines[end] ?? "", lines[end + 1] ?? "")) {
    end++;
  }
  return { start, end };
}

function findListItem(lines: readonly string[], index: number): { start: number; end: number } | null {
  let start = index;
  while (start > 0 && !listItem(lines[start] ?? "")) {
    const prev = lines[start - 1] ?? "";
    const current = lines[start] ?? "";
    if (isBlankLine(prev) || isHeadingLine(prev) || fenceInfo(prev)) {
      return null;
    }
    if (splitQuote(prev).quoted !== splitQuote(current).quoted) {
      return null;
    }
    if (listItem(prev)) {
      start--;
      break;
    }
    const indent = leadingIndent(splitQuote(prev).body);
    if (indent === 0 && splitQuote(prev).body.trim() !== "") {
      return null;
    }
    start--;
  }
  const marker = listItem(lines[start] ?? "");
  if (!marker) {
    return null;
  }
  let end = start;
  for (let next = start + 1; next < lines.length; next++) {
    const line = lines[next] ?? "";
    if (isBlankLine(line) || isHeadingLine(line) || fenceInfo(line)) {
      break;
    }
    if (splitQuote(line).quoted !== splitQuote(lines[start] ?? "").quoted) {
      break;
    }
    const nextItem = listItem(line);
    if (nextItem && nextItem.indent <= marker.indent) {
      break;
    }
    if (!nextItem && leadingIndent(splitQuote(line).body) <= marker.indent) {
      break;
    }
    end = next;
  }
  if (index < start || index > end) {
    return null;
  }
  return { start, end };
}

function isParagraphBreak(current: string, neighbor: string): boolean {
  if (isBlankLine(neighbor) || isHeadingLine(neighbor) || fenceInfo(neighbor) || listItem(neighbor)) {
    return true;
  }
  return splitQuote(current).quoted !== splitQuote(neighbor).quoted;
}

function isHeadingLine(line: string): boolean {
  if (headingSpan(line, 0)) {
    return true;
  }
  const { body } = splitQuote(line);
  return /^[ \t]{0,3}#{1,6}[ \t]*$/.test(body);
}

function isBlankLine(line: string): boolean {
  return splitQuote(line).body.trim() === "";
}

function listItem(line: string): { indent: number } | null {
  const match = /^([ \t]*)(?:[-*+]|\d+[.)])[ \t]+/.exec(splitQuote(line).body);
  if (!match) {
    return null;
  }
  return { indent: match[1]?.length ?? 0 };
}

function leadingIndent(body: string): number {
  return /^[ \t]*/.exec(body)?.[0].length ?? 0;
}

/** 拆掉行首的引用标记，保留标记后面的缩进。 */
function splitQuote(line: string): { quoted: boolean; body: string; prefixLength: number } {
  let index = 0;
  let quoted = false;
  while (index < line.length) {
    let look = index;
    while (look < line.length && (line[look] === " " || line[look] === "\t")) {
      look++;
    }
    if (line[look] !== ">") {
      break;
    }
    quoted = true;
    index = look + 1;
    if (line[index] === " " || line[index] === "\t") {
      index++;
    }
  }
  return { quoted, body: line.slice(index), prefixLength: index };
}

function fenceInfo(line: string): { char: "`" | "~"; length: number } | null {
  const match = /^[ \t]{0,3}(`{3,}|~{3,})/.exec(splitQuote(line).body);
  const token = match?.[1];
  if (!token) {
    return null;
  }
  return { char: token.startsWith("~") ? "~" : "`", length: token.length };
}

function isInsideFence(lines: readonly string[], index: number): boolean {
  let open: { char: "`" | "~"; length: number } | null = null;
  for (let i = 0; i < index; i++) {
    const fence = fenceInfo(lines[i] ?? "");
    if (!fence) {
      continue;
    }
    if (!open) {
      open = fence;
    } else if (fence.char === open.char && fence.length >= open.length) {
      open = null;
    }
  }
  return open !== null;
}

interface FlatText {
  text: string;
  points: TextPoint[];
}

function flatten(lines: readonly string[], startLine: number, endLine: number): FlatText {
  const points: TextPoint[] = [];
  let text = "";
  for (let line = startLine; line <= endLine; line++) {
    const content = lines[line] ?? "";
    if (line > startLine) {
      points.push({ line: line - 1, ch: (lines[line - 1] ?? "").length });
      text += "\n";
    }
    for (let ch = 0; ch < content.length; ch++) {
      points.push({ line, ch });
      text += content[ch] ?? "";
    }
  }
  return { text, points };
}

/** 光标落在句末空白上时，归到前面那句，而不是后面那句。 */
function anchorIndex(text: string, index: number): number {
  let probe = index;
  if (probe >= text.length) {
    probe = text.length - 1;
  }
  while (probe > 0 && isSpace(text[probe] ?? "")) {
    probe--;
  }
  return probe;
}

function indexForCursor(flat: FlatText, cursor: TextPoint): number {
  for (let i = 0; i < flat.points.length; i++) {
    const point = flat.points[i];
    if (point && point.line === cursor.line && point.ch === cursor.ch) {
      return i;
    }
  }
  for (let i = flat.points.length - 1; i >= 0; i--) {
    const point = flat.points[i];
    if (point && point.line === cursor.line && point.ch < cursor.ch) {
      return i + 1;
    }
  }
  return flat.text.length;
}

function pointAt(flat: FlatText, index: number, lines: readonly string[], endLine: number): TextPoint {
  if (index < flat.points.length) {
    return flat.points[index] ?? { line: endLine, ch: 0 };
  }
  return { line: endLine, ch: (lines[endLine] ?? "").length };
}

function buildSkipMask(text: string): boolean[] {
  const skip = Array.from({ length: text.length }, () => false);
  markInlineCode(text, skip);
  markPattern(text, skip, /\]\([^)\n]*\)/g);
  markPattern(text, skip, /https?:\/\/[^\s<>)\]]+/g);
  return skip;
}

function markInlineCode(text: string, skip: boolean[]): void {
  let index = 0;
  while (index < text.length) {
    if (text[index] !== "`") {
      index++;
      continue;
    }
    let size = 0;
    while (text[index + size] === "`") {
      size++;
    }
    const close = findClosingTicks(text, index + size, size);
    if (close < 0) {
      index += size;
      continue;
    }
    for (let mark = index; mark < close; mark++) {
      skip[mark] = true;
    }
    index = close;
  }
}

function findClosingTicks(text: string, from: number, size: number): number {
  let index = from;
  while (index < text.length) {
    if (text[index] !== "`") {
      index++;
      continue;
    }
    let sizeHere = 0;
    while (text[index + sizeHere] === "`") {
      sizeHere++;
    }
    if (sizeHere === size) {
      return index + sizeHere;
    }
    index += sizeHere;
  }
  return -1;
}

function markPattern(text: string, skip: boolean[], pattern: RegExp): void {
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null = pattern.exec(text);
  while (match) {
    const value = match[0];
    for (let index = match.index; index < match.index + value.length; index++) {
      skip[index] = true;
    }
    if (value.length === 0) {
      pattern.lastIndex++;
    }
    match = pattern.exec(text);
  }
}

function sentenceBounds(text: string, skip: boolean[], probe: number): { start: number; end: number } {
  let seenPunctuation = false;
  for (let index = 0; index < text.length; index++) {
    if (isSentenceEnd(text, index, skip)) {
      seenPunctuation = true;
      break;
    }
  }
  if (!seenPunctuation) {
    return { start: 0, end: text.length };
  }
  return {
    start: findSentenceStart(text, skip, probe),
    end: findSentenceEnd(text, skip, probe),
  };
}

function findSentenceEnd(text: string, skip: boolean[], probe: number): number {
  for (let index = probe; index < text.length; index++) {
    if (!isSentenceEnd(text, index, skip)) {
      continue;
    }
    let end = index + 1;
    while (end < text.length && isCloser(text[end] ?? "") && !skip[end]) {
      end++;
    }
    return end;
  }
  return text.length;
}

function findSentenceStart(text: string, skip: boolean[], probe: number): number {
  for (let index = probe - 1; index >= 0; index--) {
    if (!isSentenceEnd(text, index, skip)) {
      continue;
    }
    let start = index + 1;
    while (start < text.length && isCloser(text[start] ?? "") && !skip[start]) {
      start++;
    }
    while (start < text.length && isSpace(text[start] ?? "")) {
      start++;
    }
    return start;
  }
  let start = 0;
  while (start < text.length && isSpace(text[start] ?? "")) {
    start++;
  }
  return start;
}

function trimBounds(text: string, start: number, end: number): { start: number; end: number } | null {
  while (start < end && isSpace(text[start] ?? "")) {
    start++;
  }
  while (end > start && isSpace(text[end - 1] ?? "")) {
    end--;
  }
  if (start >= end) {
    return null;
  }
  return { start, end };
}

function isSentenceEnd(text: string, index: number, skip: boolean[]): boolean {
  if (skip[index]) {
    return false;
  }
  const char = text[index] ?? "";
  if (SENTENCE_END.includes(char)) {
    return true;
  }
  if (char !== ".") {
    return false;
  }
  const previous = text[index - 1] ?? "";
  const next = text[index + 1];
  if (isDigit(previous) && next !== undefined && isDigit(next)) {
    return false;
  }
  if (next === undefined || isSpace(next)) {
    return true;
  }
  if (!isCloser(next)) {
    return false;
  }
  let after = index + 1;
  while (after < text.length && isCloser(text[after] ?? "")) {
    after++;
  }
  return after >= text.length || isSpace(text[after] ?? "");
}

function isCloser(char: string): boolean {
  return CLOSERS.includes(char);
}

function isSpace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r";
}

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}
