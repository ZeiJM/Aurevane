# Master Panel Combat Content Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a protected database-backed Master Panel editor for versioned Skill targeting/effects/content publishing, with immutable publication history, server validation, preview/simulation, rollback, and new-battle snapshot resolution from published definitions.

**Architecture:** Treat `packages/game-core` validators/types from the runtime plan as the only combat-rule schema. Store drafts and immutable published versions in Supabase, expose them through a server-only resolver, and snapshot exact published definitions into new battles. Static code remains the seed/fallback authority until equivalent published rows exist; historical battles remain pinned to stored content versions.

**Tech Stack:** Next.js 16/React 19, TypeScript 6, Supabase/PostgreSQL migrations, server-only repository/service pattern, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-combat-authoring-dots-copy-revision-design.md`, `docs/superpowers/specs/2026-09-12-reactive-effects-accuracy-discipline-rebalance-design.md`, `docs/superpowers/specs/2026-09-12-covert-sensory-revealed-design.md`

## Global Constraints

- Depends on runtime/effect plan pure validators and versioned combat-definition interfaces.
- Browser never writes published combat rows directly; protected server authority validates/publishes/rolls back.
- Server validation uses the same game-core rules as battle execution.
- Publish creates immutable versions; current pointer changes, old rows never mutate.
- New battles use current publication when present; historical snapshots retain pinned definitions.
- Static source content remains seed/fallback until a publication exists.
- Presentation tags are derived, never independently hand-authored.
- Typed fields cover target kind/team/range/LoS/elevation/Single-Circle-Line/friendly fire/effect order/recipients/AP/MP/accuracy/enabled/version.
- Typed effects cover current damage/recovery/status/displacement/terrain/DoT/Copy/reactions/Blind/Vengeance/Amplify/Curse/Covert/Sensory contracts.
- No arbitrary combat script field.
- Rollback re-points current publication to an older immutable version.
- Production deployment is not part of this plan.

---

### Task 1: Combat Content Persistence Schema

**Files:** Create `supabase/migrations/20260913120000_combat_content_authoring.sql`, `packages/db/src/combat-content.ts`, tests; modify DB exports if required.

**Interfaces:** Produce draft records, immutable version records, current publication pointer, audit metadata, repository contract.

- [ ] Write failing repository contract tests: mutable drafts, immutable versions, monotonic version, current pointer, rollback without deletion.
- [ ] Add private SQL tables:
```sql
create table app_private.combat_content_versions (
  id uuid primary key default gen_random_uuid(),
  content_key text not null,
  content_kind text not null check (content_kind in ('skill','status','effect-profile')),
  content_version integer not null check (content_version > 0),
  definition jsonb not null,
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default clock_timestamp(),
  unique (content_key, content_version)
);

