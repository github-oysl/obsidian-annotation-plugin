import { getColorName, t } from "./i18n";
import type { AnnotationFilter } from "./annotation-query";

interface FilterHost { settings?: { language?: string } }
export interface FilterChip { label: string; remove: () => void }

/** Active conditions remain visible even when the navigation/popup is closed. */
export function mountFilterChips(
  container: HTMLElement, filter: AnnotationFilter, plugin: FilterHost,
  onChange: (filter: AnnotationFilter) => void, onClear: () => void,
  extras: FilterChip[] = []
): void {
  const chips = [...extras];
  for (const color of filter.colors)
    chips.push({ label: getColorName(color, plugin) || color, remove: () => onChange({ ...filter, colors: filter.colors.filter((item) => item !== color) }) });
  for (const tag of filter.tags)
    chips.push({ label: `#${tag}`, remove: () => onChange({ ...filter, tags: filter.tags.filter((item) => item !== tag) }) });
  if (filter.notesOnly)
    chips.push({ label: t("ui.notesOnly", plugin), remove: () => onChange({ ...filter, notesOnly: false }) });
  if (filter.tagsOnly)
    chips.push({ label: t("ui.tagsOnly", plugin), remove: () => onChange({ ...filter, tagsOnly: false }) });
  if (!chips.length)
    return;
  const row = container.createDiv("aa-active-filters");
  for (const chip of chips) {
    const button = row.createEl("button", {
      cls: "aa-active-filter", text: `${chip.label} ×`,
      attr: { type: "button", title: chip.label, "aria-label": `${t("ui.clearFilters", plugin)}: ${chip.label}` }
    });
    button.onclick = chip.remove;
  }
  const clear = row.createEl("button", {
    cls: "aa-clear-filters", text: t("ui.clearFilters", plugin), attr: { type: "button" }
  });
  clear.onclick = onClear;
}
