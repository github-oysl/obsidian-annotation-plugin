/** 写批注的浮动面板。快捷键只打开草稿，确认后才交给插件保存。 */
import { type App, Modal, Notice } from "obsidian";
import { highlightColors } from "./highlight-colors";
import { hasDraftChanges, type NoteDraft } from "./note-draft";
import { chordLabel, getColorName, t } from "./i18n";
import type ArticleAnnotator from "./main";

export interface AnchorRect {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

export class NoteModal extends Modal {
  plugin: ArticleAnnotator;
  highlightedText: string;
  color: string;
  anchorRect: AnchorRect | null = null;
  onSave: (content: string, color: string, tags: string[]) => void | Promise<void>;
  textarea: HTMLTextAreaElement | null = null;
  draftContent = "";
  tags: string[] = [];
  tagRow: HTMLElement | null = null;
  tagInputVisible = false;
  /** 点击面板外部时挂的监听，关闭时移除。 */
  private outsideHandler: ((evt: PointerEvent) => void) | null = null;
  /** save：按钮或快捷键；discard：取消或 Esc；implicit：点遮罩或标题栏关闭。 */
  closeReason: "save" | "discard" | "implicit" = "implicit";
  settled = false;
  saving = false;
  statusEl: HTMLElement | null = null;
  initialDraft: NoteDraft;

