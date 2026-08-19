# AUREVANE — Passive Training, Training Reports & Rested Progression

**Status:** Authoritative feature specification subordinate to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/PROGRESSION_RETENTION.md`, `docs/NATURAL_PACING.md`, and `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md`.

**Initial direction approved:** 2026-08-15.  
**Current Passive Training / terminology synchronization:** 2026-08-19.

AUREVANE should respect the player's life outside the game while offering an optional background-progression choice that never competes with active play.

Progress is created only by an explicit **Passive Training** session. Simply being logged out, idle, or away does not manufacture a new reward.

The player-facing system is called **Passive Training**.

A completed session is presented as a **Training Report**.

Older Wayfarer's Practice / automatic-offline-accrual wording is historical. Already-materialized legacy Training Reports remain preserved safely, but new sessions follow the explicit-start Passive Training contract.

---

## 1. Product Goal

Passive Training is an optional background-progression choice. A player deliberately starts one server-timed block and can then remain signed in, go AFK, or close the browser without changing the authoritative timer.

A completed block can produce a report such as:

```text
PASSIVE TRAINING — COMPLETE

Medium · 8h
+ 56 Character XP

[Claim Training]
```

The desired feeling is:

> “I chose a useful background task while I was busy, and now my character has a small reward waiting.”

not:

> “I need to stay logged out for the game to reward me.”

This system exists to:

- provide intentional background progression;
- reward shorter plans with better hourly efficiency;
- let longer plans trade efficiency for convenience;
- create a satisfying completion-and-claim ritual;
- support the long character journey without replacing active play;
- remain understandable without hidden offline-state rules.

---

## 2. Relationship to Natural Pacing

Passive Training must never become the primary way a character progresses or a gate that blocks ordinary non-combat use until a timer finishes.

While a block is active:

- starting a new Battle Hall fight/live combat entry is disabled under the current model;
- profile, account, Manual/News/Rules, Online Users, and social/chat surfaces may remain available;
- the player may stop the unfinished block at any time;
- stopping early grants no partial reward.

The long-horizon progression target still comes primarily from meaningful active progression, Discipline use and mastery challenges, Primary/Secondary build development, Resonance or pure-Discipline Essence, world/story progress, Expeditions and bosses, Soulmark or Soul-Severed/Mantle progression, Archive/lore development, endgame qualification, and live-world cadence.

Passive Training supports that journey. It does not replace it.

---

## 3. Core Player Loop

```text
OPEN PASSIVE TRAINING
  ↓
Choose Short / Medium / Extended
  ↓
Server records authoritative plan, start and duration
  ↓
Training continues whether browser stays open or player goes AFK
  ↓
Non-combat account/social/reference surfaces remain usable
  ↓
New Battle Hall fights remain unavailable until training ends or is stopped
  ↓
At completion, server freezes one Training Report
  ↓
Claim report idempotently
  ↓
