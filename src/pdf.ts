/** PDF 页面上的选区、高亮层和右键菜单。 */
import { FileView, Menu, Notice } from "obsidian";
import type ArticleAnnotator from "./main";
import {
  generateId,
  getFileType,
  isPdfPosition,
  normalizeAnnotation,
  normalizeRect,
} from "./annotation-model";
import { getColorName, t } from "./i18n";
import type { Annotation, PdfPosition, PdfRect, PdfSelection } from "./types";

function getPdfPageElementFromNode(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element))
    return null;
  const page = node.closest(".page[data-page-number], [data-page-number].page, .pdf-page, [data-page-number]");
  return page instanceof HTMLElement ? page : null;
}
function getPdfPageNumber(pageEl: Element | null): number | null {
  if (!(pageEl instanceof Element))
    return null;
  const datasetPage = pageEl instanceof HTMLElement ? pageEl.dataset.pageNumber : undefined;
  const raw = pageEl.getAttribute("data-page-number") || datasetPage || pageEl.getAttribute("data-page") || pageEl.getAttribute("aria-label")?.match(/\d+/)?.[0];
  const page = Number(raw);
  return Number.isFinite(page) ? page : null;
}
function getPdfPageRect(pageEl: Element | null): DOMRect | null {
  if (!(pageEl instanceof HTMLElement))
    return null;
  const rect = pageEl.getBoundingClientRect();
  if (!rect.width || !rect.height)
    return null;
  return rect;
}
function ensurePdfLayer(pageEl: Element | null): HTMLElement | null {
  if (!(pageEl instanceof HTMLElement))
    return null;
  const existing = pageEl.querySelector(":scope > .aa-pdf-highlight-layer");
  if (existing instanceof HTMLElement) {
    return existing;
  }
  const layer = pageEl.ownerDocument.createElement("div");
  layer.className = "aa-pdf-highlight-layer";
  const position = window.getComputedStyle(pageEl).position;
  if (!position || position === "static") {
    pageEl.style.position = "relative";
  }
  pageEl.appendChild(layer);
  return layer;
}

export function getActivePdfView(plugin: ArticleAnnotator) : FileView | null {
    const leaves = plugin.app.workspace.getLeavesOfType("pdf");
    const activeLeaf = plugin.app.workspace.activeLeaf;
    const activeView = activeLeaf?.view;
    if (activeView instanceof FileView && activeView.file?.extension === "pdf")
      return activeView;
    const matching = leaves.find((leaf) => leaf.view instanceof FileView && leaf.view.file?.path === plugin.activeFile?.path);
    return matching?.view instanceof FileView ? matching.view : null;
  }

export function getPdfContainer(plugin: ArticleAnnotator, view: FileView | null = plugin.getActivePdfView()) {
    const container = view?.containerEl || view?.contentEl || null;
    if (!(container instanceof HTMLElement))
      return null;
    return container.querySelector(".pdf-view-container, .pdf-container, .mod-pdf .view-content, .view-content") || container;
  }

export function getPdfPageSelector(plugin: ArticleAnnotator, page: number) {
    return `.page[data-page-number="${page}"], [data-page-number="${page}"].page, [data-page-number="${page}"]`;
  }

export function clearPdfRenderTimers(plugin: ArticleAnnotator) {
    for (const timer of plugin.pdfRenderTimers.values()) {
      clearTimeout(timer);
    }
    plugin.pdfRenderTimers.clear();
  }

export function schedulePdfRender(plugin: ArticleAnnotator, filePath: string | undefined = plugin.activeFile?.path, delay = 80) {
    if (!filePath)
      return;
    const existing = plugin.pdfRenderTimers.get(filePath);
    if (existing)
      clearTimeout(existing);
    const timer = setTimeout(() => {
      plugin.pdfRenderTimers.delete(filePath);
      plugin.renderPdfHighlights(filePath);
    }, delay);
    plugin.pdfRenderTimers.set(filePath, timer);
  }

