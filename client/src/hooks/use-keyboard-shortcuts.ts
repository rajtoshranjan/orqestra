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

      for (const shortcut of shortcuts) {
        if (shortcut.disabled) {
          continue;
        }

        const targetKey = shortcut.key.toLowerCase();
        if (key !== targetKey) {
          continue;
        }

        const metaMatch = !shortcut.meta === !isMeta;
        const altMatch = !shortcut.alt === !isAlt;
        const shiftMatch = !shortcut.shift === !isShift;

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
