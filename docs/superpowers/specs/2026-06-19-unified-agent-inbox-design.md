# Unified Agent Inbox + Conversation↔Annotation Linkage

**Date:** 2026-06-19
**Branch:** `feat/ai-agent`
**Status:** Approved design — ready for implementation planning

---

## Problem

The AI agent runs from two surfaces that currently bleed into each other:

1. **Main agent panel** (`client/src/pages/editor/agent-panel.tsx` + `use-agent-run.ts`).
   On open it calls `fetchLatestConversation(projectId)`, which grabs the **most
   recent conversation for the whole project** and rehydrates it as the chat
   transcript.

2. **Canvas `@orqestra` comments** (`run-annotation.ts`, wired in
   `editor-canvas.tsx`). Each tagged annotation thread spins up its **own** agent
   conversation and posts the reply back into that comment thread.

Both write rows to the same `agent_conversations` table with **no marker
distinguishing a build chat from an annotation chat**. Consequences:

- **The leak (reported):** the moment a user tags `@orqestra` in a comment, that
  becomes the project's latest conversation. Next time they open the main panel,
  it rehydrates the annotation chat and shows the machine-seeded text
  `"The user tagged you in an annotation on the … resource. Their message: …"`
  inside the main chat.
- **Latent sibling bug:** the annotation→conversation pairing lives only in an
  in-memory `Map` (`annotationConversationsRef` in `editor-canvas.tsx`). After a
  page reload the agent **forgets** a thread it was engaged in — replying
  `@orqestra` again starts a fresh conversation with no memory of prior work.

## Goal

Make the agent panel a **unified inbox** of agent conversations, cleanly separate
build chats from canvas-anchored threads, and fix both bugs with one shared
backend change.

## Non-Goals

- Multiple standalone build chats per project (stays singular — YAGNI).
- Merging annotation `comments` and agent `messages` into one store. The anchored
  conversation is **read and continued on the canvas comment thread**, exactly as
  it is today; the panel only lists and launches it.
- Changing the agent engine, run loop, op risk model, or streaming.

---

## Decisions (locked during brainstorming)

1. **Surfaces relate as a unified thread list.** The panel lists the build chat
   plus all agent-engaged annotation threads.
2. **Anchored threads jump to canvas.** Clicking one centers the canvas and opens
   the comment popover there; the conversation stays on the canvas. The panel is
   an index/launcher for anchored threads.
3. **Scope = inbox + both bug fixes**, via a shared migration.
4. **Panel default view = the list**, with two refinements for friction:
   - Empty/new project onboarding opens **straight into the build chat view**.
   - The panel **remembers the last-open view within a session** (list vs. build
     chat), so reopening lands where you left off.

---

## Section A — Backend: link a conversation to its annotation

Add a nullable FK to `AgentConversation` (`server/agent/models.py`):

```python
annotation = models.ForeignKey(
    "annotations.Annotation",
    on_delete=models.CASCADE,   # a deleted thread's chat must not resurface as a build chat
    null=True,
    blank=True,
    related_name="agent_conversations",
)
```

- **Build chats** → `annotation = NULL`.
- **Annotation-anchored runs** → `annotation = <id>`.

`CASCADE` is deliberate: if the annotation thread is deleted, its conversation
goes with it, so it can never reappear as a standalone build chat (which would
re-introduce the leak). Add a migration.

`AGENT_ID` / `author_type='agent'` plumbing for the posted reply is unchanged.

## Section B — Fix the leak (panel never shows annotation chats)

`fetchLatestConversation` (`client/src/api/agent.ts`) is the only path that pulls
a conversation into the panel. Constrain it to **standalone** chats:

- Server: `AgentConversationViewSet.get_queryset` (list action) supports a
  `standalone=true` query param → `queryset.filter(annotation__isnull=True)`.
- Client: `fetchLatestConversation` requests `?project=<id>&standalone=true`.

The panel can no longer rehydrate an annotation conversation. The seeded
annotation text can never appear in the main chat again.

## Section C — Fix the memory bug (reuse-by-annotation)

Remove the ephemeral `annotationConversationsRef` Map. Persist and reuse the link:

- `createAgentConversation` accepts an optional `annotationId` and the serializer
  saves it onto the new conversation (`AgentConversationSerializer`).
- The list endpoint supports `?annotation=<id>` (server filter on
  `annotation_id`).
