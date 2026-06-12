import { useEffect } from 'react';

import { isInputElement } from '@/utils';

export type ShortcutCategory = 'canvas' | 'edit' | 'view' | 'general';

export type ShortcutDefinition = {
  key: string; // The character of the key, e.g., 's', 'l', 'g', '/', 'Enter', 'Escape'.
  meta?: boolean; // Matches ctrlKey or metaKey.
  alt?: boolean; // Matches altKey.
  shift?: boolean; // Matches shiftKey.
  description: string;
  category: ShortcutCategory;
  handler: (event: KeyboardEvent) => void;
  disabled?: boolean;
};

// Maps physical key codes to standard characters for modifier-modified key events.
const CODE_TO_KEY_MAP: Record<string, string> = {
  Slash: '/',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Comma: ',',
  Period: '.',
  Semicolon: ';',
  Quote: "'",
  Minus: '-',
  Equal: '=',
  Backquote: '`',
};

/**
 * Registers global keyboard shortcuts with cleanup on unmount.
 * Prevents execution when user is inside text input fields.
 */
export const useKeyboardShortcuts = (
  shortcuts: ShortcutDefinition[],
  dependencies: unknown[] = [],
): void => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isInputElement(event.target)) {
        return;
      }

      const isMeta = event.metaKey || event.ctrlKey;
      const isAlt = event.altKey;
      const isShift = event.shiftKey;
      const key = event.key.toLowerCase();
      const hasModifier = isMeta || isAlt;

      for (const shortcut of shortcuts) {
        if (shortcut.disabled) {
          continue;
        }

        const targetKey = shortcut.key.toLowerCase();
        let keyMatched = key === targetKey;

        // Fall back to event.code comparison if modifiers (like Alt on macOS) modify event.key.
        if (!keyMatched && hasModifier && event.code) {
          if (event.code.startsWith('Key')) {
            const letter = event.code.slice(3).toLowerCase();
            keyMatched = letter === targetKey;
          } else if (event.code.startsWith('Digit')) {
            const digit = event.code.slice(5);
            keyMatched = digit === targetKey;
          } else if (CODE_TO_KEY_MAP[event.code]) {
            keyMatched = CODE_TO_KEY_MAP[event.code] === targetKey;
          } else {
            keyMatched = event.code.toLowerCase() === targetKey;
          }
        }

        if (!keyMatched) {
          continue;
        }

        const metaMatch = !shortcut.meta === !isMeta;
        const altMatch = !shortcut.alt === !isAlt;
        const shiftMatch =
          shortcut.shift !== undefined
            ? !shortcut.shift === !isShift
            : !isShift || !/^[a-z]$/i.test(shortcut.key);

        if (metaMatch && altMatch && shiftMatch) {
          event.preventDefault();
          shortcut.handler(event);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, dependencies);
};
