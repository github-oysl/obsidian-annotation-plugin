/** 跨文件的批注列表。只列出已有批注的路径，不是文件管理器。 */
import { ItemView, Menu, Platform, setIcon, TFile, type WorkspaceLeaf } from "obsidian";
import { canNavigateAnnotation, mountAnnotationCard } from "./annotation-card";
import { mountFilterChips, type FilterChip } from "./filter-chips";
import { isMarkdownPosition, formatTime } from "./annotation-model";
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
import { getColorName, t } from "./i18n";
import type ArticleAnnotator from "./main";
import type { Annotation } from "./types";

export const VIEW_TYPE_LIBRARY = "scholiast-library";

type PathKind = "all" | "folder" | "file";
type TimeRange = "all" | "today" | "week";

interface FolderNode {
  name: string;
  path: string;
  count: number;
  folders: FolderNode[];
  files: Array<{ name: string; path: string; count: number }>;
}

export class AnnotationLibraryView extends ItemView {
  plugin: ArticleAnnotator;
  query = "";
  kind: AnnotationKind = "all";
  filter: AnnotationFilter = defaultAnnotationFilter();
  filterOpen = false;
  sortOpen = false;
  viewMode: "list" | "grid" = "list";
  selectedId: string | null = null;
  detailWidth = 300;
  comfortable = true;
  expandedTags = false;
  searchTimer: number | null = null;
  pathKind: PathKind = "all";
  pathValue = "";
  timeRange: TimeRange = "all";
  collapsedFolders = new Set<string>();