  constructor(app: App, plugin: ArticleAnnotator, seed: { highlightedText: string; color: string; noteContent?: string; tags?: string[]; anchorRect?: AnchorRect | null }, onSave: (content: string, color: string, tags: string[]) => void | Promise<void>) {
    super(app);
    this.plugin = plugin;
    this.highlightedText = seed.highlightedText;
    this.color = seed.color;
    this.draftContent = seed.noteContent || "";
    this.tags = [...(seed.tags ?? [])];
    this.initialDraft = { content: this.draftContent, color: this.color, tags: [...this.tags] };
    this.anchorRect = seed.anchorRect ?? null;
    this.onSave = onSave;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("aa-note-modal");
    // 遮罩透明化，面板以 fixed 定位浮在选区附近，保留 Modal 的快捷键作用域。
    this.containerEl.addClass("aa-note-popover");
    const quoteBlock = contentEl.createDiv("aa-note-modal-quote");
    quoteBlock.createEl("p", { text: this.highlightedText });
    quoteBlock.style.setProperty("--aa-quote-accent", this.color);
    const textarea = contentEl.createEl("textarea", {
      attr: { placeholder: t("ui.placeholder", this.plugin), rows: "4", "aria-label": t("ui.detailNote", this.plugin) }
    });
    textarea.value = this.draftContent;
    this.textarea = textarea;
    textarea.addEventListener("input", () => {
      this.draftContent = textarea.value;
    });
    // 标签行放在输入框下方：chips + ＋按钮
    this.tagRow = contentEl.createDiv("aa-note-tags");
    this.renderTags();
    const colorRow = contentEl.createDiv("aa-note-modal-colors");
    this.renderColors(colorRow, quoteBlock);
    contentEl.createDiv({
      cls: "aa-note-save-hint",
      text: t("ui.saveHint", this.plugin).replace("${shortcut}", chordLabel())
    });
    this.statusEl = contentEl.createDiv({ cls: "aa-note-save-status", attr: { role: "status", "aria-live": "polite" } });
    const btnRow = contentEl.createDiv("aa-modal-buttons");
    const cancelBtn = btnRow.createEl("button", {
      text: t("ui.cancel", this.plugin),
      attr: { type: "button" }
    });
    cancelBtn.addClass("aa-button");
    cancelBtn.addClass("aa-button-secondary");
    const saveBtn = btnRow.createEl("button", {
      text: `${t("ui.saveAction", this.plugin)} · ${chordLabel()}`,
      attr: { type: "button" }
    });
    saveBtn.addClass("aa-button");
    saveBtn.addClass("aa-button-primary");
    saveBtn.onclick = () => this.requestSave();
    cancelBtn.onclick = () => this.requestDiscard();
    this.bindSaveKeys();
    this.placeNearSelection();
    this.attachOutsideDismiss();
    const ownerWindow = this.containerEl.ownerDocument.defaultView ?? window;
    ownerWindow.setTimeout(() => {
      if (this.contentEl.isConnected && !this.contentEl.contains(this.containerEl.ownerDocument.activeElement))
        textarea.focus();
    }, 30);
  }
  colorChoices(): string[] {
    return highlightColors(this.plugin.settings, this.color);
  }
  renderColors(colorRow: HTMLElement, quoteBlock: HTMLElement) {
    colorRow.empty();
    this.colorChoices().forEach((color) => {
      const swatch = colorRow.createEl("button", {
        cls: "aa-color-swatch",
        attr: {
          type: "button",
          "aria-label": this.colorLabel(color), title: this.colorLabel(color),
          "aria-pressed": color.toLowerCase() === this.color.toLowerCase() ? "true" : "false"
        }
      });
      swatch.style.background = color;
      if (color.toLowerCase() === this.color.toLowerCase())
        swatch.addClass("is-selected");
      swatch.onclick = () => {
        this.color = color;
        quoteBlock.style.setProperty("--aa-quote-accent", color);
        colorRow.querySelectorAll(".aa-color-swatch").forEach((el) => {
          el.classList.remove("is-selected");
          if (el.instanceOf(HTMLButtonElement))
            el.setAttr("aria-pressed", "false");
        });
        swatch.addClass("is-selected");
        swatch.setAttr("aria-pressed", "true");
      };
      swatch.addEventListener("keydown", (evt) => {
        if (evt.isComposing || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(evt.key))
          return;
        evt.preventDefault();
        const buttons = Array.from(colorRow.querySelectorAll<HTMLButtonElement>(".aa-color-swatch"));
        const delta = evt.key === "ArrowLeft" || evt.key === "ArrowUp" ? -1 : 1;
        const next = buttons[(buttons.indexOf(swatch) + delta + buttons.length) % buttons.length];
        next?.focus();
        next?.click();
      });
    });
  }
  /** 把面板放到批注原文/选区下方；拿不到坐标（文件未打开、PDF 等）就居中偏上。 */
  placeNearSelection() {
    const doc = this.containerEl.ownerDocument;
    const win = doc.defaultView;
    if (!win)
      return;
    this.modalEl.addClass("aa-note-popover-panel");
    const width = Math.min(420, win.innerWidth - 16);
    this.modalEl.style.width = `${width}px`;
    let rect: AnchorRect | null = this.anchorRect;
    if (!rect) {
      const sel = doc.getSelection();
      if (sel && sel.rangeCount > 0) {
        const rangeRect = sel.getRangeAt(0).getBoundingClientRect();
        if (rangeRect.width > 0 || rangeRect.height > 0)
          rect = { left: rangeRect.left, top: rangeRect.top, bottom: rangeRect.bottom, width: rangeRect.width };
      }
    }
    const height = this.modalEl.offsetHeight;
    let top: number;
    let left: number;
    if (rect) {
      top = rect.bottom + 8;
      if (top + height > win.innerHeight - 8)
        top = Math.max(8, rect.top - height - 8);
      left = rect.left + rect.width / 2 - width / 2;
    } else {
      top = Math.max(8, win.innerHeight * 0.15);
      left = win.innerWidth / 2 - width / 2;
    }
    left = Math.min(Math.max(8, left), win.innerWidth - width - 8);
    this.modalEl.style.top = `${Math.round(top)}px`;
    this.modalEl.style.left = `${Math.round(left)}px`;
  }
  /** Clicking outside saves changed drafts, including empty notes and color-only edits. */
  attachOutsideDismiss() {
    const doc = this.containerEl.ownerDocument;
    this.outsideHandler = (evt: PointerEvent) => {
      const target = evt.target;
      if (!(target instanceof Node))
        return;
      if (this.containerEl.contains(target))
        return;
      this.closeReason = "implicit";
      this.close();
    };
    doc.addEventListener("pointerdown", this.outsideHandler);
  }
  renderTags() {
    const row = this.tagRow;
    if (!row)
      return;
    row.empty();
    this.tags.forEach((tag, index) => {
      const chip = row.createSpan({ cls: "aa-note-tag" });
      chip.createSpan({ text: tag });
      const remove = chip.createEl("button", {
        text: "×",
        attr: { type: "button", "aria-label": `${t("ui.removeTag", this.plugin)} ${tag}` }
      });
      remove.onclick = () => {
        this.tags.splice(index, 1);
        this.renderTags();
      };
    });
    if (this.tagInputVisible) {
      const input = row.createEl("input", {
        attr: { type: "text", placeholder: t("ui.tagName", this.plugin), "aria-label": t("ui.addTag", this.plugin) }
      });
      const commit = () => {
        const tag = input.value.trim();
        if (tag && !this.tags.includes(tag))
          this.tags.push(tag);
        this.tagInputVisible = false;
        this.renderTags();
      };
      input.addEventListener("keydown", (evt) => {
        if (evt.key !== "Enter" || evt.ctrlKey || evt.metaKey || evt.isComposing)
          return;
        evt.preventDefault();
        evt.stopPropagation();
        commit();
      });
      input.addEventListener("blur", () => {
        commit();
      });
      input.focus();
      return;
    }
    const addBtn = row.createEl("button", {
      cls: "aa-note-tag-add",
      text: "+",
      attr: { type: "button", "aria-label": t("ui.addTag", this.plugin) }
    });
    addBtn.onclick = () => {
      this.tagInputVisible = true;
      this.renderTags();
    };
  }
  colorLabel(color: string): string {
    if (color === this.plugin.settings.customHighlightColor && this.plugin.settings.customHighlightColorName)
      return this.plugin.settings.customHighlightColorName;
    return getColorName(color, this.plugin);
  }
  /** 把处理函数插到作用域最前，避免弹窗自带的 Esc 先把窗口关掉。 */
  registerScopeKey(modifiers: Array<"Mod" | "Ctrl" | "Meta" | "Shift" | "Alt">, key: string, func: (evt: KeyboardEvent) => false | void) {
    const handler = this.scope.register(modifiers, key, func);
    const record = this.scope as unknown as Record<string, unknown>;
    for (const name of ["keys", "_keys"]) {
      const bucket = record[name];
      if (!Array.isArray(bucket))
        continue;
      const index = bucket.indexOf(handler);
      if (index > 0) {
        bucket.splice(index, 1);
        bucket.unshift(handler);
      }
      return;
    }
  }
  bindSaveKeys() {
    const save = (evt: KeyboardEvent) => {
      if (evt.isComposing)
        return;
      void this.requestSave();
      return false as const;
    };
    this.registerScopeKey(["Mod"], "Enter", save);
    this.registerScopeKey(["Ctrl"], "Enter", save);
    this.registerScopeKey([], "Escape", (evt) => {
      if (evt.isComposing)
        return;
      this.requestDiscard();
      return false;
    });
    this.modalEl.addEventListener("keydown", (evt) => {
      if (evt.isComposing)
        return;
      if (evt.key === "Escape") {
        this.closeReason = "discard";
        return;
      }
      if (evt.key === "Enter" && (evt.ctrlKey || evt.metaKey)) {
        evt.preventDefault();
        evt.stopPropagation();
        void this.requestSave();
      }
    }, true);
  }
  async requestSave(reason: "save" | "implicit" = "save") {
    if (this.settled || this.saving)
      return;
    this.draftContent = this.textarea?.value ?? this.draftContent;
    const pendingTag = this.tagRow?.querySelector<HTMLInputElement>("input")?.value.trim();
    if (pendingTag && !this.tags.includes(pendingTag))
      this.tags.push(pendingTag);
    const draft = { content: this.draftContent, color: this.color, tags: [...this.tags] };
    this.closeReason = reason;
    if (reason === "implicit" && !hasDraftChanges(this.initialDraft, draft)) {
      this.settled = true;
      super.close();
      return;
    }
    this.setSaving(true);
    this.statusEl?.setText(t("ui.saving", this.plugin));
    this.statusEl?.removeClass("is-error");
    try {
      await this.onSave(draft.content, draft.color, draft.tags);
      this.settled = true;
      super.close();
    } catch {
      this.closeReason = "implicit";
      const message = t("ui.saveFailed", this.plugin);
      this.statusEl?.setText(message);
      this.statusEl?.addClass("is-error");
      new Notice(message);
    } finally {
      this.setSaving(false);
      if (!this.settled) this.textarea?.focus();
    }
  }
  setSaving(saving: boolean) {
    this.saving = saving;
    this.contentEl.setAttr("aria-busy", String(saving));
    this.contentEl.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement>("input, textarea, button")
      .forEach((control) => { control.disabled = saving; });
  }
  close() {
    if (this.settled)
      super.close();
    else
      void this.requestSave("implicit");
  }
  requestDiscard() {
    if (this.settled || this.saving)
      return;
    this.closeReason = "discard";
    this.settled = true;
    super.close();
  }
  onClose() {
    if (this.outsideHandler)
      this.containerEl.ownerDocument.removeEventListener("pointerdown", this.outsideHandler);
    this.outsideHandler = null;
    this.draftContent = this.textarea?.value ?? this.draftContent;
    this.contentEl.empty();
    this.textarea = null;
    this.statusEl = null;
  }
};
