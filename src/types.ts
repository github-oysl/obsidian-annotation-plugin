/** 插件持久化设置。批注数据本身不在这里，而在知识库的 annotations.json。 */
export interface AnnotatorSettings {
  defaultColor: string;
  colors: string[];
  customHighlightColor: string;
  customHighlightColorName: string;
  language: string;
}

export interface MarkdownPosition {
  kind: "markdown";
  startLine: number;
  startCh: number;
  endLine: number;
  endCh: number;
}

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfViewportBase {
  pageWidth: number;
  pageHeight: number;
}

export interface PdfPosition {
  kind: "pdf";
  page: number;
  rects: PdfRect[];
  quote: string;
  pageLabel: string;
  viewportBase: PdfViewportBase | null;
}

export type AnnotationPosition = MarkdownPosition | PdfPosition;

/** 原句还能不能在笔记里对上。没有这个字段表示还没检查过。 */
export type AnchorStatus = "ok" | "ambiguous" | "missing" | "file-missing";

export interface Annotation {
  id: string;
  filePath: string;
  fileType: "markdown" | "pdf";
  type: string;
  color: string;
  highlightedText: string;
  noteContent: string;
  /** 用户加在这条批注上的标签。旧数据没有这个字段。 */
  tags: string[];
  /** 原句前面的一小段，用来在正文改动后重新找到它。 */
  prefix: string;
  /** 原句后面的一小段。 */
  suffix: string;
  anchor?: AnchorStatus;
  groupId: string | null;
  created: number;
  updated: number;
  order: number;
  position: AnnotationPosition;
}

export interface HighlightGroup {
  id: string;
  name: string;
  filePath: string;
  collapsed: boolean;
  order: number;
  created: number;
}

/** 归一化之前的位置。Markdown 与 PDF 字段都可选，避免两种 kind 交成 never。 */
export interface LoosePosition {
  kind?: string;
  startLine?: number;
  startCh?: number;
  endLine?: number;
  endCh?: number;
  page?: number;
  rects?: Array<Partial<PdfRect> | null>;
  quote?: string;
  pageLabel?: string;
  viewportBase?: Partial<PdfViewportBase> | null;
}

/** 从磁盘或调用方进来的批注，字段可能缺失。先经过 normalizeAnnotation。 */
export interface AnnotationDraft {
  id?: string;
  filePath?: string;
  fileType?: string;
  type?: string;
  color?: string;
  highlightedText?: string;
  noteContent?: string;
  tags?: string[];
  prefix?: string;
  suffix?: string;
  anchor?: AnchorStatus;
  groupId?: string | null;
  created?: number;
  updated?: number;
  order?: number;
  position?: LoosePosition;
}

export interface PdfSelection {
  filePath: string;
  page: number;
  highlightedText: string;
  rects: PdfRect[];
  pageLabel: string;
  viewportBase: PdfViewportBase;
}

/** 只含行号和列号的区间，用于判断 Markdown 选区是否重叠。 */
export interface TextRange {
  startLine: number;
  startCh: number;
  endLine: number;
  endCh: number;
}