  constructor(leaf: WorkspaceLeaf, plugin: ArticleAnnotator) {
    super(leaf);
    this.plugin = plugin;
    this.icon = "library";
  }
  getViewType() {
    return VIEW_TYPE_LIBRARY;
  }
  getDisplayText() {
    return t("ui.libraryTitle", this.plugin);
  }
  async onOpen() {
    this.containerEl.addClass("aa-library");
    if (Platform.isMobile)
      this.containerEl.addClass("is-touch");
    const doc = this.containerEl.ownerDocument;
    this.registerDomEvent(doc, "pointerdown", (evt) => {
      if (!this.filterOpen && !this.sortOpen)
        return;
      const target = evt.target;
      if (!(target instanceof Node))
        return;
      const popover = this.containerEl.querySelector(".aa-filter-popover");
      const buttons = this.containerEl.querySelectorAll(".aa-filter-button, .aa-sort-button");
      let insideButton = false;
      buttons.forEach((button) => {
        if (button.contains(target))
          insideButton = true;
      });
      if (insideButton || popover?.contains(target))
        return;
      this.closePopovers();
    });
    this.registerDomEvent(doc, "keydown", (evt) => {
      if (evt.key !== "Escape" || (!this.filterOpen && !this.sortOpen))
        return;
      this.closePopovers();
    });
    this.render();
  }
  closePopovers() {
    this.filterOpen = false;
    this.sortOpen = false;
    this.containerEl.querySelector(".aa-filter-popover")?.remove();
    if (this.containerEl.isConnected)
      this.render();
  }
  async onClose() {
    this.clearSearchTimer();
    await super.onClose();
  }
  clearSearchTimer() {
    if (this.searchTimer === null)
      return;
    this.containerEl.ownerDocument.defaultView?.clearTimeout(this.searchTimer);
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
  sourceAnnotations(): Annotation[] {
    return this.plugin.data.filter((annotation) => this.matchesPath(annotation) && this.matchesTime(annotation));
  }
  matchesPath(annotation: Annotation): boolean {
    if (this.pathKind === "all" || !this.pathValue)
      return true;
    if (this.pathKind === "file")
      return annotation.filePath === this.pathValue;
    return annotation.filePath === this.pathValue || annotation.filePath.startsWith(`${this.pathValue}/`);
  }
  matchesTime(annotation: Annotation): boolean {
    if (this.timeRange === "all")
      return true;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (this.timeRange === "week")
      start.setDate(start.getDate() - 6);
    return annotation.created >= start.getTime();
  }
  visibleAnnotations(): Annotation[] {
    return this.sourceAnnotations()
      .filter((annotation) => matchesKind(annotation, this.kind) && matchesQuery(annotation, this.query, true) && matchesFilter(annotation, this.filter))
      .sort((a, b) => compareAnnotations(a, b, this.filter.sort));
  }
  render() {
    const doc = this.containerEl.ownerDocument;
    const active = doc.activeElement;
    const searchWasFocused = active instanceof HTMLInputElement && active.classList.contains("aa-sidebar-search");
    const cursor = searchWasFocused ? active.selectionStart : null;
    const previousNav = this.containerEl.querySelector(".aa-library-nav");
    const navScroll = previousNav instanceof HTMLElement ? previousNav.scrollTop : 0;
    const previousList = this.containerEl.querySelector<HTMLElement>(".aa-sidebar-list");
    const listScroll = previousList?.scrollTop ?? 0;
    const focusedCardId = active?.closest<HTMLElement>(".aa-card")?.dataset.annotationId;
    const container = this.containerEl;
    container.empty();
    container.addClass("aa-library");
    if (Platform.isMobile)
      container.addClass("is-touch");
    this.renderHeader(container);
    const body = container.createDiv("aa-library-body");
    const nav = body.createDiv("aa-library-nav");
    this.renderNav(nav);
    const main = body.createDiv("aa-library-main");
    const annotations = this.sourceAnnotations();
    this.renderSearch(main, annotations);
    this.renderTabs(main, annotations);
    this.renderActiveFilters(main);
    const content = main.createDiv("aa-library-content");
    const list = content.createDiv("aa-sidebar-list");
    if (this.viewMode === "grid")
      list.addClass("is-grid");
    this.fillList(list);
    const detail = content.createDiv("aa-library-detail");
    detail.setAttr("aria-label", t("ui.detailNote", this.plugin));
    const resize = content.createDiv({ cls: "aa-detail-resize", attr: {
      role: "separator", tabindex: "0", "aria-orientation": "vertical",
      "aria-label": t("ui.resizeDetail", this.plugin), "aria-valuemin": "240", "aria-valuemax": "480"
    } });
    const setWidth = (width: number) => {
      this.detailWidth = Math.max(240, Math.min(480, width));
      container.style.setProperty("--aa-detail-width", `${this.detailWidth}px`);
      resize.setAttr("aria-valuenow", String(this.detailWidth));
    };
    setWidth(this.detailWidth);
    let drag: { x: number; width: number } | null = null;
    resize.addEventListener("pointerdown", (evt) => {
      if (evt.button !== 0) return;
      evt.preventDefault();
      drag = { x: evt.clientX, width: this.detailWidth };
      resize.setPointerCapture(evt.pointerId);
    });
    resize.addEventListener("pointermove", (evt) => {
      if (drag) setWidth(drag.width + drag.x - evt.clientX);
    });
    resize.addEventListener("pointerup", () => { drag = null; });
    resize.addEventListener("lostpointercapture", () => { drag = null; });
    resize.addEventListener("keydown", (evt) => {
      if (evt.key !== "ArrowLeft" && evt.key !== "ArrowRight") return;
      evt.preventDefault();
      setWidth(this.detailWidth + (evt.key === "ArrowLeft" ? 20 : -20));
    });
    container.classList.toggle("has-detail", this.selectedId !== null);
    container.classList.toggle("is-comfortable", this.comfortable);
    void this.renderDetail(detail);
    if (searchWasFocused) {
      const input = container.querySelector(".aa-sidebar-search");
      if (input instanceof HTMLInputElement) {
        input.focus();
        if (cursor !== null)
          input.setSelectionRange(cursor, cursor);
      }
    }
    nav.scrollTop = navScroll;
    list.scrollTop = listScroll;
    if (focusedCardId && !searchWasFocused) {
      const card = Array.from(list.querySelectorAll<HTMLElement>(".aa-card")).find((item) => item.dataset.annotationId === focusedCardId);
      card?.focus({ preventScroll: true });
    }
  }
  renderHeader(container: HTMLElement) {
    const header = container.createDiv("aa-library-header");
    const titleWrap = header.createDiv("aa-library-title-wrap");
    const icon = titleWrap.createSpan("aa-library-title-icon");
    setIcon(icon, "library");
    const textWrap = titleWrap.createDiv("aa-library-title-text");
    textWrap.createEl("h3", { text: t("ui.libraryTitle", this.plugin) });
    textWrap.createEl("p", { text: t("ui.librarySubtitle", this.plugin) });
    const right = header.createDiv("aa-library-header-right");
    right.createSpan({ cls: "aa-library-total", text: t("ui.totalCount", this.plugin).replace("${n}", String(this.plugin.data.length)) });
    const moreBtn = right.createEl("button", {
      attr: { type: "button", "aria-label": t("ui.moreActions", this.plugin) }
    });
    setIcon(moreBtn, "more-horizontal");
    moreBtn.onclick = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.openHeaderMenu(evt, moreBtn);
    };
  }
  openHeaderMenu(evt: MouseEvent, anchor: HTMLElement) {
    const menu = new Menu();
    menu.addItem((item) => {
      item.setTitle(t(this.comfortable ? "ui.compactView" : "ui.comfortableView", this.plugin));
      item.setIcon("rows-3");
      item.onClick(() => {
        this.comfortable = !this.comfortable;
        this.containerEl.classList.toggle("is-comfortable", this.comfortable);
      });
    });
    menu.addItem((item) => {
      item.setTitle(t("ui.menuExportAll", this.plugin));
      item.setIcon("download");
      item.onClick(() => {
        void this.plugin.exportAllAnnotations();
      });
    });
    menu.addItem((item) => {
      item.setTitle(t("ui.menuBatchManage", this.plugin));
      item.setIcon("square-check");
      item.onClick(() => {
        void this.plugin.activateSidebar();
      });
    });
    menu.addItem((item) => {
      item.setTitle(t("ui.menuOpenSidebar", this.plugin));
      item.setIcon("panel-right");
      item.onClick(() => {
        void this.plugin.activateSidebar();
      });
    });
    menu.addSeparator();
    menu.addItem((item) => {
      item.setTitle(t("ui.menuSettings", this.plugin));
      item.setIcon("settings");
      item.onClick(() => {
        const appWithSettings = this.app as unknown as { setting: { open: () => Promise<void> } };
        void appWithSettings.setting.open();
      });
    });
    menu.addItem((item) => {
      item.setTitle(t("ui.menuHelp", this.plugin));
      item.setIcon("book-open");
      item.onClick(() => {
        const win = this.containerEl.ownerDocument.defaultView ?? window;
        win.open("https://github.com/github-oysl/obsidian-annotation-plugin-src#readme", "_blank");
      });
    });
    if (evt instanceof MouseEvent && (evt.clientX !== 0 || evt.clientY !== 0))
      menu.showAtMouseEvent(evt);
    else {
      const rect = anchor.getBoundingClientRect();
      menu.showAtPosition({ x: rect.left, y: rect.bottom, width: rect.width }, anchor.ownerDocument);
    }
  }
  renderList() {
    const list = this.containerEl.querySelector(".aa-library-main .aa-sidebar-list");
    if (!(list instanceof HTMLElement)) {
      this.render();
      return;
    }
    const scrollTop = list.scrollTop;
    list.empty();
    this.fillList(list);
    list.scrollTop = scrollTop;
    this.containerEl.classList.toggle("has-detail", this.selectedId !== null);
    const detail = this.containerEl.querySelector<HTMLElement>(".aa-library-detail");
    if (detail) void this.renderDetail(detail);
  }
  clearFilters() {
    this.query = "";
    this.kind = "all";
    this.filter = defaultAnnotationFilter();
    this.timeRange = "all";
    this.pathKind = "all";
    this.pathValue = "";
    this.filterOpen = false;
    this.sortOpen = false;
    this.render();
  }
  renderActiveFilters(main: HTMLElement) {
    const extras: FilterChip[] = [];
    const change = (action: () => void) => () => { action(); this.render(); };
    if (this.pathKind !== "all")
      extras.push({ label: this.pathValue, remove: change(() => { this.pathKind = "all"; this.pathValue = ""; }) });
    if (this.timeRange !== "all")
      extras.push({ label: t(this.timeRange === "today" ? "ui.timeToday" : "ui.timeWeek", this.plugin), remove: change(() => { this.timeRange = "all"; }) });
    if (this.kind !== "all")
      extras.push({ label: t(this.kind === "note" ? "ui.notesOnly" : "ui.highlights", this.plugin), remove: change(() => { this.kind = "all"; }) });
    mountFilterChips(main, this.filter, this.plugin, (filter) => { this.filter = filter; this.render(); }, () => this.clearFilters(), extras);
  }
  renderNav(nav: HTMLElement) {
    this.renderSection(nav, t("ui.navFiles", this.plugin));
    const allBtn = nav.createEl("button", {
      cls: "aa-library-path",
      attr: { type: "button", "aria-pressed": this.pathKind === "all" ? "true" : "false" }
    });
    allBtn.createSpan({ text: t("ui.allFiles", this.plugin) });
    allBtn.createSpan({ cls: "aa-library-count", text: String(this.plugin.data.length) });
    if (this.pathKind === "all")
      allBtn.addClass("is-selected");
    allBtn.onclick = () => {
      this.pathKind = "all";
      this.pathValue = "";
      this.render();
    };
    this.renderFolder(nav, buildTree(this.plugin.data), 0);
    const tagCounts = new Map<string, number>();
    for (const annotation of this.plugin.data)
      for (const tag of annotation.tags ?? [])
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    const tags = [...tagCounts.keys()].sort((a, b) => (tagCounts.get(b) ?? 0) - (tagCounts.get(a) ?? 0));
    if (tags.length > 0) {
      this.renderSection(nav, t("ui.filterTag", this.plugin));
      const visibleTags = this.expandedTags ? tags : tags.slice(0, 5);
      for (const tag of visibleTags)
        this.renderTagToggle(nav, tag, tagCounts.get(tag) ?? 0);
      if (tags.length > 5) {
        const moreBtn = nav.createEl("button", {
          cls: "aa-library-path aa-library-more-tags",
          attr: { type: "button" }
        });
        moreBtn.createSpan({ text: this.expandedTags ? "▲" : t("ui.moreTags", this.plugin) });
        moreBtn.onclick = () => {
          this.expandedTags = !this.expandedTags;
          this.render();
        };
      }
    }
    const colors = [...new Set(this.plugin.data.map((annotation) => annotation.color))];
    if (colors.length > 0) {
      this.renderSection(nav, t("ui.filterColor", this.plugin));
      const row = nav.createDiv("aa-library-colors");
      for (const color of colors) {
        const swatch = row.createEl("button", {
          cls: "aa-filter-swatch",
          attr: {
            type: "button",
            "aria-label": getColorName(color, this.plugin) || color,
            "aria-pressed": this.filter.colors.includes(color) ? "true" : "false"
          }
        });
        swatch.style.setProperty("--aa-accent", color);
        if (this.filter.colors.includes(color))
          swatch.addClass("is-selected");
        swatch.onclick = () => this.toggleValue("colors", color);
      }
    }
    this.renderSection(nav, t("ui.filterTime", this.plugin));
    const ranges: Array<{ id: TimeRange; key: string }> = [
      { id: "all", key: "ui.timeAll" },
      { id: "today", key: "ui.timeToday" },
      { id: "week", key: "ui.timeWeek" }
    ];
    for (const range of ranges)
      this.renderToggle(nav, t(range.key, this.plugin), this.timeRange === range.id, () => {
        this.timeRange = range.id;
        this.render();
      });
  }
  renderSection(nav: HTMLElement, title: string) {
    nav.createDiv({ cls: "aa-library-section-title", text: title });
  }
  renderToggle(nav: HTMLElement, label: string, selected: boolean, onClick: () => void) {
    const button = nav.createEl("button", {
      cls: "aa-library-path",
      text: label,
      attr: { type: "button", "aria-pressed": selected ? "true" : "false" }
    });
    if (selected)
      button.addClass("is-selected");
    button.onclick = onClick;
  }
  renderTagToggle(nav: HTMLElement, tag: string, count: number) {
    const button = nav.createEl("button", {
      cls: "aa-library-path",
      attr: { type: "button", "aria-pressed": this.filter.tags.includes(tag) ? "true" : "false" }
    });
    button.createSpan({ text: `# ${tag}` });
    button.createSpan({ cls: "aa-library-count", text: String(count) });
    if (this.filter.tags.includes(tag))
      button.addClass("is-selected");
    button.onclick = () => this.toggleValue("tags", tag);
  }
  toggleValue(key: "tags" | "colors", value: string) {
    const selected = new Set(this.filter[key]);
    if (selected.has(value))
      selected.delete(value);
    else
      selected.add(value);
    this.filter = { ...this.filter, [key]: [...selected] };
    this.render();
  }
  renderFolder(parent: HTMLElement, node: FolderNode, depth: number) {
    const folders = [...node.folders].sort((a, b) => a.name.localeCompare(b.name));
    for (const folder of folders) {
      const collapsed = this.collapsedFolders.has(folder.path);
      const row = parent.createDiv("aa-library-folder");
      row.style.setProperty("--aa-indent", `${8 + depth * 12}px`);
      const twist = row.createEl("button", {
        cls: "aa-library-twist",
        attr: {
          type: "button",
          "aria-expanded": collapsed ? "false" : "true",
          "aria-label": t(collapsed ? "ui.expandFolder" : "ui.collapseFolder", this.plugin)
        }
      });
      setIcon(twist, collapsed ? "chevron-right" : "chevron-down");
      twist.onclick = (evt) => {
        evt.stopPropagation();
        if (collapsed)
          this.collapsedFolders.delete(folder.path);
        else
          this.collapsedFolders.add(folder.path);
        this.render();
      };
      const button = row.createEl("button", {
        cls: "aa-library-path",
        attr: { type: "button", "aria-pressed": this.pathKind === "folder" && this.pathValue === folder.path ? "true" : "false" }
      });
      button.createSpan({ text: folder.name });
      button.createSpan({ cls: "aa-library-count", text: String(folder.count) });
      if (this.pathKind === "folder" && this.pathValue === folder.path)
        button.addClass("is-selected");
      button.onclick = () => {
        this.pathKind = "folder";
        this.pathValue = folder.path;
        this.render();
      };
      if (!collapsed)
        this.renderFolder(parent, folder, depth + 1);
    }
    const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name));
    for (const file of files) {
      const button = parent.createEl("button", {
        cls: "aa-library-path",
        attr: { type: "button", "aria-pressed": this.pathKind === "file" && this.pathValue === file.path ? "true" : "false" }
      });
      button.style.setProperty("--aa-indent", `${28 + depth * 12}px`);
      button.createSpan({ text: file.name });
      button.createSpan({ cls: "aa-library-count", text: String(file.count) });
      if (this.pathKind === "file" && this.pathValue === file.path)
        button.addClass("is-selected");
      button.onclick = () => {
        this.pathKind = "file";
        this.pathValue = file.path;
        this.render();
      };
    }
  }
  renderSearch(main: HTMLElement, annotations: Annotation[]) {
    const row = main.createDiv("aa-sidebar-search-row");
    const input = row.createEl("input", {
      cls: "aa-sidebar-search",
      attr: {
        type: "search",
        placeholder: t("ui.searchQuotesPlaceholder", this.plugin),
        autocomplete: "off",
        "aria-label": t("ui.searchQuotesPlaceholder", this.plugin)
      }
    });
    input.value = this.query;
    input.addEventListener("input", () => {
      this.query = input.value;
      this.scheduleSearch();
    });
    const filterBtn = row.createEl("button", {
      cls: "aa-filter-button aa-filter-text-button",
      attr: {
        type: "button",
        "aria-expanded": this.filterOpen ? "true" : "false"
      }
    });
    setIcon(filterBtn, "filter");
    filterBtn.createSpan({ text: t("ui.filter", this.plugin) });
    if (isFilterActive(this.filter) || this.timeRange !== "all")
      filterBtn.addClass("is-active");
    filterBtn.onclick = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.sortOpen = false;
      this.filterOpen = !this.filterOpen;
      this.render();
    };
    const sortLabel = this.filter.sort === "position" ? t("ui.sortPosition", this.plugin) : this.filter.sort === "created" ? t("ui.sortCreated", this.plugin) : t("ui.sortUpdated", this.plugin);
    const sortBtn = row.createEl("button", {
      cls: "aa-sort-button",
      attr: {
        type: "button",
        "aria-expanded": this.sortOpen ? "true" : "false"
      }
    });
    setIcon(sortBtn, "arrow-up-down");
    sortBtn.createSpan({ text: t("ui.sortBy", this.plugin).replace("${n}", sortLabel) });
    sortBtn.onclick = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.filterOpen = false;
      this.sortOpen = !this.sortOpen;
      this.render();
    };
    const viewBtn = row.createEl("button", {
      cls: "aa-view-toggle",
      attr: {
        type: "button",
        "aria-label": t(this.viewMode === "list" ? "ui.viewGrid" : "ui.viewList", this.plugin)
      }
    });
    setIcon(viewBtn, this.viewMode === "list" ? "layout-grid" : "list");
    viewBtn.onclick = (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      this.viewMode = this.viewMode === "list" ? "grid" : "list";
      this.render();
    };
    if (this.filterOpen) {
      mountFilterPopover(row, annotations, this.filter, this.plugin, (filter) => {
        this.filter = filter;
        this.filterOpen = false;
        this.render();
      }, () => {
        this.filterOpen = false;
        this.render();
      }, {
        showSort: false,
        timeRange: this.timeRange,
        onTimeRange: (range) => {
          this.timeRange = range;
        }
      });
      return;
    }
    if (this.sortOpen) {
      const popover = row.createDiv("aa-filter-popover aa-sort-popover");
      const closeBtn = popover.createEl("button", {
        cls: "aa-filter-close",
        attr: { type: "button", "aria-label": t("ui.close", this.plugin) }
      });
      setIcon(closeBtn, "x");
      closeBtn.onclick = (evt) => {
        evt.preventDefault();
        this.sortOpen = false;
        this.render();
      };
      popover.createDiv({ cls: "aa-filter-label", text: t("ui.sort", this.plugin) });
      const sorts: Array<{ id: "position" | "created" | "updated"; key: string }> = [
        { id: "position", key: "ui.sortPosition" },
        { id: "created", key: "ui.sortCreated" },
        { id: "updated", key: "ui.sortUpdated" }
      ];
      for (const sort of sorts) {
        const button = popover.createEl("button", {
          cls: "aa-filter-option",
          text: t(sort.key, this.plugin),
          attr: { type: "button", "aria-pressed": this.filter.sort === sort.id ? "true" : "false" }
        });
        if (this.filter.sort === sort.id)
          button.addClass("is-selected");
        button.onclick = (evt) => {
          evt.preventDefault();
          this.filter = { ...this.filter, sort: sort.id };
          this.sortOpen = false;
          this.render();
        };
      }
    }
  }
  renderTabs(main: HTMLElement, annotations: Annotation[]) {
    const noteCount = annotations.filter((annotation) => isNote(annotation)).length;
    const tabs = main.createDiv("aa-sidebar-tabs");
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
  }
  toggleFilter() {
    this.sortOpen = false;
    this.filterOpen = !this.filterOpen;
    this.render();
  }
  fillList(list: HTMLElement) {
    const allInScope = this.sourceAnnotations();
    const visible = this.visibleAnnotations();
    if (this.selectedId && !visible.some((annotation) => annotation.id === this.selectedId))
      this.selectedId = null;
    if (allInScope.length === 0 && !this.query.trim() && !isFilterActive(this.filter) && this.kind === "all" && this.timeRange === "all" && this.pathKind === "all") {
      list.createDiv("aa-sidebar-empty").createEl("p", { text: t("ui.emptyReading", this.plugin) });
      return;
    }
    if (visible.length === 0) {
      const emptyEl = list.createDiv("aa-sidebar-empty");
      if (this.query.trim()) {
        emptyEl.createEl("p", { text: t("ui.noResults", this.plugin) });
      } else
        emptyEl.createEl("p", { text: t("ui.filterEmpty", this.plugin) });
      const clearBtn = emptyEl.createEl("button", {
        text: t("ui.clearFilters", this.plugin),
        attr: { type: "button" }
      });
      clearBtn.addClass("aa-clear-filters");
      clearBtn.onclick = () => this.clearFilters();
      return;
    }
    visible.forEach((annotation) => {
      const card = mountAnnotationCard(list, annotation, this.plugin, () => this.render(), {
        showFilePath: true,
        showTitle: true,
        onOpen: () => this.selectAnnotation(annotation.id)
      });
      if (annotation.id === this.selectedId) {
        card.addClass("is-selected");
        card.setAttr("aria-current", "true");
      }
    });
  }
  selectAnnotation(id: string) {
    this.selectedId = id;
    this.containerEl.addClass("has-detail");
    this.containerEl.querySelectorAll<HTMLElement>(".aa-card").forEach((card) => {
      const selected = card.dataset.annotationId === id;
      card.classList.toggle("is-selected", selected);
      if (selected) card.setAttr("aria-current", "true");
      else card.removeAttribute("aria-current");
    });
    const detail = this.containerEl.querySelector<HTMLElement>(".aa-library-detail");
    if (detail) {
      detail.scrollTop = 0;
      void this.renderDetail(detail);
      // A container breakpoint can turn details into a full-page preview.
      if (this.containerEl.clientWidth <= 950)
        detail.querySelector<HTMLButtonElement>(".aa-detail-back")?.focus({ preventScroll: true });
    }
  }
  closeDetail() {
    const id = this.selectedId;
    this.selectedId = null;
    this.containerEl.removeClass("has-detail");
    this.containerEl.querySelectorAll<HTMLElement>(".aa-card").forEach((card) => {
      card.removeClass("is-selected");
      card.removeAttribute("aria-current");
      if (card.dataset.annotationId === id) card.focus({ preventScroll: true });
    });
    const detail = this.containerEl.querySelector<HTMLElement>(".aa-library-detail");
    if (detail) void this.renderDetail(detail);
  }
  /** 右侧详情预览：引用、批注、标签、位置信息和原文上下文。 */
  async renderDetail(detail: HTMLElement) {
    detail.empty();
    const annotation = this.selectedId ? this.plugin.data.find((item) => item.id === this.selectedId) : undefined;
    if (!annotation) {
      detail.createDiv({ cls: "aa-detail-empty", text: t("ui.detailEmpty", this.plugin) });
      return;
    }
    const back = detail.createEl("button", {
      cls: "aa-detail-back", text: t("ui.backToList", this.plugin), attr: { type: "button" }
    });
    back.onclick = () => this.closeDetail();
    detail.style.setProperty("--aa-accent", annotation.color);
    const header = detail.createDiv("aa-detail-header");
    header.createSpan({ cls: "aa-card-dot", attr: { "aria-hidden": "true" } });
    const fileName = annotation.filePath.split("/").pop() ?? annotation.filePath;
    header.createSpan({ cls: "aa-detail-title", text: fileName.replace(/\.md$/i, "") });
    const headerActions = header.createDiv("aa-detail-actions");
    const editBtn = headerActions.createEl("button", {
      attr: { type: "button", "aria-label": t("ui.edit", this.plugin) }
    });
    setIcon(editBtn, "pencil");
    editBtn.onclick = () => this.plugin.openNoteEditor(annotation);
    const locateBtn = headerActions.createEl("button", {
      attr: { type: "button", "aria-label": t("ui.locate", this.plugin) }
    });
    setIcon(locateBtn, "locate");
    locateBtn.onclick = () => void this.plugin.navigateToAnnotation(annotation);
    locateBtn.disabled = !canNavigateAnnotation(annotation);
    const closeBtn = headerActions.createEl("button", {
      attr: { type: "button", "aria-label": t("ui.hideDetail", this.plugin), title: t("ui.hideDetail", this.plugin) }
    });
    setIcon(closeBtn, "x");
    closeBtn.onclick = () => this.closeDetail();
    detail.createDiv({ cls: "aa-detail-path", text: annotation.filePath });
    detail.createDiv({ cls: "aa-detail-label", text: t("ui.detailQuote", this.plugin) });
    const quote = detail.createDiv("aa-detail-quote");
    quote.createEl("p", { text: annotation.highlightedText });
    detail.createDiv({ cls: "aa-detail-label", text: t("ui.detailNote", this.plugin) });
    detail.createDiv({
      cls: "aa-detail-note",
      text: annotation.noteContent.trim() ? annotation.noteContent : t("ui.detailNoNote", this.plugin)
    });
    detail.createDiv({ cls: "aa-detail-label", text: t("ui.detailTags", this.plugin) });
    const tagRow = detail.createDiv("aa-note-tags aa-detail-tags");
    (annotation.tags ?? []).forEach((tag) => {
      const chip = tagRow.createSpan({ cls: "aa-note-tag" });
      chip.createSpan({ text: tag });
      const remove = chip.createEl("button", {
        text: "×",
        attr: { type: "button", "aria-label": `${t("ui.removeTag", this.plugin)} ${tag}` }
      });
      remove.onclick = () => {
        const tags = (annotation.tags ?? []).filter((item) => item !== tag);
        void this.plugin.commitAnnotationUpdate(annotation.id, { tags });
        this.render();
      };
    });
    const addBtn = tagRow.createEl("button", {
      cls: "aa-note-tag-add",
      text: "+",
      attr: { type: "button", "aria-label": t("ui.addTag", this.plugin) }
    });
    addBtn.onclick = () => {
      const input = tagRow.createEl("input", {
        attr: { type: "text", placeholder: t("ui.tagName", this.plugin), "aria-label": t("ui.addTag", this.plugin) }
      });
      addBtn.remove();
      const commit = () => {
        const tag = input.value.trim();
        if (tag && !(annotation.tags ?? []).includes(tag))
          void this.plugin.commitAnnotationUpdate(annotation.id, { tags: [...(annotation.tags ?? []), tag] });
        this.render();
      };
      input.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter" && !evt.isComposing) {
          evt.preventDefault();
          commit();
        }
      });
      input.addEventListener("blur", () => {
        commit();
      });
      input.focus();
    };
    detail.createDiv({ cls: "aa-detail-label", text: t("ui.detailLocation", this.plugin) });
    const info = detail.createDiv("aa-detail-info");
    if (annotation.fileType !== "pdf" && isMarkdownPosition(annotation.position)) {
      const lineRow = info.createDiv("aa-detail-info-row");
      lineRow.createSpan({ cls: "aa-detail-info-key", text: t("ui.detailLine", this.plugin) });
      lineRow.createSpan({ cls: "aa-detail-info-value", text: String(annotation.position.startLine + 1) });
    }
    const timeRow = info.createDiv("aa-detail-info-row");
    timeRow.createSpan({ cls: "aa-detail-info-key", text: t("ui.detailCreated", this.plugin) });
    timeRow.createSpan({ cls: "aa-detail-info-value", text: formatTime(annotation.created, this.plugin) });
    const updatedRow = info.createDiv("aa-detail-info-row");
    updatedRow.createSpan({ cls: "aa-detail-info-key", text: t("ui.detailUpdated", this.plugin) });
    updatedRow.createSpan({ cls: "aa-detail-info-value", text: formatTime(annotation.updated, this.plugin) });
    if (annotation.fileType === "markdown" && isMarkdownPosition(annotation.position)) {
      detail.createDiv({ cls: "aa-detail-label", text: t("ui.detailContext", this.plugin) });
      const context = detail.createDiv("aa-detail-context");
      const file = this.app.vault.getAbstractFileByPath(annotation.filePath);
      if (file instanceof TFile) {
        try {
          const text = await this.app.vault.read(file);
          if (!context.isConnected || this.selectedId !== annotation.id)
            return;
          const lines = text.split("\n");
          const start = annotation.position.startLine;
          const end = annotation.position.endLine;
          const from = Math.max(0, start - 1);
          const to = Math.min(lines.length - 1, end + 1);
          for (let index = from; index <= to; index++) {
            const rowEl = context.createDiv({ cls: "aa-detail-context-row" });
            if (index >= start && index <= end)
              rowEl.addClass("is-highlighted");
            rowEl.createSpan({ cls: "aa-detail-context-line", text: String(index + 1) });
            rowEl.createSpan({ cls: "aa-detail-context-text", text: lines[index] || " " });
          }
        } catch {
          context.createDiv({ cls: "aa-detail-empty", text: t("ui.detailNoContext", this.plugin) });
        }
      }
    }
  }
}

function buildTree(annotations: readonly Annotation[]): FolderNode {
  const root: FolderNode = { name: "", path: "", count: 0, folders: [], files: [] };
  const counts = new Map<string, number>();
  for (const annotation of annotations)
    counts.set(annotation.filePath, (counts.get(annotation.filePath) ?? 0) + 1);
  for (const [filePath, count] of counts) {
    const parts = filePath.split("/");
    const fileName = parts.pop() || filePath;
    let node = root;
    let path = "";
    for (const part of parts) {
      path = path ? `${path}/${part}` : part;
      let child = node.folders.find((folder) => folder.name === part);
      if (!child) {
        child = { name: part, path, count: 0, folders: [], files: [] };
        node.folders.push(child);
      }
      node = child;
    }
    node.files.push({ name: fileName, path: filePath, count });
  }
  // 自下而上汇总文件夹计数（含子孙文件）
  const rollup = (node: FolderNode): number => {
    node.count = node.files.reduce((sum, file) => sum + file.count, 0) + node.folders.reduce((sum, folder) => sum + rollup(folder), 0);
    return node.count;
  };
  rollup(root);
  return root;
}
