# AUREVANE — Passive Training, Training Reports & Rested Progression

**Status:** Authoritative feature specification subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/PROGRESSION_RETENTION.md` and `docs/NATURAL_PACING.md`.

**Direction approved:** 2026-08-15.

AUREVANE should continue to respect the player's life outside the game while giving players an optional background-progression choice that never competes with active play. Progress is created only by an explicit **Passive Training** session; simply being logged out, idle, or away does not manufacture rewards.

The player-facing system is called **Passive Training**.

A completed session is presented as a **Training Report**.

---

## 1. Product Goal

When a player leaves AUREVANE, their character can continue low-intensity practice, study, conditioning, and reflection in the background.

When the player returns, they should be able to claim a clear report such as:

```text
WAYFARER'S PRACTICE — TRAINING REPORT

While you were away:
+ 2,840 Character XP
+ 610 Bastion Mastery
+ 18 Rested Momentum

Practice time credited: 31h 42m

[Claim Training]
```

The desired feeling is:

> “Nice — my character kept moving forward while I was gone, and now I have a reason to jump back in.”

not:

> “I must log in every few hours or I lose value.”

This system exists to:

- soften the disadvantage of having less play time;
- create a satisfying return-and-claim ritual;
- encourage players to keep building a permanent character;
- support the six-month journey without turning it into a timer game;
- make short and medium absences feel productive rather than punishing;
- feed the next active session instead of replacing active gameplay.

---

## 2. Relationship to Natural Pacing

Wayfarer's Practice is explicitly **not** the kind of generic training timer prohibited by `docs/NATURAL_PACING.md`.

It must never become the primary way a character progresses.

The player should not be told:

> “You cannot continue until training finishes in 14 hours.”

Instead, active play remains available whenever the player wants it. Offline training is a secondary catch-up/continuity layer that rewards unavoidable time away.

The six-month progression target must still come primarily from:

- meaningful active progression;
- Discipline use and mastery challenges;
- build development;
- world and story progress;
- Expeditions and bosses;
- Soulmarks and Confluences;
- Archive/lore progression;
- endgame qualification;
- live-world cadence.

Offline training helps the player stay connected to that journey. It does not replace the journey.

---

## 3. Core Player Loop

The normal loop is:

```text
OPEN PASSIVE TRAINING
  ↓
Choose Short / Medium / Extended
  ↓
Server records the authoritative start and duration
  ↓
Training continues whether the browser stays open or the player goes AFK
  ↓
The player may use non-combat account/social/reference surfaces
  ↓
New Battle Hall fights remain unavailable until training ends or is stopped
  ↓
At completion, the server freezes a Training Report
  ↓
Claim the report idempotently
  ↓
