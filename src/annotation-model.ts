/** 批注数据的形状、默认设置，以及和编辑器选区相关的纯函数。 */
import { Editor } from "obsidian";
import { resolveAnnotationTextRange, type TextSpan } from "./annotation-range";
import { t } from "./i18n";
import type {
  AnchorStatus,
  Annotation,
  AnnotationDraft,
  AnnotationPosition,
  AnnotatorSettings,
  LoosePosition,
  MarkdownPosition,
  PdfPosition,
  PdfRect,
  TextRange,
} from "./types";

const ANCHOR_STATUSES: readonly AnchorStatus[] = ["ok", "ambiguous", "missing", "file-missing"];

export function readAnchorStatus(value: unknown): AnchorStatus | undefined {
  return typeof value === "string" && ANCHOR_STATUSES.includes(value as AnchorStatus) ? value as AnchorStatus : undefined;
}

export function getFileType(file: { extension?: string } | null | undefined): "pdf" | "markdown" {
  return file?.extension === "pdf" ? "pdf" : "markdown";
}
export function isMarkdownPosition(position: AnnotationPosition | LoosePosition | null | undefined): position is MarkdownPosition {
  return !!position && (position.kind === "markdown" || ("startLine" in position && typeof position.startLine === "number"));
}
export function isPdfPosition(position: AnnotationPosition | LoosePosition | null | undefined): position is PdfPosition {
  return !!position && position.kind === "pdf";
}
export function normalizeRect(rect: Partial<PdfRect> | null | undefined): PdfRect | null {
  if (!rect)
    return null;
  const x = Number(rect.x);
  const y = Number(rect.y);
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (![x, y, width, height].every(Number.isFinite))
    return null;
  if (width <= 0 || height <= 0)
    return null;
  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    width,
    height
  };
}
/** 旧记录没有标签。空字符串和重复项丢掉，不因此回写整份文件。 */
function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value))
    return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of value) {
    if (typeof item !== "string")
      continue;
    const tag = item.trim();
    if (!tag || seen.has(tag))
      continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

export function normalizeAnnotation(annotation: AnnotationDraft | null | undefined): Annotation | null {
  if (!annotation || !annotation.filePath)
    return null;
  const rawFileType = annotation.fileType || (annotation.filePath.toLowerCase().endsWith(".pdf") ? "pdf" : "markdown");
  const fileType: "pdf" | "markdown" = rawFileType === "pdf" ? "pdf" : "markdown";
  const base = {
    id: annotation.id || generateId(),
    filePath: annotation.filePath,
    fileType,
    type: annotation.type || "highlight",
    color: annotation.color || DEFAULT_SETTINGS.defaultColor,
    highlightedText: annotation.highlightedText || "",
    noteContent: annotation.noteContent || "",
    tags: normalizeTags(annotation.tags),
    prefix: typeof annotation.prefix === "string" ? annotation.prefix : "",
    suffix: typeof annotation.suffix === "string" ? annotation.suffix : "",
    anchor: readAnchorStatus(annotation.anchor),
    groupId: annotation.groupId || null,
    created: typeof annotation.created === "number" ? annotation.created : Date.now(),
    updated: typeof annotation.updated === "number" ? annotation.updated : Date.now(),
    order: typeof annotation.order === "number" ? annotation.order : typeof annotation.created === "number" ? annotation.created : Date.now()
  };
  if (fileType === "pdf") {
    const position = annotation.position || {};
    const rects = Array.isArray(position.rects) ? position.rects.map((rect) => normalizeRect(rect)).filter((rect): rect is PdfRect => rect !== null) : [];
    if (rects.length === 0 || !Number.isFinite(position.page))
      return null;
    return {
      ...base,
      position: {
        kind: "pdf",
        page: Number(position.page),
        rects,
        quote: position.quote || annotation.highlightedText || "",
        pageLabel: position.pageLabel || String(position.page),
        viewportBase: position.viewportBase && Number.isFinite(position.viewportBase.pageWidth) && Number.isFinite(position.viewportBase.pageHeight) ? {
          pageWidth: Number(position.viewportBase.pageWidth),
          pageHeight: Number(position.viewportBase.pageHeight)
        } : null
      }
    };
  }
  const position = annotation.position || {};
  if (!isMarkdownPosition(position))
    return null;
  return {
    ...base,
    position: {
      kind: "markdown",
      startLine: Number(position.startLine) || 0,
      startCh: Number(position.startCh) || 0,
      endLine: Number(position.endLine) || 0,
      endCh: Number(position.endCh) || 0
    }
  };
}

export function getAnnotationLocationLabel(annotation: Annotation, plugin?: { settings?: { language?: string } }): string {
  if (annotation.fileType === "pdf" && isPdfPosition(annotation.position)) {
    return t("ui.locationPage", plugin).replace("{page}", String(annotation.position.page));
  }
  if (!isMarkdownPosition(annotation.position)) {
    return "";
  }
  return t("ui.locationLine", plugin).replace("{line}", String(annotation.position.startLine + 1));
}

export interface AnnotationStoreData {
  annotations?: unknown;
  groups?: unknown;
  settings?: Partial<AnnotatorSettings>;
}

export const DEFAULT_SETTINGS: AnnotatorSettings = {
  defaultColor: "#FCD34D",
  colors: ["#FCD34D", "#34D399", "#60A5FA", "#8B5CF6"],
  customHighlightColor: "",
  customHighlightColorName: "自定义",
  language: "zh"
};
export const ANNOTATION_STORE_DIR = "scholiast";
export const ANNOTATION_STORE_FILE = "annotations.json";
export const LEGACY_ANNOTATION_STORE_DIR = "_article-annotator";
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}
export function formatTime(ts: number, plugin?: { settings?: { language?: string } }): string {
  const d = new Date(ts);
  const now = /* @__PURE__ */ new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (d.toDateString() === now.toDateString()) {
    return `${t("time.today", plugin)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `${t("time.yesterday", plugin)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function captureMarkdownRange(editor: Editor): TextSpan | null {
  const lines: string[] = [];
  const lineCount = editor.lineCount();
  for (let line = 0; line < lineCount; line++) {
    lines.push(editor.getLine(line));
  }
  const cursor = editor.getCursor();
  return resolveAnnotationTextRange(lines, cursor, {
    text: editor.getSelection(),
    from: editor.getCursor("from"),
    to: editor.getCursor("to"),
  });
}

export function positionsOverlap(a: TextRange, b: TextRange): boolean {
  if (a.endLine < b.startLine || a.endLine === b.startLine && a.endCh <= b.startCh)
    return false;
  if (a.startLine > b.endLine || a.startLine === b.endLine && a.startCh >= b.endCh)
    return false;
  return true;
}

function isBefore(line: number, ch: number, otherLine: number, otherCh: number): boolean {
  return line < otherLine || (line === otherLine && ch < otherCh);
}

/** 光标落在批注范围内，包含范围末尾，方便停在高亮最后一个字后面。 */
export function cursorTouchesRange(position: TextRange, line: number, ch: number): boolean {
  if (isBefore(line, ch, position.startLine, position.startCh))
    return false;
  if (isBefore(position.endLine, position.endCh, line, ch))
    return false;
  return true;
}

function spanRank(position: TextRange): number {
  return (position.endLine - position.startLine) * 100000 + Math.max(0, position.endCh - position.startCh);
}

/**
 * 找出光标或当前选区命中的 Markdown 批注。
 * 多条重叠时取范围更小的那条。
 */
export function findMarkdownAnnotationAtCursor(annotations: readonly Annotation[], editor: Editor): Annotation | null {
  const cursor = editor.getCursor();
  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
  const hasSelection = editor.getSelection().length > 0;
  const selection: TextRange = {
    startLine: from.line,
    startCh: from.ch,
    endLine: to.line,
    endCh: to.ch,
  };
  const hits = annotations.filter((annotation) => {
    if (annotation.fileType === "pdf" || !isMarkdownPosition(annotation.position))
      return false;
    if (hasSelection)
      return positionsOverlap(annotation.position, selection);
    return cursorTouchesRange(annotation.position, cursor.line, cursor.ch);
  });
  hits.sort((a, b) => {
    if (!isMarkdownPosition(a.position) || !isMarkdownPosition(b.position))
      return 0;
    const rank = spanRank(a.position) - spanRank(b.position);
    if (rank !== 0)
      return rank;
    return b.updated - a.updated;
  });
  return hits[0] ?? null;
}

// ==================== 颜色验证 ====================
export function validateHexColor(hex: unknown): hex is string {
  if (!hex || typeof hex !== "string") return false;
  return /^#[0-9A-Fa-f]{6}$/.test(hex.trim());
}
