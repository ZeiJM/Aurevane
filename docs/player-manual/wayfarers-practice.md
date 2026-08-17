# Wayfarer's Practice & Training Reports

**Audience:** Player  
**Visibility:** Public, spoiler-safe  
**System:** Phase 1 Character Foundation

**Related guide:** `character-profile-and-stats.md`

## Quick answer

**Wayfarer's Practice** gives your permanent character a modest amount of progress after a meaningful time away from AUREVANE. When you return, the game may prepare a **Training Report** containing bounded Character XP and **Rested Momentum**.

It is an absence-protection system, not an idle-game timer. Active play remains the main way to progress, and you never need to wait for practice to finish before playing.

## Set Practice

From **Character → Training**, you may set one plan for your **next meaningful absence**:

- **Short** — initially around 3 hours;
- **Overnight** — initially around 8 hours; or
- **Extended** — initially around 24 hours.

These are planned durations, not appointments on a wall clock. The exact duration values are versioned server tuning and may change during development.

A plan is prospective intent for one absence. It does not create a repeating schedule, queue future jobs, or tell the game to keep running an automation while you are offline. There is no **Until I Return** option.

Phase 1 still uses **Balanced Practice** as its only practice focus. The duration choice records how you expected the next absence to look and establishes the durable planning boundary that later Discipline-focused training can extend without changing the authority model.

If you do not set a plan, AUREVANE automatically uses Balanced Practice as the safe fallback.

## Returning earlier or later than planned

The server measures how long you were actually away.

If you return **before** the selected duration ends, only the legitimate elapsed offline time can be credited. Selecting Extended and returning after two hours does not create a 24-hour reward.

If you remain away **longer** than the selected duration, the explicit plan ends at its duration boundary. Any remaining eligible absence continues automatically as Balanced Practice under the normal thresholds, rates, and caps.

When the corresponding Training Report is generated, the explicit one-absence plan is consumed. A later absence uses automatic Balanced Practice unless you set another plan.

## What Balanced Practice can produce

Phase 1 Practice can produce only:

- bounded Character XP; and
- bounded Rested Momentum.

It cannot complete quests, story chapters, bosses, Expeditions, PvP ranks, discoveries, equipment drops, economy rewards, Horizon requirements, Rekindling requirements, Discipline Mastery, profession progress, direct attributes, or event participation.

The current rates, thresholds and caps are development balance. They are versioned tuning rather than permanent launch promises.

## When practice starts

Very short disconnects do not produce meaningful practice rewards. This prevents refreshing a page, changing tabs, or repeatedly reconnecting from becoming a progression method.

After a meaningful absence, direct practice XP builds through a full-rate window and then a reduced-rate window before reaching a multi-day cap. Longer absence can continue contributing to Rested Momentum for a bounded period.

You do not need to press **Sign out** before leaving. A closed browser, lost connection, sleeping device or ordinary interruption does not require special preparation.

Setting a plan also does not let the browser choose the start time. The authoritative timestamps are server-owned.

## Training Reports are frozen

When AUREVANE first evaluates an eligible return, it creates one pending Training Report from server-controlled time.

Once shown, that report is **frozen**. Refreshing the page does not make its time or rewards grow, and leaving it unclaimed does not make it expire. You can claim it when convenient.

A report records whether the absence used an explicit plan or automatic Balanced Practice. When a planned duration ended before you returned, the report also distinguishes the planned portion from the remaining Balanced fallback time.

After the current report is claimed, future eligible time away can form a later report from the new authoritative boundary.

## Claiming training

Choose **Claim training** on the return card. The server applies the report as one authoritative transaction.

The claim can:

- add the report's bounded Character XP;
- resolve any resulting Level changes using the same Level 1–100 progression rules as other Character XP;
- add Rested Momentum up to its current cap;
- mark the report claimed; and
- advance the practice boundary for future reports.

If you are already at maximum Level, a report cannot push Character XP past the configured maximum. Any XP that cannot be applied because of the cap is safely bounded by the server.

## Safe retries and clock safety

Planning and claiming are idempotent. If a connection drops while you press **Set Short**, **Set Overnight**, **Set Extended**, or **Claim training**, a safe retry cannot duplicate the semantic action or its reward.

The browser does not decide:

- when the absence started or ended;
- how long you were away;
- the authoritative duration behind Short, Overnight, or Extended;
- which Practice accrual window applies;
- how much XP the report contains;
- how much Rested Momentum it contains;
- your resulting Level; or
- whether a report was already claimed.

Changing your device clock or timezone cannot accelerate Practice. Those values come from server-owned timestamps, versioned rules and authoritative character state.

## Rested Momentum

Rested Momentum is a stored return reserve intended to make a later active play session more productive. Phase 1 establishes the authoritative balance and shows how much a Training Report adds.

**Phase 1 does not spend Rested Momentum yet.** Consumption belongs with future active reward systems, where it can benefit eligible gameplay without turning time away into a replacement for playing the game.

## Why there is a cap

Wayfarer's Practice is designed to soften the disadvantage of having less play time without making months of absence equivalent to months of active progression.

The direct bank therefore stops growing after a generous multi-day window. This avoids daily login pressure while preserving AUREVANE's emphasis on meaningful active progression, build development, world progress and accomplishments.

## No streaks or expiration pressure

Wayfarer's Practice does not require a daily streak. AUREVANE should not reset a multiplier because you missed a day, sell recovery for expired training, or require you to return at an exact hour.

The return value is accumulated progress, not a threat that something will disappear.
