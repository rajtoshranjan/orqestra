# UI/UX Polish & Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the existing Orqestra UI into one consistent, professional design language and fix the audited bugs — foundation first, then surface by surface.

**Architecture:** Make the shadcn HSL tokens (Tailwind utilities) the single source of truth; redefine the custom `--color-*` vars as thin aliases and migrate usages per surface. Add a type scale and three shared primitives (`Badge` forwardRef, `MetaChip`, `SectionHeader`), then apply them across Projects → Editor → Members → Settings.

**Tech Stack:** React + TypeScript, Tailwind + shadcn/ui, Redux Toolkit, React Query, Vite. Tests: vitest (logic/helpers only — no React Testing Library in this repo). Visual verification: Playwright + system Chrome harness in `/tmp/orq-audit`.

---

## Conventions for every task

- **Branch:** all work on `ui-ux-polish` (create once: `git switch -c ui-ux-polish`).
- **No patch fixes:** never add `@ts-ignore` / `eslint-disable` (per `AGENTS.md`). Remove dead code; unify duplicate state.
- **Lint gate (run after each task):**
  `cd client && npm run lint` → must pass (eslint `--max-warnings=0` + `tsc`).
- **Visual gate (run after each surface phase):** re-run the screenshot harness in dark + light and eyeball the diff + console errors:
  ```bash
  cd /tmp/orq-audit && ACCESS=… REFRESH=… ORGID=… PROJECTID=… node drive.mjs   # all surfaces
  cd /tmp/orq-audit && ACCESS=… REFRESH=… ORGID=… PROJECTID=… node drive2.mjs  # editor interactions + light
  ```
  (Re-mint a fresh JWT if expired — see "Harness auth" appendix.) No new console errors; the `Badge` `forwardRef` warning must be gone after Task 3.
- **Commit** at the end of each task with a conventional message.

---

## Phase 0 — Foundation (no intended visual change)

### Task 1: Unify semantic color tokens & resolve the `success` conflict

**Files:**
- Modify: `client/src/assets/styles.css` (`:root` ~L10-93, `:root.light` ~L96-167)
- Modify: `client/tailwind.config.js:43-50`

Today `success` is defined 3×: `tailwind.config.js` (`#10b981`), `styles.css` `--color-success` (dark `#18B26B`, light `#059669`). `warning` similarly. Make the CSS vars canonical and have Tailwind reference them.

- [ ] **Step 1: Point Tailwind `success`/`warning` at the CSS vars**

In `client/tailwind.config.js`, replace the hardcoded `success`/`warning` block:

```js
        success: {
          DEFAULT: 'var(--color-success)',
          foreground: '#ffffff',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          foreground: '#ffffff',
        },
```

- [ ] **Step 2: Keep one chosen `success` value**

In `client/src/assets/styles.css`, leave dark `--color-success: #18B26B;` and light `--color-success: #059669;` as the single definitions (now also feeding Tailwind). Do **not** reintroduce `#10b981` anywhere.

- [ ] **Step 3: Verify nothing else hardcodes the old greens**

Run: `cd /Users/rajtosh/Documents/projects/orqestra && grep -rn '#10b981' client/src client/tailwind.config.js`
Expected: no matches.

- [ ] **Step 4: Lint**

Run: `cd client && npm run lint`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add client/tailwind.config.js client/src/assets/styles.css
git commit -m "refactor(client): make CSS vars the single source for success/warning colors"
```

### Task 2: Establish one canonical radius scale

**Files:**
- Modify: `client/src/assets/styles.css` (`--radius*` ~L61-66, `--radius` ~L93)

The shadcn `--radius: 0.5rem` (8px) and the `--radius-sm/md/lg/xl/2xl` scale overlap; cards mix `rounded-xl` (16px) and `rounded-md`. Standardize: `--radius` stays the shadcn base (8px); the `--radius-*` aliases are redefined in terms of it so both systems agree.

- [ ] **Step 1: Redefine the custom radius scale as derived from `--radius`**

In `client/src/assets/styles.css` `:root`, replace the radius block:

```css
    /* Radii — derived from the shadcn --radius base (single scale) */
    --radius-sm: calc(var(--radius) - 2px); /* 6px */
    --radius-md: var(--radius);             /* 8px */
    --radius-lg: calc(var(--radius) + 4px); /* 12px */
    --radius-xl: calc(var(--radius) + 8px); /* 16px */
    --radius-2xl: calc(var(--radius) + 12px);/* 20px */
    --radius-full: 9999px;
