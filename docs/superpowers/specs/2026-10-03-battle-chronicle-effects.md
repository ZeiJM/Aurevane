# Approved battle chronicle and effect lifecycle

Owner approval: 2026-10-02, after iterative mockup review. Implement the last approved image `exec-4e68f841-7373-4253-b72a-d38731775006.png` from this conversation.

## Chronicle

- Narrow parchment rail and thin brass border, unchanged battlefield/cockpit geometry; compact text only, scrolling permitted.
- No Battle Log/Live header, action counts, format toggle, icon timeline or pagination. Slim ROUND dividers; each character owns one group per round, containing their techniques and triggered special abilities. Group by acting character, not recipient; retain every authorized result.
- Technique name, one or two short authored story sentences, then compact actual outcomes. Names/narration dark ink, harm crimson, HP/MP recovery moss green. Essence, Resonance, Ascension and Severence use restrained gold and stay inside their owner's group; do not invent unavailable powers.
- Omit ordinary movement, end turn, facing and passive expiry/fades from this view; preserve server history and export/privacy authority. Skill-driven displacement/cleanse remain actual outcomes.
- Hover/focus/click named effects for one standardized brief explanation. No fake quantities, inferred hits, fresh catalogue history upgrades or unauthorized content lookups.
- Skill descriptors and narration remain editable through versioned Master authoring; support actor/target names and pronouns without inferring gender from appearance. Missing historical identity uses a neutral fallback.

## Effect timing and rail

- Show pending effect icons immediately. Default non-damage/non-recovery effects activate at the start of the following battle round. Damage and recovery default instant. Master controls which tags use delayed versus instant timing.
- One-turn active effects survive other participants' turns and the affected character's full active turn, expiring after that character ends it. Delayed status ticks do not fire or modifiers influence combat while pending. Multi-turn counters use affected-character completed turns.
- Preserve cooldown authority separately. Pin timing policy for a battle; Master edits must not retroactively reinterpret historical snapshots.
- Distinct simple logical identifiers for each rail effect. Hover/focus/click reports standard tag meaning, pending/active timing and turns remaining. Preserve the two-row effect grid, portrait/vitals and fixed map/cockpit geometry.

## Preview cleanup

Remove redundant targeting-summary prose below full parameter tables everywhere (the owner's 'Single target · Affects: Enemies only' screenshot). Keep the ten-field Skill information contract, effects and required mechanical facts in the canonical rows, without changing targeting legality.

## Safety and release

Shared PvP/PvE/spectator presentation; server authority, privacy, idempotency and pinned content remain intact. Keep P5, Clash and unrelated work out. Refresh Main, use the existing isolated UI branch, verify focused regressions plus full quality/database/browser gates, review, then merge/deploy under the Owner's standing authorization. No unrelated blocked Production migrations or content activation.