export function bindPdfContextMenus(plugin: ArticleAnnotator) {
    if (plugin.pdfContextMenuHandler)
      return;
    plugin.pdfContextMenuHandler = (event) => {
      const target = event.target;
      const pageEl = getPdfPageElementFromNode(target);
      const view = plugin.getActivePdfView();
      const file = view?.file;
      if (!pageEl || !file || getFileType(file) !== "pdf")
        return;
      const selection = plugin.capturePdfSelection();
      if (!selection || selection.filePath !== file.path)
        return;
      event.preventDefault();
      event.stopPropagation();
      const menu = new Menu();
      plugin.addPdfAnnotationMenuItems(menu, selection);
      menu.showAtMouseEvent(event);
    };
    plugin.registerDomEvent(document, "contextmenu", plugin.pdfContextMenuHandler, true);
    plugin.registerDomEvent(document, "selectionchange", () => {
      if (plugin.activeFile?.extension === "pdf")
        plugin.schedulePdfRender();
    });
  }

export function capturePdfSelection(plugin: ArticleAnnotator) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
      return null;
    const text = selection.toString().trim();
    if (!text)
      return null;
    const range = selection.getRangeAt(0);
    const startPage = getPdfPageElementFromNode(range.startContainer);
    const endPage = getPdfPageElementFromNode(range.endContainer);
    if (!startPage || !endPage)
      return null;
    if (startPage !== endPage) {
      new Notice(t("notifications.crossPageNotSupported", plugin));
      return null;
    }
    const page = getPdfPageNumber(startPage);
    const pageRect = getPdfPageRect(startPage);
    const filePath = plugin.activeFile?.path;
    if (!filePath || !page || !pageRect)
      return null;
    const rawRects = Array.from(range.getClientRects());
    const rects = rawRects.map((rect) => {
      const normalized = normalizeRect({
        x: (rect.left - pageRect.left) / pageRect.width,
        y: (rect.top - pageRect.top) / pageRect.height,
        width: rect.width / pageRect.width,
        height: rect.height / pageRect.height
      });
      return normalized;
    }).filter((rect): rect is PdfRect => rect !== null);
    if (rects.length === 0)
      return null;
    return {
      filePath,
      page,
      highlightedText: text,
      rects,
      pageLabel: startPage.getAttribute("data-page-label") || String(page),
      viewportBase: {
        pageWidth: pageRect.width,
        pageHeight: pageRect.height
      }
    };
  }

export function addPdfAnnotationMenuItems(plugin: ArticleAnnotator, menu: Menu, selection: PdfSelection) {
    menu.addSeparator();
    plugin.settings.colors.forEach((color) => {
      menu.addItem((item) => {
        item.setIcon("pen-tool");
        item.setTitle(`${t("ui.highlight", plugin)} ${getColorName(color, plugin) || color}`);
        item.onClick(() => plugin.highlightPdfSelection(selection, color));
      });
    });
    menu.addSeparator();
    menu.addItem((item) => {
      item.setIcon("sticky-note");
      item.setTitle(t("ui.pdfAddNote", plugin));
      item.onClick(() => plugin.addNoteToPdfSelection(selection));
    });
  }

export function createPdfAnnotation(plugin: ArticleAnnotator, selection: PdfSelection, color: string, type = "highlight") {
    return normalizeAnnotation({
      id: generateId(),
      filePath: selection.filePath,
      fileType: "pdf",
      type,
      color,
      highlightedText: selection.highlightedText,
      noteContent: "",
      position: {
        kind: "pdf",
        page: selection.page,
        rects: selection.rects,
        quote: selection.highlightedText,
        pageLabel: selection.pageLabel,
        viewportBase: selection.viewportBase
      },
      created: Date.now(),
      updated: Date.now(),
      order: Date.now()
    });
  }

export async function highlightPdfSelection(plugin: ArticleAnnotator, selection: PdfSelection | null, color: string) {
    if (!selection)
      return;
    const existing = plugin.getAnnotationsForFile(selection.filePath).filter((ann): ann is Annotation & { position: PdfPosition } => ann.fileType === "pdf" && isPdfPosition(ann.position) && ann.position.page === selection.page);
    const overlap = existing.some((ann) => ann.position.rects.some((rect) => selection.rects.some((candidate) => !(rect.x + rect.width <= candidate.x || candidate.x + candidate.width <= rect.x || rect.y + rect.height <= candidate.y || candidate.y + candidate.height <= rect.y))));
    if (overlap) {
      new Notice(t("notifications.annotationExists", plugin));
      return;
    }
    const annotation = plugin.createPdfAnnotation(selection, color, "highlight");
    if (!annotation)
      return;
    await plugin.addAnnotation(annotation);
    new Notice(t("notifications.highlightAdded", plugin).replace("${color}", getColorName(color, plugin) || color));
  }