```

- [ ] **Step 2: Decide the canonical card radius**

Standard = `rounded-xl` (12px via Tailwind `lg`/`--radius-lg`) for content cards. Record this in the plan note; cards get aligned during their surface phases (Projects Task 6, Settings/Members tasks).

- [ ] **Step 3: Lint + commit**

```bash
cd client && npm run lint
git add client/src/assets/styles.css
git commit -m "refactor(client): derive custom radius scale from shadcn --radius base"
```

### Task 3: `Badge` → `React.forwardRef` (fixes 🔴 ref warning)

**Files:**
- Modify: `client/src/components/ui/badge.tsx`

- [ ] **Step 1: Reproduce the bug**

Run the editor in the harness (see appendix) and confirm the console shows
`Warning: Function components cannot be given refs … at Badge`.

- [ ] **Step 2: Convert Badge to forwardRef**

Replace the component definition in `client/src/components/ui/badge.tsx` (keep `badgeVariants` unchanged):

```tsx
export type BadgeProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants>;

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  ),
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
```

- [ ] **Step 3: tsc/lint**

Run: `cd client && npm run lint`
Expected: passes.

- [ ] **Step 4: Verify the warning is gone**

Re-run the editor harness; confirm the `forwardRef` warning no longer appears and the editor read-only badge tooltip works.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ui/badge.tsx
git commit -m "fix(client): forward ref in Badge so it works as a Radix asChild trigger"
```

### Task 4: `MetaChip` shared primitive

**Files:**
- Create: `client/src/components/ui/meta-chip.tsx`
- Modify: `client/src/components/ui/index.ts` (add export)

Replaces the inline `inline-flex … rounded-full border … text-[10px]` pills duplicated across projects cards, members directory, etc.

- [ ] **Step 1: Create the component**

```tsx
import * as React from 'react';

import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export type MetaChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  icon?: LucideIcon;
};

const MetaChip = React.forwardRef<HTMLSpanElement, MetaChipProps>(
  ({ className, icon: Icon, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex select-none items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground',
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-3 text-muted-foreground" /> : null}
      {children}
    </span>
  ),
);
MetaChip.displayName = 'MetaChip';

export { MetaChip };
```

- [ ] **Step 2: Export it**

In `client/src/components/ui/index.ts`, add: `export * from './meta-chip';`

- [ ] **Step 3: Lint + commit**

```bash
cd client && npm run lint
git add client/src/components/ui/meta-chip.tsx client/src/components/ui/index.ts
git commit -m "feat(client): add MetaChip primitive for meta pills"
```

### Task 5: `SectionHeader` shared primitive

**Files:**
- Create: `client/src/components/ui/section-header.tsx`
- Modify: `client/src/components/ui/index.ts`

Replaces the repeated "icon + title + description" headers on Settings/Members.

- [ ] **Step 1: Create the component**

