/** 阅读卡片。侧栏和批注中心用同一套结构和菜单。 */
import { Menu, Modal, Notice, setIcon } from "obsidian";
import { formatTime, isMarkdownPosition, isPdfPosition } from "./annotation-model";
import { highlightColors } from "./highlight-colors";
import { getColorName, t } from "./i18n";
import type ArticleAnnotator from "./main";
import type { Annotation } from "./types";

export function canNavigateAnnotation(annotation: Annotation): boolean {
  return annotation.anchor == null || annotation.anchor === "ok";
}

function anchorStatusText(annotation: Annotation, plugin: ArticleAnnotator): string {
  if (annotation.anchor === "ambiguous")
    return t("ui.anchorAmbiguous", plugin);
  if (annotation.anchor === "missing")
    return t("ui.anchorMissing", plugin);
  if (annotation.anchor === "file-missing")
    return t("ui.anchorFileMissing", plugin);
  return "";
}

function showMenu(menu: Menu, evt: Event, anchor: HTMLElement) {
  if (evt instanceof MouseEvent && (evt.clientX !== 0 || evt.clientY !== 0)) {
    menu.showAtMouseEvent(evt);
    return;
  }
  const rect = anchor.getBoundingClientRect();
  menu.showAtPosition({ x: rect.left, y: rect.bottom, width: rect.width }, anchor.ownerDocument);
}

export interface CardOptions {
  showFilePath?: boolean;
  /** 批注中心卡片显示标题行（颜色圆点 + 文件名 + 操作按钮） */
  showTitle?: boolean;
  /** 覆盖点击卡片的默认行为（如批注中心改为选中查看详情）；定位图标始终跳原文 */
  onOpen?: () => void;
}

