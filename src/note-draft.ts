export interface NoteDraft {
  content: string;
  color: string;
  tags: string[];
}

/** Emptying a note or changing only its color/tags is still an edit. */
export function hasDraftChanges(initial: NoteDraft, draft: NoteDraft): boolean {
  return initial.content.trim() !== draft.content.trim()
    || initial.color.toLowerCase() !== draft.color.toLowerCase()
    || JSON.stringify(initial.tags) !== JSON.stringify(draft.tags);
}
