import { useEffect, useMemo, useRef, useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import { MentionAutocomplete } from './mention-autocomplete';
import {
  getMentionQueryAtCaret,
  insertLineBreakAtCaret,
  insertMentionChip,
  placeCaretAtEnd,
  renderMentionValue,
  serializeMentionValue,
} from './mention-editable';
import type { CaretMentionQuery } from './mention-editable';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useMentionableUsers } from '@/api';
import type { MentionableUser } from '@/api';

type CommentComposerProps = {
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  focusOnMount?: boolean;
  isSubmitting?: boolean;
  onSubmit: (body: string) => void;
  onCancel?: () => void;
};

export function CommentComposer({
  placeholder = 'Add a comment… use @ to mention',
  initialValue = '',
  submitLabel = 'Comment',
  focusOnMount = true,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: CommentComposerProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(initialValue.trim().length === 0);
  const [mentionQuery, setMentionQuery] = useState<CaretMentionQuery | null>(
    null,
  );
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    renderMentionValue(editor, initialValue);
    setIsEmpty(initialValue.trim().length === 0);
    if (focusOnMount) {
      editor.focus();
      placeCaretAtEnd(editor);
    }
    // Only re-run when switching to a different draft/comment, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: mentionableUsers } = useMentionableUsers(mentionQuery !== null);

  const suggestions = useMemo(() => {
    if (!mentionQuery || !mentionableUsers) return [];
    const query = mentionQuery.query.toLowerCase();
    return mentionableUsers
      .filter(
        (user) =>
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query),
      )
      .slice(0, 6);
  }, [mentionQuery, mentionableUsers]);

  const refreshMentionQuery = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = getMentionQueryAtCaret(editor);
    setMentionQuery(next);
    if (next) setHighlightedIndex(0);
  };

  const insertMention = (user: MentionableUser) => {
    const editor = editorRef.current;
    if (!editor || !mentionQuery) return;
    insertMentionChip(
      mentionQuery.node,
      mentionQuery.start,
      mentionQuery.end,
      user.name,
      user.id,
    );
    setMentionQuery(null);
    setIsEmpty(false);
    editor.focus();
  };

  const submit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const trimmed = serializeMentionValue(editor).trim();
    if (!trimmed || isSubmitting) return;
    onSubmit(trimmed);
    editor.innerHTML = '';
    setIsEmpty(true);
    setMentionQuery(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (mentionQuery && suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((index) => (index + 1) % suggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex(
          (index) => (index - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insertMention(suggestions[highlightedIndex]);
        return;
      }
      if (event.key === 'Escape') {
        event.stopPropagation();
        setMentionQuery(null);
        return;
      }
    }

    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      insertLineBreakAtCaret(editorRef.current!);
      setIsEmpty(false);
      return;
    }
    if (event.key === 'Escape' && onCancel) {
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className="relative">
      {mentionQuery && (
        <MentionAutocomplete
          users={suggestions}
          highlightedIndex={highlightedIndex}
          onHighlight={setHighlightedIndex}
          onSelect={insertMention}
        />
      )}

      <div
        ref={editorRef}
        contentEditable
        role="textbox"
        tabIndex={0}
        aria-multiline="true"
        aria-label={placeholder}
        data-placeholder={placeholder}
        className={cn(
          'mention-input min-h-16 w-full whitespace-pre-wrap break-words rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          isSubmitting && 'pointer-events-none opacity-50',
        )}
        onInput={() => {
          const editor = editorRef.current;
          const empty = (editor?.textContent?.length ?? 0) === 0;
          if (empty && editor) editor.innerHTML = '';
          setIsEmpty(empty);
          refreshMentionQuery();
        }}
        onKeyDown={handleKeyDown}
        onClick={refreshMentionQuery}
        onKeyUp={refreshMentionQuery}
      />

      <div className="mt-1.5 flex items-center justify-end gap-1.5">
        {onCancel && (
          <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          size="sm"
          type="button"
          disabled={isEmpty || isSubmitting}
          onClick={submit}
          className="gap-1.5"
        >
          <SendHorizontal size={12} />
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
