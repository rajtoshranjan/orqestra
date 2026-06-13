# Access Control

Orqestra is a multi-tenant product. Every piece of data belongs to an
**organisation**, and a user only ever sees or acts on data in an organisation
they belong to. Within an organisation, what a user can do is determined by
their **role**.

This document is the single reference for the role model: the roles, the
capability matrix, where each rule is enforced, and how the UI reflects it.

## Tenancy model

- A user can belong to many organisations (as owner and/or member).
- The **active organisation** for a request is resolved from the
  `X-Active-Org-Id` header, validated against the user's memberships
  (`server/organisations/helpers.py:get_active_organisation`). An unknown or
  unauthorised id is rejected — you cannot act on an org you don't belong to.
- All querysets are scoped to the active organisation, so cross-tenant reads and
  writes are not possible even with a guessed id.

## Roles

There are four effective roles. `owner` is the `Organisation.owner` foreign key;
the other three are values of `OrganisationMember.role`
(`server/organisations/constants.py`).

| Role | Meaning |
|------|---------|
| **owner** | Created the organisation. Full control, including deletion. Exactly one per org. |
| **admin** | Trusted manager. Everything the owner can do except delete the organisation. |
| **regular** | Builder. Can create and deploy infrastructure, but cannot manage the org, its members, or cloud credentials. |
| **guest** | Read-only viewer. Can browse everything and collaborate via comments, but cannot change infrastructure or settings. |

## Capability matrix

| Capability | owner | admin | regular | guest |
|------------|:-----:|:-----:|:-------:|:-----:|
| View org / projects / deployments | ✅ | ✅ | ✅ | ✅ |
| View members directory, audit logs, AWS accounts | ✅ | ✅ | ✅ | ❌ |
| Create / edit / delete projects | ✅ | ✅ | ✅ | ❌ |
| Trigger deployments | ✅ | ✅ | ✅ | ❌ |
| Create / edit / delete AWS accounts (cloud credentials) | ✅ | ✅ | ❌ | ❌ |
| Comment / reply / react on annotations | ✅ | ✅ | ✅ | ✅ |
| Resolve / reopen / archive annotations | ✅ | ✅ | ✅ | own only |
| Edit own comment | ✅ | ✅ | ✅ | ✅ |
| Delete (moderate) anyone's comment / thread | ✅ | ✅ | ❌ | ❌ |
| Edit organisation name | ✅ | ✅ | ❌ | ❌ |
| Invite / remove members, change roles | ✅ | ✅ | ❌ | ❌ |
| Delete the organisation | ✅ | ❌ | ❌ | ❌ |

Notes:

- **AWS accounts are admin-only** because they hold cloud credentials. Regular
  members can build and deploy projects but cannot add, edit, or remove the AWS
  accounts those deployments target.
- **Guests are read-only for infrastructure but full collaborators in comments.**
  "Read-only" means no infra editing and no deploys; a guest can still create
  comments, reply, react, and resolve threads they started.
- **Guests cannot see the members directory, audit logs, or AWS accounts** at
  all — these are hidden in the UI and return `403` from the API. Guests can
  still @mention teammates in comments (that uses a separate, member-visible
  endpoint).
- A user can never act on another organisation's data, regardless of their role
  in their own org.

## Where it is enforced (backend — source of truth)

Authorisation is enforced server-side. The client is never trusted; every rule
in the matrix is independently checked by the API.

Permission classes live in `server/organisations/permissions.py`:

| Class | Allows | Used by |
|-------|--------|---------|
| `IsOrganisationMember` | any member (owner/admin/regular/guest) of the active org | project/deployment reads; annotation participation; @mentions |
| `IsNonGuestMember` | owner / admin / regular (blocks guest) | reads guests must not see: members directory, audit logs, AWS accounts |
| `CanWriteOrganisation` | owner / admin / regular (blocks guest) | project + deployment writes |
| `CanManageOrganisation` | owner / admin only | org settings, member management, AWS-account writes |

Applied at:

- **Projects** — `server/projects/views.py`: reads use `IsOrganisationMember`,
  writes use `CanWriteOrganisation`.
- **Deployments** — `server/deployments/views.py`: `create` uses
  `CanWriteOrganisation`, reads use `IsOrganisationMember`. (The deployer
  callback endpoint is `AllowAny` but gated by a per-deployment HMAC token.)
- **Members directory** — `server/organisations/views.py:OrganisationMemberViewSet`:
  reads use `IsNonGuestMember` (guests blocked); member mutations use
  `CanManageOrganisation`.
- **Audit logs** — `server/organisations/views.py:AuditLogViewSet`: read-only,
  `IsNonGuestMember` (guests blocked).
- **AWS accounts** — `server/organisations/views.py:AWSAccountViewSet`: reads use
  `IsNonGuestMember` (guests blocked), writes use `CanManageOrganisation`
  (admin-only).
- **Organisation settings** — org mutations use `CanManageOrganisation`; org
  deletion additionally checks `owner` in `perform_destroy`.
- **Annotations / comments** — `server/annotations/permissions.py`: all members
  may view/create/reply/react via `CanParticipateInAnnotations`. Finer rules are
  applied per object: `can_resolve` (write-roles may resolve any thread, guests
  only their own) and `can_moderate` (owner/admin may delete anyone's content).

## How the UI reflects it (frontend)

The frontend mirrors the backend rules so users never see a control that would
fail with a 403. **This is a UX layer only — it is not a security boundary.**
The server enforces every rule regardless of what the UI shows.

The single source of truth on the client is the `usePermissions()` hook
(`client/src/hooks/use-permissions.ts`), which derives capability booleans from
the active organisation's role:

```ts
const { isOwner, isGuest, canWrite, canManage, canModerate, canDeleteOrg } =
  usePermissions();
```

- `canWrite` — owner/admin/regular → projects, deployments.
- `canManage` — owner/admin → org settings, members, AWS accounts.
- `canModerate` — owner/admin → delete others' comments.
- `canDeleteOrg` — owner only.

Where the booleans are used:

- **Projects page** — "New Project", the empty-state create action, and per-card
  delete are gated on `canWrite`; guests see a "Read-only access" indicator.
- **Editor** — read-only roles get a locked canvas (no add/drag/connect/delete,
  no quick-add, no starter templates), a "Read-only" badge in the toolbar, a
  disabled Deploy button, and suppressed autosave. Comments stay fully enabled.
- **Organisation settings / members** — name edit, member invite/remove, role
  changes, AWS-account management, and org deletion are each gated on the
  appropriate booleans (`canManage`, `canDeleteOrg`). For guests, the **Members
  and Settings nav entries are hidden** and both pages show a restricted state
  if reached directly — there is nothing in either that a guest may see.
- **Comments** — Resolve/Reopen requires `canWrite` or owning the thread;
  Delete (thread or comment) requires authorship or `canModerate`; Edit is
  author-only. Replying and reacting are open to all members.

## Changing the model

Because the backend is authoritative, any change to the role model **must** be
made in the permission classes first, then mirrored in `usePermissions()` and
this document. Changing only the frontend changes nothing about what users can
actually do.
