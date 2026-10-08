import { validateHexColor } from "./annotation-model";
import type { AnnotatorSettings, Annotation } from "./types";

/** One palette for the composer, toolbar and card menus; preserve custom names. */
export function highlightColors(settings: AnnotatorSettings, current?: string): string[] {
  const colors = [settings.defaultColor, ...settings.colors, settings.customHighlightColor, current];
  const seen = new Set<string>();
  return colors.filter((color): color is string => {
    if (!color || !validateHexColor(color) || seen.has(color.toLowerCase()))
      return false;
    seen.add(color.toLowerCase());
    return true;
  });
}

export function toolbarColors(settings: AnnotatorSettings, annotations: readonly Annotation[]): string[] {
  const available = highlightColors(settings);
  const recent = [...annotations].sort((a, b) => b.updated - a.updated).map((item) => item.color);
  const ordered = [settings.defaultColor, ...recent, ...available];
  const seen = new Set<string>();
  return ordered.filter((color) => {
    const key = color.toLowerCase();
    if (!available.some((item) => item.toLowerCase() === key) || seen.has(key))
      return false;
    seen.add(key);
    return true;
  });
}
