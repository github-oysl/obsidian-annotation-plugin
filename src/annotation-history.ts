import { invertedEffects, isolateHistory } from "@codemirror/commands";
import { StateEffect, Transaction, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { Annotation } from "./types";

export interface AnnotationHistoryOp {
  type: "add" | "remove" | "update";
  annotation: Annotation;
  /** update 撤销时要恢复的旧内容。 */
  previous?: Annotation;
}

/** 进入编辑器撤销栈的批注操作。撤销时由 invertedEffects 换成相反操作。 */
export const annotationHistoryEffect = StateEffect.define<AnnotationHistoryOp>();

export function createAnnotationHistoryExtension(apply: (op: AnnotationHistoryOp) => void): Extension {
  return [
    invertedEffects.of((tr) => {
      const inverted: Array<StateEffect<AnnotationHistoryOp>> = [];
      for (const effect of tr.effects) {
        if (!effect.is(annotationHistoryEffect)) {
          continue;
        }
        if (effect.value.type === "update" && effect.value.previous) {
          inverted.push(annotationHistoryEffect.of({
            type: "update",
            annotation: effect.value.previous,
            previous: effect.value.annotation,
          }));
          continue;
        }
        if (effect.value.type === "update")
          continue;
        inverted.push(annotationHistoryEffect.of({
          type: effect.value.type === "add" ? "remove" : "add",
          annotation: effect.value.annotation,
        }));
      }
      return inverted;
    }),
    EditorView.updateListener.of((update) => {
      for (const tr of update.transactions) {
        const userEvent = tr.annotation(Transaction.userEvent);
        if (userEvent !== "undo" && userEvent !== "redo") {
          continue;
        }
        for (const effect of tr.effects) {
          if (effect.is(annotationHistoryEffect)) {
            apply(effect.value);
          }
        }
      }
    }),
  ];
}

/** 把一次批注新增或删除记进当前编辑器的撤销栈，不改动正文。 */
export function dispatchAnnotationHistory(view: EditorView, op: AnnotationHistoryOp): void {
  const snapshot = JSON.parse(JSON.stringify(op.annotation)) as Annotation;
  const previous = op.previous ? JSON.parse(JSON.stringify(op.previous)) as Annotation : undefined;
  view.dispatch({
    effects: annotationHistoryEffect.of({ type: op.type, annotation: snapshot, previous }),
    annotations: isolateHistory.of("full"),
  });
}
