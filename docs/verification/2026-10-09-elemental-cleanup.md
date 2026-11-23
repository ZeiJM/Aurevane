# October 9 elemental live-review cleanup

Status: **LIVE for Owner testing** at https://aurevane.vercel.app since `2026-10-09T22:24:17.685Z` (18:24:17 America/Port_of_Spain). PR #856 merged and its exact tested tree is deployed. Independent review, local quality, all 12 exact-head GitHub workflows and production smoke pass. Human gameplay acceptance remains pending.

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

Independent review compared all 1,467 prior serialized definitions (667 Skill, 190 Essence, 610 Resonance) byte-for-byte against the base. The first candidate passed full `pnpm check` (exit 0): formatting, lint, all eight package typechecks, 4,793 Vitest tests plus seven Node checks, and production build. The initial local Turbopack persistence-cache error was isolated to generated cache: the prior cache was preserved and the clean build passed with no source change.

The first exact-head GitHub Browser smoke found a stale authenticated Master publication test sending unflagged Enemy activation while expecting Ground persistence. Its request now supplies `ground: true`; publication, projection, reload and rollback assertions remain intact. Diagnosis also exposed an adjacent Master preview mismatch: native Ground Fire displayed a lingering area while evaluating an Enemy activation. The preview now supplies Ground intent for native enemy-targeted Ground Fire Circle/All activation and Line direction. Four regressions cover actual Flame Burst PvE/PvP persistence and ordinary unit Fire. RED reproduced the mismatch; GREEN passes all ten preview tests. Independent verification passes 94 preview/authoring/selection tests and confirms actual Flame Burst evaluates Ground intent with its authored area and expiry. The Important preview finding is resolved. The complete follow-up source passes `pnpm check` (exit 0), including 4,797 Vitest tests plus seven Node checks and production build. Final immutable review passes with zero unresolved Critical, Important or Minor findings, covering local `48ca379354fce1f006df41c2e5da1a8a68db844e` and equivalent GitHub head `02728f26255af57d4187ab5ba7ebcc7aa3adc84e`, tree `93a03c0ef1e35051db76ef69c3532c8fdc35893a`.


All 12 expected exact-head GitHub workflows pass on `02728f26255af57d4187ab5ba7ebcc7aa3adc84e`: CI, Browser smoke, UI layout review, Desktop experience, Desktop page fit, Skill Engine, Shared Build Snapshots, Profile Skill Build, Essence Build, Resonance Build, Discipline Build DB and Representative Buildcraft. Browser run `37991594222` passes the corrected Master publication/rollback and movement checks (two scenarios, each repeated twice; four passes), recovery (six), battle experience (three), the focused desktop/mobile suite (73 passed, 21 configured skips), the complete desktop/laptop/mobile suite (322 passed, 221 configured skips) and Edge (ten passed, two configured skips). Existing project-specific skips remain; no new skip, scenario removal, assertion, timeout or count-gate relaxation was introduced.

Final fresh-main preflight remained `d712e7dc408aa3778dce440c0806317dd8c51638`; no concurrent source changes needed reconciliation. PR #856 merged as `25c0779f9bbf895e1be2a139d94f76e180b062d6`, with exact tree equality to the reviewed/tested source. Hosted read-only preflight again found no current publication pointers for Frostweaver, Tidecaller, Stormsinger or Cinderweaver, so current static Skill versions reach those defaults without replacing Owner content. No database migration was required.

One explicitly authorized production deployment was created from the exact merge SHA: `dpl_68dL6NwV2s8CrqjV4cXQWub6YxiP`, `aurevane-ee4b40v33-zeijms-projects.vercel.app`. Vercel confirms READY and the source SHA; canonical alias `aurevane.vercel.app` belongs to the same project/team and points to this deployment. The Git deployment lock remains unchanged; this receipt does not request a second deployment.

Production smoke: HTTP 200 for `/`, `/manual`, `/manual/battle-hall`, `/rules`, `/news`, `/api/foundation/auth-status` and `/auth/reset-password`. The live Battle Hall manual shows separate Cleanse Chilled, caster-only removal, ordinary Fire board selection, stacking Drenched Initiative and explicit Conductive application. Signed-out auth status is correctly false. Deployment-scoped warning/error/fatal counts are zero for the bounded `2026-10-09T22:24:17.685Z`–`2026-10-09T22:25:49.077Z` smoke window. Authenticated end-to-end evidence is from disposable GitHub CI; no new human gameplay acceptance or hosted email-delivery test is claimed.

## Owner testing checklist

Start a new battle after release.

1. Use Fire while Chilled: the caster clears only Chilled; caster Drenched/Suppress remain. Inspect the separate Cleanse Chilled tag and Master option. A Drenched or Chilled enemy retains those statuses after Fire damage. Fire on ice still produces animated mist with its original expiry.
2. Inspect every damaging Frostweaver, Tidecaller and Stormsinger Skill: Damage and its matching Chilled/Drenched/Conductive effect appear separately. Costs, power and geometry remain the same.
3. Select Fire and click an enemy or empty ground using the normal board controls. No Enemies/Ground buttons appear. Verify Single and area Fire, normal keyboard use, and Ground immunity while Airborne.
4. Apply Water repeatedly: Drenched x2 reduces effective Initiative by 20%, x3 by 30%. Future unacted turns can change order, with no interrupted or extra turns. Cleanse or expiry restores order.
5. Repeat a Storm hit on Conductive: the old charge increases damage, is consumed and is replaced by the explicit Conductive tag. Check the separate status description and Master duration/bonus fields.
