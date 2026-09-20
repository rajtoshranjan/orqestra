import { ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui';

export function OpenAIAccessNote() {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">
        Have a ChatGPT subscription?
      </p>
      <p>
        This connection uses the OpenAI API, which is billed separately from
        ChatGPT. A ChatGPT subscription is not an API key.
      </p>
      <p>
        Subscription sign-in is available through Codex. Orqestra’s canvas agent
        does not currently embed the Codex runtime, so connecting that
        subscription here is not supported.
      </p>
      <Button asChild variant="link" size="sm" className="h-auto p-0">
        <a
          href="https://developers.openai.com/codex/auth"
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenAI sign-in options{' '}
          <ExternalLink size={12} className="ml-1" aria-hidden="true" />
        </a>
      </Button>
    </div>
  );
}
