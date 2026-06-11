import { Fragment } from 'react';
import { parseCommentBody } from './comments-utils';
import type { CommentInlineSegment } from './comments-utils';

const InlineSegment = ({ segment }: { segment: CommentInlineSegment }) => {
  switch (segment.type) {
    case 'bold':
      return <strong className="font-semibold">{segment.text}</strong>;
    case 'italic':
      return <em>{segment.text}</em>;
    case 'code':
      return (
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
          {segment.text}
        </code>
      );
    case 'link':
      return (
        <a
          href={segment.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:opacity-80"
        >
          {segment.text}
        </a>
      );
    case 'mention':
      return (
        <span className="rounded bg-primary/15 px-1 py-0.5 font-medium text-primary">
          @{segment.name}
        </span>
      );
    default:
      return <>{segment.text}</>;
  }
};

type CommentBodyProps = {
  body: string;
};

/**
 * Renders the lightweight comment format: a markdown subset (bold, italic,
 * inline code, links, dash lists) plus @[Name](user:id) mention chips.
 */
export function CommentBody({ body }: CommentBodyProps) {
  const lines = parseCommentBody(body);

  return (
    <div className="space-y-0.5 break-words text-xs leading-relaxed text-foreground">
      {lines.map((line, lineIndex) => {
        const content = line.segments.map((segment, segmentIndex) => (
          <InlineSegment key={segmentIndex} segment={segment} />
        ));
        if (line.isListItem) {
          return (
            <div key={lineIndex} className="flex gap-1.5 pl-1">
              <span className="text-muted-foreground">•</span>
              <span>{content}</span>
            </div>
          );
        }
        return (
          <p key={lineIndex}>
            {content.length > 0 ? content : <Fragment>&nbsp;</Fragment>}
          </p>
        );
      })}
    </div>
  );
}
