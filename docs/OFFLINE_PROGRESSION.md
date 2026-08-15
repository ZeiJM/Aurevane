# AUREVANE — Wayfarer's Practice, Offline Training & Rested Progression

**Status:** Authoritative feature specification subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/PROGRESSION_RETENTION.md` and `docs/NATURAL_PACING.md`.

**Direction approved:** 2026-08-15.

AUREVANE should continue to respect the player's life outside the game while giving them a satisfying reason to return. Time away should create a modest amount of character growth and a useful reserve for the next play session rather than making absence feel like lost progress.

The player-facing system is called **Wayfarer's Practice**.

The return moment is presented as a **Training Report**.

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
PLAY AUREVANE
  ↓
Character is active
  ↓
Leave the game
  ↓
Wayfarer's Practice begins automatically after the minimum offline threshold
  ↓
Low-intensity progress accumulates while away
  ↓
Return to AUREVANE
  ↓
Training Report is ready
  ↓
Claim accumulated progress
  ↓
Rested Momentum strengthens the next active session
  ↓
Continue normal gameplay
```

The player does **not** need to press a special logout button.

The player does **not** lose the benefit because a browser tab crashed, a phone died, or they forgot to configure training before leaving.

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

## 5. Automatic Safe Default

Forgetting to choose a focus must not punish the player.

If no explicit focus is selected:

- Balanced Practice is used;
- the current Discipline is used when eligible;
- if that Discipline cannot receive offline Mastery, the Mastery portion safely falls back to Rested Momentum rather than disappearing.

This makes the system useful even to players who never optimize it.

---

## 6. Accrual Shape

Exact values are data-driven and Master Panel configurable.

Recommended initial production shape:

```text
0–1 hour offline     no meaningful accrual; avoids tab-hop exploitation
1–24 hours           full offline-practice rate
24–72 hours          reduced but still worthwhile direct-practice rate
72+ hours             direct Training Report bank is considered full
up to ~14 days        additional absence can continue building Rested Momentum at a slower rate
```

These are tuning defaults, not hard-coded promises.

The direct offline reward should generally feel meaningful while remaining clearly weaker than engaged active progression. A reasonable balancing starting target is for direct offline gains to represent only a modest fraction of the progression an actively playing character could earn over comparable calendar time.

The exact percentage must be established through telemetry and the Pacing Simulator rather than guessed permanently in code.

---

## 7. Why the Direct Bank Caps

The direct Training Report should have a generous multi-day cap so the system encourages return without demanding daily attendance.

A short cap such as four or eight hours would create unhealthy login pressure and is not acceptable as the production default.

A multi-day cap:

- creates anticipation;
- gives regular players a reason to return;
- does not punish sleep, work, school, travel, weekends, or ordinary life;
- prevents months of inactivity from becoming months of fully automated character progression.

After the direct bank is full, longer absence is handled primarily through Rested Momentum and returning-player systems rather than unlimited passive XP.

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
- Character → Training / Wayfarer's Practice page;
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

Wayfarer's Practice must never become a disguised destructive login streak.

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

Wayfarer's Practice is part of healthy progression/catch-up and must not become a pay-to-win product.

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

1. store authoritative timestamps and the selected training focus;
2. when an eligible server action needs the current training state, calculate elapsed offline time from server-controlled timestamps;
3. apply the configured accrual curve deterministically;
4. create a pending/claimable Training Report;
5. claim through one authoritative idempotent server command;
6. atomically update XP/Mastery/Rested Momentum and the `claimed_through` boundary;
7. emit the normal progression/realtime refresh events.

This is cheaper, cleaner, easier to test, and avoids millions of pointless scheduled updates.

The browser may display an estimate, but it never determines elapsed authoritative time or reward values.

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
- minimum offline threshold;
- direct accrual cap;
- long-absence Rested Momentum cap;
- accrual curves by progression band;
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

- authoritative `last_active_at`/accrual timestamps;
- selected training focus;
- deterministic server-side elapsed-time calculation;
- Balanced Practice;
- direct Character XP claim;
- initial Rested Momentum representation;
- idempotent claim command;
- basic Training Report UI;
- telemetry.

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

- what Wayfarer's Practice is;
- when it begins;
- how to choose a focus;
- what the direct cap means;
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
