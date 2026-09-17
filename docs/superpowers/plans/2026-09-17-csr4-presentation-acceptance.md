# CSR-4 — Covert / Sensory / Revealed presentation and acceptance

**Status:** implementation plan  
**Branch:** `agent/combat-csr4-presentation-acceptance-20260917`  
**Base:** verified shared combat merge `686af92b809b8d14d70650ca9bd44df3ad9c17de`  
**Scope:** presentation and acceptance only; no combat-mechanic redesign, Master Panel authoring, publication, deployment, or `main` integration.

## Behavioral delta

Present the already-authoritative CSR engine/privacy behavior truthfully and consistently across shared PvP/PvE/spectator battle UI, without allowing any browser surface to reconstruct hidden Covert information.

## Existing authority to preserve

- Live battle snapshots are already viewer-projected server-side; opponents/spectators do not receive hidden positive status payloads.
- Historical battle logs are already viewer-projected server-side; hidden commands become `hidden_combat_action` and positive lifecycle details are suppressed until the approved Sensory reveal boundary.
- Revealed AP costs are already calculated by the shared authoritative action-economy evaluator used by preview, commit, and Recruit AI.
- Sensory legality remains independent of whether an opposing target is secretly Covert.
- PvP is the canonical shared presentation reference; applicable changes must flow through shared battle presentation rather than duplicated PvE/spectator implementations.

## Task 1 — CSR active-status presentation

**Files:**
- `packages/game-core/src/combat/status-content.ts`
- `apps/web/src/components/battle/battle-combatant-effects.test.tsx`

Add focused RED coverage proving:
- entitled viewers see Covert as a positive/Buff effect with truthful secrecy wording and remaining duration;
- Revealed renders as a negative/Debuff effect describing the qualifying Skill AP ×2 tax and Covert lockout;
- no hidden-count placeholder is invented when the projected status list is empty.

Implement the smallest shared status-presentation metadata extension. Do not add Covert/Revealed to the fixed-duration `PHASE4_STATUSES` catalog because their duration is authored by CSR content; keep runtime remaining duration sourced from the projected status instance.

## Task 2 — Hidden command + public consequence log beat

**Files:**
- `apps/web/src/components/battle/battle-log-presentation.ts`
- `apps/web/src/components/battle/battle-log-presentation.test.ts`

Add a RED regression where one battle version contains:
- `hidden_combat_action`; and
- a viewer-entitled public status consequence from that command (for example Revealed at the Sensory boundary).

Required presentation:
- the primary beat remains `<Combatant> performed an action.`;
- the visible public consequence may appear as a secondary line;
- action ID/name, target of the hidden command, hit/miss, AP/MP, hidden child count/order, and hidden details remain absent;
- a lone hidden command still renders one generic beat.

Implement an explicit `hidden_combat_action` presentation branch before ordinary visible action/status inference so later grouping changes cannot silently erase the required generic beat.

## Task 3 — Sensory/Revealed preview acceptance

**Files:**
- `apps/web/src/components/battle/battle-action-preview.test.tsx`
- `apps/web/src/components/battle/battle-preview-content.test.ts`
- production code only if the RED assertions expose a real presentation gap.

Prove:
- selected Sensory Skills display the typed Sensory tag and the conditional rule without asserting whether the target is currently Covert;
- exact action preview displays the server-authoritative Revealed-adjusted AP cost and unchanged MP cost;
- a legal Sensory attempt does not gain a target-state oracle in UI wording;
- normal blocked/accuracy behavior remains unchanged.

Reuse existing `skillEffectDescription`, typed presentation tags, and authoritative preview payloads. Do not recalculate Revealed costs in React.

## Task 4 — inspect/reconnect/spectator acceptance

Inspect the existing desktop/mobile/PvP/spectator surfaces and keep them on projected battle state. Add focused automated guards where a practical shared boundary exists, then use the repository browser-smoke workflow for rendered acceptance.

Acceptance matrix:
- playable PvP desktop/mobile;
- PvE desktop/mobile where shared UI applies;
- spectator inspection/log view;
- participant reconnect/refetch;
- owner/allied full status visibility versus opponent/spectator redaction;
- negative Revealed remains visible;
- old hidden log entries stay generic after later Reveal.

Do not add client-side Covert filtering as a security mechanism. The browser must continue to receive only server-projected state/history.

## Verification and merge gate

1. Record focused RED failures on the intended presentation gaps.
2. Apply the smallest production changes.
3. Run focused tests for status presentation, log presentation, preview content/action preview, and adjacent shared battle presentation.
4. Run formatting, lint, web/game-core typecheck and relevant unit suites.
5. Open a PR into `agent/combat-effect-taxonomy-rework`, never `main`.
6. Require the complete exact-head PR matrix, including Browser smoke and Battle Session DB/privacy regressions.
7. Inspect reviews, inline threads, comments, candidate/shared/main freshness, and competing PRs.
8. Merge only the exact verified candidate into the shared combat branch.
9. Verify merge parents/tree and all shared-branch post-merge workflows.
10. Confirm `main` remains untouched.

Master Panel CSR authoring remains the next separate workstream after CSR-4 closes.