/** 当前文档的批注侧栏：搜索、筛选和卡片。 */
import { ItemView, Menu, Modal, Platform, setIcon, TFile, type WorkspaceLeaf } from "obsidian";
import { mountAnnotationCard } from "./annotation-card";
import {
  compareAnnotations,
  defaultAnnotationFilter,
  isFilterActive,
  isNote,
  matchesFilter,
  matchesKind,
  matchesQuery,
  type AnnotationFilter,
  type AnnotationKind
} from "./annotation-query";
import { mountFilterPopover } from "./filter-popover";
import { mountFilterChips, type FilterChip } from "./filter-chips";
import { t } from "./i18n";
import type ArticleAnnotator from "./main";
import type { Annotation, HighlightGroup } from "./types";

export const VIEW_TYPE = "scholiast-sidebar";

export class AnnotatorSidebarView extends ItemView {
  currentFile: TFile | null = null;
  plugin: ArticleAnnotator;
  selectedAnnotations = new Set<string>();
  isMultiSelectMode = false;
  query = "";
  kind: AnnotationKind = "all";
  filter: AnnotationFilter = defaultAnnotationFilter();
  filterOpen = false;
  searchTimer: number | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: ArticleAnnotator) {
    super(leaf);
    this.plugin = plugin;
    this.icon = "pen-tool";
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return t("pluginName", this.plugin);
  }
  async onOpen() {
    const container = this.containerEl;
    container.addClass("aa-sidebar");
    if (Platform.isMobile)
      container.addClass("is-touch");
    const doc = container.ownerDocument;
    this.registerDomEvent(doc, "pointerdown", (evt) => {
      if (!this.filterOpen)
        return;
      const target = evt.target;
      if (!(target instanceof Node))
        return;
      const popover = container.querySelector(".aa-filter-popover");
      const buttons = container.querySelectorAll(".aa-filter-button, .aa-tabs-toggle");
      let insideButton = false;
      buttons.forEach((button) => {
        if (button.contains(target))
          insideButton = true;
      });
      if (insideButton || popover?.contains(target))
        return;
      this.filterOpen = false;
      popover?.remove();
    });
    this.registerDomEvent(doc, "keydown", (evt) => {
      if (evt.key !== "Escape" || !this.filterOpen)
        return;
      this.filterOpen = false;
      container.querySelector(".aa-filter-popover")?.remove();
    });
    this.render();
  }
  async onClose() {
    this.clearSearchTimer();
    await super.onClose();
  }
  update(file: TFile | null) {
    const changed = this.currentFile?.path !== file?.path;
    this.currentFile = file;
    if (changed) {
      this.clearSearchTimer();
      this.query = "";
      this.kind = "all";
      this.filter = defaultAnnotationFilter();
      this.filterOpen = false;
      this.isMultiSelectMode = false;
      this.selectedAnnotations.clear();
    }
    this.render();
  }
  clearSearchTimer() {
    if (this.searchTimer === null)
      return;
    const win = this.containerEl.ownerDocument.defaultView;
    win?.clearTimeout(this.searchTimer);
    this.searchTimer = null;
  }
  scheduleSearch() {
    this.clearSearchTimer();
    const win = this.containerEl.ownerDocument.defaultView ?? window;
    this.searchTimer = win.setTimeout(() => {
      this.searchTimer = null;
      this.renderList();
    }, 300);
  }
  fileAnnotations(): Annotation[] {
    if (!this.currentFile)
      return [];
    return this.plugin.getAnnotationsForFile(this.currentFile.path).filter((annotation) => annotation.anchor !== "file-missing");
  }
  visibleAnnotations(source: Annotation[]): Annotation[] {
    return source
      .filter((annotation) => matchesKind(annotation, this.kind) && matchesQuery(annotation, this.query) && matchesFilter(annotation, this.filter))
      .sort((a, b) => compareAnnotations(a, b, this.filter.sort));
  }
  render() {
    const doc = this.containerEl.ownerDocument;
    const active = doc.activeElement;
    const searchWasFocused = active instanceof HTMLInputElement && active.classList.contains("aa-sidebar-search");
    const cursor = searchWasFocused ? active.selectionStart : null;
    const previousList = this.containerEl.querySelector(".aa-sidebar-list");
    const scrollTop = previousList instanceof HTMLElement ? previousList.scrollTop : 0;
    const container = this.containerEl;
    container.empty();
    container.addClass("aa-sidebar");
    if (Platform.isMobile)
      container.addClass("is-touch");
    this.renderHeader(container);
    if (!this.currentFile) {
      const emptyEl = container.createDiv("aa-sidebar-empty");
      emptyEl.createEl("p", { text: t("notifications.openFileFirst", this.plugin) });
      return;
    }
    const annotations = this.fileAnnotations();
    this.renderSearchRow(container, annotations);
    this.renderTabs(container, annotations);
    const chips: FilterChip[] = [];
    if (this.kind !== "all")
      chips.push({ label: t(this.kind === "note" ? "ui.notesOnly" : "ui.highlights", this.plugin), remove: () => { this.kind = "all"; this.render(); } });
    mountFilterChips(container, this.filter, this.plugin, (filter) => {
      this.filter = filter;
      this.render();
    }, () => this.clearFilters(), chips);
    if (this.isMultiSelectMode)
      this.renderMultiSelectBar(container);
    const list = container.createDiv("aa-sidebar-list");
    this.fillList(list, annotations);
    if (searchWasFocused) {
      const input = container.querySelector(".aa-sidebar-search");
      if (input instanceof HTMLInputElement) {
        input.focus();
        if (cursor !== null)
          input.setSelectionRange(cursor, cursor);
      }
    }
    if (list.instanceOf(HTMLElement))
      list.scrollTop = scrollTop;
  }
  renderList() {
    const list = this.containerEl.querySelector(".aa-sidebar-list");
    if (!(list instanceof HTMLElement)) {
      this.render();
      return;
    }
    const scrollTop = list.scrollTop;
    list.empty();
    this.fillList(list, this.fileAnnotations());
    list.scrollTop = scrollTop;
  }
  renderHeader(container: HTMLElement) {
    const header = container.createDiv("aa-sidebar-header");
    header.createEl("h3", { text: t("ui.sidebarHeading", this.plugin) });
    const actions = header.createDiv("aa-sidebar-header-actions");
    const moreBtn = actions.createEl("button", {
      attr: { type: "button", "aria-label": t("ui.moreActions", this.plugin) }
    });
    setIcon(moreBtn, "more-horizontal");
    moreBtn.onclick = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.openHeaderMenu(evt, moreBtn);
    };
    const closeBtn = actions.createEl("button", {
      attr: { type: "button", "aria-label": t("ui.close", this.plugin) }
    });
    setIcon(closeBtn, "x");
    closeBtn.onclick = () => {
      this.plugin.app.workspace.detachLeavesOfType(VIEW_TYPE);
    };
  }
  openHeaderMenu(evt: MouseEvent, anchor: HTMLElement) {
    const menu = new Menu();
    menu.addItem((item) => {
      item.setTitle(t("ui.openLibrary", this.plugin));
      item.setIcon("library");
      item.onClick(() => this.plugin.openAnnotationLibrary());
    });
    menu.addItem((item) => {
      item.setTitle(t("ui.multiSelect", this.plugin));
      item.setIcon("square-check");
      item.setChecked(this.isMultiSelectMode);
      item.onClick(() => {
        this.isMultiSelectMode = !this.isMultiSelectMode;
        if (!this.isMultiSelectMode)
          this.selectedAnnotations.clear();
        this.render();
      });
    });
    menu.addItem((item) => {
      item.setTitle(t("ui.exportCurrent", this.plugin));
      item.setIcon("download");
      item.onClick(() => {
        void this.plugin.exportAnnotations();
      });
    });
    menu.addItem((item) => {
      item.setTitle(t("ui.clearCurrent", this.plugin));
      item.setIcon("trash-2");
      item.setWarning(true);
      item.onClick(() => {
        void this.plugin.clearFileAnnotations();
      });
    });
    this.showMenu(menu, evt, anchor);
  }
  showMenu(menu: Menu, evt: Event, anchor: HTMLElement) {
    if (evt instanceof MouseEvent && (evt.clientX !== 0 || evt.clientY !== 0)) {
      menu.showAtMouseEvent(evt);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    menu.showAtPosition({ x: rect.left, y: rect.bottom, width: rect.width }, anchor.ownerDocument);
  }
  renderSearchRow(container: HTMLElement, annotations: Annotation[]) {
    const row = container.createDiv("aa-sidebar-search-row");
    const input = row.createEl("input", {
      cls: "aa-sidebar-search",
      attr: {
        type: "search",
        placeholder: t("ui.searchAnnotationsPlaceholder", this.plugin),
        autocomplete: "off",
        "aria-label": t("ui.searchAnnotationsPlaceholder", this.plugin)
      }
    });
    input.value = this.query;
    input.addEventListener("input", () => {
      this.query = input.value;
      this.scheduleSearch();
    });
    const filterBtn = row.createEl("button", {
      cls: "aa-filter-button",
      attr: {
        type: "button",
        "aria-label": t("ui.filter", this.plugin),
        "aria-expanded": this.filterOpen ? "true" : "false"
      }
    });
    setIcon(filterBtn, "list-filter");
    if (isFilterActive(this.filter))
      filterBtn.addClass("is-active");
    filterBtn.onclick = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.toggleFilter();
    };
    if (this.filterOpen)
      this.renderFilterPopover(row, annotations);
  }
  renderTabs(container: HTMLElement, annotations: Annotation[]) {
    const noteCount = annotations.filter((annotation) => isNote(annotation)).length;
    const tabs = container.createDiv("aa-sidebar-tabs");
    const options: Array<{ kind: AnnotationKind; label: string }> = [
      { kind: "all", label: t("ui.tabAll", this.plugin).replace("${n}", String(annotations.length)) },
      { kind: "note", label: t("ui.tabNotes", this.plugin).replace("${n}", String(noteCount)) },
      { kind: "highlight", label: t("ui.tabHighlights", this.plugin).replace("${n}", String(annotations.length - noteCount)) }
    ];
    for (const option of options) {
      const button = tabs.createEl("button", {
        text: option.label,
        attr: { type: "button", "aria-pressed": this.kind === option.kind ? "true" : "false" }
      });
      if (this.kind === option.kind)
        button.addClass("is-active");
      button.onclick = () => {
        this.kind = option.kind;
        this.render();
      };
    }
    const toggle = tabs.createEl("button", {
      cls: "aa-tabs-toggle",
      attr: {
        type: "button",
        "aria-label": t("ui.filter", this.plugin),
        "aria-expanded": this.filterOpen ? "true" : "false"
      }
    });
    setIcon(toggle, "chevron-down");
    if (isFilterActive(this.filter))
      toggle.addClass("is-active");
    toggle.onclick = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.toggleFilter();
    };
  }
  toggleFilter() {
    this.filterOpen = !this.filterOpen;
    this.render();
  }
  renderMultiSelectBar(container: HTMLElement) {
    const bar = container.createDiv("aa-multiselect-bar");
    if (this.selectedAnnotations.size > 0) {
      const groupBtn = bar.createEl("button", {
        text: t("ui.groupSelected", this.plugin),
        attr: { type: "button" }
      });
      groupBtn.onclick = () => this.showCreateGroupDialog();
    }
    const cancelBtn = bar.createEl("button", {
      text: t("ui.cancelSelection", this.plugin),
      attr: { type: "button" }
    });
    cancelBtn.onclick = () => {
      this.isMultiSelectMode = false;
      this.selectedAnnotations.clear();
      this.render();
    };
  }
  renderFilterPopover(row: HTMLElement, annotations: Annotation[]) {
    mountFilterPopover(row, annotations, this.filter, this.plugin, (filter) => {
      this.filter = filter;
      this.filterOpen = false;
      this.render();
    }, () => {
      this.filterOpen = false;
      this.render();
    });
  }
  clearFilters() {
    this.query = "";
    this.kind = "all";
    this.filter = defaultAnnotationFilter();
    this.filterOpen = false;
    this.render();
  }
  fillList(list: HTMLElement, annotations: Annotation[]) {
    const visible = this.visibleAnnotations(annotations);
    if (annotations.length === 0) {
      const emptyEl = list.createDiv("aa-sidebar-empty");
      emptyEl.createEl("p", { text: t("ui.emptyReading", this.plugin) });
      this.renderMissingFiles(list);
      return;
    }
    if (visible.length === 0) {
      const emptyEl = list.createDiv("aa-sidebar-empty");
      if (this.query.trim()) {
        emptyEl.createEl("p", { text: t("ui.noResults", this.plugin) });
      } else {
        emptyEl.createEl("p", { text: t("ui.filterEmpty", this.plugin) });
      }
      const clearBtn = emptyEl.createEl("button", {
        text: t("ui.clearFilters", this.plugin),
        attr: { type: "button" }
      });
      clearBtn.addClass("aa-clear-filters");
      clearBtn.onclick = () => this.clearFilters();
      this.renderMissingFiles(list);
      return;
    }
    if (this.isMultiSelectMode)
      this.renderGrouped(list, visible);
    else
      visible.forEach((annotation) => this.renderAnnotationCard(list, annotation));
    this.renderMissingFiles(list);
  }
  renderGrouped(list: HTMLElement, visible: Annotation[]) {
    const currentFile = this.currentFile;
    if (!currentFile)
      return;
    const groups = this.plugin.getGroupsForFile(currentFile.path);
    const grouped = new Map<string, Annotation[]>();
    const ungrouped: Annotation[] = [];
    groups.forEach((group) => grouped.set(group.id, []));
    visible.forEach((annotation) => {
      const bucket = annotation.groupId ? grouped.get(annotation.groupId) : undefined;
      if (bucket)
        bucket.push(annotation);
      else
        ungrouped.push(annotation);
    });
    groups.forEach((group) => {
      const groupAnnotations = grouped.get(group.id) ?? [];
      if (groupAnnotations.length === 0)
        return;
      this.renderGroup(list, group, groupAnnotations);
    });
    if (ungrouped.length > 0) {
      if (groups.length > 0) {
        const separator = list.createDiv("aa-ungrouped-separator");
        separator.setText(t("ui.ungrouped", this.plugin));
      }
      ungrouped.forEach((annotation) => this.renderAnnotationCard(list, annotation));
    }
  }
  renderGroup(list: HTMLElement, group: HighlightGroup, groupAnnotations: Annotation[]) {
    const groupContainer = list.createDiv("aa-group-container");
    const groupHeader = groupContainer.createDiv("aa-group-header");
    groupHeader.tabIndex = 0;
    const groupTitle = groupHeader.createDiv("aa-group-title");
    groupTitle.createSpan({
      text: group.collapsed ? "▶" : "▼",
      cls: "aa-collapse-icon"
    });
    groupTitle.createSpan({ text: group.name });
    groupHeader.createSpan({
      text: t("ui.groupCount", this.plugin).replace("${n}", String(groupAnnotations.length)),
      cls: "aa-group-count"
    });
    const groupActions = groupHeader.createDiv("aa-group-actions");
    const renameBtn = groupActions.createEl("button", {
      attr: { type: "button", "aria-label": t("ui.renameGroup", this.plugin) }
    });
    setIcon(renameBtn, "pencil");
    renameBtn.onclick = (evt) => {
      evt.stopPropagation();
      this.showRenameGroupDialog(group);
    };
    const ungroupBtn = groupActions.createEl("button", {
      attr: { type: "button", "aria-label": t("ui.ungroup", this.plugin) }
    });
    setIcon(ungroupBtn, "folder-output");
    ungroupBtn.onclick = async (evt) => {
      evt.stopPropagation();
      const win = this.containerEl.ownerDocument.defaultView;
      const message = t("ui.ungroupConfirm", this.plugin).replace("${name}", group.name).replace("${n}", String(groupAnnotations.length));
      if (!win?.confirm(message))
        return;
      for (const annotation of groupAnnotations)
        await this.plugin.removeAnnotationFromGroup(annotation.id);
      await this.plugin.removeGroup(group.id);
      this.render();
    };
    const toggleGroup = () => {
      group.collapsed = !group.collapsed;
      void this.plugin.updateGroup(group.id, { collapsed: group.collapsed });
      this.render();
    };
    groupHeader.onclick = () => toggleGroup();
    groupHeader.addEventListener("keydown", (evt) => {
      if (evt.target !== groupHeader)
        return;
      if (evt.key !== "Enter" && evt.key !== " ")
        return;
      evt.preventDefault();
      toggleGroup();
    });
    if (!group.collapsed) {
      const groupContent = groupContainer.createDiv("aa-group-content");
      groupAnnotations.forEach((annotation) => this.renderAnnotationCard(groupContent, annotation));
    }
    groupContainer.addEventListener("dragover", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      groupContainer.addClass("aa-group-drop-target");
    });
    groupContainer.addEventListener("dragleave", (evt) => {
      const nextTarget = evt.relatedTarget;
      if (!(nextTarget instanceof Node) || !groupContainer.contains(nextTarget))
        groupContainer.removeClass("aa-group-drop-target");
    });
    groupContainer.addEventListener("drop", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      groupContainer.removeClass("aa-group-drop-target");
      const annotationId = evt.dataTransfer?.getData("text/plain");
      if (!annotationId)
        return;
      void (async () => {
        await this.plugin.addAnnotationToGroup(annotationId, group.id);
        this.render();
      })();
    });
  }
  renderMissingFiles(list: HTMLElement) {
    const missing = this.plugin.data.filter((annotation) => annotation.anchor === "file-missing");
    if (missing.length === 0)
      return;
    const separator = list.createDiv("aa-ungrouped-separator");
    separator.setText(t("ui.orphanHeading", this.plugin));
    missing.forEach((annotation) => this.renderAnnotationCard(list, annotation));
  }
  scrollToCard(annotationId: string) {
    const card = this.containerEl.querySelector(`.aa-card[data-annotation-id="${annotationId}"]`);
    if (!card)
      return;
    card.scrollIntoView({ block: "center", behavior: "smooth" });
    this.containerEl.querySelectorAll(".aa-card.is-scroll-synced").forEach((el) => el.classList.remove("is-scroll-synced"));
    card.classList.add("is-scroll-synced");
    const win = card.ownerDocument.defaultView ?? window;
    win.setTimeout(() => card.classList.remove("is-scroll-synced"), 1600);
  }
  renderAnnotationCard(container: HTMLElement, annotation: Annotation) {
    const card = mountAnnotationCard(container, annotation, this.plugin, () => this.render());
    if (!this.isMultiSelectMode || annotation.anchor === "file-missing")
      return;
    card.addClass("is-selectable");
    const checkboxContainer = card.createDiv("aa-card-checkbox");
    const checkbox = checkboxContainer.createEl("input", { type: "checkbox" });
    checkbox.checked = this.selectedAnnotations.has(annotation.id);
    checkbox.onchange = (evt) => {
      evt.stopPropagation();
      if (checkbox.checked)
        this.selectedAnnotations.add(annotation.id);
      else
        this.selectedAnnotations.delete(annotation.id);
      this.render();
    };
    card.draggable = true;
    card.addClass("aa-draggable-card");
    card.addEventListener("dragstart", (evt) => {
      card.addClass("aa-card-dragging");
      if (evt.dataTransfer) {
        evt.dataTransfer.effectAllowed = "move";
        evt.dataTransfer.setData("text/plain", annotation.id);
      }
    });
    card.addEventListener("dragend", () => {
      card.removeClass("aa-card-dragging");
      this.containerEl.querySelectorAll(".aa-group-drop-target").forEach((el) => el.classList.remove("aa-group-drop-target"));
    });
  }
  showCreateGroupDialog() {
    const selectedIds = Array.from(this.selectedAnnotations);
    if (selectedIds.length === 0)
      return;
    const modal = new Modal(this.plugin.app);
    modal.titleEl.setText(t("ui.createGroup", this.plugin));
    const content = modal.contentEl;
    content.createEl("p", {
      text: t("ui.groupAssignPrompt", this.plugin).replace("${n}", String(selectedIds.length))
    });
    const input = content.createEl("input", {
      type: "text",
      placeholder: t("ui.groupName", this.plugin)
    });
    input.addClass("aa-input");
    const buttonContainer = content.createDiv("aa-modal-buttons");
    const cancelBtn = buttonContainer.createEl("button", { text: t("ui.cancel", this.plugin) });
    cancelBtn.addClass("aa-button");
    cancelBtn.addClass("aa-button-secondary");
    cancelBtn.onclick = () => modal.close();
    const confirmBtn = buttonContainer.createEl("button", { text: t("ui.createGroup", this.plugin) });
    confirmBtn.addClass("aa-button");
    confirmBtn.addClass("aa-button-primary");
    confirmBtn.onclick = async () => {
      const groupName = input.value.trim();
      const currentFile = this.currentFile;
      if (!groupName || !currentFile)
        return;
      const group = await this.plugin.addGroup(groupName, currentFile.path);
      for (const annotationId of selectedIds)
        await this.plugin.addAnnotationToGroup(annotationId, group.id);
      this.isMultiSelectMode = false;
      this.selectedAnnotations.clear();
      modal.close();
      this.render();
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
  showRenameGroupDialog(group: HighlightGroup) {
    const modal = new Modal(this.plugin.app);
    modal.titleEl.setText(t("ui.renameGroup", this.plugin));
    const content = modal.contentEl;
    content.createEl("p", {
      text: t("ui.renameGroupPrompt", this.plugin).replace("${name}", group.name)
    });
    const input = content.createEl("input", {
      type: "text",
      value: group.name
    });
    input.addClass("aa-input");
    const buttonContainer = content.createDiv("aa-modal-buttons");
    const cancelBtn = buttonContainer.createEl("button", { text: t("ui.cancel", this.plugin) });
    cancelBtn.addClass("aa-button");
    cancelBtn.addClass("aa-button-secondary");
    cancelBtn.onclick = () => modal.close();
    const confirmBtn = buttonContainer.createEl("button", { text: t("ui.renameGroup", this.plugin) });
    confirmBtn.addClass("aa-button");
    confirmBtn.addClass("aa-button-primary");
    confirmBtn.onclick = async () => {
      const newName = input.value.trim();
      if (!newName || newName === group.name) {
        modal.close();
        return;
      }
      await this.plugin.renameGroup(group.id, newName);
      modal.close();
      this.render();
    };
    input.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") {
        evt.preventDefault();
        confirmBtn.click();
      }
    });
    modal.open();
    input.select();
  }
}
