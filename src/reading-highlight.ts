/** 阅读模式只在渲染结果上盖颜色，不改笔记源文件。 */
import type { Annotation } from "./types";

interface TextChunk {
  node: Text;
  start: number;
}

function countOf(haystack: string, needle: string): number {
  if (!needle)
    return 0;
  let count = 0;
  let from = 0;
  while (from <= haystack.length) {
    const index = haystack.indexOf(needle, from);
    if (index < 0)
      break;
    count += 1;
    from = index + needle.length;
  }
  return count;
}

function collectText(root: HTMLElement): { text: string; chunks: TextChunk[] } {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const chunks: TextChunk[] = [];
  let text = "";
  let current = walker.nextNode();
  while (current) {
    const node = current instanceof Text ? current : null;
    const parent = node?.parentElement;
    if (node && !parent?.closest("pre, code, .math, .aa-reading-highlight")) {
      chunks.push({ node, start: text.length });
      text += node.nodeValue ?? "";
    }
    current = walker.nextNode();
  }
  return { text, chunks };
}

function wrapRange(chunks: readonly TextChunk[], start: number, end: number, annotation: Annotation, onOpen: (annotation: Annotation) => void) {
  const hits = chunks.filter((chunk) => {
    const value = chunk.node.nodeValue ?? "";
    return chunk.start < end && chunk.start + value.length > start;
  });
  for (const chunk of hits) {
    const value = chunk.node.nodeValue ?? "";
    const localStart = Math.max(0, start - chunk.start);
    const localEnd = Math.min(value.length, end - chunk.start);
    if (localStart >= localEnd)
      continue;
    const node = chunk.node;
    const parent = node.parentElement;
    if (!parent)
      continue;
    let target = node;
    if (localStart > 0)
      target = target.splitText(localStart);
    const length = localEnd - localStart;
    if ((target.nodeValue ?? "").length > length)
      target.splitText(length);
    const doc = node.ownerDocument;
    const mark = doc.createElement("span");
    mark.className = "aa-reading-highlight";
    mark.dataset.annotationId = annotation.id;
    if (annotation.noteContent)
      mark.title = annotation.noteContent;
    mark.style.setProperty("--aa-accent", annotation.color);
    mark.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onOpen(annotation);
    });
    target.parentNode?.replaceChild(mark, target);
    mark.appendChild(target);
  }
}

/** 只包在这一段渲染结果里能够唯一对上的原句。 */
export function decorateReadingHighlights(el: HTMLElement, annotations: readonly Annotation[], onOpen: (annotation: Annotation) => void) {
  const located = annotations.filter((annotation) => annotation.anchor === "ok" && annotation.fileType !== "pdf" && annotation.highlightedText);
  const ordered = [...located].sort((a, b) => b.highlightedText.length - a.highlightedText.length);
  for (const annotation of ordered) {
    const collected = collectText(el);
    const quote = annotation.highlightedText;
    const needle = `${annotation.prefix}${quote}${annotation.suffix}`;
    const withContext = (annotation.prefix || annotation.suffix) && countOf(collected.text, needle) === 1;
    const quoteOnly = countOf(collected.text, quote) === 1;
    if (!withContext && !quoteOnly)
      continue;
    const foundAt = withContext ? collected.text.indexOf(needle) : collected.text.indexOf(quote);
    if (foundAt < 0)
      continue;
    const quoteStart = withContext ? foundAt + annotation.prefix.length : foundAt;
    wrapRange(collected.chunks, quoteStart, quoteStart + quote.length, annotation, onOpen);
  }
}
