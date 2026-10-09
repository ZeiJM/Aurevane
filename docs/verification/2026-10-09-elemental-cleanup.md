# October 9 elemental live-review cleanup

Status: implementation and local verification complete; final immutable review, GitHub CI and release verification pending. This follow-up has not yet been deployed. The previous release remains live; no new human acceptance is claimed.

## Requested behavior

- Current Fire Skills include an explicit **Cleanse Chilled** tag: actor-only removal of Chilled using the existing status-removal primitive. Current captured timing is Instant, so legal casts clear it even on empty Ground or a miss; authored Normal/Delayed timing remains authoritative. Drenched, Suppress and other statuses remain. It converts eligible Frozen Ground to animated Steam with the original expiry. It does not cleanse enemy Drenched or Chilled in new encounters.
- Current Ice, Water and Storm damage Skills show separate Chilled, Drenched and Conductive tags. Matching authored tags apply once per recipient after positive hostile HP loss, with captured duration, potency and timing. Damage without the corresponding tag supplies no hidden status. Existing Skill versions remain immutable.
- Fire Skills report Enemy / Ground in Target and use normal enemy/tile selection. No extra cockpit targeting buttons remain. Single, Line, Circle and All geometry and canonical server legality remain authoritative. For current policy 2 Flame Burst, Enemy activation deals its attack without a lingering area; Ground activation retains its authored three-round area and Ground immunity for Airborne recipients. The reader qualifies this lifetime as Ground casts.
- Drenched reduces effective Initiative by 10% per active application, up to 100%, including current-round tempo and with one integer rounding operation. Pending applications do not reduce Initiative. The active actor and already completed turns stay fixed; each living actor receives one turn per round. Removal/expiry restores the corresponding future order.
- Existing strongest captured Drenched/Conductive Storm bonuses remain unchanged. Drenched stacking changes Initiative, not Storm bonus stacking.
- New PvE/PvP and Master preview encounters pin elemental policy2. Policy1 and absent historical encounters preserve their recorded behavior.

## Reviewable choices

Chilled, Drenched and Conductive remain explicit editable tags so effect rows, authoring and actual settlement agree. Their separate readers own duration and potency instead of repeating those rules in the Damage explanation. The cost of reversing this choice is coordinated definition, authoring and reader changes.

Drenched applications use an additive ten-percentage-point Initiative reduction with a zero floor. This makes the displayed application count predictable and prevents negative Initiative. A different stacking formula would require changing the calculation and its displayed explanation together.

## Verification and release

Resolved catalog audit covers 18 current typed mature damage Skills (Fire 4, Ice 4, Storm 6, Water 4), all with explicit matching tags. All 17 current Essences and 136 current Resonances were inspected; none currently has typed elemental damage, so unrelated definitions were not appended.

Focused RED/GREEN includes the original implicit-status, duplicate-prose, toggle, stacking and limited-cleanse failures, plus actual Flame Burst PvE/PvP Enemy/Ground behavior, Airborne recipients, delayed restore, preserved Ice expiry and historical intent. The latest focused elemental suite passes 77 tests. All game-core checks pass: 145 files / 2,763 tests. Three initially failing historical test assumptions were corrected by locating the original persistent publication and explicitly checking the new clockless limited-removal primitive; production logic and other duration bounds were not changed.

Mounted browser verification passes 136 cases with zero page errors, including 24 actual catalog Flame Burst intent/outcome cases across PvE/PvP, desktop/mobile and policy 2/1/absence. Policy 2 Ground retains three-round persistence and misses Airborne; Enemy deals damage with no persistent area. The full Master/Nexus/Battle/summon palette passes at desktop and mobile widths, including authored duration/potency/timing, limited Fire cleanup and qualified Ground casts. Root visually inspected the mobile Fire reports.

Independent interim review found no unresolved findings and compared all 1,467 prior serialized definitions (667 Skill, 190 Essence, 610 Resonance) byte-for-byte against the base. Full `pnpm check` passes (exit 0): formatting, lint, all eight package typechecks, 4,793 Vitest tests plus seven Node checks, and production build. The initial local Turbopack persistence-cache error was isolated to generated cache: the prior cache was preserved and the clean build passed with no source change. Final immutable-head review and exact-head GitHub CI are still pending.


Evidence will be recorded after the complete source passes its focused regressions, independent review, repository quality gate and exact-head CI. Hosted read-only preflight found no current publication pointers for Frostweaver, Tidecaller, Stormsinger or Cinderweaver, so current static Skill versions reach those defaults without replacing Owner content. No database migration is planned for this change.

## Owner testing checklist

Start a new battle after release.

1. Use Fire while Chilled: the caster clears only Chilled; caster Drenched/Suppress remain. Inspect the separate Cleanse Chilled tag and Master option. A Drenched or Chilled enemy retains those statuses after Fire damage. Fire on ice still produces animated mist with its original expiry.
2. Inspect every damaging Frostweaver, Tidecaller and Stormsinger Skill: Damage and its matching Chilled/Drenched/Conductive effect appear separately. Costs, power and geometry remain the same.
3. Select Fire and click an enemy or empty ground using the normal board controls. No Enemies/Ground buttons appear. Verify Single and area Fire, normal keyboard use, and Ground immunity while Airborne.
4. Apply Water repeatedly: Drenched x2 reduces effective Initiative by 20%, x3 by 30%. Future unacted turns can change order, with no interrupted or extra turns. Cleanse or expiry restores order.
5. Repeat a Storm hit on Conductive: the old charge increases damage, is consumed and is replaced by the explicit Conductive tag. Check the separate status description and Master duration/bonus fields.
