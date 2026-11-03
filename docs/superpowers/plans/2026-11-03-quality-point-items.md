# Quality Point Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver persistent 100-QP equipment/inventory, shared-engine weapon/support/item actions, artwork and the complete Owner acceptance checklist.

**Architecture:** Retained Item V1 stays historical; executable Item V2 uses the existing content lifecycle. Atomic owned-stack/equipment services validate QP, slots and battle admission. Ordinary captured AbilityDefinition sources implement every battle effect.

**Tech Stack:** TypeScript/React/Next.js, game-core, Supabase PostgreSQL with existing service-only RPCs, Vitest/PGlite/pgTAP and native Playwright.

**Spec:** `docs/superpowers/specs/2026-11-03-quality-point-items-design.md`.

## Global Constraints

- Hard100 equippedQP; six equipment positions; six40-slot inventory categories; Gear stack1, other stacks at most99.
- Starter battle supplies refill per battle and do not consume owned quantities. Do not advertise future consuming items without atomic settlement.
- Main-hand weapon supplies Basic Attack; off-hand weapon used only when main has no weapon; one selected Support Action.
- Shared combat engine and current/pinned publication authorities; historical captures and user drafts preserved.
- Cockpit Inspect/Move/Basic Attack/Item/Support; singular Item, existing custom keys preserved.
- All47 starter/sample Items have real art; mobile390/412; no per-stage deployments.
- QP/ownership/hand/revision/active-battle checks are server-owned. Item-level wrapper Requirements null; bound ability Requirements normal.

## Review Focus

- Publication changes QP/slot/stack shape after ownership: retain inventory, reject incompatible shape and block invalid new admission.
- Equip races battle entry or simultaneous sort/grant: one authoritative revision, shared locks, no stale ownership capture.
- Same-item/two-hand source identities: count occupied units correctly, count a two-handed weapon once, never expose another character's inventory.
- Reload/retry/pending effects: one activation spends one use, never another on queued packet execution or duplicate request.
- Movement/passive modifiers across all raw stat consumers: same effective values in previews/actual damage/initial and later turns, no cumulative bonus on reload.

---

### Task 0: Finish Skill corrections before Item execution

**Files:** existing paired-status patch; `apps/web/src/lib/combat-whole-requirements.ts`, current-authoring corrector/validation, shared explanation grouping; audit scripts/report and tests.

- [x] Reproduce unequal implicit Reckless/Fortified, add optional current policy, preserve explicit/custom/historical values, verify real mechanics/readers.
- [x] Correct actual13 published effect-gated records prospectively. Remove OpenWound's direct same-effect Bleed gate; promote legitimate conditions to whole Requirements and preserve exact comparators. Review CloseQuarry Enemy follow-up.
- [x] Deduplicate bottom explanations by stable semantic Tag, retaining all packets/custom notes/history caveats.
- [x] Run audit in CI and commit bounded source snapshot/candidate; no unreviewed hosted publication.
- [x] Verify fresh-target OpenWound actual Bleed and3ticks through reload; whole gate before payment for all corrected cases.

### Task 1: Typed Item and owned-inventory domain

**Files:** `packages/game-core/src/content/authored-content.ts`, new `items.ts`, `item-inventory.ts`, domain tests; additive migrations and DB tests; `packages/game-core/package.json` exports.

**Interfaces:** RuntimeItemDefinition V2 and legacy union; ItemInventorySnapshot (character/revision/stacks/equipment/selected equipment support), `validateEquipmentLoadout`, `equipInventoryItem`, `unequipInventoryItem`, `sortItemInventory`, `grantInventoryItems`. Exact field contract follows the spec; typed failures distinguish overQP, hand/slot, ownership, quantity/capacity and stale revision.

- [x] RED:100QP accepts/101rejects,2Hcounts once/conflicts,40/41category,99/100stack, nonowned/repeated foreign assignments, support binding/source removal.
- [x] Implement pure checked domain operations and retained V1/current V2 validation; immutable inputs and bounded arithmetic.
- [x] RED migrated DB: cross-player/RLS, direct client denial, atomic CAS/locks, duplicate first-load grants, conflicting category publication, full-category rollback, active-battle rejection.
- [x] Add service-only inventory/equipment functions and current runtime Item resolution from the same authoritative definitions; seed new source defaults idempotently without broad catalogue rewrite.
- [x] Verify PGlite/pgTAP appropriate scopes, types/lint, commit owned files.

### Task 2: Generic passive stats, elemental bonuses and finite uses

**Files:** core tag/definition/runtime/usage validators and shared effective stats/turn preparation, damage composition/accuracy/ground/summon readers, focused tests.

**Interfaces:** `stat-bonus {recipient:'actor',stat,amount}` ongoing modifier; optional `damage-bonus.elementFilter`; `AbilityBehavior.maximumUsesPerBattle`, persisted usageCount and shared remaining-use query.