Continue normal gameplay
```

Nothing starts automatically.

Browser presence, logout state, local clock, timezone, tab state, and client-submitted elapsed time never determine rewards.

---

## 4. Current Scope & Future Focuses

The current Phase-1/A2 player-facing system is intentionally small: one Character-XP training activity with three duration choices.

There is no hidden default focus and no automatic fallback.

Future phases may add carefully bounded choices such as Discipline Focus or Recovery & Study only after dependent Mastery/Rested systems exist. Those extensions must preserve:

- explicit start;
- server-owned time;
- active-play-first value;
- non-pay-to-win progression;
- bounded rewards;
- no idle-game job catalog.

---

## 5. Explicit Start Rule

Passive Training is opt-in for each block.

If the player does not choose a duration, the character remains idle and no new Training Report accrues merely because time passes.

The server owns:

- start time;
- duration/config version;
- completion boundary;
- completion reward;
- active/stopped/completed state;
- claim state.

---

## 6. Duration & Efficiency Shape

Exact values are data-driven and Master Panel configurable.

The initial A2 shape is:

```text
Short      3 hours    10 Character XP/hour    30 XP on completion
Medium     8 hours     7 Character XP/hour    56 XP on completion
Extended  24 hours     4 Character XP/hour    96 XP on completion
```

Longer plans grant more total XP when completed but deliberately lose hourly efficiency.

- Short = strongest hourly return.
- Medium = middle ground.
- Extended = convenience for a long unattended window.

The browser may display a synchronized countdown, but the server remains authoritative for time and reward calculation.

---

## 7. Why Longer Plans Are Less Efficient

Decreasing hourly efficiency:

- gives active players/shorter intentional plans the strongest training efficiency;
- allows convenient longer windows without making them universally optimal;
- keeps active gameplay more valuable than unattended progression;
- creates a real efficiency-versus-convenience choice;
- avoids exact-login-hour pressure because completed reports remain claimable.

Production rates remain versioned and tunable through future Master Panel/Pacing Simulator controls.

---

## 8. Rested Momentum

**Rested Momentum** remains a future bounded return-support concept rather than part of the current Character-XP-only player reward path.

If implemented, it should bridge time away back into active play by storing a bounded reserve spent automatically through eligible active gameplay.

Possible future effects include temporarily increasing a bounded portion of:

- Character XP from eligible active encounters/quests;
- Discipline Mastery earned through actual use;
- selected ordinary progression rewards;
- catch-up gains in older progression bands.

Rested Momentum should drain as it benefits active actions.

It must never become a second passive currency farm or a replacement for playing the game.

---

## 9. What Passive Training May Progress

Current implemented target:

- Character XP.

Future approved targets may include:

- eligible Discipline Mastery up to a configured passive-training ceiling;
- Rested Momentum;
- future non-tradable training-specific progression approved by the Owner.

Future additions are allowed only after the underlying active system exists and is proven fun.

---

## 10. What Passive Training Must Not Replace

Passive Training must **not** automatically complete or award:

- main-story chapters;
- quests requiring player decisions;
- boss clears;
- Expedition clears;
- PvP rating/rank;
- tournament results;
- Resonance or Essence accomplishments requiring actual build use/discovery;
- Soulmark awakening/branch milestones;
- The Severance or Mantle progression milestones;
- Horizon trials;
- endgame rites;
- Archive discoveries requiring evidence;
- event participation or first-witness credit;
- rare equipment drops;
- tradable marketplace goods;
- Crowns/economic output that creates passive inflation;
- guild/nation participation credit;
- Rekindling qualification by itself.

The system supports the journey but cannot complete meaningful accomplishments on the player's behalf.

---

## 11. Future Discipline Mastery Guardrail

If Discipline Focus is introduced, a player must not become a true Master by never using the Discipline.

Default direction:

- passive Mastery can advance numerical progress only to a configurable ceiling;
- final Master status still requires active proof/trials/varied-use milestones as authored;
- passive gains cannot satisfy technique challenges requiring demonstrated play;
- Training Report clearly explains when a practice ceiling is reached.

Example:

```text
Bastion practice reached its current passive study limit.
Complete the Bastion Mastery Trial and demonstrate its advanced Skills in battle to progress further.
```

This preserves the fantasy that the player actually **became** a master.

---

## 12. Return Experience

When claimable progress exists, surface it in a restrained but satisfying way.

Recommended surfaces:

- compact `Training Report Ready` indicator;
- World Pulse / `Since you were away` summary when that system exists;
- Character → Passive Training page;
- optional single return card after meaningful absence.

Do not use:

- repeated full-screen popups;
- fake urgency;
- flashing countdown spam;
- destructive claim expiration;
- multiple special currencies solely for Passive Training.

Completed reports do not expire merely because the player did not click immediately.

---

## 13. Claim Presentation

The report can show:

- training plan/duration;
- authoritative credited time;
- Character XP gained;
- future Discipline Mastery/Rested Momentum only if those extensions exist;
- levels crossed;
- future practice ceiling status;
- next meaningful active goal.

If a claim causes a level-up, normal level-up presentation may play after the authoritative claim completes.

Passive Training must not silently award accomplishment-based requirements it did not complete.

---

## 14. No Daily-Streak Dependency

Never add:

- `claim every day or reset your multiplier`;
- seven-day chains that lose accumulated value when missed;
- permanent stacking bonuses for never missing a day;
- paid recovery of expired training;
- exact-hour login requirements;
- meaningful completed rewards that vanish if the player returns late.

Return motivation comes from accumulated value and interesting goals, not threatened loss.

---

## 15. Monetization Guardrail

The premium shop must not sell:

- faster Passive Training XP rates;
- higher passive Mastery rates;
- instant Training Report completion;
- paid Rested Momentum multipliers;
- paid removal of Mastery practice ceilings;
- paid Horizon qualification through Passive Training.

Cosmetic training-room/camp presentation may eventually be monetized only if it has **zero progression effect**.

---

## 16. Server-Authoritative Efficient Implementation

Do **not** run a background job every minute for every training character.

Preferred architecture:

1. store explicit server-authored plan, start, duration and config version;
2. when an eligible server action needs current training state, compare server time to completion boundary;
3. if incomplete, return authoritative status without partial rewards;
4. if complete, deterministically create/freeze one pending Training Report and clear/complete the active plan;
5. claim through one authoritative idempotent command;
6. atomically update progression and provenance;
7. emit normal progression/realtime refresh events.

The browser may display countdown state, but it never owns elapsed time or reward values.

---

## 17. Suggested Data Shape

Exact schema belongs to implementation tickets, but the current concept needs state equivalent to:

```text
active_training_plan
training_started_at
training_completes_at
training_duration_key
training_rules_version
frozen_reward_xp
training_status
training_report_id / claim state
```

Future Discipline Focus/Rested Momentum adds only the fields actually required by those released features.

A claim keeps provenance sufficient to explain:

- Passive Training source;
- plan/duration;
- start/completion boundary;
- rules/config version;
- XP granted;
- future Mastery/Rested values where relevant;
- claim correlation/idempotency key.

Legacy already-materialized reports may preserve historical internal provenance identifiers such as `WAYFARER_PRACTICE`; do not rewrite persisted history merely to rename the player-facing system.

---

## 18. Anti-Abuse Rules

Requirements:

- timestamps are server-authoritative;
- client clock/timezone changes have no effect;
- reconnects/tab refreshes cannot duplicate a completion or claim;
- claim is idempotent;
- stopping/restarting cannot retroactively rewrite a completed/frozen report;
- repeated short connection loops do not manufacture rewards;
- Owner/QA override characters can be excluded from progression telemetry;
- no tradable economic output is generated by default;
- suspicious progression speed is observable.

Multi-character rewards remain character-bound. Extra character slots must not create transferable passive-resource farms.

---

## 19. Catch-Up / “Do Not Fall Behind” Role

Passive Training is one layer of healthy absence protection, not the entire catch-up system.

It may coexist with:

- future rested progression;
- contract banking;
- returning-player objectives;
- older-band catch-up bonuses;
- recurring access to important build components;
- guild/mentor support;
- replayable event aftermath.

A player who misses time should feel helped rather than punished, while still needing active play to re-enter current high-end progression.

---

## 20. Master Panel Controls

Future Owner/delegated controls include:

- system enabled/disabled;
- Short / Medium / Extended durations;
- per-duration XP rates/rewards;
- efficiency ordering;
- progression-band modifiers;
- future Rested Momentum rules;
- future Discipline Mastery weight/ceilings;
- focus definitions when introduced;
- eligibility rules;
- emergency pause;
- telemetry cohorts;
- configuration version/history/rollback.

The Owner should be able to see whether Passive Training improves return behavior without accidentally trivializing the long progression journey.

---

## 21. Analytics & Pacing Simulator

Track at least:

- percentage of active players starting/completing/claiming Passive Training;
- duration choice distribution;
- completion vs early-stop rate;
- direct XP from Passive Training versus active XP;
- future Mastery/Rested values when those extensions exist;
- claim-to-session conversion;
- play-session length after claim;
- return rate after meaningful absence windows;
- progression speed of frequent vs infrequent players;
- effect on Horizon timing;
- churn after long absence;
- suspicious behavior.

Pacing Simulator models Passive Training as one contributor, not the progression engine.

---

## 22. Implementation Timing

### Phase 1 — Character Foundation

Implemented/current foundation:

- explicit Short / Medium / Extended plans;
- authoritative server start/completion timestamps;
- decreasing hourly efficiency as duration increases;
- no automatic reward for being offline/idle;
- deterministic Character XP completion reward;
- stop command with no partial reward;
- Battle Hall new-fight exclusion while active;
- idempotent completion/claim behavior;
- Training Report UI/countdown;
- telemetry;
- safe compatibility with legacy materialized reports.

### Phase 3 — Signature Buildcraft

Only after dependencies exist, consider:

- Discipline Focus;
- eligible Discipline Mastery accrual;
- passive Mastery ceiling;
- mastery-trial guardrails;
- Discipline-specific telemetry.

Primary/Secondary attunement cooldowns, Resonance, Essence and supernatural progression are not accelerated/bypassed by merely selecting a Passive Training plan.

### Phase 5 — Living World

Integrate return experience with:

- World Pulse / `Since you were away`;
- region/mentor flavor where appropriate;
- returning-player objectives;
- event aftermath links.

Live-event attendance rewards do not accrue offline.

### Phase 13 — Master Panel

Add complete Owner controls, analytics, cohort comparisons, config history/rollback and Pacing Simulator inputs.

### Phase 15 — Hardening

Validate:

- timestamp manipulation resistance;
- idempotency/double-claim safety;
- long-duration edge cases;
- stop/restart boundaries;
- multi-character behavior;
- battle-entry exclusion;
- progression pacing impact;
- database/query efficiency;
- telemetry;
- no economy inflation;
- legacy-report compatibility.

---

## 23. Player Manual Requirements

The Adventurer's Guide explains:

- what Passive Training is;
- that it starts only after explicit duration choice;
- Short / Medium / Extended efficiency tradeoffs;
- stopping early forfeits the unfinished reward;
- what currently progresses (Character XP);
- what cannot progress passively;
- future Rested Momentum/Mastery rules only after release;
- claims are server-authoritative/idempotent;
- premium purchases do not increase Passive Training power.

Contextual help is available from Training Report/Passive Training surfaces.

---

## 24. Definition of Success

Passive Training succeeds when:

- returning feels rewarding;
- busy players feel helped rather than punished;
- the loop is pleasant without destructive FOMO;
- active gameplay remains much more important than passive gains;
- Discipline Mastery still means demonstrated mastery;
- Primary/Secondary/Resonance/Essence/supernatural accomplishments remain active-game achievements;
- long-horizon pacing remains healthy;
- there is no pay-to-win acceleration;
- rewards are server-authoritative and idempotent;
- infrastructure does not waste continuous per-character work;
- Owner can tune the system later;
- telemetry shows improved return behavior without trivializing progression.