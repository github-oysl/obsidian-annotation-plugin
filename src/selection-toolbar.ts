/** 选中 Markdown 后出现的颜色和批注条。点下去仍走原来的高亮和写批注。 */
import { MarkdownView } from "obsidian";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { getColorName, t } from "./i18n";
import { toolbarColors } from "./highlight-colors";
import type ArticleAnnotator from "./main";

export function createSelectionToolbar(plugin: ArticleAnnotator) {
  return ViewPlugin.fromClass(class {
    toolbar: HTMLElement | null = null;
    constructor(readonly view: EditorView) {
      this.onKeyDown = (evt: KeyboardEvent) => {
        if (evt.key === "Escape")
          this.hide();
      };
      this.view.dom.addEventListener("keydown", this.onKeyDown);
      this.sync();
    }
    onKeyDown: (evt: KeyboardEvent) => void;
    update(update: ViewUpdate) {
      if (update.selectionSet || update.docChanged || update.viewportChanged || update.focusChanged)
        this.sync();
    }
    sync() {
      const selection = this.view.state.selection.main;
      if (selection.empty || !this.view.hasFocus) {
        this.hide();
        return;
      }
      const coords = this.view.coordsAtPos(selection.from);
      if (!coords) {
        this.hide();
        return;
      }
      this.show(coords);
    }
    show(coords: { left: number; top: number; bottom: number }) {
      const doc = this.view.dom.ownerDocument;
      const win = doc.defaultView;
      if (!win)
        return;
      if (!this.toolbar) {
        const bar = doc.body.createDiv({ cls: "aa-selection-toolbar" });
        for (const color of toolbarColors(plugin.settings, plugin.data)) {
          const label = getColorName(color, plugin) || color;
          const button = bar.createEl("button", {
            cls: "aa-selection-color",
            attr: {
              type: "button", "aria-label": label, title: label,
              "aria-pressed": String(color.toLowerCase() === plugin.settings.defaultColor.toLowerCase())
            }
          });
          button.style.setProperty("--aa-accent", color);
          if (color.toLowerCase() === plugin.settings.defaultColor.toLowerCase())
            button.addClass("is-selected");
          button.addEventListener("mousedown", (evt) => evt.preventDefault());
          button.addEventListener("click", () => {
            void this.applyColor(color);
          });
        }
        const comment = bar.createEl("button", {
          cls: "aa-selection-comment",
          text: t("ui.toolbarComment", plugin),
          attr: { type: "button" }
        });
        comment.addEventListener("mousedown", (evt) => evt.preventDefault());
        comment.addEventListener("click", () => {
          const md = plugin.app.workspace.getActiveViewOfType(MarkdownView);
          if (!md?.editor)
            return;
          void plugin.addNoteToSelection(md.editor, md);
          this.hide();
        });
        this.toolbar = bar;
      }
      const bar = this.toolbar;
      const width = bar.offsetWidth || 180;
      const left = Math.min(Math.max(8, coords.left), Math.max(8, win.innerWidth - width - 8));
      const above = coords.top - 40;
      bar.style.left = `${left}px`;
      bar.style.top = `${above < 8 ? coords.bottom + 6 : above}px`;
    }
    async applyColor(color: string) {
      const md = plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (!md?.editor)
        return;
      await plugin.highlightSelection(md.editor, md, color);
      this.hide();
    }
    hide() {
      this.toolbar?.remove();
      this.toolbar = null;
    }
    destroy() {
      this.view.dom.removeEventListener("keydown", this.onKeyDown);
      this.hide();
    }
  });
}