Continue normal gameplay
```

Nothing starts automatically. Browser presence, logout state, local clock, tab state, and client-submitted elapsed time never determine rewards. Stopping a session early clears the unfinished block without granting a partial reward.

---

## 4. Training Focuses

Wayfarer's Practice supports a small number of understandable focuses rather than a complicated idle-game management screen.

### Balanced Practice — default

A mixture of:

- modest Character XP;
- modest Mastery for the selected/current eligible Discipline;
- normal Rested Momentum accumulation.

This is the safe default when the player never changes anything.

### Discipline Focus

Trades some Character XP for increased Mastery progress in one already unlocked eligible Discipline.

It may help move a Discipline toward mastery, but **offline practice alone cannot complete the final mastery proof/trial or bypass active mastery requirements**.

### Recovery & Study

Produces little or no direct vertical XP and instead increases the amount of **Rested Momentum** available for the player's next active sessions.

This is useful for players who prefer to earn most progression through actual combat, quests, exploration, Expeditions, or PvP.

Additional focuses should be added only when they create a genuinely useful player choice. Do not turn this into dozens of idle jobs.

---

## 5. Explicit Start Rule

Passive Training is opt-in for each training block. If the player does not choose a duration, the character remains idle and no Training Report accrues.

This avoids invisible offline-state rules and makes the tradeoff legible: the player deliberately chooses when to enter background progression. The server owns the start time, configured duration, completion boundary, and frozen reward.

---

## 6. Duration and Efficiency Shape

Exact values are data-driven and Master Panel configurable. The initial A2 shape uses three simple server-timed choices:

```text
Short      3 hours    10 Character XP/hour    30 XP on completion
Medium     8 hours     7 Character XP/hour    56 XP on completion
Extended  24 hours     4 Character XP/hour    96 XP on completion
```

Longer plans grant more total XP when completed but deliberately lose hourly efficiency. Short is the strongest hourly return, Medium is moderate, and Extended trades efficiency for a long unattended window. This prevents the longest timer from becoming the universally optimal choice.

The browser may show a synchronized countdown, but the database/server remains authoritative for start, completion, and reward calculation.

---

## 7. Why Longer Plans Are Less Efficient

Passive Training should reward convenience without turning unattended time into the strongest progression strategy. Decreasing hourly efficiency:

- gives active players and shorter intentional sessions the best training efficiency;
- lets a player choose a longer window when they expect to be busy without losing the entire opportunity;
- keeps active gameplay clearly more important than unattended progression;
- creates a real choice between efficiency and convenience;
- avoids an exact-login-hour obligation because completed reports remain claimable.

Production rates remain versioned and tunable through the future Master Panel and Pacing Simulator.

---

## 8. Rested Momentum

**Rested Momentum** is the bridge between time away and active play.

It is a stored reserve earned by being away and spent automatically while the player completes eligible active gameplay.

Possible effects include temporarily increasing a bounded portion of:

- Character XP earned from eligible encounters/quests;
- Discipline Mastery earned through actual use;
- selected ordinary progression rewards;
- catch-up gains in older progression bands.

Rested Momentum should drain as it benefits active actions.

This means a returning player gets:

1. an immediate satisfying Training Report claim; and
2. a period where active play is especially productive.

The second part is important because it directs the player back into the real game instead of rewarding them only for staying offline.

---

## 9. What Offline Training May Progress

Allowed default targets:

- Character XP;
- eligible Discipline Mastery up to a configured offline ceiling;
- Rested Momentum;
- future non-tradable training-specific progression approved by the Owner.

Potential later additions may include bounded study progress for systems that are naturally compatible with passive practice, but only after the underlying active system exists and is proven fun.

---

## 10. What Offline Training Must Not Replace

Wayfarer's Practice must **not** automatically complete or award:

- main-story chapters;
- quests requiring player decisions;
- boss clears;
- Expedition clears;
- PvP rating/rank;
- tournament results;
- Confluence discoveries that require actual build use/discovery;
- Soulmark awakening or major branch milestones;
- Horizon trials;
- endgame rites;
- Archive discoveries that require finding evidence;
- event participation or first-witness credit;
- rare equipment drops;
- tradeable marketplace goods;
- Crowns or other economy output at a rate that creates passive inflation;
- guild/nation participation credit;
- Rekindling qualification by itself.

The system supports the character journey but cannot complete the game's meaningful accomplishments while the player is absent.

---

## 11. Discipline Mastery Guardrail

Discipline Focus should be useful without allowing a player to become a master by never using the Discipline.

Default behavior:

- offline Mastery can advance the numerical Mastery track only to a configurable ceiling;
- final mastery status still requires whatever active proof, trial, varied-use, or milestone requirements that Discipline uses;
- offline gains cannot satisfy special technique challenges that require demonstrated play;
- the Training Report clearly explains when the practice ceiling has been reached.

Example:

```text
Bastion Practice reached its current offline study limit.
Complete the Bastion Mastery Trial and use its advanced techniques in battle to progress further.
```

This preserves the fantasy that the player actually **became** a master.

---

## 12. Return Experience

When claimable progress exists, the game should surface it in a restrained but satisfying way.

Recommended surfaces:

- a compact “Training Report Ready” indicator on the character/home screen;
- World Pulse “Since you were away” summary;
- Character → Passive Training page;
- optional single return card after a meaningful absence.

Do not use:

- repeated full-screen popups;
- fake urgency;
- flashing countdown spam;
- destructive claim expiration;
- multiple currencies just for offline training.

The player can claim the report when convenient. The claim should not expire simply because they did not click immediately.

---

## 13. Claim Presentation

The claim should feel like character growth, not collecting a mobile-game chore box.

The report can show:

- time credited;
- selected focus;
- Character XP gained;
- Discipline Mastery gained;
- levels crossed, if any;
- Rested Momentum gained;
- whether a training ceiling was reached;
- the next meaningful active goal.

If the claim causes a level-up, the level-up presentation may play normally after the authoritative claim completes.

If a Horizon requirement becomes numerically closer, the UI may update progress, but offline training must not silently award accomplishment-based requirements it did not actually complete.

---

## 14. No Daily-Streak Dependency

Passive Training must never become a disguised destructive login streak.

Do not add:

- “claim every day or reset your multiplier”;
- seven-day chains that lose accumulated value when missed;
- permanent stacking bonuses for never missing a day;
- paid recovery of expired training;
- a requirement to log in at an exact hour;
- meaningful rewards that vanish if the player returns late.

The system should encourage return through accumulated value, not threaten the player with loss.

---

## 15. Monetization Guardrail

Passive Training is part of healthy progression/catch-up and must not become a pay-to-win product.

The normal premium shop must not sell:

- faster offline XP rates;
- higher offline Mastery rates;
- a larger direct training bank;
- instant Training Report completion;
- paid Rested Momentum multipliers;
- paid removal of Mastery practice ceilings;
- paid Horizon qualification through offline training.

Cosmetic presentation around a camp/training room could eventually be monetized only if it has **zero progression effect**.

This keeps premium monetization aligned with `docs/MONETIZATION.md`.

---

## 16. Server-Authoritative and Efficient Implementation

The implementation should be deliberately simple and efficient.

Do **not** run a background job every minute for every offline character.

Preferred architecture:

1. store the explicit server-authored training plan, start time, configured duration, and config version;
2. when an eligible server action needs current training state, compare the server clock to that stored completion boundary;
3. if the block is incomplete, return its current authoritative status without granting partial rewards;
4. if complete, deterministically create one pending/frozen Training Report and clear the active plan;
5. claim through one authoritative idempotent server command;
6. atomically update eligible progression and claim provenance;
7. emit the normal progression/realtime refresh events.

No per-character background timer job is required. The browser may display a synchronized countdown, but it never determines authoritative elapsed time or reward values.

---

## 17. Suggested Data Shape

Exact schema belongs to the implementation ticket, but the design should be representable with concepts similar to:

```text
training_focus
training_discipline_id
last_active_at
practice_accrual_anchor_at
practice_claimed_through_at
rested_momentum_balance
training_version
```

A generated claim should include enough provenance to explain:

- source = WAYFARER_PRACTICE;
- accrual window;
- rules/config version;
- XP granted;
- Mastery granted;
- Rested Momentum granted;
- focus used;
- claim correlation/idempotency key.

Do not persist one row per minute/hour of offline time when a deterministic window calculation can represent the same state cleanly.

---

## 18. Anti-Abuse Rules

The system must be safe against trivial manipulation.

Requirements:

- all timestamps are server-authoritative;
- client clock/timezone changes have no effect;
- reconnects or tab refreshes cannot duplicate a claim;
- claim is idempotent;
- changing focus does not retroactively rewrite already accrued time;
- extremely short disconnect/reconnect loops do not farm rewards;
- Owner/QA override characters can be excluded from progression telemetry;
- no tradeable economy output is generated by default;
- suspicious progression speed is visible in analytics.

If multiple characters exist, offline rewards are character-bound. Premium character slots must not create transferable passive resource farms.

---

## 19. Catch-Up and “Do Not Fall Behind” Role

Wayfarer's Practice is one layer of absence protection, not the entire catch-up system.

It combines with:

- rested progression;
- contract banking;
- returning-player objectives;
- older-band catch-up bonuses;
- recurring access to important build components;
- guild/mentor support;
- replayable event aftermath.

A player who misses several days should return to a character that has made modest progress and is primed for a productive session.

A player who misses several weeks should receive stronger returning-player assistance, but they should still need to play the game to re-enter current high-end progression.

---

## 20. Master Panel Controls

The protected Owner and delegated balance staff should eventually be able to configure:

- system enabled/disabled state;
- Passive Training enabled/disabled state;
- Short / Medium / Extended durations;
- per-duration XP rates and completion rewards;
- efficiency ordering and progression-band modifiers;
- future Rested Momentum rules when that extension is active;
- Character XP weight;
- Discipline Mastery weight;
- Rested Momentum weight;
- eligible/ineligible Disciplines or progression states;
- offline Mastery ceiling;
- focus definitions;
- focus-switch behavior;
- catch-up multipliers;
- account/character eligibility rules;
- emergency global pause;
- telemetry cohorts;
- configuration version/rollback.

The Owner should be able to see whether offline training is helping retention without accidentally shortening the six-month progression path too much.

---

## 21. Analytics and Pacing Simulator

Track at least:

- percentage of active players claiming Wayfarer's Practice;
- average offline duration before claim;
- direct XP from offline practice versus active XP;
- Mastery from offline practice versus active Mastery;
- Rested Momentum earned and consumed;
- claim-to-session conversion;
- play-session length after a claim;
- return rate after 1, 3, 7, 14, and 30 days away;
- progression speed of frequent versus infrequent players;
- percentage of players hitting the direct cap;
- percentage hitting the Mastery ceiling;
- whether the system materially changes Horizon timing;
- churn after long absence;
- suspicious claim behavior.

The Pacing Simulator should model the system as one contributor to progression, including different absence patterns.

A healthy result is that less-frequent players recover some lost ground while active skilled play remains the strongest route to meaningful progression.

---

## 22. Implementation Timing

### Phase 1 — Character Foundation

Implement the minimal foundation once character XP/progression exists:

- explicit Short / Medium / Extended Passive Training plans;
- authoritative server-side start/completion timestamps;
- decreasing hourly efficiency as duration increases;
- no automatic reward merely for being offline or idle;
- deterministic Character XP completion reward;
- stop-training command with no partial reward;
- Battle Hall new-fight exclusion while a plan is active;
- idempotent Training Report claim;
- basic Training Report UI and synchronized countdown;
- telemetry and legacy-report compatibility.

This must be a focused Phase 1 ticket, **not part of F0.4**.

### Phase 3 — Discipline Framework

Extend Wayfarer's Practice with:

- Discipline Focus;
- eligible Discipline Mastery accrual;
- offline Mastery ceiling;
- mastery-trial guardrails;
- Discipline-specific telemetry.

### Phase 5 — Living World

Integrate the return experience with:

- World Pulse / “Since you were away”;
- region/mentor flavor where appropriate;
- returning-player objectives;
- event aftermath links.

Do not make live-event attendance rewards accrue offline.

### Phase 13 — Complete Master Panel

Add complete Owner controls, analytics, cohort comparisons, configuration history/rollback, and Pacing Simulator inputs for Wayfarer's Practice.

### Phase 15 — Hardening

Validate:

- timestamp manipulation resistance;
- idempotency/double-claim safety;
- long-absence edge cases;
- multi-character behavior;
- progression pacing impact;
- database/query efficiency;
- telemetry correctness;
- no accidental economy inflation.

---

## 23. Player Manual Requirements

The Adventurer's Guide should explain:

- what Passive Training is;
- that it begins only after the player explicitly chooses a duration;
- Short / Medium / Extended duration and efficiency tradeoffs;
- that stopping early forfeits the unfinished block;
- how Rested Momentum works;
- what can and cannot progress while offline;
- why Mastery still requires active proof;
- that claims do not expire on a daily streak;
- that premium purchases do not increase offline progression power.

Contextual help should be available directly from the Training Report and Training page.

---

## 24. Definition of Success

Wayfarer's Practice succeeds when:

- returning to the game feels rewarding;
- a player who was busy for a few days feels helped rather than punished;
- the system creates a pleasant “come back and claim” loop without destructive FOMO;
- active gameplay remains much more important than passive gains;
- Discipline Mastery still means actual demonstrated mastery;
- the six-month journey remains naturally paced;
- there is no pay-to-win acceleration;
- the server calculates rewards authoritatively and idempotently;
- implementation does not waste infrastructure on continuous background updates;
- the Owner can tune the entire system from the Master Panel later;
- telemetry shows that the system improves return behavior without trivializing progression.
