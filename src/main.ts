/**
 * 笺注插件。
 * 启动、命令和各模块的连接写在这里。具体界面和存储在同目录的其他文件里。
 * 根目录 main.js 由 esbuild 从这里生成。
 */
import {
  Editor,
  type EditorPosition,
  FileView,
  MarkdownView,
  Menu,
  normalizePath,
  Notice,
  Platform,
  Plugin,
  TAbstractFile,
  TFile,
  TFolder,
  type WorkspaceLeaf,
} from "obsidian";
import { EditorView } from "@codemirror/view";
import { anchorFieldsForRange, linesFromText, reconcileFileAnnotations } from "./anchor";
import { createAnnotationHistoryExtension, type AnnotationHistoryOp } from "./annotation-history";
import {
  ANNOTATION_STORE_DIR,
  ANNOTATION_STORE_FILE,
  DEFAULT_SETTINGS,
  captureMarkdownRange,
  findMarkdownAnnotationAtCursor,
  formatTime,
  generateId,
  getAnnotationLocationLabel,
  getFileType,
  isMarkdownPosition,
  positionsOverlap,
  validateHexColor,
  type AnnotationStoreData,
} from "./annotation-model";
import { compareByDocumentPosition } from "./annotation-query";
import { annotationGutter, annotationGutterField, highlightField, refreshHighlights } from "./editor-highlights";
import { getColorName, t } from "./i18n";
import { NoteModal } from "./note-modal";
import * as pdf from "./pdf";
import { decorateReadingHighlights } from "./reading-highlight";
import { SearchModal } from "./search-modal";
import { AnnotatorSettingTab } from "./settings";
import { VIEW_TYPE_LIBRARY, AnnotationLibraryView } from "./library-view";
import { createSelectionToolbar } from "./selection-toolbar";
import { VIEW_TYPE, AnnotatorSidebarView } from "./sidebar";
import * as store from "./store";
import type { Annotation, AnnotationDraft, AnnotatorSettings, HighlightGroup, PdfSelection } from "./types";

interface EditorCaret {
  editor: Editor;
  anchor: EditorPosition;
  head: EditorPosition;
}

