import { useEffect, useRef, useState } from 'react';

import {
  ArrowUp,
  CircleCheck,
  DollarSign,
  FolderTree,
  Info,
  Link2,
  MessageSquare,
  Plus,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';

import { type GraphState } from '@/agent/op-executor';
import { describeOp, type AgentOpIcon } from '@/agent/op-label';
import { useAgentRun, type AgentTimelineItem } from '@/agent/use-agent-run';
import type { ClientAnnotation } from '@/api';
import {
  Badge,
  Button,
  EmptyState,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAppDispatch } from '@/store';
import { setAgentPanelOpen } from '@/store/ui-slice';

import { AnnotationCard } from './comments/annotation-card';

import type { LucideIcon } from 'lucide-react';

const REQUIREMENT_HINTS = [
  'Workload',
  'Scale',
  'Data',
  'Regions',
  'Compliance',
  'Budget',
];

const EXAMPLE_PROMPTS = [
  'A REST API with a Postgres database and a background job queue',
  'A static site on S3 served through CloudFront',
  'An event pipeline: SQS → Lambda → DynamoDB',
];

const ACTIVITY_ICONS: Record<AgentOpIcon, LucideIcon> = {
  add: Plus,
  connect: Link2,
  configure: SlidersHorizontal,
  parent: FolderTree,
  remove: Trash2,
  check: CircleCheck,
  cost: DollarSign,
  info: Info,
};

type AgentPanelProps = {
  projectId: string;
  getGraph: () => GraphState;
  applyGraph: (next: GraphState) => void;
  /** Re-tidy the canvas once a run finishes changing topology. */
  layoutGraph?: (graph: GraphState) => GraphState;
  /** Read-only viewers can read the thread but never start a run. */
  readOnly?: boolean;
  /** Kept mounted while closed (hidden via CSS) so the thread survives toggles. */
  open: boolean;
  /** Canvas-anchored agent threads shown in the "Threads" tab. */
  anchoredThreads: ClientAnnotation[];
  /** Id of the thread whose popover is currently open on the canvas, if any. */
  activeThreadId: string | null;
  isThreadDetached: (annotation: ClientAnnotation) => boolean;
  /** Jump the canvas to a thread and open its comment popover. */
  onOpenThread: (annotationId: string) => void;
};

function AgentAvatar({
  className,
  iconSize = 14,
  busy = false,
}: {
  className?: string;
  iconSize?: number;
  busy?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-sm',
        busy && 'animate-pulse-glow',
        className,
      )}
    >
      <Sparkles size={iconSize} aria-hidden="true" />
    </div>
  );
}

function ActivityRow({
  icon,
  label,
  isError,
}: {
  icon: AgentOpIcon;
  label: string;
  isError: boolean;
}) {
  const Icon = ACTIVITY_ICONS[icon];
  return (
    <div className="animate-slide-up flex items-center gap-2 pl-1">
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-md border',
          isError
            ? 'border-destructive/40 bg-destructive/10 text-destructive'
            : 'border-border/60 bg-muted/50 text-muted-foreground',
        )}
      >
        <Icon size={11} aria-hidden="true" />
      </span>
      <span
        className={cn(
          'text-xs leading-tight',
          isError ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </div>
  );
}

function TimelineItem({ item }: { item: AgentTimelineItem }) {
  if (item.kind === 'activity') {
    return (
      <ActivityRow icon={item.icon} label={item.label} isError={item.isError} />
    );
  }
  if (item.kind === 'notice') {
    return (
      <div className="animate-fade-in rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        {item.text}
      </div>
    );
  }
  if (item.role === 'user') {
    return (
      <div className="animate-slide-up flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary/15 px-3 py-2 text-[13px] leading-relaxed text-foreground">
          {item.text}
        </div>
      </div>
    );
  }
  return (
    <div className="animate-slide-up flex items-start gap-2">
      <AgentAvatar className="mt-0.5 size-6" iconSize={12} />
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-border/60 bg-muted/40 px-3 py-2 text-[13px] leading-relaxed text-foreground">
        {item.text}
      </div>
    </div>
  );
}