export function mountAnnotationCard(container: HTMLElement, annotation: Annotation, plugin: ArticleAnnotator, onChanged: () => void, options?: CardOptions): HTMLElement {
  const card = container.createDiv("aa-card");
  card.addClass("aa-reading-card");
  card.dataset.annotationId = annotation.id;
  card.style.setProperty("--aa-accent", annotation.color);
  card.tabIndex = 0;
  const located = canNavigateAnnotation(annotation);
  if (located || options?.onOpen)
    card.addClass("is-navigable");
  if (!located)
    card.addClass("has-anchor-warning");
  const hover = card.createDiv("aa-card-hover-actions");
  const editBtn = hover.createEl("button", {
    attr: { type: "button", "aria-label": t("ui.edit", plugin) }
  });
  setIcon(editBtn, "pencil");
  editBtn.onclick = (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    plugin.openNoteEditor(live(plugin, annotation));
  };
  const moreBtn = hover.createEl("button", {
    attr: { type: "button", "aria-label": t("ui.moreActions", plugin) }
  });
  setIcon(moreBtn, "more-horizontal");
  moreBtn.onclick = (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    openAnnotationMenu(plugin, live(plugin, annotation), evt, moreBtn, onChanged);
  };
  if (options?.showTitle) {
    card.addClass("has-title");
    const titleRow = card.createDiv("aa-card-title-row");
    titleRow.createSpan({ cls: "aa-card-dot", attr: { "aria-hidden": "true" } });
    const fileName = annotation.filePath.split("/").pop() ?? annotation.filePath;
    titleRow.createSpan({ cls: "aa-card-title", text: fileName.replace(/\.md$/i, "") });
    titleRow.appendChild(hover);
  }
  const quote = card.createDiv({ cls: "aa-card-text", text: annotation.highlightedText });
  if (annotation.highlightedText.length > 140 || annotation.highlightedText.includes("\n")) {
    quote.addClass("is-collapsible");
    const expand = card.createEl("button", {
      cls: "aa-quote-toggle",
      text: t("ui.expandQuote", plugin),
      attr: { type: "button", "aria-expanded": "false" }
    });
    expand.onclick = (evt) => {
      evt.stopPropagation();
      const expanded = quote.classList.toggle("is-expanded");
      expand.setAttr("aria-expanded", String(expanded));
      expand.setText(t(expanded ? "ui.collapseQuote" : "ui.expandQuote", plugin));
    };
  }
  if (annotation.noteContent.trim())
    card.createDiv({ cls: "aa-card-note", text: annotation.noteContent });
  const tags = annotation.tags ?? [];
  if (tags.length > 0) {
    const tagsEl = card.createDiv("aa-card-tags");
    tags.forEach((tag) => tagsEl.createSpan({ cls: "aa-card-tag", text: tag }));
  }
  const anchorLabel = anchorStatusText(annotation, plugin);
  if (anchorLabel)
    card.createDiv({ cls: "aa-anchor-status", text: anchorLabel });
  if (annotation.anchor === "file-missing")
    card.createDiv({ cls: "aa-card-line", text: annotation.filePath });
  else if (!located)
    card.createDiv({ cls: "aa-card-edit-hint", text: t("ui.reassignHint", plugin) });
  if (options?.showFilePath)
    card.createDiv({ cls: "aa-card-file", text: annotation.filePath });
  const meta = card.createDiv("aa-card-meta");
  const location = compactLocation(annotation);
  const when = formatTime(annotation.created, plugin);
  const modified = annotation.updated > annotation.created + 60_000 ? ` · ${t("ui.modified", plugin)} ${formatTime(annotation.updated, plugin)}` : "";
  meta.createSpan({
    cls: "aa-card-meta-label",
    text: `${location ? `${location} · ` : ""}${when}${modified}`
  });
  if (located) {
    const locate = meta.createEl("button", {
      cls: "aa-card-locate",
      attr: { type: "button", "aria-label": t("ui.locate", plugin), title: t("ui.locate", plugin) }
    });
    setIcon(locate, "locate");
    const gotoSource = (evt: Event) => {
      evt.stopPropagation();
      void plugin.navigateToAnnotation(live(plugin, annotation));
    };
    locate.addEventListener("click", gotoSource);
  }
  const openCard = () => {
    if (options?.onOpen) {
      options.onOpen();
      return;
    }
    if (!canNavigateAnnotation(live(plugin, annotation)))
      return;
    void plugin.navigateToAnnotation(live(plugin, annotation));
  };
  card.addEventListener("click", (evt) => {
    const target = evt.target;
    if (!(target instanceof Element))
      return;
    if (target.closest("button, input, .aa-card-hover-actions, .aa-card-checkbox"))
      return;
    openCard();
  });
  card.addEventListener("keydown", (evt) => {
    if (evt.target !== card || (evt.key !== "Enter" && evt.key !== " "))
      return;
    evt.preventDefault();
    openCard();
  });
  return card;
}

/** 卡片底行用文档里的紧凑写法：L13、P2。对不上的句子不显示旧行号。 */
function compactLocation(annotation: Annotation): string {
  if (annotation.anchor && annotation.anchor !== "ok")
    return "";
  if (annotation.fileType === "pdf" && isPdfPosition(annotation.position))
    return `P${annotation.position.page}`;
  if (isMarkdownPosition(annotation.position))
    return `L${annotation.position.startLine + 1}`;
  return "";
}

function live(plugin: ArticleAnnotator, annotation: Annotation): Annotation {
  return plugin.data.find((item) => item.id === annotation.id) ?? annotation;
}

