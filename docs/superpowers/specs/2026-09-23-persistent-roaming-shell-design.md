# Persistent Roaming Shell Design

Date: 2026-09-23

## Goal

Make normal authenticated AUREVANE navigation feel materially faster by keeping the existing game shell mounted across roaming pages, without changing the current visual layouts, gameplay behavior, authorization boundaries, battle/session enforcement, character-selection behavior, or user-facing functionality.

This is a navigation/rendering optimization only. Existing visual output and game rules are the compatibility target.

## Non-negotiable acceptance criteria

1. Character, Arsenal, Passive Training, Online Users, Titles/Profile, and Controls retain their current layouts and responsive behavior.
2. No existing visible shell element may be removed, restyled, resized, repositioned, or replaced as part of this work.
3. Existing page-specific content, controls, copy, animations, audio controls, presence UI, identity rail, footer, and navigation behavior remain functionally equivalent.
4. All existing server-authoritative battle, spectator, selected-character, persistence, and authentication checks remain authoritative.
5. Switching characters must force a fresh authoritative shell state.
6. Entering a battle or spectator session must leave the persistent roaming shell and construct the battle experience from fresh server state.
7. Returning from battle must construct fresh roaming shell state.
8. Title/profile-display mutations must refresh the persistent shell identity using the existing `router.refresh()` mutation behavior.
9. No authenticated data may be cached globally across users.
10. Existing layout, desktop/mobile, buildcraft, battle, database/security, and browser-smoke suites must remain green.

## Current problem

The normal roaming pages each render `AuthenticatedShellFrame` inside their individual page shells. Navigating among those pages therefore reconstructs the same large presentation frame repeatedly even though most of it is unchanged:

- world/background presentation
- header and navigation
- character rail / shared identity presentation
- account controls
- online presence footer
- shared shell effects and client state

The first navigation-performance pass reduced backend fan-out and remount-triggered presence work. The remaining structural cost is repeated shell construction.

## Recommended architecture

Use a URL-transparent App Router route group under `/game` for normal roaming pages.

Conceptual shape:

```
app/game/
  page.tsx                         # character roster / selection entry; outside persistent shell
  create/...                       # outside persistent shell
  select/...                       # outside persistent shell

  (roaming)/
    layout.tsx                     # persistent authenticated roaming shell
    loading.tsx                    # page-body transition fallback only
    character/page.tsx
    arsenal/page.tsx
    training/page.tsx
    online/page.tsx
    account/titles/page.tsx
    settings/controls/page.tsx

  battle/
    page.tsx                       # Battle Hall launch may remain outside persistent roaming shell
    [battleSessionId]/page.tsx     # active battle; outside persistent shell
    spectate/[battleKey]/page.tsx  # spectator experience; outside persistent shell
```

Route groups do not change public URLs, so existing links remain `/game/character`, `/game/arsenal`, and so on.

## Shell boundary

The persistent `(roaming)/layout.tsx` owns the shared presentation frame only.

It must not become the sole authority for mutable game/session restrictions. Page-level server checks remain in place so stale layout state cannot grant access to a route that current server state forbids.

The shared layout may load only the data needed to render the shell itself. Page-specific data remains page-owned.

## Battle and character boundaries

Battle and character-selection transitions deliberately cross out of the roaming route group.

This is required because these transitions change authoritative identity/session state:

- selecting a different character
- creating a character
- entering PvE/PvP battle
- entering spectator mode
- leaving a battle/spectator session

Crossing the boundary forces a fresh server-rendered shell when returning to roaming pages.

## Page migration

Existing page components should be split minimally:

- remove the nested `AuthenticatedShellFrame` wrapper from roaming page shells;
- leave the existing page/body markup unchanged;
- preserve existing CSS modules and class names;
- preserve page-level server loaders, redirects, error handling, and recovery behavior;
- let the new roaming layout provide the frame exactly once.

No page redesign is permitted in this migration.

## Loading behavior

Add a `(roaming)/loading.tsx` that occupies only the page-content region.

Requirements:

- do not replace or flash the persistent header/rail/footer;
- do not alter page geometry enough to create layout shift;
- use existing AUREVANE visual primitives;
- remain subtle and non-distracting;
- loading UI is presentation-only and cannot imply successful authorization before page data resolves.

## Freshness and mutations

The shared roaming shell must remain fresh where identity/display mutations occur.

Existing title and custom-profile-image mutations already call `router.refresh()`; that behavior must be retained and covered by tests so the shared identity presentation refreshes after mutation.

Character switching and battle transitions do not rely on `router.refresh()`; they cross route boundaries and therefore create fresh authoritative shell state.

## Caching policy

This change does not enable broad user-data caching.

Do not use a global `use cache` boundary around authenticated shell data in the first implementation. Static/content-level caching can be evaluated separately after the persistent layout is proven stable.

This keeps the first architectural change focused on mount persistence rather than data-staleness semantics.

## Performance expectations

The implementation should reduce:

- repeated shared-shell Server Component work during roaming navigation;
- client remount work for shared shell components;
- repeated mounting of long-lived visual effects;
- layout reconstruction during Character ↔ Arsenal ↔ Training ↔ Online/Settings navigation.

It does not aim to change battle runtime polling, database authority, or page-specific query cost.

## Verification plan

### Source/contract tests

Add a navigation architecture contract verifying:

- roaming routes live under the route group;
- battle and character-selection routes remain outside it;
- roaming pages do not re-wrap themselves in `AuthenticatedShellFrame`;
- the roaming layout owns the shared frame.

### Browser persistence regression

Add an authenticated Playwright test:

1. open Character;
2. record a marker/state on a persistent shell DOM node;
3. navigate to Arsenal;
4. verify the same shell DOM instance/state survived;
5. navigate to Passive Training;
6. verify the shell still survived.

### Boundary refresh regression

Add browser coverage proving:

- switching characters creates a new shell;
- entering Battle leaves the roaming shell;
- returning from Battle creates fresh roaming shell state;
- title/profile-display mutation followed by `router.refresh()` updates shared identity presentation.

### Visual/layout regression

Run existing:

- UI layout review
- Desktop page fit
- Desktop experience
- Browser smoke
- Profile Skill Build
- Representative Buildcraft
- Battle Session DB
- Attribute Allocation
- Essence Build
- Resonance Build
- main CI/database foundation

No snapshot/layout expectation should be intentionally changed for this work.

## Rollout

1. Land the current low-risk navigation pass separately.
2. Rebase the persistent-shell implementation on the latest `main`.
3. Implement route-group migration without visual edits.
4. Run all exact-head CI and browser/layout regressions.
5. Build a Vercel preview for structural verification.
6. Promote only after exact-head checks pass.
7. Verify production navigation and runtime errors.
8. Relock Vercel immediately after release.

## Rollback

The route-group migration is reversible without schema/data rollback.

Rollback consists of restoring page-local `AuthenticatedShellFrame` ownership and removing the `(roaming)` layout/loading files. No database migration is part of this design.

## Out of scope

- page redesigns
- shell visual changes
- battle runtime changes
- combat/session authority changes
- broad Cache Components enablement
- global authenticated-user caching
- Supabase schema changes
- animation quality changes
- unrelated performance refactors

Those remain separate changes so regressions can be isolated.
