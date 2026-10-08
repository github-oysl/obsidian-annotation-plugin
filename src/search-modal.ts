/** 搜索全部批注，并用方向键选中一条后跳转。 */
import { type App, Modal } from "obsidian";
import { formatTime, getAnnotationLocationLabel } from "./annotation-model";
import { getColorName, t } from "./i18n";
import type ArticleAnnotator from "./main";
import type { Annotation } from "./types";

export class SearchModal extends Modal {
  plugin: ArticleAnnotator;
  resultsEl!: HTMLElement;
  results: Annotation[] = [];
  activeIndex = 0;

  constructor(app: App, plugin: ArticleAnnotator) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("aa-search-modal");
    this.setTitle(t("ui.searchAll", this.plugin));
    const input = contentEl.createEl("input", {
      attr: { type: "text", placeholder: t("ui.searchPlaceholder", this.plugin), autofocus: "true" }
    });
    contentEl.createDiv({ cls: "aa-note-modal-hint", text: t("ui.searchHint", this.plugin) });
    this.resultsEl = contentEl.createDiv("aa-search-results");
    input.oninput = () => {
      this.activeIndex = 0;
      this.renderResults(input.value);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.moveActive(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        this.moveActive(-1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        this.openActive();
      }
    });
    const ownerWindow = this.containerEl.ownerDocument.defaultView ?? window;
    ownerWindow.setTimeout(() => input.focus(), 30);
    this.renderResults("");
  }
  moveActive(delta: number) {
    if (this.results.length === 0)
      return;
    this.activeIndex = Math.max(0, Math.min(this.results.length - 1, this.activeIndex + delta));
    this.markActive();
  }
  markActive() {
    const cards = this.resultsEl.querySelectorAll(".aa-search-card");
    cards.forEach((card, index) => {
      const selected = index === this.activeIndex;
      card.classList.toggle("is-active", selected);
      card.setAttr("aria-selected", selected ? "true" : "false");
      if (selected)
        card.scrollIntoView({ block: "nearest" });
    });
  }
  openActive() {
    const item = this.results[this.activeIndex];
    if (!item)
      return;
    this.close();
    void this.plugin.navigateToAnnotation(item);
  }
  renderResults(query: string) {
    this.resultsEl.empty();
    let results = this.plugin.data;
    if (query.trim()) {
      const q = query.toLowerCase();
      results = results.filter(
        (a) => a.highlightedText.toLowerCase().includes(q) || a.noteContent.toLowerCase().includes(q) || a.filePath.toLowerCase().includes(q)
      );
    }
    results = [...results].sort((a, b) => b.created - a.created).slice(0, 80);
    this.results = results;
    if (this.activeIndex >= results.length)
      this.activeIndex = 0;
    if (results.length === 0) {
      this.resultsEl.createEl("p", {
        text: query.trim() ? t("ui.noResults", this.plugin) : t("ui.noData", this.plugin),
        cls: "aa-no-results"
      });
      return;
    }
    const stats = this.resultsEl.createDiv("aa-search-stats");
    stats.setText(t("ui.searchResults", this.plugin).replace("${n}", String(results.length)));
    const list = this.resultsEl.createDiv("aa-search-list");
    list.setAttr("role", "listbox");
    results.forEach((annotation, index) => {
      const card = list.createDiv("aa-search-card");
      card.setAttr("role", "option");
      card.setAttr("aria-selected", index === this.activeIndex ? "true" : "false");
      if (index === this.activeIndex)
        card.addClass("is-active");
      const colorBar = card.createDiv("aa-card-color");
      colorBar.style.background = annotation.color;
      const body = card.createDiv("aa-search-card-body");
      const textEl = body.createDiv("aa-search-card-text");
      textEl.setText(annotation.highlightedText);
      if (annotation.noteContent) {
        const noteEl = body.createDiv("aa-search-card-note");
        noteEl.setText(annotation.noteContent);
      }
      const meta = body.createDiv("aa-card-meta");
      const fileName = annotation.filePath.split(/[\\/]/).pop() || annotation.filePath;
      meta.setText(`${fileName} \xB7 ${getAnnotationLocationLabel(annotation, this.plugin)} \xB7 ${formatTime(annotation.created, this.plugin)}`);
      const colorLabel = body.createDiv("aa-card-color-label");
      colorLabel.style.color = annotation.color;
      colorLabel.setText(getColorName(annotation.color, this.plugin) || t("ui.highlights", this.plugin));
      const openCard = () => {
        this.activeIndex = index;
        this.openActive();
      };
      card.addEventListener("click", openCard);
      card.tabIndex = -1;
      card.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter") {
          evt.preventDefault();
          openCard();
        }
      });
    });
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
};