- `run-annotation.ts` reuse logic becomes: look up the conversation linked to that
  annotation (`GET …/conversations/?annotation=<id>`); reuse if present, else
  create one linked to the annotation. Memory now survives reloads.

`editor-canvas.tsx` drops the `Map` ref; the lookup is the source of truth.

## Section D — Frontend: agent panel becomes a two-view inbox

The panel (`agent-panel.tsx`) gains a lightweight view switch held in **local
component state**. `AgentPanel` already stays mounted while closed (hidden via
CSS, per its existing doc comment), so the active view naturally persists across
open/close without touching Redux.

**List view (default):**
- A pinned **"Build chat"** entry at the top → opens the build-chat view inline.
- An **"On the canvas"** section listing anchored agent threads.
  - Source: the annotations already loaded by `useComments`, filtered with the
    existing `threadEngagesAgent()` from `agent/annotation-trigger.ts`.
  - Rendering: **reuse the `AnnotationCard` pattern** from `comments-sidebar.tsx`
    (extract it to a shared component if needed — do not duplicate it).
  - Resolved anchored threads hidden by default, mirroring the comments sidebar.
- Clicking an anchored thread → `comments.jumpToAnnotation(id)` (reused): centers
  the canvas, sets the active annotation, and opens the thread popover. If the
  popover only renders in comment mode, the open handler also enables comment
  mode so the thread is actually visible.

**Build-chat view:**
- The current transcript + composer (today's `AgentPanel` body), with a back
  arrow to the list. `useAgentRun` is unchanged except that it consumes the
  `standalone=true` rehydrate from Section B.

**Header** adapts to the active view (list: "Orqestra" + new-chat; chat: back
arrow + new-chat).

## Section E — Wiring

`editor-canvas.tsx` already owns both `useComments` and `<AgentPanel>`. It passes
down:

- `anchoredThreads`: `comments.filteredAnnotations` filtered by
  `threadEngagesAgent` (computed once, memoized).
- `onOpenThread(annotationId)`: a callback that runs `jumpToAnnotation` (+ ensures
  the thread is visible).

No duplicate annotation fetching, no new global state store. The build-chat
conversation continues to live in `useAgentRun`.

## Section F — Onboarding & session view memory

- The existing empty-project auto-open (`autoOpenedAgentForRef` effect) opens the
  panel **into the build-chat view**, preserving the guided "describe your app"
  flow.
- The panel's active view (list vs. build chat) lives in `AgentPanel` local state
  (Section D). Because the panel stays mounted while hidden, reopening returns to
  the last view rather than always resetting to the list.

## Section G — Testing

Per `docs/agents/testing.md` and project conventions:

- **Backend** (`docker compose run --rm server python manage.py test`):
  - Migration applies cleanly.
  - Conversation list filtering: `standalone=true` excludes annotation chats;
    `annotation=<id>` returns the linked conversation.
  - Conversation create accepts and persists `annotation`.
  - Deleting an annotation cascades its conversation.
- **Frontend** (no testing-library; test pure fns, verify UI via `tsc`/build):
  - Extract inbox-thread derivation (build-chat entry + filtered anchored threads)
    into a pure util and unit-test it; reuse existing `threadEngagesAgent`
    coverage.
  - `annotation-trigger.test.ts` stays green.
  - `tsc --noEmit` and the client build pass.

---

## Edge cases

- **Annotation deleted** → `CASCADE` removes its conversation; cannot resurface as
  a build chat.
- **Anchored thread resolved** → drops out of the default inbox (review toggle can
  reveal it later, mirroring comments sidebar).
- **Detached annotation** (target node removed) → still listed; jump centers
  best-effort via the existing `resolvePinFlowPosition`.
- **Concurrent runs** (build chat + an annotation run) → independent
  conversations, independent run loops; no shared client state.

## Conventions to honor

- Frontend camelCase ↔ backend snake_case via `apiDataResponseMapper` /
  `apiPayloadMapper`; never hand-cased payloads.
- Frontend filenames kebab-case; constants `SCREAMING_SNAKE_CASE`.
- shadcn `components/ui` primitives only; semantic design tokens (no hardcoded
  Tailwind colors).
- Reuse before creating: `AnnotationCard`, `jumpToAnnotation`,
  `threadEngagesAgent`, existing mappers.
- No patch fixes: remove the `Map` ref rather than working around it; clean-remove
  dead code.
- Backend ops via Docker; remember the server has no autoreload (restart after
  `.py` edits).
