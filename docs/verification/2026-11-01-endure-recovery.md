# Endure recovery

The Owner reported that Endure blocked movement, stalled Recruit AI and prevented the Master Panel from ending the encounter. The configured Skill combined Damage to Enemy with Endure on Self,400% return, radius1 and3turns. That setup is valid.

Movement and AI/PvP quality helpers reconstructed a temporary encounter with active Endure status but no private ledger. Strict validation rejected it. Master recovery separately cleared statuses while retaining the ledger, creating an invalid terminal application. Practice abort used the same incomplete reconstruction pattern. Source fixes preserve full authority during movement/quality updates and clear private execution state on terminal recovery. Surrender cancels only the forfeiting holder before turn handoff, preventing a release burst. Natural expiry remains authoritative; no public ledger or relaxed validator was introduced.

## Urgent hosted recovery

Only the recovery database correction and one requested NoContest operation are live. The broader application changes remain pending in PR#1002.

- Applied `20261101053041_master_recovery_private_execution_cleanup.sql`. The guarded patch changes exactly two cleanup key lists in the current `recover_master_player_battle_v1` definition, permitting Endure/Reversal ledgers to be discarded with their effects. It preserves delegated page authority, PT409 conflict handling, locks, participant/version checks, service-only ACL, function owner/configuration, no-reward rules and immutable NoContest safeguards.
- Exact hosted function readback equals the predecessor with only those two replacements. No table, grant, content publication or unrelated function changed.
- Validated the exact saved active encounter and generated terminal through the strict game engine. Resources, combatants, stats and captured definitions match the original.
- Rehearsed the canonical RPC inside a rolled-back transaction, then committed the same compare-and-swap operation once: version6→7, abandoned, NoContest/NoRewards, one receipt and one audit. No Endure ledger, AI/PvP turn clock or active encounter remains for the affected character. Character and build rows, level2,XP111 and cycle1 are unchanged.
- A preliminary rollback-only compatibility attempt was rejected by the immutable NoContest head guard. It committed no changes; the guard was preserved and the final recovery used the corrected canonical RPC directly.

Raw private snapshots and identifiers are excluded from this receipt. No full application deployment, automatic catalogue republication or phase closure occurred.

## Verification

Before hosted application,61 recovery SQL tests passed and two independent reviews approved the guarded patch. Focused Endure checks pass actual movement, support, enemy AI, JSON save/reload, timeout, surrender, practice abort, Master recovery and private projection. Full core passes6470tests. The completed source checkpoint passes pnpm check with14947 Vitest tests,7 Node tests and production build. New native editor/terrain CI remains pending; later Ground/Haste requests are separate work, tracked in the implementation plan.
