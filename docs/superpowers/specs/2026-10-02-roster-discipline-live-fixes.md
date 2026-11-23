# Owner roster, Discipline and Support refinement — 2026-10-02

Based on fresh main `439549e4f957d245aceb92e45e628a9fd57a96e1` after PRs #794–#796. The Owner's ongoing merge/deployment authorization applies to the verified continuation. This work does not activate P5 content or require migrations.

## Authorized implementation

- Character Select removes the decorative account grace-period footer only. Real deletion warnings remain. Discipline labels come from the owned character's committed build, including Secondary when present; only explicit absence of a legacy build uses the foundation fallback.
- Discipline Management selects the edited Primary/Secondary slot, then immediately saves a library choice through authoritative preview and commit. Remove Secondary Discipline replaces Use Primary only; no separate confirmation button remains. Selected slot and last successful Change Impact are the two lower panels. Impact clears on leaving; failed/pending/stale requests must not masquerade as a successful saved build.
- Techniques geometry is stable through selection, saving and failure. Support parameter fields describe their one effect concisely, with full explanation separate from compact fields.
- Owner explicitly chose Guard's independent two-owner-turn cooldown. Recovery retains its existing shared two-turn cooldown. Guarded potency, stacking and duration, AP costs, Recovery amount and legality remain unchanged. The canonical inherent-action rule applies to resumed battles on their next Guard use; no retroactive cooldown is invented and pinned authored definitions remain intact.
- Shared playable PvP/PvE cockpit uses translucent parchment and a registered transparent generated ornament. The red End Turn surround is removed. Artwork, control contrast and all dock/board geometry remain intact at desktop and phone breakpoints.
- Nexus content rows no longer stretch Skills or push Attunement down unnecessarily. Approved artwork sizes and functioning management controls remain intact.

## Battle Log proposal only

The Owner requested a plan for the small rail without scrolling. No log redesign is part of this implementation batch. Proposed layout: top Timeline/Text toggle and turn arrows, fit-based pages of action icons, then an available-height selected-action reader containing the recorded result, concise Skill description and one authored flavor line. Normal turns show all their icons, with the latest action selected by default. Clicking another icon changes the reader. Turn arrows disappear at history boundaries; separate labelled action paging (for example Actions 1–6) handles an overflowing turn. Separate labelled content pages handle long descriptions; every recorded action remains reachable. Reviewing an older turn preserves the selection when new events arrive. The map and rail dimensions stay stable.

Future implementation must preserve privacy-projected history and the battle's exact pinned Skill version, including copied identities. Current log entries do not contain description/flavor metadata; a safe server presentation projection is required. Do not infer missing flavor or use the current catalogue to rewrite historical definitions. Verify PvP, PvE and spectators at 220/264/300px rail widths, long turns, long names, multi-target results and hidden information. No scrolling, clipped text or discarded events is acceptable.

## Verification and release

See `../verification/2026-10-02-roster-discipline-live-fixes.md` for actual evidence and remaining gates. Authenticated Production and Owner visual acceptance are testing outcomes, not inferred from local mounted fixtures.
