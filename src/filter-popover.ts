/** 侧栏和批注中心共用的筛选弹出层。草稿式：点“应用”才生效。 */
import { setIcon } from "obsidian";
import { getColorName, t } from "./i18n";
import { defaultAnnotationFilter, type AnnotationFilter, type AnnotationSort } from "./annotation-query";
import type { Annotation } from "./types";

interface FilterHost {
  settings?: { language?: string };
}

export interface FilterPopoverExtras {
  showSort?: boolean;
  timeRange?: "all" | "today" | "week";
  onTimeRange?: (range: "all" | "today" | "week") => void;
}

export function mountFilterPopover(
  row: HTMLElement,
  annotations: Annotation[],
  filter: AnnotationFilter,
  plugin: FilterHost,
  onApply: (filter: AnnotationFilter) => void,
  onClose: () => void,
  extras?: FilterPopoverExtras
): HTMLElement {
  const draft: AnnotationFilter = { ...filter, colors: [...filter.colors], tags: [...filter.tags] };
  let draftTime = extras?.timeRange ?? "all";
  const popover = row.createDiv("aa-filter-popover");
  const closeBtn = popover.createEl("button", {
    cls: "aa-filter-close",
    attr: { type: "button", "aria-label": t("ui.close", plugin) }
  });
  setIcon(closeBtn, "x");
  closeBtn.onclick = (evt) => {
    evt.preventDefault();
    onClose();
  };
  if (extras?.showSort !== false) {
    popover.createDiv({ cls: "aa-filter-label", text: t("ui.sort", plugin) });
    const sorts: Array<{ id: AnnotationSort; key: string }> = [
      { id: "position", key: "ui.sortPosition" },
      { id: "created", key: "ui.sortCreated" },
      { id: "updated", key: "ui.sortUpdated" }
    ];
    const syncSort = () => {
      popover.querySelectorAll(".aa-filter-sort").forEach((el) => {
        const button = el as HTMLButtonElement;
        const active = button.dataset.sort === draft.sort;
        button.classList.toggle("is-selected", active);
        button.setAttr("aria-pressed", active ? "true" : "false");
      });
    };
    for (const sort of sorts) {
      const button = popover.createEl("button", {
        cls: "aa-filter-option aa-filter-sort",
        text: t(sort.key, plugin),
        attr: { type: "button", "data-sort": sort.id, "aria-pressed": draft.sort === sort.id ? "true" : "false" }
      });
      if (draft.sort === sort.id)
        button.addClass("is-selected");
      button.onclick = (evt) => {
        evt.preventDefault();
        draft.sort = sort.id;
        syncSort();
      };
    }
  }
  const colors = [...new Set(annotations.map((annotation) => annotation.color))];
  if (colors.length > 0) {
    popover.createDiv({ cls: "aa-filter-label", text: t("ui.filterColor", plugin) });
    const colorRow = popover.createDiv("aa-filter-colors");
    for (const color of colors) {
      const swatch = colorRow.createEl("button", {
        cls: "aa-filter-swatch",
        attr: {
          type: "button",
          "aria-label": getColorName(color, plugin) || color,
          "aria-pressed": draft.colors.includes(color) ? "true" : "false"
        }
      });
      swatch.style.setProperty("--aa-accent", color);
      if (draft.colors.includes(color))
        swatch.addClass("is-selected");
      swatch.onclick = (evt) => {
        evt.preventDefault();
        const selected = new Set(draft.colors);
        if (selected.has(color))
          selected.delete(color);
        else
          selected.add(color);
        draft.colors = [...selected];
        swatch.classList.toggle("is-selected", selected.has(color));
        swatch.setAttr("aria-pressed", selected.has(color) ? "true" : "false");
      };
    }
  }
  const tagCounts = new Map<string, number>();
  for (const annotation of annotations)
    for (const tag of annotation.tags ?? [])
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  const tags = [...tagCounts.keys()].sort((a, b) => (tagCounts.get(b) ?? 0) - (tagCounts.get(a) ?? 0));
  if (tags.length > 0) {
    popover.createDiv({ cls: "aa-filter-label", text: t("ui.filterTag", plugin) });
    const tagRow = popover.createDiv("aa-filter-tags");
    for (const tag of tags) {
      const chip = tagRow.createEl("button", {
        cls: "aa-filter-chip",
        attr: { type: "button", "aria-pressed": draft.tags.includes(tag) ? "true" : "false" }
      });
      chip.createSpan({ text: tag });
      chip.createSpan({ cls: "aa-filter-chip-count", text: String(tagCounts.get(tag) ?? 0) });
      if (draft.tags.includes(tag))
        chip.addClass("is-selected");
      chip.onclick = (evt) => {
        evt.preventDefault();
        const selected = new Set(draft.tags);
        if (selected.has(tag))
          selected.delete(tag);
        else
          selected.add(tag);
        draft.tags = [...selected];
        chip.classList.toggle("is-selected", selected.has(tag));
        chip.setAttr("aria-pressed", selected.has(tag) ? "true" : "false");
      };
    }
  }
  popover.createDiv({ cls: "aa-filter-label", text: t("ui.filterOther", plugin) });
  mountFilterToggle(popover, draft, "notesOnly", t("ui.notesOnly", plugin), (value) => {
    draft.notesOnly = value;
  });
  mountFilterToggle(popover, draft, "tagsOnly", t("ui.tagsOnly", plugin), (value) => {
    draft.tagsOnly = value;
  });
  if (extras?.onTimeRange) {
    popover.createDiv({ cls: "aa-filter-label", text: t("ui.filterTime", plugin) });
    const ranges: Array<{ id: "all" | "today" | "week"; key: string }> = [
      { id: "all", key: "ui.timeAll" },
      { id: "today", key: "ui.timeToday" },
      { id: "week", key: "ui.timeWeek" }
    ];
    for (const range of ranges) {
      const button = popover.createEl("button", {
        cls: "aa-filter-option aa-filter-sort",
        text: t(range.key, plugin),
        attr: { type: "button", "data-time": range.id, "aria-pressed": draftTime === range.id ? "true" : "false" }
      });
      if (draftTime === range.id)
        button.addClass("is-selected");
      button.onclick = (evt) => {
        evt.preventDefault();
        draftTime = range.id;
        popover.querySelectorAll(".aa-filter-sort[data-time]").forEach((el) => {
          const item = el as HTMLButtonElement;
          const active = item.dataset.time === draftTime;
          item.classList.toggle("is-selected", active);
          item.setAttr("aria-pressed", active ? "true" : "false");
        });
      };
    }
  }
  const footer = popover.createDiv("aa-filter-footer");
  const clearBtn = footer.createEl("button", {
    cls: "aa-filter-clear",
    text: t("ui.resetFilters", plugin),
    attr: { type: "button" }
  });
  clearBtn.onclick = (evt) => {
    evt.preventDefault();
    extras?.onTimeRange?.("all");
    onApply(defaultAnnotationFilter());
  };
  const applyBtn = footer.createEl("button", {
    cls: "aa-filter-apply",
    text: t("ui.apply", plugin),
    attr: { type: "button" }
  });
  applyBtn.onclick = (evt) => {
    evt.preventDefault();
    if (extras?.onTimeRange && draftTime !== extras.timeRange)
      extras.onTimeRange(draftTime);
    onApply(draft);
  };
  return popover;
}

function mountFilterToggle(popover: HTMLElement, draft: AnnotationFilter, key: "notesOnly" | "tagsOnly", label: string, onChange: (value: boolean) => void) {
  const button = popover.createEl("button", {
    cls: "aa-filter-option",
    text: label,
    attr: { type: "button", "aria-pressed": draft[key] ? "true" : "false" }
  });
  if (draft[key])
    button.addClass("is-selected");
  button.onclick = (evt) => {
    evt.preventDefault();
    const next = !draft[key];
    onChange(next);
    button.classList.toggle("is-selected", next);
    button.setAttr("aria-pressed", next ? "true" : "false");
  };
}