create table app_private.combat_content_publications (
  content_key text primary key,
  content_kind text not null,
  version_id uuid not null references app_private.combat_content_versions(id),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default clock_timestamp()
);
```
Add draft table with definition/base-version/updated-by/updated-at/optimistic version; revoke browser roles and grant service-role only.
- [ ] Implement:
```ts
export interface CombatContentRepository {
  findDraft(contentKey: string): Promise<CombatContentDraftRecord | null>
  saveDraft(input: SaveCombatContentDraftInput): Promise<CombatContentDraftRecord>
  publish(input: PublishCombatContentInput): Promise<CombatContentVersionRecord>
  findPublished(contentKey: string): Promise<CombatContentVersionRecord | null>
  listPublishedVersions(contentKey: string): Promise<readonly CombatContentVersionRecord[]>
  setCurrentPublication(contentKey: string, version: number, actorUserId: string): Promise<void>
}
```
- [ ] Run `pnpm --filter @aurevane/db test` and commit `feat: add versioned combat content storage`.

### Task 2: Server-Only Published Combat Content Resolver

**Files:** Create `apps/web/src/server/combat/combat-content-resolver.ts` + test; modify `battle-build-authority.ts`, PvP lobby service/tests.

- [ ] Failing resolver tests: static fallback; DB current publication; exact historical pinned version; invalid stored definition errors instead of silent semantic fallback; derived tags.
- [ ] Run:
```bash
pnpm --filter @aurevane/web exec vitest run src/server/combat/combat-content-resolver.test.ts src/server/battle/battle-build-authority-mixed-source-cap.test.ts
```
- [ ] Implement:
```ts
export interface CombatContentResolver {
  resolveCurrentSkillDefinition(skillId: string): Promise<MatureSkillDefinition | null>
  resolvePinnedSkillDefinition(skillId: string, version: number): Promise<MatureSkillDefinition | null>
}
```
Validate DB definitions using game-core before returning them.
- [ ] Snapshot resolved current/pinned version into new battle build authority.
- [ ] Re-run and commit `feat: resolve published combat definitions`.

### Task 3: Protected Draft/Validate/Diff/Publish Service

**Files:** Create `apps/web/src/server/master/combat-content-service.ts`, handler, tests; reuse existing Master Panel auth guard.

- [ ] Auth tests: unauthorized cannot read/save/publish; authorized Owner/content staff can.
- [ ] Validation tests reject impossible ranges/shapes, invalid Push/Pull, recovery ticks, Bleed budget, Sensory routing, Copy source targeting, uncapped Vengeance, unknown effects, mismatched manual tags.
- [ ] Publish tests: base N creates immutable N+1 and pointer atomically; stale-base conflict.
- [ ] Run:
```bash
pnpm --filter @aurevane/web exec vitest run src/server/master/combat-content-service.test.ts src/server/master/combat-content-handler.test.ts
```
- [ ] Implement:
```ts
export interface CombatContentValidationResult {
  valid: boolean
  issues: readonly { path: string; code: string; message: string }[]
  derivedTags: readonly string[]
}
```
Publish transaction: re-read pointer → base check → validate → insert immutable version → update pointer → clear/rebase draft.
- [ ] Re-run and commit `feat: add protected combat content publishing service`.

### Task 4: Combat Content Simulation/Preview

**Files:** Create `apps/web/src/server/master/combat-content-preview.ts` + test; modify service.

- [ ] Failing preview tests: targeting, derived tags, AP/MP, hit chance, direct effects, DoT/recovery, displacement, Vengeance, conditional Sensory, Copy pool/count without result.
- [ ] Run:
```bash
pnpm --filter @aurevane/web exec vitest run src/server/master/combat-content-preview.test.ts
```
- [ ] Implement pure non-persisting deterministic fixture simulation with its own explicit seed; do not consume production battle RNG.
- [ ] Re-run and commit `feat: preview combat content drafts`.

### Task 5: Master Panel Combat Content Page Shell

**Files:** Modify `apps/web/src/app/master/page.tsx`; create `apps/web/src/app/master/combat-content/page.tsx`, `apps/web/src/components/master/combat-content/combat-content-editor.tsx`, CSS/test.

- [ ] Component tests: Discipline/Skill selector, current version, draft/base version, validation status, Validate/Diff/Preview/Publish/Rollback controls, derived tags read-only.
- [ ] Run:
```bash
pnpm --filter @aurevane/web exec vitest run src/components/master/combat-content/combat-content-editor.test.tsx
```
- [ ] Implement protected server page + client draft editor only.
- [ ] Re-run and commit `feat: add master combat content editor shell`.

### Task 6: Targeting and Action-Economy Controls

**Files:** Create `skill-targeting-editor.tsx`, `skill-economy-editor.tsx` and tests; modify editor.

- [ ] Target tests: Circle radius vs Line length conditional controls; legal target/team options; min/max validation.
- [ ] Economy tests: AP, MP, Automatic Hit/Accuracy Roll, signed accuracy modifier; no editable gameplay-tag field.
- [ ] Run focused Vitest.
- [ ] Use discriminated draft types matching game-core exactly.
- [ ] Re-run and commit `feat: author skill targeting and economy`.

### Task 7: Ordered Typed Effect-Block Editor

**Files:** Create `skill-effect-list-editor.tsx`, `skill-effect-editor.tsx` + tests; modify editor.

- [ ] Add/remove/reorder tests serialize visible order.
- [ ] Type-specific tests cover Dmg/element/Pierce; Heal/MP Rec; apply/remove status; Cleanse/Dispel; Push/Pull; Revert/Freeze Ground; Bleed; Poison/Burn profile; Copy; Absorb HP/MP/Reflect; Blind; Vengeance; Amplify/Curse; Covert; Sensory/Revealed.
- [ ] Run:
```bash
pnpm --filter @aurevane/web exec vitest run src/components/master/combat-content/skill-effect-list-editor.test.tsx src/components/master/combat-content/skill-effect-editor.test.tsx
```
- [ ] Explicit editor branch for every supported current effect union member; no raw script/JSON escape hatch.
- [ ] Re-run and commit `feat: author typed combat skill effects`.

### Task 8: Validate, Diff, Preview, Publish, Rollback UX

**Files:** Create review panel/version history + tests; modify editor.

- [ ] Workflow tests: Publish disabled before validation; edit invalidates validation; semantic diff; preview; publish increments current; rollback repoints without deletion.
- [ ] Run focused Vitest.
- [ ] Explicit publish confirmation shows content key/base/new version/validation/diff.
- [ ] Re-run and commit `feat: publish and rollback combat content`.

### Task 9: Player-Facing and Battle Consumption of Publications

**Files:** Modify server battle build authority; current Skill-detail server loader/data boundary; related tests.

- [ ] Publication propagation test: new Skill detail + new battle use publication; existing battle keeps pinned old definition.
- [ ] Run:
```bash
pnpm --filter @aurevane/web exec vitest run src/server/battle/battle-session-primary-build.test.ts src/server/battle/phase4-snapshot-compatibility.test.ts src/components/character/skill-detail-presentation.test.ts
```
- [ ] Route current-definition resolution through server resolver, never direct Master table reads from React.
- [ ] Re-run and commit `feat: consume published combat content`.

### Task 10: Browser Verification and Documentation

**Files:** Create `apps/web/e2e/master-combat-content-authoring.pw.ts`; modify combat/Master Panel docs.

- [ ] Browser flow: authorized editor → draft harmless Skill change → validate → diff → preview → publish → version increment → new battle pins publication → rollback → old battle stays pinned.
- [ ] Run:
```bash
pnpm --filter @aurevane/web test:browser -- e2e/master-combat-content-authoring.pw.ts
pnpm --filter @aurevane/db test
pnpm --filter @aurevane/game-core test
pnpm --filter @aurevane/web test
pnpm check
```
- [ ] Document static fallback vs publication precedence, immutable versions, pinning, server validation, authoring fields, rollback, and fixed typed Covert privacy semantics.
- [ ] Commit `docs: verify master combat content authoring`.