function ThinkingRow({ label }: { label: string }) {
  return (
    <div className="animate-fade-in flex items-center gap-2.5" role="status">
      <AgentAvatar className="size-6" iconSize={12} busy />
      <span className="sr-only">{label}</span>
      <div className="flex items-center gap-1" aria-hidden="true">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="size-1.5 animate-pulse rounded-full bg-muted-foreground/60"
            style={{ animationDelay: `${dot * 180}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

type AgentPanelTab = 'chat' | 'threads';

export function AgentPanel({
  projectId,
  getGraph,
  applyGraph,
  layoutGraph,
  readOnly = false,
  open,
  anchoredThreads,
  activeThreadId,
  isThreadDetached,
  onOpenThread,
}: AgentPanelProps) {
  const dispatch = useAppDispatch();
  const {
    items,
    status,
    pendingOp,
    pendingGraph,
    errorText,
    sendMessage,
    confirm,
    cancel,
    reset,
    retry,
  } = useAgentRun({
    projectId,
    getGraph,
    applyGraph,
    layoutGraph,
    readOnly,
    enabled: open,
  });
  const [input, setInput] = useState('');
  // The panel stays mounted while closed, so the active tab persists across
  // open/close within a session. Chat is the default — onboarding lands here.
  const [tab, setTab] = useState<AgentPanelTab>('chat');
  const scrollRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  const running = status === 'thinking' || status === 'cancelling';
  const busy = running || pendingOp !== null;
  const isEmpty = items.length === 0;
  const composerDisabled = busy || readOnly;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [items.length, status, pendingOp]);

  // A decision the user has to make should take focus, not wait to be noticed.
  useEffect(() => {
    if (pendingOp) confirmRef.current?.focus();
  }, [pendingOp]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || composerDisabled) return;
    setInput('');
    void sendMessage(trimmed);
  };

  const statusLabel = readOnly
    ? 'Read-only'
    : status === 'cancelling'
      ? 'Stopping…'
      : status === 'thinking'
        ? 'Working…'
        : status === 'awaiting_confirm'
          ? 'Waiting for you'
          : status === 'error'
            ? 'Something went wrong'
            : 'AI architect';

  return (
    <aside
      className={cn(
        'flex w-[400px] shrink-0 flex-col border-l border-border bg-card',
        !open && 'hidden',
      )}
      aria-label="Orqestra agent"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
        <AgentAvatar className="size-7" iconSize={14} busy={running} />
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-gradient text-sm font-semibold">
              Orqestra
            </span>
            <span
              className={cn(
                'size-1.5 rounded-full',
                running
                  ? 'animate-pulse bg-warning'
                  : status === 'error'
                    ? 'bg-destructive'
                    : status === 'awaiting_confirm'
                      ? 'bg-warning'
                      : 'bg-success',
              )}
              aria-hidden="true"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">{statusLabel}</p>
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          {running && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground"
              onClick={() => void cancel()}
              disabled={status === 'cancelling'}
              title="Stop the run"
            >
              <Square size={11} aria-hidden="true" /> Stop
            </Button>
          )}
          {tab === 'chat' && !isEmpty && !running && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="size-7 p-0 text-muted-foreground"
              onClick={reset}
              disabled={busy}
              title="New chat"
              aria-label="New chat"
            >
              <RotateCcw size={13} aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="size-7 p-0 text-muted-foreground"
            onClick={() => dispatch(setAgentPanelOpen(false))}
            aria-label="Close agent panel"
          >
            <X size={14} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border p-2">
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as AgentPanelTab)}
        >
          <TabsList className="grid h-8 w-full grid-cols-2">
            <TabsTrigger value="chat" className="text-xs">
              Chat
            </TabsTrigger>
            <TabsTrigger value="threads" className="gap-1.5 text-xs">
              Threads
              {anchoredThreads.length > 0 && (
                <Badge variant="outline" className="px-1 py-0 text-[10px]">
                  {anchoredThreads.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === 'threads' ? (
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {anchoredThreads.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No agent threads yet"
              description="Tag @orqestra in a canvas comment to start an in-context thread the agent will work on."
              size="sm"
            />
          ) : (
            anchoredThreads.map((annotation) => (
              <AnnotationCard
                key={annotation.id}
                annotation={annotation}
                isActive={annotation.id === activeThreadId}
                isDetached={isThreadDetached(annotation)}
                onClick={() => onOpenThread(annotation.id)}
              />
            ))
          )}
        </div>
      ) : (
        <>
          {/* Body */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto p-3"
            aria-live="polite"
            aria-busy={running}
          >
            {isEmpty ? (
              <div className="animate-fade-in flex h-full flex-col items-center justify-center gap-4 px-2 text-center">
                <AgentAvatar className="size-12" iconSize={24} />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Describe your app, watch it build
                  </h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    I&apos;ll design a validated AWS architecture on the canvas
                    and explain every choice.
                  </p>
                </div>
                <div className="w-full space-y-1.5">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => send(prompt)}
                      disabled={composerDisabled}
                      className="group flex w-full items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-left text-xs leading-snug text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                    >
                      <Sparkles
                        size={12}
                        className="shrink-0 text-primary/70"
                        aria-hidden="true"
                      />
                      <span>{prompt}</span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {REQUIREMENT_HINTS.map((hint) => (
                    <span
                      key={hint}
                      className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {hint}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              items.map((item) => <TimelineItem key={item.id} item={item} />)
            )}

            {running && (
              <ThinkingRow
                label={
                  status === 'cancelling'
                    ? 'Stopping the run'
                    : 'Orqestra is working'
                }
              />
            )}

            {pendingOp &&
              (() => {
                const desc = describeOp(pendingOp, pendingGraph ?? undefined);
                const Icon = ACTIVITY_ICONS[desc.icon];
                return (
                  <div
                    ref={confirmRef}
                    tabIndex={-1}
                    role="group"
                    aria-label="Change awaiting your approval"
                    className="border-warning/30 bg-warning/10 animate-scale-in space-y-2.5 rounded-xl border p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                      <ShieldAlert size={14} aria-hidden="true" /> Review before
                      applying
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="border-warning/40 bg-warning/15 mt-px flex size-5 shrink-0 items-center justify-center rounded-md border text-warning">
                        <Icon size={11} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-[13px] font-medium text-foreground">
                          {desc.pending}
                        </p>
                        {desc.impact.length > 0 && (
                          <p className="mt-1 text-xs leading-relaxed text-warning">
                            Also affects {desc.impact.join(' and ')}.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 flex-1 text-xs"
                        onClick={() => void confirm(true)}
                      >
                        Apply change
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => void confirm(false)}
                      >
                        Skip
                      </Button>
                    </div>
                  </div>
                );
              })()}

            {status === 'error' && (
              <div
                role="alert"
                className="animate-scale-in space-y-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                  <Info size={14} aria-hidden="true" /> Orqestra hit an error
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {errorText || 'Something went wrong.'}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => void retry()}
                  disabled={composerDisabled}
                >
                  <RotateCcw size={12} aria-hidden="true" /> Try again
                </Button>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-border p-3">
            <div className="relative">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    send(input);
                  }
                }}
                placeholder={
                  readOnly
                    ? 'You have read-only access to this project'
                    : 'Describe what you want to build…'
                }
                rows={2}
                className="resize-none rounded-xl pr-11 text-[13px]"
                disabled={composerDisabled}
                aria-label="Message Orqestra"
              />
              <Button
                type="button"
                size="sm"
                className="absolute bottom-2 right-2 size-7 rounded-lg p-0"
                onClick={() => send(input)}
                disabled={composerDisabled || !input.trim()}
                aria-label="Send"
              >
                <ArrowUp size={14} aria-hidden="true" />
              </Button>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
              {readOnly
                ? 'Ask an editor to make changes'
                : 'Enter to send · Shift+Enter for a new line'}
            </p>
          </div>
        </>
      )}
    </aside>
  );
}