```tsx
import * as React from 'react';

import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export type SectionHeaderProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
};

export function SectionHeader({
  title,
  description,
  icon: Icon,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h2>
      </div>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Export it**

In `client/src/components/ui/index.ts`, add: `export * from './section-header';`

- [ ] **Step 3: Lint + commit**

```bash
cd client && npm run lint
git add client/src/components/ui/section-header.tsx client/src/components/ui/index.ts
git commit -m "feat(client): add SectionHeader primitive"
```

### Task 6: Type-scale convention + clean shared components

**Files:**
- Modify: shared components only in this task — `client/src/components/ui/*` where sub-11px sizes appear.

Establish the rule (document at top of `docs/agents/frontend.md` if a standards section exists): **11px is the floor for readable text**; `text-[10px]` reserved only for dense numeric badge counts. Mass per-surface replacement happens in later phases; here only fix shared primitives.

- [ ] **Step 1: Find sub-11px usages in shared UI**

Run: `grep -rnE 'text-\[(7|8|9|10)px\]' client/src/components/ui`

- [ ] **Step 2: Replace each with the nearest scale step**

For each hit, bump `text-[9px]`/`text-[8px]`/`text-[7px]` → `text-[10px]` (badge counts) or `text-xs` (labels), choosing `text-xs` for anything that is a readable label rather than a count.

- [ ] **Step 3: Lint + commit**

```bash
cd client && npm run lint
git add client/src/components/ui
git commit -m "refactor(client): apply type-scale floor to shared UI primitives"
```

---

## Phase 1 — Projects (`pages/projects/index.tsx`, `components/app-header.tsx`)

### Task 7: Refactor the project card

**Files:**
- Modify: `client/src/pages/projects/index.tsx:231-294`

- [ ] **Step 1: Use MetaChip + fix hierarchy + placeholder + drop fake button**

Replace the card body (the `<div className="space-y-4">…</div>` stats block and the bottom actions row) so that:
- The two stat pills use `<MetaChip icon={Layers}>…</MetaChip>` / `<MetaChip icon={Clock}>…</MetaChip>` (import `MetaChip` from `@/components/ui`).
- The title is `text-base font-semibold` (was `text-sm`).
- The empty description renders muted + italic: when `!project.projectDescription`, render `<p className="… italic text-muted-foreground/60">No description provided.</p>`; otherwise the normal description.
- Remove the fake "Open Canvas" `<span>` (the whole `Card` is already the click target — keep the `group-hover` border/translate). Keep only the delete icon-button, right-aligned in the footer.
- Card radius → `rounded-xl` (canonical, Task 2).

- [ ] **Step 2: Lint**

Run: `cd client && npm run lint` → passes.

- [ ] **Step 3: Visual gate**

Re-run `drive.mjs`; open `shots/01-projects.png` (+ `30-projects-light.png`). Confirm: no leaked placeholder look, clear title hierarchy, single affordance, chips consistent.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/projects/index.tsx
git commit -m "refactor(client): tighten project card hierarchy, chips, and affordances"
```

### Task 8: App header contrast & hierarchy

**Files:**
- Modify: `client/src/components/app-header.tsx`

- [ ] **Step 1: Strengthen breadcrumb + logo**

Increase the breadcrumb text from its current muted/tiny size to `text-sm` for the active page and `text-sm text-muted-foreground` for the org segment; ensure the logo wordmark is `text-sm font-semibold` minimum. Swap any `var(--color-*)` here to shadcn utilities (`text-foreground`, `text-muted-foreground`, `border-border`).

- [ ] **Step 2: Lint + visual + commit**

```bash
cd client && npm run lint
# re-run drive.mjs; check header in 01-projects.png
git add client/src/components/app-header.tsx
git commit -m "refactor(client): improve app header hierarchy and token usage"
```

---

## Phase 2 — Editor (`pages/editor/*`, `components/base-node.tsx`)

### Task 9: Remove redundant category labels in the service catalog

**Files:**
- Modify: `client/src/pages/editor/service-catalog.tsx`

- [ ] **Step 1: Drop the per-item category label**

In the catalog row, remove the small per-item category (`COMPUTE`/`NETWORKING`) label element that duplicates the section header. Keep icon + service name. Verify the section grouping headers remain.

- [ ] **Step 2: Lint + visual**

Run `cd client && npm run lint`; re-run `drive.mjs`, check `10-editor.png` left panel.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/editor/service-catalog.tsx
git commit -m "refactor(client): remove redundant per-item category label in service catalog"
```

### Task 10: Toolbar spacing + edge-label contrast

**Files:**
- Modify: `client/src/pages/editor/editor-toolbar.tsx`
- Modify: edge label component (find via `grep -rn "Executes As\|edge" client/src/pages/editor client/src/relationships client/src/flow`)

- [ ] **Step 1: Loosen the right icon cluster**

In `editor-toolbar.tsx:292`, change `gap-0.5` → `gap-1` for the right action cluster; ensure the `ChevronDown` "Canvas actions" button keeps its tooltip (it does) and add a subtle border/`bg-muted` resting affordance so it reads as a menu, not decoration.

- [ ] **Step 2: Raise edge label legibility**

In the edge label styles, bump the label text to `text-[11px]` and use `text-muted-foreground` (from current low-contrast value) with a small `bg-background/80` chip behind it for readability over edges.

- [ ] **Step 3: Lint + visual + commit**

```bash
cd client && npm run lint
# re-run drive.mjs + drive2.mjs; check 10-editor.png and 11-editor-nodes-crop.png
git add client/src/pages/editor/editor-toolbar.tsx <edge-file>
git commit -m "refactor(client): loosen toolbar cluster and improve edge label legibility"
```

### Task 11: Fix the broken node render (🔴) with a graceful fallback

**Files:**
- Modify: `client/src/components/base-node.tsx`
- Possibly: the SNS service def under `client/src/services/sns/`
- Test: `client/src/components/base-node.fallback.test.ts` (only if a pure helper is extracted)

- [ ] **Step 1: Root-cause the `topic-1` (SNS) node**

Open the editor harness, inspect the SNS node. Determine why its header renders as placeholder bars: (a) missing/blank `serviceId` → registry lookup fails and a skeleton shows, or (b) the SNS service icon/header metadata is missing. Run:
`grep -rn "registry.find\|serviceId\|skeleton\|animate-pulse" client/src/components/base-node.tsx`

- [ ] **Step 2: Write a failing test for the fallback resolver (if header derivation is a pure function)**

If header content is derived via a function (e.g. `resolveNodeHeader(node)`), add `client/src/components/base-node.fallback.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { resolveNodeHeader } from './base-node';

describe('resolveNodeHeader', () => {
  it('falls back to label + generic icon when serviceId is unknown', () => {
    const header = resolveNodeHeader({
      id: 'n1',
      data: { label: 'topic-1', serviceId: 'missing' },
    } as never);
    expect(header.title).toBe('topic-1');
    expect(header.icon).toBeDefined();
  });
});
```

Run: `cd client && npx vitest run src/components/base-node.fallback.test.ts` → FAIL.

(If header content is **not** a pure function, skip the test and instead fix the JSX fallback directly; verify visually.)

- [ ] **Step 3: Implement the fix + fallback**

Ensure: the actual SNS render bug is fixed (correct icon/header), **and** any node whose service can't be resolved renders a readable fallback header (label text + a generic icon), never blank placeholder bars.

- [ ] **Step 4: Verify**

Run vitest (if test added) → PASS. Re-run `drive2.mjs`; confirm `topic-1` shows a proper header in `10-editor.png` / `11-editor-nodes-crop.png` (dark) and `31-editor-light.png` (light).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/base-node.tsx client/src/services/sns/* client/src/components/base-node.fallback.test.ts
git commit -m "fix(client): render real header for SNS node and add graceful node-header fallback"
```

---

## Phase 3 — Members (`pages/org-members/index.tsx`)

### Task 12: Reorder the invite flow (email → role → invite) + enablement logic

**Files:**
- Modify: `client/src/pages/org-members/index.tsx`
- Test: `client/src/pages/org-members/invite.test.ts` (extract the validation helper)

- [ ] **Step 1: Extract + TDD the enablement helper**

Create `canSubmitInvite({ email, role })` (export from the page module or a small sibling). Add `client/src/pages/org-members/invite.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { canSubmitInvite } from './invite';

describe('canSubmitInvite', () => {
  it('false when email invalid', () => {
    expect(canSubmitInvite({ email: 'nope', role: 'member' })).toBe(false);
  });
  it('false when role missing', () => {
    expect(canSubmitInvite({ email: 'a@b.com', role: '' })).toBe(false);
  });
  it('true when email valid and role selected', () => {
    expect(canSubmitInvite({ email: 'a@b.com', role: 'member' })).toBe(true);
  });
});
```

Run: `cd client && npx vitest run src/pages/org-members/invite.test.ts` → FAIL.

- [ ] **Step 2: Implement `canSubmitInvite`**

Create `client/src/pages/org-members/invite.ts`:

```ts
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function canSubmitInvite({
  email,
  role,
}: {
  email: string;
  role: string;
}): boolean {
  return EMAIL_RE.test(email.trim()) && role.trim().length > 0;
}
```

Run vitest → PASS.

- [ ] **Step 3: Reorder the JSX + wire enablement**

Move the role-picker cards **above** the Invite button; order = email field → role picker → Invite button. Disable the Invite button via `!canSubmitInvite({ email, role })`. Use `SectionHeader` for the section titles and `MetaChip`/`Badge` for directory role tags.

- [ ] **Step 4: Lint + visual + commit**

```bash
cd client && npm run lint && npx vitest run src/pages/org-members/invite.test.ts
# re-run drive.mjs; check 05-org-members.png
git add client/src/pages/org-members
git commit -m "refactor(client): reorder member invite flow and gate submit on valid email+role"
```

---

## Phase 4 — Settings (`pages/org-settings/index.tsx`)

### Task 13: Danger Zone dedupe + details card affordance

**Files:**
- Modify: `client/src/pages/org-settings/index.tsx`

- [ ] **Step 1: Collapse Danger Zone heading redundancy**

Replace the nested "Danger Zone" + "Delete this organisation" headings with a single `SectionHeader` (title "Danger Zone", one description line) + the destructive action. Remove the duplicate inner heading.

- [ ] **Step 2: Save-on-change affordance**

Enable "Save Name" only when the input differs from the current org name (`name.trim() !== currentName`); otherwise keep it disabled. Tighten the card's internal padding/whitespace; use `SectionHeader` for "Organisation Details".

- [ ] **Step 3: Lint + visual + commit**

```bash
cd client && npm run lint
# re-run drive.mjs; check 04-org-settings.png
git add client/src/pages/org-settings/index.tsx
git commit -m "refactor(client): simplify danger zone and clarify org details save affordance"
```

---

## Phase 5 — Token migration sweep (finish unification)

### Task 14: Replace remaining `var(--color-*)` usages with shadcn utilities

**Files:**
- Modify: the ~20 files still using `var(--color-*)` (list: `grep -rl 'var(--color-' client/src --include='*.tsx'`)

- [ ] **Step 1: Map each custom var to its shadcn utility**

| custom | replacement |
|---|---|
| `bg-[var(--color-bg-surface)]` | `bg-card` |
| `bg-[var(--color-bg-base)]` | `bg-background` |
| `bg-[var(--color-bg-elevated)]` | `bg-muted` |
| `text-[var(--color-text-secondary)]` | `text-muted-foreground` |
| `text-[var(--color-text-muted)]` | `text-muted-foreground` (or `/70`) |
| `border-[var(--color-border)]` | `border-border` |

Leave `--color-success/warning/accent*` and `--glass-*`/`--shadow-*` as-is (semantic, no direct Tailwind equivalent).

- [ ] **Step 2: Apply per file, lint after each batch**

Work file-by-file; after each few files: `cd client && npm run lint`.

- [ ] **Step 3: Confirm the bg/text/border custom vars are gone**

Run: `grep -rn 'var(--color-bg-\|var(--color-text-\|var(--color-border' client/src --include='*.tsx'`
Expected: no matches (only `--color-success/warning/accent/glass/shadow` may remain).

- [ ] **Step 4: Full visual gate (dark + light, all surfaces)**

Re-run `drive.mjs` + `drive2.mjs`; compare every shot to the pre-change baseline. No regressions.

- [ ] **Step 5: Commit**

```bash
git add client/src
git commit -m "refactor(client): migrate remaining surfaces from --color-* vars to shadcn token utilities"
```

---

## Appendix — Harness auth (re-mint JWT when expired)

```bash
cd /Users/rajtosh/Documents/projects/orqestra
docker compose run --rm server python manage.py shell -c "
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
u=get_user_model().objects.get(email='rajtoshranjan@gmail.com')
r=RefreshToken.for_user(u)
print('ACCESS='+str(r.access_token)); print('REFRESH='+str(r))
"
# ORGID=9e94bcc7-5233-4ba5-8e3a-043fcac36d11  PROJECTID=9891c53e-77dd-437a-a7dd-3ed01da48f31
```

Drivers live in `/tmp/orq-audit/drive.mjs` (all surfaces, dark) and `/tmp/orq-audit/drive2.mjs` (editor interactions + light). Vite dev server must be running on `:5173`.

---

## Self-review notes (coverage vs spec)

- Token unification → Tasks 1, 2, 14. Type scale → Task 6 (+ per-surface). Primitives → Tasks 3 (Badge), 4 (MetaChip), 5 (SectionHeader).
- Projects placeholder/hierarchy/fake-button/top bar → Tasks 7, 8.
- Editor catalog labels / toolbar / edges / broken node → Tasks 9, 10, 11.
- Members flow reorder → Task 12. Settings danger zone / details → Task 13.
- Bugs: Badge → Task 3; broken node → Task 11.
- Out of scope (auth, preferences, backend) — intentionally no tasks.