export async function addNoteToPdfSelection(plugin: ArticleAnnotator, selection: PdfSelection | null) {
    if (!selection)
      return;
    const annotation = plugin.createPdfAnnotation(selection, plugin.settings.defaultColor, "note");
    if (!annotation)
      return;
    plugin.openNoteComposer(annotation);
  }

export function clearPdfHighlightLayers(plugin: ArticleAnnotator, filePath: string | null = null) {
    const root = plugin.app.workspace.containerEl;
    if (!(root instanceof HTMLElement))
      return;
    root.querySelectorAll(".aa-pdf-highlight-layer").forEach((layer) => {
      const owner = layer.getAttribute("data-file-path");
      if (!filePath || owner === filePath)
        layer.remove();
    });
  }

export function renderPdfHighlights(plugin: ArticleAnnotator, filePath = plugin.activeFile?.path) {
    if (!filePath)
      return;
    const view = plugin.getActivePdfView();
    if (!view?.file || view.file.path !== filePath)
      return;
    const container = plugin.getPdfContainer(view);
    if (!(container instanceof HTMLElement))
      return;
    const pageElements = container.querySelectorAll('.page[data-page-number], [data-page-number].page, .pdf-page, [data-page-number]');
    if (!pageElements.length)
      return;
    const annotations = plugin.getAnnotationsForFile(filePath).filter((ann): ann is Annotation & { position: PdfPosition } => ann.fileType === "pdf" && isPdfPosition(ann.position));
    pageElements.forEach((pageEl) => {
      if (!(pageEl instanceof HTMLElement))
        return;
      const page = getPdfPageNumber(pageEl);
      const layer = ensurePdfLayer(pageEl);
      if (!page || !layer)
        return;
      layer.setAttribute("data-file-path", filePath);
      layer.empty();
      const pageRect = getPdfPageRect(pageEl);
      if (!pageRect)
        return;
      annotations.filter((ann) => ann.position.page === page).forEach((ann) => {
        ann.position.rects.forEach((rect) => {
          const el = layer.createDiv("aa-pdf-highlight");
          el.style.left = `${rect.x * 100}%`;
          el.style.top = `${rect.y * 100}%`;
          el.style.width = `${rect.width * 100}%`;
          el.style.height = `${rect.height * 100}%`;
          el.style.setProperty("--aa-accent", ann.color);
          el.setAttribute("data-annotation-id", ann.id);
          el.setAttribute("title", ann.noteContent || ann.highlightedText);
        });
      });
    });
  }

export function jumpToPdfAnnotation(plugin: ArticleAnnotator, annotation: Annotation) {
    if (annotation.fileType !== "pdf" || !isPdfPosition(annotation.position))
      return;
    const view = plugin.getActivePdfView();
    const container = plugin.getPdfContainer(view);
    if (!(container instanceof HTMLElement))
      return;
    const pageEl = container.querySelector(plugin.getPdfPageSelector(annotation.position.page));
    if (!(pageEl instanceof HTMLElement)) {
      const fallback = container.querySelector(`[data-page-number], .page, .pdf-page`);
      if (fallback instanceof HTMLElement) {
        fallback.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      plugin.schedulePdfRender(annotation.filePath, 200);
      return;
    }
    pageEl.scrollIntoView({ behavior: "smooth", block: "center" });
    plugin.renderPdfHighlights(annotation.filePath);
    const marker = pageEl.querySelector(`.aa-pdf-highlight[data-annotation-id="${annotation.id}"]`);
    if (marker instanceof HTMLElement) {
      marker.classList.add("is-active");
      setTimeout(() => marker.classList.remove("is-active"), 1600);
    }
  }