export function openAnnotationMenu(plugin: ArticleAnnotator, annotation: Annotation, evt: MouseEvent, anchor: HTMLElement, onChanged: () => void) {
  const menu = new Menu();
  menu.addItem((item) => {
    item.setTitle(t("ui.edit", plugin));
    item.setIcon("pencil");
    item.onClick(() => plugin.openNoteEditor(live(plugin, annotation)));
  });
  menu.addItem((item) => {
    item.setTitle(t("ui.changeColor", plugin));
    item.setIcon("palette");
    item.onClick((clickEvt) => openColorMenu(plugin, live(plugin, annotation), clickEvt));
  });
  menu.addItem((item) => {
    item.setTitle(t("ui.addTag", plugin));
    item.setIcon("tag");
    item.onClick(() => showAddTagDialog(plugin, live(plugin, annotation), onChanged));
  });
  menu.addItem((item) => {
    item.setTitle(t("ui.copyQuote", plugin));
    item.setIcon("copy");
    item.onClick(() => {
      void plugin.copyText(annotation.highlightedText);
    });
  });
  menu.addItem((item) => {
    item.setTitle(t("ui.copyNote", plugin));
    item.setIcon("copy");
    item.onClick(() => {
      if (!annotation.noteContent.trim()) {
        new Notice(t("ui.noNoteToCopy", plugin));
        return;
      }
      void plugin.copyText(annotation.noteContent);
    });
  });
  menu.addItem((item) => {
    item.setTitle(t("ui.copyObsidianLink", plugin));
    item.setIcon("link");
    item.onClick(() => plugin.copyObsidianLink(annotation));
  });
  menu.addItem((item) => {
    item.setTitle(t("ui.convertToNote", plugin));
    item.setIcon("file-plus");
    item.onClick(() => {
      void plugin.convertAnnotationToNote(annotation);
    });
  });
  if (!canNavigateAnnotation(annotation)) {
    menu.addItem((item) => {
      item.setTitle(t("ui.reassign", plugin));
      item.setIcon("locate");
      item.onClick(() => {
        void plugin.reassignAnnotation(annotation);
      });
    });
  }
  menu.addItem((item) => {
    item.setTitle(t("ui.delete", plugin));
    item.setIcon("trash-2");
    item.setWarning(true);
    item.onClick(() => {
      void deleteAnnotation(plugin, annotation, anchor, onChanged);
    });
  });
  showMenu(menu, evt, anchor);
}

function openColorMenu(plugin: ArticleAnnotator, annotation: Annotation, evt: MouseEvent | KeyboardEvent) {
  const menu = new Menu();
  const colors = highlightColors(plugin.settings, annotation.color);
  colors.forEach((color) => {
    menu.addItem((item) => {
      item.setTitle(getColorName(color, plugin) || color);
      item.setChecked(color.toLowerCase() === annotation.color.toLowerCase());
      item.onClick(() => {
        void plugin.commitAnnotationUpdate(annotation.id, { color });
      });
    });
  });
  if (evt instanceof MouseEvent)
    menu.showAtMouseEvent(evt);
}

async function deleteAnnotation(plugin: ArticleAnnotator, annotation: Annotation, _anchor: HTMLElement, onChanged: () => void) {
  const caret = plugin.captureCaret(plugin.editorInFile(annotation.filePath));
  await plugin.removeAnnotation(annotation.id, true);
  onChanged();
  plugin.restoreCaret(caret);
}

function showAddTagDialog(plugin: ArticleAnnotator, annotation: Annotation, onChanged: () => void) {
  const modal = new Modal(plugin.app);
  modal.titleEl.setText(t("ui.addTag", plugin));
  const input = modal.contentEl.createEl("input", {
    type: "text",
    placeholder: t("ui.tagName", plugin)
  });
  input.addClass("aa-input");
  const buttonContainer = modal.contentEl.createDiv("aa-modal-buttons");
  const cancelBtn = buttonContainer.createEl("button", { text: t("ui.cancel", plugin) });
  cancelBtn.addClass("aa-button");
  cancelBtn.addClass("aa-button-secondary");
  cancelBtn.onclick = () => modal.close();
  const confirmBtn = buttonContainer.createEl("button", { text: t("ui.saveAction", plugin) });
  confirmBtn.addClass("aa-button");
  confirmBtn.addClass("aa-button-primary");
  confirmBtn.onclick = async () => {
    const tag = input.value.trim();
    const current = live(plugin, annotation);
    const tags = current.tags ?? [];
    if (!tag || tags.includes(tag)) {
      modal.close();
      return;
    }
    await plugin.commitAnnotationUpdate(current.id, { tags: [...tags, tag] });
    modal.close();
    onChanged();
  };
  input.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") {
      evt.preventDefault();
      confirmBtn.click();
    }
  });
  modal.open();
  input.focus();
}