- [x] RED: Movement boots+1/+2 affect initial and next own turns without extra AP or double-add after reload; bonus removal/conditional next-turn semantics; shared direct defense/power/accuracy/summon/Ground captures.
- [x] RED: Fire/Water mixed action boosts Fire only; absent filter is unchanged and periodic effects are not boosted twice.
- [x] RED: max3 allows3committed attempts then blocks; previews/stale retries/priming/queued effects do not increment; new battle resets; existing once/round/cooldown bounds still win.
- [x] Implement common primitive/validators and shared accessors, preserving historical absent fields, current raw profiles and original base Movement. Expose shared editor/report support without duplicating Item effect fields.
- [x] Run adjacent mechanics/current-history tests and types/lint; commit owned files.

### Task 3: Persistent player service and Master publication/editor

**Files:** new `apps/web/src/server/character/character-items-service.ts` and Supabase repository; authenticated Item API; existing combat-content Item defaults/descriptor/resolver/validator/media/editor, tests.

**Interfaces:** `loadCharacterItems(userId,characterId) -> CharacterItemsView`, mutation(command,expectedRevision); current/pinned runtime Item APIs; public ItemPresentation with canonical reports/image paths; no raw private source inventory in UI.

- [x] RED complete request roundtrip: first grant, equip/swap/unequip, persisted sort, reload, current media changes, source Support fallback, unauthorized grants and stale commands.
- [x] Enable Item runtime publication only after real adapters exist; retain other future-kind blockers. Validate builtin/finalized art and supported passive/action bindings.
- [x] Extend sanitized shared Master editor and actual Item preview; duplicate/test grant through existing staff audit/capability paths.
- [x] Add immutable inventory-shape publication checks and fresh token/revision checks.
- [x] Verify API/DB/editor integration, current-publication readback and draft persistence; commit.

### Task 4: Arsenal inventory/equipment UI

**Files:** replace `/game/loadout/items/page.tsx` placeholder with new Item client shell/CSS/detail reader; add support choices to existing Arsenal Support area; focused and browser tests.

**Interfaces:** consumes CharacterItemsView/mutation API and ItemPresentation from Task3. Owns selection/search/filter/scroll/dialog UI, not authoritative eligibility.

- [ ] RED render/interaction:6tabs/40slots, real thumbnails/99counts, search/sorts/filters, six gear positions andQPsum, shortage/swap explanations.
- [ ] Implement persisted equip/unequip/sort and candidate previews, two-hand occupancy, item/slot comparison; current selected equipment-support notice/fallback.
- [ ] Native desktop390/412 exercise slot/detail/equip/reload and real visible art; no page-level clipping or inaccessible actions.
- [ ] Verify appropriate component/service/browser checks, types/lint; commit.

### Task 5: Frozen battle admission and cockpit actions

**Files:** build snapshot/types/repository/proofs, `battle-build-authority.ts`, `battle-ability-startup.ts`, PvE/PvP/map entry; captured equipment sources; action/preview/log/public projection; BattleExperience/SkillCommand/preview item picker/keybinding labels, tests.

**Interfaces:** frozen equipped Item references and weapon/support/use action bindings; sourceKind equipment; existing canonical action intents and shared finite-use engine. BattleItemPresentation is owner-only with hand, image, action/behavior, costs, uses and eligibility reason.

- [ ] RED equip versus admission race, invalid currentQP/noitem ownership, source fingerprints, pending/active battle restriction and frozen reload after Master edits.
- [ ] Capture authenticated sources and passives at startup; weapon keeps BasicAttack semantics; selected granted Support competes in the one slot, no live catalogue lookups during battle.
- [ ] RED actual quote/payment/effect/use count/Chronicle for item action; rejected/stale/replayed requests unchanged; source visibility and opponent/spectator omission.
- [ ] Implement cockpit order/Item singular, unlock allmouse/keyboard/touch paths, preview pane1/2image+name+AP+uses+ichoices, shared info/target/forecast/commit; own weapon art/report.
- [ ] Native PvE/PvP/spectator desktop/mobile actual full flow, including same-name/same-item hand identity, Self deliberate click and custom keybindings.
- [ ] Run focused then assembled quality/build and commit.

### Task 6: Starter set, art and delivery

**Files:** current starter Item definitions/seed manifest, registered per-item artwork/thumbnails/provenance; tests; active authority docs and Owner checklist.

- [ ] Author11armor/2passivehand/8weapon/11battle/15sample items using real effects and100AP economy; include Movement+1/+2 boots and50QP2Hweapon.
- [ ] Check weapon baseline output roughly60–70% comparable Discipline, perAP and scenario, plus actual double hit/element/Guard/Defense behaviors. Avoid prose-only mechanics.
- [ ] Generate and inspect all47 item images, optimize/registry-prove allpaths, actualpreviewpane thumbnails; retain prompt/source manifests.
- [ ] Verify starter grants idempotent and stack12/40/99 samples persist; current items editable through Master with correct history.
- [ ] Fresh-main reconcile, independent whole-branch review, full required CI at exact head and coordinated release/migrations/publications through existing procedures.
- [ ] Publish the Owner checklist only with truthful implementation/release status; human tests stay unchecked until performed.
