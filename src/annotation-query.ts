/** 侧栏和批注中心共用的筛选、搜索和排序。不读写文件。 */
import { isMarkdownPosition, isPdfPosition } from "./annotation-model";
import type { Annotation } from "./types";

export type AnnotationSort = "position" | "created" | "updated";
export type AnnotationKind = "all" | "note" | "highlight";

export interface AnnotationFilter {
  sort: AnnotationSort;
  colors: string[];
  tags: string[];
  notesOnly: boolean;
  tagsOnly: boolean;
}

export function defaultAnnotationFilter(): AnnotationFilter {
  return {
    sort: "position",
    colors: [],
    tags: [],
    notesOnly: false,
    tagsOnly: false
  };
}

export function isFilterActive(filter: AnnotationFilter): boolean {
  return filter.colors.length > 0 || filter.tags.length > 0 || filter.notesOnly || filter.tagsOnly;
}

/** 有批注正文才算批注。空正文是高亮，不看 type 字段。 */
export function isNote(annotation: Annotation): boolean {
  return annotation.noteContent.trim().length > 0;
}

export function matchesQuery(annotation: Annotation, query: string, includePath = false): boolean {
  const q = query.trim().toLowerCase();
  if (!q)
    return true;
  if (annotation.highlightedText.toLowerCase().includes(q))
    return true;
  if (annotation.noteContent.toLowerCase().includes(q))
    return true;
  if ((annotation.tags ?? []).some((tag) => tag.toLowerCase().includes(q)))
    return true;
  return includePath && annotation.filePath.toLowerCase().includes(q);
}

export function matchesKind(annotation: Annotation, kind: AnnotationKind): boolean {
  if (kind === "note")
    return isNote(annotation);
  if (kind === "highlight")
    return !isNote(annotation);
  return true;
}

export function matchesFilter(annotation: Annotation, filter: AnnotationFilter): boolean {
  if (filter.colors.length > 0 && !filter.colors.includes(annotation.color))
    return false;
  const tags = annotation.tags ?? [];
  if (filter.tags.length > 0 && !filter.tags.some((tag) => tags.includes(tag)))
    return false;
  if (filter.notesOnly && !isNote(annotation))
    return false;
  if (filter.tagsOnly && tags.length === 0)
    return false;
  return true;
}

/**
 * 与导出用的文档顺序一致：PDF 按页码，同一页再按创建时间；
 * Markdown 按起始行、列。不要在这里改比较结果。
 */
export function compareByDocumentPosition(a: Annotation, b: Annotation): number {
  if (a.fileType === "pdf" && b.fileType === "pdf" && isPdfPosition(a.position) && isPdfPosition(b.position)) {
    if (a.position.page !== b.position.page)
      return a.position.page - b.position.page;
    return a.created - b.created;
  }
  if (a.fileType === "pdf")
    return -1;
  if (b.fileType === "pdf")
    return 1;
  if (!isMarkdownPosition(a.position) || !isMarkdownPosition(b.position))
    return a.created - b.created;
  if (a.position.startLine !== b.position.startLine)
    return a.position.startLine - b.position.startLine;
  return a.position.startCh - b.position.startCh;
}

export function compareAnnotations(a: Annotation, b: Annotation, sort: AnnotationSort): number {
  if (sort === "created")
    return b.created - a.created || compareByDocumentPosition(a, b);
  if (sort === "updated")
    return b.updated - a.updated || compareByDocumentPosition(a, b);
  return compareByDocumentPosition(a, b);
}
