# UI/UX Polish & Consistency — Design Spec

**Date:** 2026-06-16
**Status:** Approved (direction) — pending spec review
**Scope:** Client (`client/`) only. No backend/API changes.

## Overview

The product works but reads inconsistent and unpolished in places. This effort
refines the **existing** visual identity (no redesign) to make it cleaner, more
consistent, and more professional — improving first impression and day-to-day
stickiness. It covers polish **and** targeted UX-flow fixes across all surfaces:
projects, editor/canvas, app shell, members, and settings. Auth and Preferences
are already clean and are largely left alone.

### Goals
- One coherent design language: a single token source of truth, one type scale,
  consistent radii/spacing, shared primitives reused everywhere.
- Fix the concrete bugs surfaced during the audit.
- Tighten visual hierarchy and remove "leaked placeholder / redundant" feel.
- Fix the few awkward flows (notably member invite ordering).

### Non-goals (YAGNI)
- No visual redesign or new brand. Keep the indigo/dark identity.
- No new features, no new pages, no backend changes.
- No light/dark behavior change beyond consistency fixes.
- No component-library swap (stay on shadcn/Tailwind).
- Auth pages and the Preferences layout are out of scope except where they
  consume shared tokens/primitives.

## Approach

**Foundation first, then surface-by-surface.** Establish the shared design layer
once, then apply it per surface so consistency compounds and we avoid one-off
rework. Order: Foundation → Projects → Editor → Members → Settings.

---

## Part 1 — Design-system foundation

### 1.1 Unify the token system (single source of truth)

Today two token systems coexist and drift:
- Custom CSS vars: `--color-bg-*`, `--color-text-*`, `--color-border-*`,
  `--color-accent*`, `--color-success/warning/error*`, `--radius-*`,
  `--shadow-*` (used **133×** across **20 files**).
- shadcn HSL tokens: `--background`, `--card`, `--primary`, `--border`,
  `--radius`, etc. (used **1203×** via Tailwind utilities — the dominant system).
- Tailwind config **also** hardcodes `success: #10b981` / `warning: #f59e0b`,
  while CSS defines `--color-success: #18B26B`. So `success` exists in **three
  places with two different dark values** — a concrete drift bug.

**Decision:** shadcn HSL tokens (driven by Tailwind utilities) are the canonical
source of truth, because they already cover 90% of usage and feed every shadcn
primitive. The custom `--color-*` layer is reconciled to it:

1. **Add missing semantic tokens to the shadcn set** so nothing needs the custom
   layer: `success`, `warning` (already partly present), and any surface levels
   the custom palette provided (e.g. an `elevated` surface). Define them as HSL
   vars in `:root` / `:root.light` and expose via `tailwind.config.js` `colors`.
   Resolve the `success` value conflict to a single chosen value.
2. **Redefine the remaining `--color-*` vars as thin aliases** of the canonical
   tokens (so existing files keep working during migration, no big-bang break).
3. **Migrate usages opportunistically** within each surface phase: when we touch
   a file for its surface work, replace `bg-[var(--color-bg-surface)]` →
   `bg-card`, `text-[var(--color-text-secondary)]` → `text-muted-foreground`,
   `border-[var(--color-border)]` → `border-border`, etc.
4. **Deduplicate radius:** keep one canonical radius scale. `--radius` (shadcn)
   becomes the base; `--radius-sm/md/lg/xl` are either mapped onto it or removed
   in favor of Tailwind's `rounded-{sm,md,lg,xl}`. Pick **one** card radius
   (cards currently mix `rounded-xl` and `rounded-md`).

This keeps risk bounded: foundation phase changes only the token definitions +
aliases (no visual change intended); per-surface phases do the utility swaps.

### 1.2 Type scale

~165 ad-hoc sizes exist (`text-[10px]`×102, `text-[9px]`×32, `text-[11px]`×24,
plus stragglers at 7/8/12/13px). Introduce a small, named scale and use it:

- Standardize on Tailwind's steps (`text-xs` = 12px min for body/meta, `text-sm`,
  `text-base`, `text-lg`, etc.). Treat **11px as the floor** for readable meta
  text; reserve `text-[10px]`/below only for dense badge counts where justified.
- Add 1–2 utilities if needed (e.g. a `text-meta` for the 11px muted-label case)
  so the same intent isn't re-expressed five ways.
- Replace stray `text-[9px]/[8px]/[7px]` with the nearest scale step.

### 1.3 Shared primitives (build/extend once, reuse everywhere)

- **`Badge` → `React.forwardRef`** (fixes the 🔴 bug, see Part 3). Keep the cva
  variants; just forward the ref so it can be a Radix `asChild` trigger.
- **`MetaChip`** — the rounded pill used for "N resources", "3d ago", role tags,
  status. Currently re-implemented inline with `text-[10px]` + `inline-flex …
  rounded-full border …` in several places (projects cards, etc.). Extract one
  component (icon + label, size variants) and reuse.
- **`SectionHeader`** — the small "icon + title + description" header repeated on
  Settings/Members sections. Extract one component for consistent spacing/sizing.

These three are the units the surface phases build on.

---

