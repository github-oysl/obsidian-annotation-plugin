/** CodeMirror 里的高亮装饰。批注存在独立文件里，这里只负责画出来。 */
import { Editor, MarkdownView, type App } from "obsidian";
import { EditorView, Decoration, GutterMarker, gutter } from "@codemirror/view";
import { RangeSet, RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { isMarkdownPosition } from "./annotation-model";
import type { Annotation, MarkdownPosition } from "./types";

export interface HighlightHost {
  app: App;
  getAnnotationsForFile(filePath: string): Annotation[];
}

// CM6 StateEffect：通知装饰层更新高亮
interface HighlightSpan {
  from: number;
  to: number;
  color: string;
  annotationId: string;
}

const setHighlightsEffect = StateEffect.define<HighlightSpan[]>();

// CM6 StateField：管理 Decoration.mark 集合，自动跟随编辑调整位置
export const highlightField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (let e of tr.effects) {
      if (e.is(setHighlightsEffect)) {
        const ranges = e.value;
        if (!ranges || ranges.length === 0) {
          decorations = Decoration.none;
        } else {
          const marks = ranges.map((r) => Decoration.mark({
            class: "aa-editor-highlight",
            attributes: {
              style: `--aa-accent: ${r.color};`,
              "data-annotation-id": r.annotationId || ""
            }
          }).range(r.from, r.to));
          decorations = Decoration.set(marks, true);
        }
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f)
});

class AnnotationGutterMarker extends GutterMarker {
  constructor(readonly color: string, readonly annotationId: string) {
    super();
  }
  eq(other: GutterMarker) {
    return other instanceof AnnotationGutterMarker && other.color === this.color && other.annotationId === this.annotationId;
  }
  toDOM(view: EditorView) {
    const el = view.dom.ownerDocument.createElement("div");
    el.className = "aa-gutter-marker";
    el.dataset.annotationId = this.annotationId;
    el.style.setProperty("--aa-accent", this.color);
    return el;
  }
}

/** 和正文高亮用同一次刷新结果，不再单独算行号。同一行只留一个圆点。 */
export const annotationGutterField = StateField.define<RangeSet<GutterMarker>>({
  create() {
    return RangeSet.empty;
  },
  update(markers, tr) {
    markers = markers.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setHighlightsEffect))
        continue;
      const doc = tr.state.doc;
      const seen = new Set<number>();
      const points: Array<{ pos: number; marker: AnnotationGutterMarker }> = [];
      for (const range of effect.value) {
        if (range.from < 0 || range.from > doc.length)
          continue;
        const pos = doc.lineAt(range.from).from;
        if (seen.has(pos))
          continue;
        seen.add(pos);
        points.push({ pos, marker: new AnnotationGutterMarker(range.color, range.annotationId) });
      }
      points.sort((a, b) => a.pos - b.pos);
      const builder = new RangeSetBuilder<GutterMarker>();
      for (const point of points)
        builder.add(point.pos, point.pos, point.marker);
      markers = builder.finish();
    }
    return markers;
  }
});

export const annotationGutter = gutter({
  class: "aa-annotation-gutter",
  markers: (view) => view.state.field(annotationGutterField),
  lineMarkerChange: (update) => update.docChanged || update.transactions.some((tr) => tr.effects.some((effect) => effect.is(setHighlightsEffect)))
});

// 刷新当前编辑器高亮：从 annotation 数据计算文档偏移量，dispatch 到 CM6

export function getCodeMirror(editor: Editor): EditorView | null {
  const cm = (editor as Editor & { cm?: EditorView }).cm;
  return cm ?? null;
}

export function refreshHighlights(plugin: HighlightHost): void {
  const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
  if (!view?.file)
    return;
  const cm = getCodeMirror(view.editor);
  if (!cm)
    return;
  const annotations = plugin.getAnnotationsForFile(view.file.path).filter((ann): ann is Annotation & { position: MarkdownPosition } => ann.fileType !== "pdf" && ann.anchor === "ok" && isMarkdownPosition(ann.position));
  if (annotations.length === 0) {
    cm.dispatch({ effects: setHighlightsEffect.of([]) });
    return;
  }
  const doc = cm.state.doc;
  const ranges: HighlightSpan[] = [];
  for (const ann of annotations) {
    const startLine = ann.position.startLine + 1;
    const endLine = ann.position.endLine + 1;
    if (startLine > doc.lines || endLine > doc.lines)
      continue;
    const from = doc.line(startLine).from + ann.position.startCh;
    const to = doc.line(endLine).from + ann.position.endCh;
    if (from >= 0 && to <= doc.length && from <= to) {
      ranges.push({ from, to, color: ann.color, annotationId: ann.id });
    }
  }
  cm.dispatch({ effects: setHighlightsEffect.of(ranges) });
}
