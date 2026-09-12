# Phase 4 combat completeness

Authority: Owner request to complete Phase 4, including battle tags/targeting and Discipline Atlas/Mastery within Profile → Discipline Management. GAME_MASTER_PLAN §18, ROADMAP Phase 4, COMBAT, and ROADMAP_DISCIPLINE_ATLAS_MASTERY govern scope. Existing implementation and production evidence must be credited accurately.

## Approved scope and constraints

Complete the first playable roster's combat grammar and publish it for testing. Preserve 17 published Disciplines, eight regular Skills each, pure Essences, mixed Resonances, four selected Skills, AP/MP and repeat-use rules, authoritative intent/preview/commit, immutable historical content versions, bounded deterministic state, and existing acquired character data. All 36 Atlas identities remain visible according to reveal policy; unpublished nodes remain planned. Later world quests, full 36-class combat publication, mature summon armies, supernatural identities, and human balance approval are outside this phase.

## Missing runtime contract

1. Typed gameplay tags cover Scorched, Frozen, Conductive, Wet, Bleeding, Marked, Guarded, Inspired, Hexed, Invisible, Exposed, Poisoned, Fortified, Summoned, Airborne, Displaced. Existing status IDs remain compatible (burn→Scorched, bleed→Bleeding, poison→Poisoned). Requirements/modifiers can consume typed tags rather than relying on display strings. Summoned describes an authored temporary spirit protection effect, not an extra actor/turn; Airborne is a temporary terrain exemption, not flight outside board rules.
2. Water Skills can apply Wet; storm damage exploits Wet or Conductive once (20% bounded bonus, consumes Conductive); fire removes Wet and Frozen rather than adding a weakness wheel. Existing damage caps/defenses still apply. Marked and Bleeding remain usable cross-Discipline setup. Inspired gives a bounded 10% outgoing benefit. Hexed reduces incoming healing by 25%. Invisible prevents hostile direct unit targeting, is broken by the holder's damaging action or taking damage, and does not protect from area/ground effects. Summoned protection is dispellable. Airborne ignores temporary frozen traversal surcharge. Displaced records a successful bounded push, never grants a turn or AP refund.
3. Authored ground effects can create Frozen terrain. Frozen adds 10 AP per traversed tile without increasing Movement allowance. Fire on Frozen replaces it with Steam. Steam blocks line of sight through its tile. Both expire after two round boundaries; refresh never stacks; at most one overlay per board tile. Overlays preserve base terrain, persist through JSON snapshots/reloads and all wrappers, and use the same deterministic preview/execute rules. Tile overlays affect both teams; per-unit friendly fire remains explicit. No client-generated effects or arbitrary scripts.
4. One-tile displacement must remain in bounds, passable, vacant and within legal elevation; failure must not teleport, overlap units or refund resources. Existing Root/movement rules apply. All effects, conversions, durations and legality failures must be visible in forecast/log/inspection and work through AI/PvP/spectator paths.
5. Publish versioned authored examples on the existing roster with producer/consumer tests. Do not silently change stored historical version definitions. Additive migrations must move future build selection to latest definitions while old battles keep their snapshots. Do not change mastery grants into fabricated earned XP.

## Presentation and Atlas

Ground and empty-tile targeting submit tile intents from the existing shared battlefield, including empty tiles and keyboard activation. Preview stays silent and never spends resources. Confirmation commits once through existing authority. Status and terrain names, duration, affected teams, requirements, and interactions come from typed definitions. Desktop/mobile playable and spectator parity is required.

Discipline Atlas/Mastery stays inside the Profile Discipline Management popup. Audit and complete publication vs. earned eligibility vs. testing access, accurate 36/17 counts, mastery progress, unmet prerequisites, accessible responsive expansion, and secret reveal privacy. Preserve the existing illustrated Manual. No full-roster redesign.

## Completion evidence

Create a requirement-to-code/test ledger covering every Phase 4 roadmap item, including inherited equipment/stat integration, actual AI choice, pair coverage, Mastery acquisition, maps, media hooks and current authored media. Distinguish code/release verification from human balance/art acceptance. Require focused engine and server compatibility tests, UI regression coverage, repository gate, final diff review, CI on the final reconciled head, additive database validation, production release and authenticated browser checks. Prior Owner authorization covers this release; restore the deployment lock afterwards.
