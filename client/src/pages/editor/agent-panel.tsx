import { useState } from 'react';

import { Loader2, Send, ShieldAlert, Sparkles, X } from 'lucide-react';

import { type GraphState } from '@/agent/op-executor';
import { useAgentRun, type AgentChatMessage } from '@/agent/use-agent-run';
import { Button, Textarea } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAppDispatch } from '@/store';
import { setAgentPanelOpen } from '@/store/ui-slice';

const REQUIREMENT_HINTS = [
  'Workload type',
  'Scale & traffic',
  'Data & persistence',
  'Regions',
  'Compliance',
  'Budget',
];

type AgentPanelProps = {
  projectId: string;
  getGraph: () => GraphState;
  applyGraph: (next: GraphState) => void;
};

function MessageBubble({ message }: { message: AgentChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-xs leading-relaxed',
          isUser
            ? 'bg-primary/15 text-foreground'
            : 'border border-border/60 bg-muted/40 text-foreground',
        )}
      >
        {message.text}
      </div>
    </div>
  );
}

export function AgentPanel({ projectId, getGraph, applyGraph }: AgentPanelProps) {
  const dispatch = useAppDispatch();
  const { messages, status, pendingOp, sendMessage, confirm } = useAgentRun({
    projectId,
    getGraph,
    applyGraph,
  });
  const [input, setInput] = useState('');

  const busy = status === 'thinking' || pendingOp !== null;

  const onSubmit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    void sendMessage(text);
  };

  return (
    <aside className="flex w-96 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Sparkles size={14} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">AI agent</h2>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="ml-auto size-6 p-0 text-muted-foreground"
          onClick={() => dispatch(setAgentPanelOpen(false))}
          aria-label="Close agent panel"
        >
          <X size={14} />
        </Button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Describe the app you want to run. I&apos;ll design a validated AWS
              architecture on the canvas and explain the choices. I&apos;ll ask
              about:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {REQUIREMENT_HINTS.map((hint) => (
                <span
                  key={hint}
                  className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {hint}
                </span>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}

        {status === 'thinking' && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> Working…
          </div>
        )}

        {pendingOp && (
          <div className="border-warning/30 bg-warning/10 space-y-2 rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-warning">
              <ShieldAlert size={13} /> Confirm change
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              The agent wants to run{' '}
              <span className="font-mono text-foreground">{pendingOp.name}</span>
              {typeof pendingOp.input.target_id === 'string'
                ? ` on ${pendingOp.input.target_id}`
                : ''}
              {typeof pendingOp.input.service_id === 'string'
                ? ` (${pendingOp.input.service_id})`
                : ''}
              . This is a higher-impact action.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => void confirm(true)}
              >
                Apply
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => void confirm(false)}
              >
                Discard
              </Button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <p className="text-xs text-destructive">
            The agent hit an error. Try sending your message again.
          </p>
        )}
      </div>

      <div className="border-t border-border p-3">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Describe what you want to build…"
          rows={3}
          className="resize-none text-xs"
          disabled={busy}
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={onSubmit}
            disabled={busy || !input.trim()}
          >
            <Send size={12} /> Send
          </Button>
        </div>
      </div>
    </aside>
  );
}
