import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import vm from "node:vm";
import { build } from "esbuild";

// Exercise production code with only the Obsidian host API substituted.
const host = `
export const Platform = { isMobile: false, isMacOS: false };
export class Editor {}
export class MarkdownView {}
export class TFile {}
export class Notice { constructor(message) {} }
export class Menu {}
export function setIcon() {}
export class ItemView {}
export class Modal {
  constructor(app) {
    this.app = app;
    this.contentEl = { setAttr() {}, querySelectorAll() { return []; }, empty() {} };
    this.containerEl = { ownerDocument: { removeEventListener() {} } };
  }
  close() { this.closed = true; this.onClose(); }
}
`;
const result = await build({
  stdin: {
    contents: `export { NoteModal } from './src/note-modal';
      export { AnnotationLibraryView } from './src/library-view';
      export { highlightColors, toolbarColors } from './src/highlight-colors';
      export { addAnnotation, updateAnnotation } from './src/store';
      export { mountFilterPopover } from './src/filter-popover';
      export { getColorName } from './src/i18n';`,
    resolveDir: process.cwd(), loader: "ts"
  },
  bundle: true, write: false, platform: "node", format: "cjs",
  plugins: [{ name: "obsidian-host", setup(builder) {
    builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: "obsidian", namespace: "host" }));
    builder.onLoad({ filter: /.*/, namespace: "host" }, () => ({ contents: host, loader: "js" }));
  } }]
});
const module = { exports: {} };
vm.runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require: createRequire(import.meta.url), console, setTimeout, clearTimeout });
const { NoteModal, AnnotationLibraryView, highlightColors, toolbarColors, addAnnotation, updateAnnotation, mountFilterPopover, getColorName } = module.exports;
const settings = { language: "en", defaultColor: "#FCD34D", colors: ["#FCD34D", "#34D399", "#fcd34d"], customHighlightColor: "#123456", customHighlightColorName: "Research" };
const plugin = { settings };
const seed = { highlightedText: "Source quote", noteContent: "Existing thought", color: "#FCD34D", tags: ["work"] };
const capture = (value) => JSON.parse(JSON.stringify(value));

function composer(initial, save) {
  const modal = new NoteModal({}, plugin, initial, save);
  modal.textarea = { value: initial.noteContent ?? "", focus() {} };
  return modal;
}

test("clearing an existing note saves the empty content on outside close", async () => {
  const saved = [];
  const modal = composer(seed, (...args) => saved.push(capture(args)));
  modal.textarea.value = "";
  await modal.requestSave("implicit");
  assert.equal(saved[0][0], "");
  assert.equal(modal.closed, true);
});

test("color-only and tag-only edits to pure highlights are saved", async () => {
  for (const edit of [m => { m.color = "#123456"; }, m => { m.tags = ["new"]; }]) {
    let calls = 0;
    const modal = composer({ ...seed, noteContent: "", tags: [] }, () => { calls++; });
    edit(modal);
    await modal.requestSave("implicit");
    assert.equal(calls, 1);
  }
});

test("unchanged outside close creates nothing; explicit save can create a highlight", async () => {
  let calls = 0;
  const initial = { ...seed, noteContent: "", tags: [] };
  await composer(initial, () => { calls++; }).requestSave("implicit");
  assert.equal(calls, 0);
  await composer(initial, () => { calls++; }).requestSave();
  assert.equal(calls, 1);
});

test("cancel discards changed drafts", () => {
  let calls = 0;
  const modal = composer(seed, () => { calls++; });
  modal.textarea.value = "Discard this";
  modal.requestDiscard();
  assert.equal(calls, 0);
  assert.equal(modal.closed, true);
});

test("failed save retains the draft, allows retry and prevents duplicate in-flight saves", async () => {
  let attempts = 0;
  let release;
  const modal = composer(seed, async () => {
    attempts++;
    if (attempts === 1) throw new Error("Disk unavailable");
    await new Promise(resolve => { release = resolve; });
  });
  modal.textarea.value = "Keep this draft";
  await modal.requestSave();
  assert.equal(modal.closed, undefined);
  assert.equal(modal.textarea.value, "Keep this draft");
  assert.equal(modal.saving, false);
  const retry = modal.requestSave();
  await modal.requestSave();
  assert.equal(attempts, 2);
  release();
  await retry;
  assert.equal(modal.closed, true);
});

test("configured palette is shared, deduplicated and includes custom colors", () => {
  assert.deepEqual(capture(highlightColors(settings)), ["#FCD34D", "#34D399", "#123456"]);
  assert.deepEqual(capture(toolbarColors(settings, [{ color: "#123456", updated: 10 }, { color: "#34D399", updated: 5 }])), ["#FCD34D", "#123456", "#34D399"]);
  assert.equal(getColorName("#123456", plugin), "Research");
  assert.equal(getColorName("#fcd34d", plugin), "Warm Yellow");
});

const annotation = { id: "a", filePath: "note.md", fileType: "markdown", color: "#FCD34D", highlightedText: "Quote", noteContent: "Before", tags: [], prefix: "", suffix: "", created: 1, updated: 1, position: { kind: "markdown", startLine: 0, startCh: 0, endLine: 0, endCh: 5 } };

test("failed disk writes roll back new/updated annotations for a safe retry", async () => {
  const p = { data: [], saveAnnotations: async () => { throw new Error("Disk unavailable"); } };
  await assert.rejects(addAnnotation(p, annotation), /Disk unavailable/);
  assert.equal(p.data.length, 0);
  p.data = [annotation];
  await assert.rejects(updateAnnotation(p, "a", { noteContent: "After" }), /Disk unavailable/);
  assert.equal(p.data[0], annotation);
});

test("selecting a library card keeps the original list and never rebuilds the view", () => {
  const view = Object.create(AnnotationLibraryView.prototype);
  let renders = 0;
  const cards = ["a", "b"].map(id => ({ dataset: { annotationId: id }, classList: { toggle() {} }, setAttr() {}, removeAttribute() {} }));
  view.render = () => { renders++; };
  view.containerEl = { addClass() {}, querySelectorAll() { return cards; }, querySelector() { return null; } };
  view.selectAnnotation("b");
  assert.equal(renders, 0);
  assert.equal(view.selectedId, "b");
  view.selectAnnotation("b");
  assert.equal(view.selectedId, "b");
});

test("resetting popup filters also clears the active time range", () => {
  const buttons = [];
  const element = () => ({
    createDiv() { return element(); },
    createEl(tag, options) { const button = element(); button.cls = options?.cls; buttons.push(button); return button; },
    addClass() {}, style: { setProperty() {} }
  });
  let time = "week";
  let applied;
  mountFilterPopover(element(), [], { sort: "updated", colors: [], tags: [], notesOnly: true, tagsOnly: false }, plugin, value => { applied = value; }, () => {}, { showSort: false, timeRange: time, onTimeRange(value) { time = value; } });
  buttons.find(button => button.cls === "aa-filter-clear").onclick({ preventDefault() {} });
  assert.equal(time, "all");
  assert.equal(applied.notesOnly, false);
});
