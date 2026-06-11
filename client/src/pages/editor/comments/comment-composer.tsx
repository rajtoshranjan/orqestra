import { useEffect, useMemo, useRef, useState } from 'react';
import { SendHorizontal } from 'lucide-react';
import { buildMentionToken } from './comments-utils';
import { MentionAutocomplete } from './mention-autocomplete';
import { Button, Textarea } from '@/components/ui';
import { useMentionableUsers } from '@/api';
import type { MentionableUser } from '@/api';

type MentionQuery = {
  /** Index of the '@' character in the textarea value. */
  start: number;
  query: string;
};

const findMentionQuery = (
  value: string,
  caret: number,
): MentionQuery | null => {
  const beforeCaret = value.slice(0, caret);
  const atIndex = beforeCaret.lastIndexOf('@');
  if (atIndex === -1) return null;
  // '@' must start a word and the query must not span whitespace or an
  // already-completed token (which contains '[').
  if (atIndex > 0 && !/[\s([]/.test(beforeCaret[atIndex - 1])) return null;
  const query = beforeCaret.slice(atIndex + 1);
  if (/[\s[\]()]/.test(query)) return null;
  return { start: atIndex, query };
};

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
  const [value, setValue] = useState(initialValue);
  const [mentionQuery, setMentionQuery] = useState<MentionQuery | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusOnMount) textareaRef.current?.focus();
  }, [focusOnMount]);

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

  const refreshMentionQuery = (nextValue: string) => {
    const caret = textareaRef.current?.selectionStart ?? nextValue.length;
    const next = findMentionQuery(nextValue, caret);
    setMentionQuery(next);
    if (next) setHighlightedIndex(0);
  };

  const insertMention = (user: MentionableUser) => {
    if (!mentionQuery) return;
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const token = `${buildMentionToken(user.name, user.id)} `;
    const nextValue =
      value.slice(0, mentionQuery.start) + token + value.slice(caret);
    setValue(nextValue);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const position = mentionQuery.start + token.length;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(position, position);
    });
  };

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isSubmitting) return;
    onSubmit(trimmed);
    setValue('');
    setMentionQuery(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

      <Textarea
        ref={textareaRef}
        value={value}
        placeholder={placeholder}
        rows={2}
        className="min-h-16 resize-none text-xs"
        onChange={(event) => {
          setValue(event.target.value);
          refreshMentionQuery(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        onClick={() => refreshMentionQuery(value)}
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
          disabled={!value.trim() || isSubmitting}
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