/** 用原文前几个字做新笔记的文件名，去掉路径里不能出现的符号。 */
function noteTitleFromQuote(quote: string, fallback: string): string {
  const compact = quote.replace(/\s+/g, " ").trim().slice(0, 24);
  const cleaned = compact.replace(/[\\/:*?"<>|#^[\]\n\r]/g, "").trim();
  return cleaned || fallback;
}

export default class ArticleAnnotator extends Plugin {
  data: Annotation[] = [];
  groups: HighlightGroup[] = [];
  activeFile: TFile | null = null;
  mobileFabEl: HTMLButtonElement | null = null;
  mobileFabPanelEl: HTMLElement | null = null;
  pdfContextMenuHandler: ((event: MouseEvent) => void) | null = null;
  pdfRenderTimers = new Map<string, number>();
  reanchorTimers = new Map<string, number>();
  annotationStorePath = `${ANNOTATION_STORE_DIR}/${ANNOTATION_STORE_FILE}`;
  isReloadingAnnotationStore = false;
  settings: AnnotatorSettings = { ...DEFAULT_SETTINGS };

  // ==================== 生命周期 ====================
  async onload() {
    await this.loadSettingsAndData();
    this.registerEditorExtension(highlightField);
    this.registerEditorExtension(annotationGutterField);
    this.registerEditorExtension(annotationGutter);
    this.registerEditorExtension(createSelectionToolbar(this));
    this.registerEditorExtension(createAnnotationHistoryExtension((op) => {
      void this.applyAnnotationHistory(op);
    }));
    this.registerEditorExtension(
      EditorView.domEventHandlers({
        click: (event: MouseEvent) => {
          const rawTarget = event.target;
          if (!(rawTarget instanceof Element)) {
            return;
          }
          const target = rawTarget.closest("[data-annotation-id]");
          const id = target instanceof HTMLElement ? target.dataset.annotationId : undefined;
          if (id) {
            this.getSidebarView()?.scrollToCard(id);
          }
        }
      })
    );
    this.registerView(VIEW_TYPE, (leaf) => new AnnotatorSidebarView(leaf, this));
    this.registerView(VIEW_TYPE_LIBRARY, (leaf) => new AnnotationLibraryView(leaf, this));
    this.addRibbonIcon("pen-tool", t("pluginName", this), () => {
      void this.activateSidebar();
    });
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        this.addCursorAnnotationMenuItems(menu, editor, view);
        if (!editor.getSelection())
          return;
        this.addAnnotationMenuItems(menu, editor, view);
      })
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        const view = leaf?.view;
        const file = view instanceof FileView ? view.file : null;
        if (!file)
          return;
        void this.handleActiveFileChange(file);
      })
    );
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.schedulePdfRender();
      })
    );
    this.registerEvent(
      this.app.vault.on("modify", async (file) => {
        if (file?.path === this.getAnnotationStorePath()) {
          await this.reloadAnnotationStoreFromVault();
        }
      })
    );
    this.registerEvent(
      this.app.workspace.on("editor-change", (editor, info) => {
        const file = info.file;
        if (!(file instanceof TFile) || file.extension === "pdf")
          return;
        this.scheduleReanchor(file, editor);
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        void this.followRenamedPath(file, oldPath);
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        void this.markDeletedPath(file);
      })
    );
    this.registerMarkdownPostProcessor((el, ctx) => {
      const annotations = this.getAnnotationsForFile(ctx.sourcePath);
      decorateReadingHighlights(el, annotations, (annotation) => {
        void this.navigateToAnnotation(annotation);
      });
    });
    this.addCommand({
      id: "open-annotation-library",
      name: t("commands.openLibrary", this),
      callback: () => {
        void this.openAnnotationLibrary();
      }
    });
    this.addCommand({
      id: "toggle-sidebar",
      name: t("commands.toggleSidebar", this),
      callback: () => this.activateSidebar()
    });
    this.addCommand({
      id: "export-annotations",
      name: t("commands.exportAnnotations", this),
      callback: () => this.exportAnnotations()
    });
    this.addCommand({
      id: "search-annotations",
      name: t("commands.searchAnnotations", this),
      callback: () => this.openSearchModal()
    });
    this.addCommand({
      id: "clear-file-annotations",
      name: t("commands.clearFileAnnotations", this),
      callback: () => this.clearFileAnnotations()
    });
    this.addCommand({
      id: "mobile-highlight-default-color",
      name: t("commands.mobileHighlight", this),
      editorCallback: async (editor, view) => {
        await this.highlightSelection(editor, view, this.settings.defaultColor);
      }
    });
    this.addCommand({
      id: "mobile-add-note-to-selection",
      name: t("commands.mobileAddNote", this),
      editorCallback: async (editor, view) => {
        await this.addNoteToSelection(editor, view);
      }
    });
    this.addCommand({
      id: "locate-annotation-at-cursor",
      name: t("commands.locateAtCursor", this),
      editorCallback: async (editor, view) => {
        await this.locateAnnotationAtCursor(editor, view);
      }
    });
    this.addCommand({
      id: "edit-annotation-at-cursor",
      name: t("commands.editAtCursor", this),
      editorCallback: (editor, view) => {
        void this.editAnnotationAtCursor(editor, view);
      }
    });
    this.addCommand({
      id: "delete-annotation-at-cursor",
      name: t("commands.deleteAtCursor", this),
      editorCallback: async (editor, view) => {
        await this.deleteAnnotationAtCursor(editor, view);
      }
    });
    this.addSettingTab(new AnnotatorSettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => {
      void this.finishStartup();
    });
    this.register(() => this.clearPdfRenderTimers());
    this.register(() => this.clearReanchorTimers());
    new Notice(t("notifications.pluginLoaded", this));
  }
  onunload() {
    this.cleanupMobileFab();
    this.clearPdfHighlightLayers();
    this.clearPdfRenderTimers();
    
    
  }
  async finishStartup() {
    await this.initSidebar();
    this.bindPdfContextMenus();
    const active = this.app.workspace.getActiveFile();
    if (active && getFileType(active) !== "pdf")
      await this.reconcileMarkdownFile(active);
    else
      refreshHighlights(this);
    this.schedulePdfRender();
    if (Platform.isMobile)
      this.setupMobileFab();
  }
  async handleActiveFileChange(file: TFile) {
    await this.reloadAnnotationStoreFromVault();
    this.activeFile = file;
    this.refreshAnnotationViews(file);
    if (getFileType(file) === "pdf") {
      this.schedulePdfRender(file.path, 120);
    } else {
      await this.reconcileMarkdownFile(file);
      this.clearPdfHighlightLayers();
    }
  }
  clearReanchorTimers() {
    for (const timer of this.reanchorTimers.values())
      window.clearTimeout(timer);
    this.reanchorTimers.clear();
  }
  /** 正文改动后稍等再对齐，避免每个字符都重写批注文件。 */
  scheduleReanchor(file: TFile, editor: Editor) {
    const pending = this.reanchorTimers.get(file.path);
    if (pending)
      window.clearTimeout(pending);
    const timer = window.setTimeout(() => {
      this.reanchorTimers.delete(file.path);
      void this.reconcileMarkdownFile(file, editor);
    }, 500);
    this.reanchorTimers.set(file.path, timer);
  }
  async reconcileMarkdownFile(file: TFile, editor?: Editor) {
    const liveEditor = editor ?? this.editorForFile(file);
    let lines: string[];
    if (liveEditor) {
      lines = [];
      for (let index = 0; index < liveEditor.lineCount(); index++)
        lines.push(liveEditor.getLine(index));
    } else {
      lines = linesFromText(await this.app.vault.read(file));
    }
    const reconciled = reconcileFileAnnotations(this.data, file.path, lines);
    if (!reconciled.changed) {
      refreshHighlights(this);
      return;
    }
    this.data = reconciled.annotations;
    await this.saveAnnotations();
    this.refreshAnnotationViews(file);
    refreshHighlights(this);
  }
  editorForFile(file: TFile): Editor | null {
    return this.editorInFile(file.path);
  }
  editorInFile(filePath: string): Editor | null {
    const active = this.app.workspace.activeEditor;
    if (active?.file?.path === filePath && active.editor)
      return active.editor;
    let found: Editor | null = null;
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === filePath)
        found = view.editor;
    });
    return found;
  }
  /** 记下删除前的光标。确认框和侧栏重绘会把焦点带走。 */
  captureCaret(editor: Editor | null): EditorCaret | null {
    if (!editor)
      return null;
    return {
      editor,
      anchor: editor.getCursor("anchor"),
      head: editor.getCursor("head")
    };
  }
  restoreCaret(caret: EditorCaret | null) {
    if (!caret)
      return;
    const apply = () => {
      caret.editor.setSelection(caret.anchor, caret.head);
      caret.editor.focus();
    };
    const win = this.app.workspace.containerEl.ownerDocument.defaultView ?? window;
    win.requestAnimationFrame(() => {
      apply();
      win.setTimeout(apply, 30);
    });
  }
  async followRenamedPath(file: TAbstractFile, oldPath: string) {
    const isFolder = file instanceof TFolder;
    let changed = false;
    const remap = (path: string) => {
      if (path === oldPath)
        return file.path;
      if (isFolder && path.startsWith(`${oldPath}/`))
        return `${file.path}${path.slice(oldPath.length)}`;
      return path;
    };
    this.data = this.data.map((annotation) => {
      const filePath = remap(annotation.filePath);
      if (filePath === annotation.filePath)
        return annotation;
      changed = true;
      return { ...annotation, filePath };
    });
    this.groups = this.groups.map((group) => {
      const filePath = remap(group.filePath);
      if (filePath === group.filePath)
        return group;
      changed = true;
      return { ...group, filePath };
    });
    if (changed)
      await this.saveAnnotations();
  }
  async markDeletedPath(file: TAbstractFile) {
    const isFolder = file instanceof TFolder;
    const matches = (path: string) => path === file.path || (isFolder && path.startsWith(`${file.path}/`));
    let changed = false;
    this.data = this.data.map((annotation) => {
      if (!matches(annotation.filePath) || annotation.anchor === "file-missing")
        return annotation;
      changed = true;
      return { ...annotation, anchor: "file-missing" };
    });
    if (!changed)
      return;
    await this.saveAnnotations();
    this.refreshAnnotationViews(this.activeFile);
  }

  /** 快捷键和右键菜单共用：先在弹窗里写草稿，确认后才写入批注文件。 */
  openNoteComposer(draft: AnnotationDraft) {
    const modal = new NoteModal(this.app, this, {
      highlightedText: draft.highlightedText || "",
      color: draft.color || this.settings.defaultColor,
      noteContent: draft.noteContent || ""
    }, async (content, color, tags) => {
      const saved = await this.addAnnotation({
        ...draft,
        color,
        tags,
        noteContent: content.trim(),
        type: content.trim() ? "note" : "highlight",
        updated: Date.now()
      });
      if (!saved)
        return;
      this.pushAnnotationHistory("add", saved);
      new Notice(t("notifications.annotationSaved", this));
    });
    modal.open();
  }

  /** 批注中心和侧栏自己不拿来打开原文，避免管理页被笔记替换。 */
  leafForAnnotation(filePath: string): WorkspaceLeaf {
    const workspace = this.app.workspace;
    const blocked = new Set([VIEW_TYPE, VIEW_TYPE_LIBRARY]);
    let opened: WorkspaceLeaf | null = null;
    let fallback: WorkspaceLeaf | null = null;
    workspace.iterateAllLeaves((leaf) => {
      if (blocked.has(leaf.view.getViewType()))
        return;
      const view = leaf.view;
      if (!opened && view instanceof FileView && view.file?.path === filePath)
        opened = leaf;
      else if (!fallback)
        fallback = leaf;
    });
    if (opened)
      return opened;
    const active = workspace.getLeaf(false);
    if (active && !blocked.has(active.view.getViewType()))
      return active;
    if (fallback)
      return fallback;
    return workspace.getLeaf("split", "vertical");
  }
  async navigateToAnnotation(annotation: Annotation) {
    const file = this.app.vault.getAbstractFileByPath(annotation.filePath);
    if (!(file instanceof TFile)) {
      new Notice(t("notifications.fileNotFound", this));
      return;
    }
    const leaf = this.leafForAnnotation(annotation.filePath);
    await leaf.openFile(file);
    void this.app.workspace.revealLeaf(leaf);
    if (annotation.fileType === "pdf") {
      window.setTimeout(() => this.jumpToPdfAnnotation(annotation), 220);
      return;
    }
    this.waitForViewAndNavigate(annotation);
  }
  waitForViewAndNavigate(annotation: Annotation, retries = 10) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view?.editor && isMarkdownPosition(annotation.position)) {
      view.editor.setCursor({
        line: annotation.position.startLine,
        ch: annotation.position.startCh
      });
      view.editor.scrollIntoView(
        {
          from: { line: annotation.position.startLine, ch: annotation.position.startCh },
          to: { line: annotation.position.endLine, ch: annotation.position.endCh }
        },
        true
      );
      view.editor.focus();
    } else if (retries > 0) {
      window.setTimeout(() => this.waitForViewAndNavigate(annotation, retries - 1), 120);
    }
  }

  // ==================== 数据持久化 ====================

  // ==================== 标注 CRUD ====================

  // ==================== 分组管理 ====================

  setupMobileFab() {
    this.cleanupMobileFab();
    const container = document.body;
    if (!container)
      return;
    const fab = container.createEl("button", {
      cls: "aa-mobile-fab",
      text: "\u270D\uFE0F"
    });
    fab.setAttribute("aria-label", t("ui.fabAriaLabel", this));
    const panel = container.createDiv("aa-mobile-fab-panel");
    panel.addClass("is-hidden");
    const addBtn = panel.createEl("button", { text: t("ui.mobileHighlight", this) });
    addBtn.onclick = async () => {
      const md = this.app.workspace.getActiveViewOfType(MarkdownView);
      const editor = this.app.workspace.activeEditor?.editor;
      if (!md?.file || !editor) {
        new Notice(t("notifications.openEditableNote", this));
        return;
      }
      await this.highlightSelection(editor, md, this.settings.defaultColor);
    };
    const noteBtn = panel.createEl("button", { text: t("ui.mobileAddNote", this) });
    noteBtn.onclick = async () => {
      const md = this.app.workspace.getActiveViewOfType(MarkdownView);
      const editor = this.app.workspace.activeEditor?.editor;
      if (!md?.file || !editor) {
        new Notice(t("notifications.openEditableNote", this));
        return;
      }
      await this.addNoteToSelection(editor, md);
    };
    const sidebarBtn = panel.createEl("button", { text: t("ui.mobileSidebar", this) });
    sidebarBtn.onclick = () => this.activateSidebar();
    fab.onclick = (e) => {
      e.preventDefault();
      panel.toggleClass("is-hidden", !panel.hasClass("is-hidden"));
    };
    const dismiss = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Node))
        return;
      if (!panel.contains(target) && target !== fab) {
        panel.addClass("is-hidden");
      }
    };
    document.addEventListener("click", dismiss, true);
    this.register(() => document.removeEventListener("click", dismiss, true));
    this.mobileFabEl = fab;
    this.mobileFabPanelEl = panel;
  }
  cleanupMobileFab() {
    if (this.mobileFabPanelEl) {
      this.mobileFabPanelEl.remove();
      this.mobileFabPanelEl = null;
    }
    if (this.mobileFabEl) {
      this.mobileFabEl.remove();
      this.mobileFabEl = null;
    }
  }
  // ==================== 侧边栏管理 ====================
  async initSidebar() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (leaves.length === 0) {
      const leaf = this.app.workspace.getRightLeaf(false) || this.app.workspace.getLeaf("split", "vertical");
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE, active: true });
        void this.app.workspace.revealLeaf(leaf);
      }
    }
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView?.file) {
      this.activeFile = activeView.file;
      this.refreshAnnotationViews(activeView.file);
    }
  }
  async activateSidebar() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null | undefined = workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (!leaf) {
        leaf = workspace.getLeaf("split", "vertical");
      }
      if (leaf) {
        await leaf.setViewState({ type: VIEW_TYPE, active: true });
      }
    }
    if (leaf) {
      void workspace.revealLeaf(leaf);
    }
  }
  // ==================== 光标处的旧批注 ====================
  annotationAtCursor(editor: Editor, view: { file: TFile | null }): Annotation | null {
    if (!view.file)
      return null;
    return findMarkdownAnnotationAtCursor(this.getAnnotationsForFile(view.file.path), editor);
  }
  /** 选中这条批注的原文，并让侧边栏滚到对应卡片。 */
  selectAnnotationRange(editor: Editor, annotation: Annotation) {
    if (!isMarkdownPosition(annotation.position))
      return;
    const position = annotation.position;
    const from = { line: position.startLine, ch: position.startCh };
    const to = { line: position.endLine, ch: position.endCh };
    editor.setSelection(from, to);
    editor.scrollIntoView({ from, to }, true);
    this.getSidebarView()?.scrollToCard(annotation.id);
  }
  /** 还没对上、或已经对不上的记录，不拿旧行号去选正文。 */
  anchoredOk(annotation: Annotation): boolean {
    return annotation.anchor === "ok" || (annotation.fileType === "pdf" && annotation.anchor == null);
  }
  async revealUnanchored(annotation: Annotation) {
    new Notice(t("notifications.anchorLost", this));
    await this.activateSidebar();
    this.getSidebarView()?.scrollToCard(annotation.id);
  }
  async locateAnnotationAtCursor(editor: Editor, view: { file: TFile | null }) {
    const found = this.annotationAtCursor(editor, view);
    if (!found) {
      new Notice(t("notifications.cursorMiss", this));
      return;
    }
    if (!this.anchoredOk(found)) {
      await this.revealUnanchored(found);
      return;
    }
    this.selectAnnotationRange(editor, found);
    await this.activateSidebar();
    this.selectAnnotationRange(editor, found);
    new Notice(t("notifications.annotationLocated", this));
  }
  async editAnnotationAtCursor(editor: Editor, view: { file: TFile | null }) {
    const found = this.annotationAtCursor(editor, view);
    if (!found) {
      new Notice(t("notifications.cursorMiss", this));
      return;
    }
    if (!this.anchoredOk(found)) {
      await this.revealUnanchored(found);
      return;
    }
    this.selectAnnotationRange(editor, found);
    this.openNoteEditor(found);
  }
  async deleteAnnotationAtCursor(editor: Editor, view: { file: TFile | null }) {
    const found = this.annotationAtCursor(editor, view);
    if (!found) {
      new Notice(t("notifications.cursorMiss", this));
      return;
    }
    if (!this.anchoredOk(found)) {
      await this.revealUnanchored(found);
      return;
    }
    const caret = this.captureCaret(editor);
    await this.removeAnnotation(found.id, true);
    this.restoreCaret(caret);
    new Notice(t("notifications.annotationDeleted", this));
  }
  async reassignAnnotation(annotation: Annotation) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.file || !view.editor) {
      new Notice(t("notifications.openEditableNote", this));
      return;
    }
    const range = captureMarkdownRange(view.editor);
    if (!range) {
      new Notice(t("notifications.placeCursor", this));
      return;
    }
    const lines: string[] = [];
    for (let index = 0; index < view.editor.lineCount(); index++)
      lines.push(view.editor.getLine(index));
    const position = {
      startLine: range.from.line,
      startCh: range.from.ch,
      endLine: range.to.line,
      endCh: range.to.ch,
    };
    await this.updateAnnotation(annotation.id, {
      ...anchorFieldsForRange(lines, position, range.text),
      filePath: view.file.path,
      fileType: "markdown",
      position,
    });
    new Notice(t("notifications.reassigned", this));
  }
  /** 找已打开该文件的编辑器，把批注原文范围换算成视口坐标；文件没打开或 PDF 时返回 null。 */
  annotationDomRect(annotation: Annotation): { left: number; top: number; bottom: number; width: number } | null {
    if (!isMarkdownPosition(annotation.position))
      return null;
    const editor = this.editorInFile(annotation.filePath);
    if (!editor)
      return null;
    const cm = (editor as unknown as { cm?: { coordsAtPos?: (pos: number, side: number) => { left: number; right: number; top: number; bottom: number } | null } }).cm;
    if (!cm?.coordsAtPos)
      return null;
    try {
      const position = annotation.position;
      const start = cm.coordsAtPos(editor.posToOffset({ line: position.startLine, ch: position.startCh }), -1);
      const end = cm.coordsAtPos(editor.posToOffset({ line: position.endLine, ch: position.endCh }), 1);
      if (!start || !end)
        return null;
      const left = Math.min(start.left, end.left);
      return { left, top: Math.min(start.top, end.top), bottom: Math.max(start.bottom, end.bottom), width: Math.max(40, Math.abs(end.right - left)) };
    } catch {
      return null;
    }
  }
  /** 修改已有批注或高亮的颜色和文字，不新建一条。 */
  openNoteEditor(existing: Annotation) {
    const modal = new NoteModal(this.app, this, {
      highlightedText: existing.highlightedText,
      color: existing.color,
      noteContent: existing.noteContent,
      tags: existing.tags ?? [],
      anchorRect: this.annotationDomRect(existing)
    }, async (content, color, tags) => {
      const current = this.data.find((item) => item.id === existing.id);
      if (!current)
        return;
      const before = JSON.parse(JSON.stringify(current)) as Annotation;
      const noteContent = content.trim();
      await this.updateAnnotation(existing.id, {
        noteContent,
        color,
        tags,
        type: noteContent ? "note" : "highlight"
      });
      const next = this.data.find((item) => item.id === existing.id);
      if (!next)
        return;
      const tagsChanged = (before.tags ?? []).join("\0") !== next.tags.join("\0");
      if (next.noteContent !== before.noteContent || next.color !== before.color || next.type !== before.type || tagsChanged)
        this.pushAnnotationHistory("update", next, before);
      new Notice(t("notifications.annotationSaved", this));
    });
    modal.open();
  }
  addCursorAnnotationMenuItems(menu: Menu, editor: Editor, view: { file: TFile | null }) {
    const found = this.annotationAtCursor(editor, view);
    if (!found)
      return;
    menu.addSeparator();
    menu.addItem((item) => {
      item.setIcon("pencil");
      item.setTitle(t("commands.editAtCursor", this));
      item.onClick(() => {
        void this.editAnnotationAtCursor(editor, view);
      });
    });
    menu.addItem((item) => {
      item.setIcon("trash");
      item.setTitle(t("commands.deleteAtCursor", this));
      item.onClick(() => {
        void this.deleteAnnotationAtCursor(editor, view);
      });
    });
  }
  // ==================== 右键菜单 ====================
  addAnnotationMenuItems(menu: Menu, editor: Editor, view: { file: TFile | null }) {
    menu.addSeparator();
    this.settings.colors.forEach((color) => {
      menu.addItem((item) => {
        item.setIcon("pen-tool");
        item.setTitle(`${t("ui.highlight", this)} ${getColorName(color, this) || color}`);
        item.onClick(() => this.highlightSelection(editor, view, color));
      });
    });
    // 自定义颜色（如果已设置）
    if (this.settings.customHighlightColor && validateHexColor(this.settings.customHighlightColor)) {
      const colorName = this.settings.customHighlightColorName || t("ui.customColor", this);
      menu.addItem((item) => {
        item.setIcon("pen-tool");
        item.setTitle(`${t("ui.highlight", this)} ${colorName} (${this.settings.customHighlightColor})`);
        item.onClick(() => this.highlightSelection(editor, view, this.settings.customHighlightColor));
      });
    }
    menu.addSeparator();
    menu.addItem((item) => {
      item.setIcon("sticky-note");
      item.setTitle(t("ui.pdfAddNote", this));
      item.onClick(() => this.addNoteToSelection(editor, view));
    });
  }
  // ==================== 高亮操作 ====================
  async highlightSelection(editor: Editor, view: { file: TFile | null }, color: string) {
    if (!view.file)
      return;
    const range = captureMarkdownRange(editor);
    if (!range) {
      new Notice(t("notifications.placeCursor", this));
      return;
    }
    const existing = this.getAnnotationsForFile(view.file.path);
    const overlap = existing.some(
      (a) => (a.anchor == null || a.anchor === "ok") && isMarkdownPosition(a.position) && positionsOverlap(a.position, {
        startLine: range.from.line,
        startCh: range.from.ch,
        endLine: range.to.line,
        endCh: range.to.ch
      })
    );
    if (overlap) {
      new Notice(t("notifications.annotationExists", this));
      return;
    }
    const position = {
      startLine: range.from.line,
      startCh: range.from.ch,
      endLine: range.to.line,
      endCh: range.to.ch
    };
    const lines: string[] = [];
    for (let index = 0; index < editor.lineCount(); index++)
      lines.push(editor.getLine(index));
    const annotation = {
      id: generateId(),
      filePath: view.file.path,
      type: "highlight",
      color,
      noteContent: "",
      ...anchorFieldsForRange(lines, position, range.text),
      position,
      created: Date.now(),
      updated: Date.now(),
      order: Date.now()
    };
    const saved = await this.addAnnotation(annotation);
    if (saved)
      this.pushAnnotationHistory("add", saved);
    new Notice(t("notifications.highlightAdded", this).replace("${color}", getColorName(color, this)));
  }
  // ==================== 批注操作 ====================
  async addNoteToSelection(editor: Editor, view: { file: TFile | null }) {
    if (!view.file)
      return;
    const range = captureMarkdownRange(editor);
    if (!range) {
      new Notice(t("notifications.placeCursor", this));
      return;
    }
    const overlap = this.getAnnotationsForFile(view.file.path).some(
      (a) => (a.anchor == null || a.anchor === "ok") && isMarkdownPosition(a.position) && positionsOverlap(a.position, {
        startLine: range.from.line,
        startCh: range.from.ch,
        endLine: range.to.line,
        endCh: range.to.ch
      })
    );
    if (overlap) {
      new Notice(t("notifications.annotationExists", this));
      return;
    }
    const position = {
      startLine: range.from.line,
      startCh: range.from.ch,
      endLine: range.to.line,
      endCh: range.to.ch
    };
    const lines: string[] = [];
    for (let index = 0; index < editor.lineCount(); index++)
      lines.push(editor.getLine(index));
    const annotation = {
      id: generateId(),
      filePath: view.file.path,
      type: "note",
      color: this.settings.defaultColor,
      noteContent: "",
      ...anchorFieldsForRange(lines, position, range.text),
      position,
      created: Date.now(),
      updated: Date.now(),
      order: Date.now()
    };
    this.openNoteComposer(annotation);
  }
  // ==================== 导出 ====================
  /** 批注中心菜单：把全库批注按文件分组导出到一个 Markdown 文件。 */
  async exportAllAnnotations() {
    if (this.data.length === 0) {
      new Notice(t("notifications.noAnnotations", this));
      return;
    }
    const byFile = new Map<string, Annotation[]>();
    for (const annotation of this.data) {
      const list = byFile.get(annotation.filePath) ?? [];
      list.push(annotation);
      byFile.set(annotation.filePath, list);
    }
    let content = t("export.title", this).replace("${name}", t("ui.libraryTitle", this));
    content += `> ${t("export.exportTime", this)}${(/* @__PURE__ */ new Date()).toLocaleString()}
`;
    content += `> ${t("export.totalCount", this)}${this.data.length}${t("export.items", this)}

---

`;
    for (const [filePath, annotations] of [...byFile.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      content += `## 📄 ${filePath}

`;
      [...annotations].sort(compareByDocumentPosition).forEach((annotation, index) => {
        const colorName = getColorName(annotation.color, this) || t("ui.highlights", this);
        const hasNote = annotation.noteContent ? "\u{1F4DD}" : "\u{1F506}";
        content += `### ${index + 1}. ${hasNote} ${colorName}

`;
        content += `> “${annotation.highlightedText}”

`;
        if (annotation.noteContent)
          content += `${t("export.note", this)}${annotation.noteContent}

`;
        content += `${t("export.location", this)}${getAnnotationLocationLabel(annotation, this)}*

`;
      });
    }
    const exportPath = "scholiast-export.md";
    const existing = this.app.vault.getAbstractFileByPath(exportPath);
    if (existing instanceof TFile)
      await this.app.vault.modify(existing, content);
    else
      await this.app.vault.create(exportPath, content);
    new Notice(`${t("notifications.exportDone", this)}${exportPath}`);
  }
  async exportAnnotations() {
    const file = this.activeFile;
    if (!file) {
      new Notice(t("notifications.openFileFirst", this));
      return;
    }
    const annotations = this.getAnnotationsForFile(file.path);
    if (annotations.length === 0) {
      new Notice(t("notifications.noAnnotations", this));
      return;
    }
    const sorted = [...annotations].sort(compareByDocumentPosition);
    let content = t("export.title", this).replace("${name}", file.basename);
    content += `> ${t("export.exportTime", this)}${(/* @__PURE__ */ new Date()).toLocaleString()}
`;
    content += `> ${t("export.totalCount", this)}${sorted.length}${t("export.items", this)}

`;
    content += `---

`;
    sorted.forEach((a, i) => {
      const colorName = getColorName(a.color, this) || t("ui.highlights", this);
      const hasNote = a.noteContent ? "\u{1F4DD}" : "\u{1F506}";
      content += `## ${i + 1}. ${hasNote} ${colorName}

`;
      content += `> \u201C${a.highlightedText}\u201D

`;
      if (a.noteContent) {
        content += `${t("export.note", this)}${a.noteContent}

`;
      }
      content += `${t("export.location", this)}${getAnnotationLocationLabel(a, this)}*
`;
      content += `${t("export.fileType", this)}${a.fileType === "pdf" ? t("export.pdf", this) : t("export.markdown", this)}*
`;
      content += `${t("export.time", this)}${formatTime(a.created, this)}*

`;
      content += `---

`;
    });
    const exportPath = `${file.parent?.path || ""}/${file.basename}${t("export.fileSuffix", this)}`;
    let exportFile;
    try {
      const existing = this.app.vault.getAbstractFileByPath(exportPath);
      if (existing instanceof TFile) {
        await this.app.vault.modify(existing, content);
        exportFile = existing;
      } else {
        exportFile = await this.app.vault.create(exportPath, content);
      }
    } catch {
      exportFile = await this.app.vault.create(exportPath, content);
    }
    new Notice(`${t("notifications.exportDone", this)}${exportFile.path}`);
    const leaf = this.app.workspace.getLeaf(false);
    if (leaf) {
      await leaf.openFile(exportFile);
    }
  }
  // ==================== 搜索 ====================
  openSearchModal() {
    const modal = new SearchModal(this.app, this);
    modal.open();
  }
  async openAnnotationLibrary() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null | undefined = workspace.getLeavesOfType(VIEW_TYPE_LIBRARY)[0];
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      if (leaf)
        await leaf.setViewState({ type: VIEW_TYPE_LIBRARY, active: true });
    }
    if (leaf)
      void workspace.revealLeaf(leaf);
  }
  getSidebarView(): AnnotatorSidebarView | null {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof AnnotatorSidebarView)
        return leaf.view;
    }
    return null;
  }
  refreshAnnotationViews(file: TFile | null = this.activeFile) {
    this.getSidebarView()?.update(file);
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_LIBRARY)) {
      if (leaf.view instanceof AnnotationLibraryView)
        leaf.view.render();
    }
  }
  /** 改颜色或标签时记下撤销前的样子。保存格式仍走原来的 updateAnnotation。 */
  async commitAnnotationUpdate(id: string, updates: Partial<AnnotationDraft>) {
    const current = this.data.find((item) => item.id === id);
    if (!current)
      return;
    const before = JSON.parse(JSON.stringify(current)) as Annotation;
    await this.updateAnnotation(id, updates);
    const next = this.data.find((item) => item.id === id);
    if (!next)
      return;
    const beforeTags = before.tags ?? [];
    const tagsChanged = beforeTags.join("\0") !== next.tags.join("\0");
    if (next.noteContent !== before.noteContent || next.color !== before.color || next.type !== before.type || tagsChanged)
      this.pushAnnotationHistory("update", next, before);
  }
  async copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      new Notice(t("ui.copied", this));
    } catch {
      new Notice(t("ui.copyFailed", this));
    }
  }
  copyObsidianLink(annotation: Annotation) {
    const vault = this.app.vault.getName();
    const url = `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(annotation.filePath)}`;
    void this.copyText(url);
  }
  async convertAnnotationToNote(annotation: Annotation) {
    const parts = annotation.filePath.split("/");
    parts.pop();
    const folder = parts.join("/");
    const title = noteTitleFromQuote(annotation.highlightedText, t("ui.note", this));
    let path = normalizePath(folder ? `${folder}/${title}.md` : `${title}.md`);
    let index = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = normalizePath(folder ? `${folder}/${title} ${index}.md` : `${title} ${index}.md`);
      index += 1;
    }
    const quote = annotation.highlightedText.replace(/\r\n/g, "\n").split("\n").map((line) => `> ${line}`).join("\n");
    const source = annotation.filePath.replace(/\.md$/i, "");
    const note = annotation.noteContent.trim();
    const body = `${quote}\n\n${note ? `${note}\n\n` : ""}${t("ui.noteSource", this)}：[[${source}]]\n`;
    try {
      const created = await this.app.vault.create(path, body);
      new Notice(t("ui.noteCreated", this));
      const leaf = this.app.workspace.getLeaf("tab");
      if (leaf)
        await leaf.openFile(created);
    } catch {
      new Notice(t("notifications.fileNotFound", this));
    }
  }
  getActivePdfView() : FileView | null {
    return pdf.getActivePdfView(this);
  }
  getPdfContainer(view: FileView | null = this.getActivePdfView()) {
    return pdf.getPdfContainer(this, view);
  }
  getPdfPageSelector(page: number) {
    return pdf.getPdfPageSelector(this, page);
  }
  clearPdfRenderTimers() {
    return pdf.clearPdfRenderTimers(this);
  }
  schedulePdfRender(filePath: string | undefined = this.activeFile?.path, delay = 80) {
    return pdf.schedulePdfRender(this, filePath, delay);
  }
  bindPdfContextMenus() {
    return pdf.bindPdfContextMenus(this);
  }
  capturePdfSelection() {
    return pdf.capturePdfSelection(this);
  }
  addPdfAnnotationMenuItems(menu: Menu, selection: PdfSelection) {
    return pdf.addPdfAnnotationMenuItems(this, menu, selection);
  }
  createPdfAnnotation(selection: PdfSelection, color: string, type = "highlight") {
    return pdf.createPdfAnnotation(this, selection, color, type);
  }
  async highlightPdfSelection(selection: PdfSelection | null, color: string) {
    return pdf.highlightPdfSelection(this, selection, color);
  }
  async addNoteToPdfSelection(selection: PdfSelection | null) {
    return pdf.addNoteToPdfSelection(this, selection);
  }
  clearPdfHighlightLayers(filePath: string | null = null) {
    return pdf.clearPdfHighlightLayers(this, filePath);
  }
  renderPdfHighlights(filePath = this.activeFile?.path) {
    return pdf.renderPdfHighlights(this, filePath);
  }
  jumpToPdfAnnotation(annotation: Annotation) {
    return pdf.jumpToPdfAnnotation(this, annotation);
  }
  getAnnotationStorePath() {
    return store.getAnnotationStorePath(this);
  }
  getLegacyAnnotationStorePath() {
    return store.getLegacyAnnotationStorePath(this);
  }
  async ensureAnnotationStoreDir() {
    return store.ensureAnnotationStoreDir(this);
  }
  async readAnnotationStoreFile(filePath: string) : Promise<AnnotationStoreData | null> {
    return store.readAnnotationStoreFile(this, filePath);
  }
  async readAvailableAnnotationStore() {
    return store.readAvailableAnnotationStore(this);
  }
  getAnnotationStoreCollections(data: AnnotationStoreData | null | undefined) {
    return store.getAnnotationStoreCollections(this, data);
  }
  hasAnnotationStoreContent(data: AnnotationStoreData | null | undefined) {
    return store.hasAnnotationStoreContent(this, data);
  }
  applyAnnotationStoreData(data: AnnotationStoreData | null | undefined) {
    return store.applyAnnotationStoreData(this, data);
  }
  async readAnnotationStore() {
    return store.readAnnotationStore(this);
  }
  async writeAnnotationStore(data: AnnotationStoreData) {
    return store.writeAnnotationStore(this, data);
  }
  async readLegacyPluginData() {
    return store.readLegacyPluginData(this);
  }
  async writeLegacyPluginData(data: object) {
    return store.writeLegacyPluginData(this, data);
  }
  async migrateLegacyPluginData(settingsFallback: AnnotatorSettings | null = null) {
    return store.migrateLegacyPluginData(this, settingsFallback);
  }
  async loadSettingsAndData() {
    return store.loadSettingsAndData(this);
  }
  async reloadAnnotationStoreFromVault() {
    return store.reloadAnnotationStoreFromVault(this);
  }
  async persistAll() {
    return store.persistAll(this);
  }
  async saveAnnotations() {
    return store.saveAnnotations(this);
  }
  async saveSettings() {
    return store.saveSettings(this);
  }
  getActiveFilePath() {
    return store.getActiveFilePath(this);
  }
  getAnnotationsForFile(filePath: string) {
    return store.getAnnotationsForFile(this, filePath);
  }
  async addAnnotation(annotation: AnnotationDraft | null | undefined) : Promise<Annotation | null> {
    return store.addAnnotation(this, annotation);
  }
  async removeAnnotation(id: string, recordHistory = false) {
    return store.removeAnnotation(this, id, recordHistory);
  }
  pushAnnotationHistory(type: AnnotationHistoryOp["type"], annotation: Annotation, previous?: Annotation) {
    return store.pushAnnotationHistory(this, type, annotation, previous);
  }
  async applyAnnotationHistory(op: AnnotationHistoryOp) {
    return store.applyAnnotationHistory(this, op);
  }
  async updateAnnotation(id: string, updates: Partial<AnnotationDraft>) {
    return store.updateAnnotation(this, id, updates);
  }
  async clearFileAnnotations() {
    return store.clearFileAnnotations(this);
  }
  getGroupsForFile(filePath: string) {
    return store.getGroupsForFile(this, filePath);
  }
  async addGroup(name: string, filePath: string) {
    return store.addGroup(this, name, filePath);
  }
  async removeGroup(groupId: string) {
    return store.removeGroup(this, groupId);
  }
  async renameGroup(groupId: string, newName: string) {
    return store.renameGroup(this, groupId, newName);
  }
  async updateGroup(groupId: string, updates: Partial<HighlightGroup>) {
    return store.updateGroup(this, groupId, updates);
  }
  async addAnnotationToGroup(annotationId: string, groupId: string) {
    return store.addAnnotationToGroup(this, annotationId, groupId);
  }
  async removeAnnotationFromGroup(annotationId: string) {
    return store.removeAnnotationFromGroup(this, annotationId);
  }
  getAnnotationsForGroup(groupId: string) {
    return store.getAnnotationsForGroup(this, groupId);
  }
};
