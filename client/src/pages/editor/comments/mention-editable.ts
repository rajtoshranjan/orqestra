import { buildMentionToken } from './comments-utils';

const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(user:([0-9a-fA-F-]{36})\)/g;

const MENTION_CHIP_CLASS =
  'mx-px rounded bg-primary/15 px-1 py-0.5 font-medium text-primary';

export const createMentionChip = (
  name: string,
  userId: string,
): HTMLSpanElement => {
  const chip = document.createElement('span');
  chip.contentEditable = 'false';
  chip.dataset.mentionName = name;
  chip.dataset.mentionId = userId;
  chip.className = MENTION_CHIP_CLASS;
  chip.textContent = `@${name}`;
  return chip;
};

/** Rebuilds the editable's contents from a canonical token-based string. */
export const renderMentionValue = (root: HTMLElement, value: string) => {
  root.innerHTML = '';
  const lines = value.split('\n');
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) root.appendChild(document.createElement('br'));
    let lastIndex = 0;
    for (const match of line.matchAll(MENTION_TOKEN_RE)) {
      const index = match.index ?? 0;
      if (index > lastIndex) {
        root.appendChild(document.createTextNode(line.slice(lastIndex, index)));
      }
      root.appendChild(createMentionChip(match[1], match[2]));
      lastIndex = index + match[0].length;
    }
    if (lastIndex < line.length) {
      root.appendChild(document.createTextNode(line.slice(lastIndex)));
    }
  });
};

/** Serializes the editable's contents back to the canonical token-based string. */
export const serializeMentionValue = (root: HTMLElement): string => {
  let result = '';
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    if (element.tagName === 'BR') {
      result += '\n';
      return;
    }
    const { mentionName, mentionId } = element.dataset;
    if (mentionName && mentionId) {
      result += buildMentionToken(mentionName, mentionId);
    }
  });
  return result;
};

/** Replaces the `@query` text spanning [start, end) of `node` with a mention chip. */
export const insertMentionChip = (
  node: Text,
  start: number,
  end: number,
  name: string,
  userId: string,
) => {
  const text = node.textContent ?? '';
  const before = document.createTextNode(text.slice(0, start));
  const after = document.createTextNode(text.slice(end));
  const chip = createMentionChip(name, userId);
  const space = document.createTextNode(' ');

  const parent = node.parentNode;
  if (!parent) return;
  parent.replaceChild(after, node);
  parent.insertBefore(space, after);
  parent.insertBefore(chip, space);
  parent.insertBefore(before, chip);

  const range = document.createRange();
  range.setStartBefore(after);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

export type CaretMentionQuery = {
  node: Text;
  start: number;
  end: number;
  query: string;
};

/** Detects an in-progress `@mention` query at the current caret position. */
export const getMentionQueryAtCaret = (
  root: HTMLElement,
): CaretMentionQuery | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!range.collapsed || !root.contains(range.startContainer)) return null;

  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;

  const text = node.textContent ?? '';
  const caret = range.startOffset;
  const beforeCaret = text.slice(0, caret);
  const atIndex = beforeCaret.lastIndexOf('@');
  if (atIndex === -1) return null;
  if (atIndex > 0 && !/[\s([]/.test(beforeCaret[atIndex - 1])) return null;

  const query = beforeCaret.slice(atIndex + 1);
  if (/[\s[\]()]/.test(query)) return null;

  return { node: node as Text, start: atIndex, end: caret, query };
};

export const placeCaretAtEnd = (root: HTMLElement) => {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};