## Part 2 — Per-surface fixes

### Projects (`pages/projects/index.tsx`)
- **Placeholder text:** stop rendering "No description provided." as normal body
  copy. **Default:** render it muted + italic at reduced opacity so it reads as
  "intentionally empty," not leaked (keeps card heights uniform).
- **Card hierarchy:** raise the title weight/size; demote meta chips; convert the
  inline chips to `MetaChip`; pick one card radius (1.1.4).
- **"Open Canvas" affordance:** it's a fake `<span>` styled as a button while the
  whole card is the click target. **Default:** drop the fake span — the whole
  card stays the click target with a clear hover state — and keep the delete
  icon-button as the only (secondary) action, so there's one obvious affordance.
- **Top bar (`app-header.tsx`):** strengthen breadcrumb/logo contrast & size.

### Editor (`pages/editor/*`)
- **Service catalog (`service-catalog.tsx`):** remove the per-item category label
  ("COMPUTE" on every row) — it's already the section header. Reduces noise.
- **Toolbar (`editor-toolbar.tsx`):** loosen spacing/grouping of the right icon
  cluster; give the "Canvas actions" chevron a clearer affordance (it already has
  a tooltip — improve the visual cue). Apply token/type-scale cleanup.
- **Edge labels:** raise contrast/size of "Executes As" / "Triggers".

### Members (`pages/org-members/index.tsx`)
- **Flow reorder (UX):** email field → role picker → **Invite** button, so the
  action follows the required role choice (currently the button sits above the
  role cards). Use `SectionHeader` and `MetaChip` for the directory roles.
- Strengthen role-card text sizing and selected-state visibility.

### Settings (`pages/org-settings/*`)
- **Danger Zone:** remove the nested heading redundancy ("Danger Zone" +
  "Delete this organisation"); one heading + one line + action.
- **Organisation Details card:** tighten whitespace; clarify the disabled
  "Save Name" affordance (e.g. enabled only when the name changed, clearer state).

---

## Part 3 — Bugs (fix regardless of phase)

- **🔴 `Badge` not `forwardRef`.** `function Badge` returns a `<div>` with no ref.
  Used as `TooltipTrigger asChild` (editor read-only badge) → live console error
  *"Function components cannot be given refs"* + broken tooltip. Fix: convert to
  `React.forwardRef`. (Folded into 1.3.)
- **🔴 Broken node render.** The SNS `topic-1` node renders placeholder/skeleton
  bars instead of its icon + type header (confirmed dark **and** light), unlike
  SQS/Lambda nodes. Root-cause during implementation: determine whether it's a
  rendering fallback bug or bad node data, fix the cause, **and** ensure a
  graceful fallback header so a node never renders as blank bars.

---

## Components / units & isolation

Each unit has one purpose, a clear interface, and is independently testable:

| Unit | Purpose | Consumers |
|---|---|---|
| Token layer (`styles.css` + `tailwind.config.js`) | one source of truth for color/radius/shadow | all |
| `Badge` (forwardRef) | status/label pill, Radix-trigger-safe | toolbar, members, validation |
| `MetaChip` | icon+label meta pill | projects, members, editor |
| `SectionHeader` | icon+title+description block | settings, members |
| Surface modules | apply foundation per page | one page each |

Surfaces depend on the foundation, not on each other — so phases ship
independently and a regression is isolated to one surface.

## Testing strategy

- **Visual regression via the audit harness:** the Playwright + system-Chrome
  driver in `/tmp/orq-audit` (auth via injected JWT) captures every surface in
  dark and light. Re-run before/after each phase and compare screenshots.
- **Unit tests (vitest):** for new shared primitives (`MetaChip`, `SectionHeader`,
  `Badge` ref-forwarding) and any logic touched (e.g. members invite enablement).
- **Console-error gate:** the harness already surfaces console errors; the Badge
  fix must clear the `forwardRef` warning. No new console errors per surface.
- **Manual:** `npm run lint` (eslint `--max-warnings=0` + `tsc`) must pass — no
  `@ts-ignore`/`eslint-disable` patch fixes (per AGENTS.md).

## Risks & mitigations

- **Token migration breaks visuals.** Mitigation: foundation phase only adds
  tokens + aliases (no intended visual change); usage swaps happen per surface
  with screenshot diffing; `--color-*` aliases keep un-migrated files working.
- **Scope creep across 80+ service node files.** Mitigation: editor work targets
  shared node chrome (`base-node.tsx`, catalog, toolbar, edges), not per-service
  files, except the one broken node.
- **"Success" color change is visible.** Mitigation: pick the value deliberately,
  verify in both themes via the harness.

## Sequencing

1. **Foundation** — token unification + aliases, type scale, `Badge` forwardRef,
   `MetaChip`, `SectionHeader`. (No intended visual change.)
2. **Projects** — cards, placeholder, hierarchy, top bar, token swaps.
3. **Editor** — catalog labels, toolbar, edges, broken-node fix, token swaps.
4. **Members** — invite flow reorder, role cards, token swaps.
5. **Settings** — danger zone, details card, token swaps.

Each phase: implement → lint/tsc → screenshot diff (dark+light) → commit.
