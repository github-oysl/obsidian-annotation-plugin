/** 用原句和前后文把批注对回笔记，行号只当缓存。 */
import type { Annotation, TextRange } from "./types";
import { isMarkdownPosition } from "./annotation-model";

const CONTEXT_CHARS = 24;

interface FlatText {
  text: string;
  lineStarts: number[];
}

function normalizeQuote(quote: string): string {
  return quote.split("\n").map((line) => line.trimEnd()).join("\n");
}

function flattenTrimmed(lines: readonly string[]): FlatText {
  const lineStarts: number[] = [];
  let text = "";
  lines.forEach((line, index) => {
    lineStarts.push(text.length);
    text += line.trimEnd();
    if (index < lines.length - 1)
      text += "\n";
  });
  return { text, lineStarts };
}

function pointAt(flat: FlatText, index: number): { line: number; ch: number } {
  let line = 0;
  for (let i = 0; i < flat.lineStarts.length; i++) {
    const start = flat.lineStarts[i] ?? 0;
    if (start <= index)
      line = i;
    else
      break;
  }
  return { line, ch: index - (flat.lineStarts[line] ?? 0) };
}

function indexAt(flat: FlatText, line: number, ch: number): number {
  const start = flat.lineStarts[line];
  if (start === undefined)
    return flat.text.length;
  const next = flat.lineStarts[line + 1];
  const lineLength = next === undefined ? flat.text.length - start : next - start - 1;
  return start + Math.max(0, Math.min(ch, Math.max(0, lineLength)));
}

export function textOfRange(lines: readonly string[], range: TextRange): string {
  const startLine = lines[range.startLine] ?? "";
  if (range.startLine === range.endLine)
    return startLine.slice(range.startCh, range.endCh);
  const parts = [startLine.slice(range.startCh)];
  for (let line = range.startLine + 1; line < range.endLine; line++)
    parts.push(lines[line] ?? "");
  parts.push((lines[range.endLine] ?? "").slice(0, range.endCh));
  return parts.join("\n");
}

export function contextAround(lines: readonly string[], range: TextRange): { prefix: string; suffix: string } {
  const flat = flattenTrimmed(lines);
  const start = indexAt(flat, range.startLine, range.startCh);
  const end = indexAt(flat, range.endLine, range.endCh);
  return {
    prefix: flat.text.slice(Math.max(0, start - CONTEXT_CHARS), start),
    suffix: flat.text.slice(end, end + CONTEXT_CHARS),
  };
}

function rangeBetween(flat: FlatText, start: number, end: number): TextRange {
  const from = pointAt(flat, start);
  const to = pointAt(flat, end);
  return {
    startLine: from.line,
    startCh: from.ch,
    endLine: to.line,
    endCh: to.ch,
  };
}

/** 在去掉行尾空白后的全文里找原句。有前后文时只接受整段对得上的位置。 */
export function findAnchoredRanges(lines: readonly string[], quote: string, prefix: string, suffix: string): TextRange[] {
  const flat = flattenTrimmed(lines);
  const normalizedQuote = normalizeQuote(quote);
  if (!normalizedQuote)
    return [];
  const ranges: TextRange[] = [];
  const needle = prefix || suffix ? `${prefix}${normalizedQuote}${suffix}` : normalizedQuote;
  let from = 0;
  while (from <= flat.text.length) {
    const index = flat.text.indexOf(needle, from);
    if (index < 0)
      break;
    const quoteStart = prefix || suffix ? index + prefix.length : index;
    ranges.push(rangeBetween(flat, quoteStart, quoteStart + normalizedQuote.length));
    from = index + Math.max(needle.length, 1);
  }
  return ranges;
}

function rangeMatchesQuote(lines: readonly string[], range: TextRange, quote: string): boolean {
  if (range.startLine < 0 || range.endLine >= lines.length || range.startLine > range.endLine)
    return false;
  return normalizeQuote(textOfRange(lines, range)) === normalizeQuote(quote);
}

function samePosition(left: TextRange, right: TextRange): boolean {
  return left.startLine === right.startLine && left.startCh === right.startCh && left.endLine === right.endLine && left.endCh === right.endCh;
}

function reconcileOne(annotation: Annotation, lines: readonly string[]): Annotation {
  if (annotation.fileType === "pdf" || !isMarkdownPosition(annotation.position) || annotation.anchor === "file-missing")
    return annotation;
  const quote = annotation.highlightedText;
  if (!normalizeQuote(quote))
    return annotation.anchor === "missing" ? annotation : { ...annotation, anchor: "missing" };
  if (rangeMatchesQuote(lines, annotation.position, quote)) {
    const context = contextAround(lines, annotation.position);
    if (annotation.anchor === "ok" && annotation.prefix === context.prefix && annotation.suffix === context.suffix)
      return annotation;
    return { ...annotation, anchor: "ok", prefix: context.prefix, suffix: context.suffix };
  }
  // 前后文被改过时，原句若仍只出现一次，就认这一处，避免旁边改几个字就把批注标丢。
  let hits = findAnchoredRanges(lines, quote, annotation.prefix, annotation.suffix);
  if (hits.length === 0 && (annotation.prefix || annotation.suffix))
    hits = findAnchoredRanges(lines, quote, "", "");
  if (hits.length === 1) {
    const hit = hits[0];
    if (!hit)
      return { ...annotation, anchor: "missing" };
    const context = contextAround(lines, hit);
    const liveQuote = textOfRange(lines, hit);
    if (annotation.anchor === "ok" && annotation.prefix === context.prefix && annotation.suffix === context.suffix && annotation.highlightedText === liveQuote && samePosition(annotation.position, hit))
      return annotation;
    return {
      ...annotation,
      anchor: "ok",
      prefix: context.prefix,
      suffix: context.suffix,
      highlightedText: liveQuote,
      position: { kind: "markdown", ...hit },
    };
  }
  const nextStatus = hits.length > 1 ? "ambiguous" : "missing";
  return annotation.anchor === nextStatus ? annotation : { ...annotation, anchor: nextStatus };
}

/** 只重算这一篇里的 Markdown 批注。没变化时返回原数组。 */
export function reconcileFileAnnotations(annotations: readonly Annotation[], filePath: string, lines: readonly string[]): { annotations: Annotation[]; changed: boolean } {
  let changed = false;
  const next = annotations.map((annotation) => {
    if (annotation.filePath !== filePath || annotation.fileType === "pdf")
      return annotation;
    const updated = reconcileOne(annotation, lines);
    if (updated !== annotation)
      changed = true;
    return updated;
  });
  return { annotations: changed ? next : annotations as Annotation[], changed };
}

export function anchorFieldsForRange(lines: readonly string[], range: TextRange, quote: string): Pick<Annotation, "prefix" | "suffix" | "anchor" | "highlightedText"> {
  const context = contextAround(lines, range);
  return {
    prefix: context.prefix,
    suffix: context.suffix,
    anchor: "ok",
    highlightedText: quote,
  };
}

export function linesFromText(text: string): string[] {
  const lines = text.split("\n");
  if (text.endsWith("\n") && lines[lines.length - 1] === "")
    lines.pop();
  return lines;
}
