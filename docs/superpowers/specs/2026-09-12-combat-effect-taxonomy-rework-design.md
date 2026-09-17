# AUREVANE — Combat Effect Taxonomy, Displacement, Tempo, and Recovery Rework

**Status:** Owner-approved design, awaiting written-spec review before implementation planning  
**Approved in chat:** 2026-09-12  
**Base:** `main` at `ceb0dac43a48c8de10a6dc0a223e6432f8103345`  
**Task branch:** `agent/combat-effect-taxonomy-rework`

## 1. Purpose

This design shortens and regularizes player-facing combat tags while deliberately upgrading the underlying combat rules where the Owner requested mechanical changes.

This is not a presentation-only rename. It changes the shared authoritative combat grammar in four areas:

1. variable-distance Push and new Pull;
2. Haste/Slow as movement-AP effects rather than next-round Initiative effects;
3. duration-bearing Heal and MP Recovery effects instead of a separate Regeneration status;
4. distinct spatial identities for Burn, Bleed, and Poison through authored AoE delivery patterns.

The implementation must preserve server authority, preview/commit parity, AI/PvP parity, deterministic resolution, existing Action Economy rules, and compatibility with already committed battle snapshots.

## 2. Scope

### In scope

- canonical player-facing targeting/effect/status tag wording;
- shared Skill tag generation in Profile and battle UI;
- variable-distance Push;
- new variable-distance Pull;
- `Displaced` applying to successful Push and Pull;
- movement-cost Haste and Slow;
- retirement of new-content use of `Hastened`, `Delayed`, `Borrowed Hour`, and `Regeneration` status mechanics;
- first-class duration for HP healing and positive MP recovery;
- active-effect presentation for remaining recovery ticks;
- Burn/Bleed/Poison AoE identity through Skill targeting shapes;
- rebalance of affected regular Skills and Essences across the published roster;
- AI utility/tag metadata updates where mechanics change;
- battle preview, combat log, inspection, tests, Manual/current combat documentation, and authoring validation updates.

### Out of scope

- adding selectable Skill slots;
- changing the four-Technique build limit;
- changing Essence/Resonance exclusivity;
- changing the normal 100 AP turn budget;
- changing the Movement allowance system;
- changing Jump/elevation rules except where displacement reuses them;
- recursive DoT spreading;
- a general persistent poison/fire-zone subsystem;
- production deployment. Deployment remains Owner-controlled and separately authorized.

## 3. Canonical player-facing tag vocabulary

Only labels explicitly changed by the Owner are renamed. Skipped labels remain unchanged.

Internal stable IDs may remain different when compatibility requires it.

### 3.1 Targeting and shape

| Current wording | New wording | Meaning |
| --- | --- | --- |
| `Self` | `Self` | Caster only. |
| `Enemy` | `Enemy` | Hostile unit. |
| `Ally` | `Ally` | Allied unit excluding self where authored targeting prevents self. |
| `Self or ally` | `Self/Ally` | Caster or allied unit. |
| `Any unit` | `Anyone` | Any legal unit regardless of team. |
| `Ground tile` | `Ground` | Select a board tile. |
| `Empty tile` | `Empty Tile` | Select an unoccupied board tile. |
| `Single target` | `Single` | One selected target. |
| `Area · radius X` | `Circle X` | Circular AoE with authored radius `X`. |
| `Line · X tiles` | `Line X` | Linear AoE with authored maximum length `X`. |

`X` is always rendered as the actual authored numeric value.

### 3.2 Direct effect tags

| Current wording | New wording | Meaning |
| --- | --- | --- |
| `Damage` | `Dmg` | Non-element-specific direct damage. |
| `Water damage` | `Water Dmg` | Water-element damage. |
| `Storm damage` | `Storm Dmg` | Storm-element damage. |
| `Fire damage` | `Fire Dmg` | Fire-element damage. |
| `Healing` | `Heal X` | HP recovery applied for `X` total recovery ticks. |
| `MP Restore` | `MP Rec X` | Positive MP recovery applied for `X` total recovery ticks. |
| `MP Drain` | `MP Drain` | Removes MP. |
| `Cleanse` | `Cleanse` | Removes authored harmful statuses. |
| `Dispel` | `Dispel` | Removes authored beneficial statuses. |
| `Push one tile` | `Push X` | Move another unit away by up to `X` legal tiles. |
| — | `Pull X` | Move another unit toward the source by up to `X` legal tiles. |
| `Return to start` | `Revert` | Return the actor to the legal turn-origin tile under the existing Revert rules. |
| `Frozen terrain` | `Freeze Ground` | Create Frozen terrain on affected tiles. |

The existing recipient suffix remains available where needed. Example: `MP Rec 1 · Self` on a Skill that targets an enemy but restores MP to the caster.

### 3.3 Status/effect labels

| Current wording | New wording |
| --- | --- |
| `Guarded` | `Guard` |
| `Exposed` | `Expose` |
| `Wet` | `Wet` |
| `Frozen` | `Frozen` |
| `Conductive` | `Conductive` |
| `Inspired` | `Inspire` |
| `Hexed` | `Hex` |
| `Invisible` | `Ghost` |
| `Summoned` | `Summon` |
| `Airborne` | `Airborne` |
| `Displaced` | `Displaced` |
| `Hastened` / new movement-buff identity | `Haste` |
| `Delayed` / current movement-slow identity | `Slow` |
| `Burn (Scorched)` | `Burn (Scorched)` |
| `Bleed (Bleeding)` | `Bleed (Bleeding)` |
| `Poison (Poisoned)` | `Poison (Poisoned)` |
| `Reckless` | `Reckless` |
| `Fortified` | `Fortified` |
| `Challenged` | `Challenged` |
| `Marked` | `Marked` |
| `Warded` | `Warded` |
| `Lowered Guard` | `Off-guard` |

`Root` remains `Root`.

`Borrowed Hour` is retired as a status/effect identity in new content. The Chronist Essence named **Borrowed Hour** may retain that Skill name; only the separate status mechanic is retired.

`Regeneration` is retired as a player-facing/new-content status identity. Recovery-over-time is represented by `Heal X` instead.

## 4. Variable Push and Pull

### 4.1 Shared displacement model

The existing one-tile `displace` mechanic becomes a shared displacement effect with:

- direction: Push or Pull;
- authored positive integer distance `X`;
- target recipient: another unit, never the actor;
- the same authoritative board legality checks used by current displacement.

Historical effects that omit direction remain Push for backward compatibility. Historical one-tile definitions remain equivalent to `Push 1`.

The engine may support any positive safe-integer distance, but current roster authoring should stay in the tactical range `1–3` unless a later balance decision explicitly approves a larger value.

### 4.2 Stepwise resolution

Displacement resolves one tile at a time.

For each step:

1. calculate the next tile on the dominant orthogonal axis between source and target;
2. preserve the current horizontal tie-break when both axes are equally dominant;
3. validate board bounds;
4. validate passability;
5. validate occupancy;
6. validate elevation legality;
7. validate Root/status movement restriction;
8. move the unit one tile if legal;
9. stop before the first illegal step.

Therefore `Push 3` or `Pull 3` means **up to** three legal tiles, not an all-or-nothing teleport.

If zero steps are legal, displacement fails and no movement occurs. Normal Skill costs are not refunded.

### 4.3 Pull collision invariant

A Pulled target must never occupy the source unit's tile.

The source tile is occupied and therefore illegal. Pull stops on the last legal tile before the source and may not pass through the source tile.

This invariant is server-side and regression-tested.

### 4.4 Displaced status

Any Push or Pull that moves the target at least one tile applies/refreshes `Displaced`.

Zero-tile failed displacement does not apply `Displaced`.

`Displaced` retains its short informational duration and does not spend/refund AP, Movement, or turns.

### 4.5 Multi-recipient displacement

If an area effect displaces multiple units, recipients resolve in the engine's existing stable deterministic order against the latest state after each previous recipient resolves. If two units compete for a destination, the later unit stops when occupancy makes its next step illegal.

## 5. Haste and Slow — movement AP, not Initiative

### 5.1 New current meaning

`Haste` and `Slow` modify **AP required to enter movement tiles**. They do not alter turn count or next-round Initiative.

- `Haste`: `-10 AP` per entered tile.
- `Slow`: `+10 AP` per entered tile.
- If both are active, their modifiers sum to zero.
- Movement allowance is unchanged.
- Jump/elevation rules are unchanged.
- Root still blocks movement completely.

### 5.2 Movement cost order

For each passable entered tile:

1. calculate normal terrain AP (`traversal cost × 20 AP`);
2. add temporary terrain surcharge such as Frozen (`+10 AP`, unless Airborne ignores that Frozen surcharge);
3. add status movement deltas (`Haste -10`, `Slow +10`);
4. clamp the final legal tile cost to a minimum of `10 AP`.

Examples:

- normal ground: 20 AP;
- normal + Haste: 10 AP;
- normal + Slow: 30 AP;
- normal + Haste + Slow: 20 AP;
- rough ground: 40 AP;
- rough + Haste: 30 AP;
- Frozen normal ground + Slow: 40 AP;
- Airborne on Frozen normal ground + Haste: 10 AP.

### 5.3 Current and historical identities

New content uses:

- new internal status ID `haste` for movement Haste;
- existing internal status ID `slow` for movement Slow.

Historical `hastened`, `delayed`, and `borrowed-hour` definitions remain decodable for already committed battles and historical snapshots. They are not emitted by new current Skill versions.

The existing `slow` movement status is the single current Slow mechanic. No second current Slow status is introduced.

### 5.4 Duration and stacking

Haste and Slow are single-stack timed statuses. Reapplication refreshes duration rather than increasing the AP modifier.

Current authored duration is two owner-turn-start boundaries.

## 6. Heal X and MP Rec X

### 6.1 Meaning of X

`X` is the **total number of recovery applications**, including the immediate application.

- `Heal 1`: heal once immediately; no ongoing recovery remains.
- `Heal 2`: heal immediately, then once at the target's next end of turn.
- `Heal 3`: heal immediately, then at each of the target's next two end-of-turn boundaries.
- `Heal 4`: heal immediately, then at each of the target's next three end-of-turn boundaries.

`MP Rec X` follows the same timing model for positive MP restoration.

Current authored recovery duration is bounded to `1–4` total ticks. A future larger bound requires a separate balance decision.

The effect's authored amount is the amount **per tick**, subject to normal caps/modifiers for that resource.

### 6.2 First-class ongoing recovery state

Ongoing recovery must not be represented by dynamic status IDs or by continuing to expose `Regeneration`.

The combat encounter gains a bounded first-class ongoing-effect collection for scheduled positive recovery. Each instance records at minimum:

- effect kind (`healing` or positive `mp-recovery`);
- source combatant;
- recipient combatant;
- source action/Skill ID;
- per-tick amount after repeat-use effectiveness is determined;
- remaining future ticks;
- stable timing (`recipient end of turn`).

Historical encounter snapshots without this collection normalize to an empty collection.

### 6.3 Reapplication and coexistence

For the same recipient, resource kind, and source action ID:

- reapplication refreshes/replaces that action's remaining schedule;
- it does not create duplicate copies of the same action's ongoing recovery.

Different action IDs may maintain separate ongoing recovery instances on the same recipient.

### 6.4 Resolution rules

- The first tick resolves during the Skill's normal effect sequence.
- Future ticks resolve at the recipient's end of turn using the authoritative end-turn lifecycle.
- HP healing respects maximum HP.
- MP recovery respects maximum MP.
- Hex modifies every HP healing tick normally.
- MP recovery is not affected by Hex.
- Future healing ticks cannot revive a defeated unit.
- If the recipient is defeated, all remaining scheduled HP/MP recovery for that recipient is removed rather than banked for a later revive.
- Preview and commit use the same recovery scheduling/resolution path.
- Positive MP recovery may have `X > 1`; MP Drain remains immediate-only.
- Scheduled recovery is not a named status and is not removed by current Cleanse/Dispel unless a later explicitly authored mechanic targets ongoing recovery.

### 6.5 Repeat-use falloff

The existing consecutive-use effectiveness rule applies to the per-tick amount at cast time. Duration `X` does not increase to compensate.

Example: if a repeated Skill is at 50% effectiveness and normally authors `Heal 3` for 4 HP per tick, the repeated cast schedules 2 HP per tick for the same three total applications.

### 6.6 Active-effects UI

The Skill tag shows authored total duration, for example `Heal 3`.

After the immediate tick resolves, the Active Effects surface shows only future work remaining, for example `Heal 2` if two future HP ticks remain.

`Regeneration` is not shown as a current player-facing effect. A legacy Regeneration instance encountered in transitional/historical state may be presented as its equivalent remaining `Heal X` schedule while retaining its historical internal identity for correct resolution.

## 7. Retired current effects

The following are retired from newly authored current content:

- `hastened` next-round Initiative effect;
- `delayed` next-round Initiative effect;
- `borrowed-hour` next-round Initiative effect;
- `regeneration` named periodic-healing status.

They remain available only where necessary to resolve previously committed historical definitions/snapshots correctly.

No new current Skill version may depend on `delayed`, `hastened`, `borrowed-hour`, or `regeneration` as a requirement or newly applied effect.

## 8. Burn, Bleed, and Poison — distinct AoE identity

The player-facing labels remain **`Burn (Scorched)`**, **`Bleed (Bleeding)`**, and **`Poison (Poisoned)`**.

Their existing timing/magnitude identities remain, while current Skills establish different **spatial delivery identities**.

### 8.1 DoT cadence remains

- Burn: 4 fixed HP damage × 2 end-of-turn ticks = 8 total raw periodic damage.
- Bleed: 3 fixed HP damage × 3 end-of-turn ticks = 9 total raw periodic damage.
- Poison: 2 fixed HP damage × 4 end-of-turn ticks = 8 total raw periodic damage.

Reapplication retains non-runaway refresh semantics rather than multiplying independent copies.

### 8.2 Spatial signature

- **Burn — Circle identity:** short, high-pressure radial application. Cinderweaver's principal multi-target Burn delivery uses Circle/ground-circle targeting.
- **Bleed — Line identity:** cutting/sweeping linear application. Principal multi-target Bleed delivery uses Line targeting.
- **Poison — Ground Circle identity:** long attrition delivered into a selected ground area, representing poison-cloud/contaminated impact without a persistent terrain-zone subsystem.

These are authoring identities, not automatic propagation. Burn/Bleed/Poison do **not** spread themselves to nearby units at tick time.

Single-target DoT Skills may remain where they serve setup/payoff identity, but each family must have at least one current representative Skill using its signature AoE form.

## 9. Required representative Skill migrations

This section fixes the minimum concrete migrations. The full roster still receives the section-10 audit.

### 9.1 Chronist

Chronist moves from Initiative manipulation to movement-tempo control.

- `chronist.haste`: apply movement `Haste`; retain 30 AP ally-support role.
- `chronist.slow`: retain 35 AP hybrid identity; direct damage + movement `Slow`.
- `chronist.delay`: become a cheaper pure movement-control application of `Slow` at **25 AP**, with no damage.
- `chronist.time-lock`: apply `Root + Slow`, not `Root + Delayed`.
- `chronist.temporal-ward`: apply `Guard + Haste` to self.
- `chronist.stolen-moment`: require `Slow` instead of historical `Delayed`; preserve its payoff identity and self MP recovery.
- Chronist Essence `Borrowed Hour`: keep the Skill name, remove the `Borrowed Hour` status, and become **Heal 2 at 5 HP per tick + Haste** on the ally at its existing 60 AP cost. This preserves 10 raw healing while converting the removed Initiative benefit into movement tempo.

### 9.2 Tidecaller

- `tidecaller.undertow`: replace its Slow application with **Pull 2**. Retain 5 direct damage and 40 AP initially; Pull becomes its control identity.
- `tidecaller.springwater`: replace Regeneration with **Heal 3 at 3 HP per tick** (9 total raw healing) at 35 AP.

### 9.3 Wildwarden / Poison identity

- `wildwarden.venom-shot`: become **Ground + Circle 1**, affecting legal enemies in the selected area.
- New balance target: **3 direct damage + Poison (Poisoned)** to affected enemies at **50 AP**. This is 11 raw single-target damage including the unchanged Poison total, before defenses, while paying the AoE premium.
- `wildwarden.renewing-herbs`: replace Regeneration with **Heal 2 at 4 HP per tick**. Preserve the separately authored Summon effect on the current version. With Summon paired to recovery, use **35 AP**.

### 9.4 Edgedancer / Bleed identity

- `edgedancer.severing-cut`: become **Line 2**, affecting legal enemies along the line.
- New balance target: **4 direct damage + Bleed (Bleeding)** to affected enemies at **45 AP**.
- `ravager.gash` remains a single-target Bleed setup so the family retains focused setup as well as representative linear AoE delivery.

### 9.5 Cinderweaver / Burn identity

- `cinderweaver.flame-burst`: remain a ground-circle/area fire attack and add Burn to affected enemies.
- New balance target: **5 Fire Dmg + Burn (Scorched)** in **Circle 1** at **50 AP**.
- `cinderweaver.cinder-bolt` remains a focused single-target Burn setup.
- Other Burn applications are audited so Circle is the primary multi-target Burn identity without forcing every Burn Skill into Circle targeting.

### 9.6 Dawnshield

- `dawnshield.renewal`: replace Regeneration with **Heal 2 at 4 HP per tick + Cleanse** on self at its current 35 AP cost.

### 9.7 Existing displacement Skills

Any current Skill already using one-tile displacement remains `Push 1` unless its class identity clearly warrants a larger authored distance during the roster audit. No existing Push is silently converted to Pull.

## 10. Roster-wide balance rules

Every current enabled Skill/Essence must be audited for changed tags, requirements, AI metadata, and mechanical valuation. Only affected definitions receive new content versions.

### 10.1 Balance bands

Use the roster's existing AP bands as the default guardrail:

- 25–35 AP: focused setup, light support, or narrow utility;
- 35–45 AP: single-target hybrid damage/control or meaningful support;
- 45–55 AP: AoE, displacement/control packages, stronger hybrids;
- 60–65 AP: Essence-level packages.

Do not raise costs merely because wording changed.

### 10.2 Potency preservation

When converting an effect without adding meaningful utility, preserve total raw expected potency as closely as possible.

Examples:

- historical Regeneration 4 × 2 = 8 raw healing converts to Heal 2 at 4/tick;
- Borrowed Hour's immediate 10 HP becomes Heal 2 at 5/tick = 10 raw healing;
- Burn/Bleed/Poison periodic totals remain 8/9/8.

### 10.3 Utility premium

When a Skill gains new multi-target reach or displacement utility, reduce direct magnitude and/or move it into the next appropriate AP band rather than adding free power.

### 10.4 No duplicate current identities

The audit must eliminate cases where two same-cost current Skills become strict mechanical duplicates after Initiative effects retire. Chronist Delay is explicitly 25 AP so it remains a low-cost pure Slow option while Chronist Slow is the 35 AP damage+Slow hybrid.

### 10.5 Requirements and payoff chains

Any requirement referencing a retired status must migrate to a current mechanic where the gameplay relationship remains meaningful.

Examples:

- `Delayed` payoff requirements become `Slow` when the intent is tempo/control setup;
- no current Skill requirement may require `Borrowed Hour` or `Regeneration`.

### 10.6 AI metadata

AI purpose tags/base utility must be updated when a Skill changes to displacement, ground AoE, timed recovery, or movement tempo. AI must evaluate the new mechanic rather than stale legacy tags.

## 11. Shared combat schema design

### 11.1 Target shapes

No new target-shape primitive is required. Existing `single`, `circle`, and `line` stay authoritative. Presentation becomes `Single`, `Circle X`, and `Line X`.

### 11.2 Displacement effect

Conceptual shape:

```ts
{
  type: 'displace'
  recipient: 'primary-unit' | 'affected-units'
  direction?: 'push' | 'pull' // omitted historical value means push
  distance: number            // positive safe integer
}
```

### 11.3 Healing and positive MP recovery

Healing and positive MP recovery gain optional tick count; omitted historical values normalize to one tick.

```ts
{ type: 'healing'; recipient: ...; amount: number; ticks?: number }
{ type: 'resource-change'; resource: 'mp'; delta: number; recipient: ...; ticks?: number }
```

Validation rules:

- `ticks` defaults to 1;
- `ticks` must be an integer from 1 through 4 for current authored content;
- negative MP delta (`MP Drain`) must use one tick;
- direct zero/negative healing is not introduced.

### 11.4 Ongoing-effect state

Encounter state gains an optional/default-empty first-class collection for future recovery ticks rather than dynamic statuses.

Old serialized encounters lacking the field remain valid and normalize to no ongoing recovery.

### 11.5 Movement modifiers

Status movement metadata supports a signed per-tile AP delta. Current Slow becomes `+10`; Haste authors `-10`.

Movement-cost calculation remains server authoritative. Client reachability/preview derives from the same rule inputs and must not own a parallel rule system.

## 12. Presentation and player communication

### 12.1 One shared tag source

Profile Skill details, battle command cards, battle Skill picker options, Essence presentation, and other current Skill-tag surfaces derive from one presentation helper/source of truth.

Do not hard-code separate PvE/PvP vocabularies.

### 12.2 Active Effects

Active Effects use the shortened labels the Owner selected, while unchanged labels stay unchanged. Relevant examples include:

- Guard;
- Expose;
- Inspire;
- Hex;
- Ghost;
- Summon;
- Haste;
- Slow;
- Off-guard;
- Burn (Scorched);
- Bleed (Bleeding);
- Poison (Poisoned);
- Displaced;
- Root and other unchanged current effects.

Scheduled recovery appears as `Heal N` / `MP Rec N` based on future ticks remaining, not as Regeneration.

### 12.3 Forecast and logs

Forecast/log text remains explanatory even when tags are compact.

Examples:

- `Pull 2` can forecast `Pulled 1/2 tiles; second tile blocked.`
- `Heal 3` details show amount per tick and timing.
- movement preview shows Haste/Slow-adjusted AP before confirmation.

Compact tags do not replace the detailed Skill explanation surface.

## 13. Compatibility and versioning

### 13.1 Immutable historical behavior

Already committed battles and historical Skill versions resolve with their pinned semantics.

Do not reinterpret old `delayed` as movement Slow or old `hastened` as movement Haste.

### 13.2 New versions, not mutation of history

Where a published Skill's mechanics change, append a new content version and enable it for new battle/build snapshots. Historical versions remain available to old snapshots.

### 13.3 Stable internal IDs where safe

Pure presentation renames prefer stable internal IDs:

- `guarded` may remain internal while displaying Guard;
- `exposed` may remain internal while displaying Expose;
- `invisible` may remain internal while displaying Ghost;
- `lowered-guard` may remain internal while displaying Off-guard;
- Burn/Bleed/Poison keep their current stored IDs and typed aliases.

Mechanically retired identities remain historical-only rather than being repurposed with new semantics.

## 14. Server authority, preview, AI, and PvP/PvE parity

- Browser submits target/path/action intent only.
- Server resolves Push/Pull distance, movement AP, ongoing recovery, DoTs, and battle outcomes.
- Preview and commit call the same deterministic rules for all new effects.
- PvE and PvP consume the same definitions and effect presentation.
- Spectator/inspect/log surfaces render authoritative results rather than recomputing them.
- Recruit/AI decisions use updated action definitions and utility metadata.

## 15. Test and verification contract

Implementation is incomplete without focused coverage for required and forbidden behavior.

### 15.1 Tag/presentation tests

Assert exact current labels including:

- Self/Ally;
- Anyone;
- Ground;
- Empty Tile;
- Single;
- Circle numeric radius;
- Line numeric length;
- Dmg/element Dmg;
- Heal X;
- MP Rec X;
- Push X/Pull X;
- Revert;
- Freeze Ground;
- Guard/Expose/Inspire/Hex/Ghost/Summon/Haste/Slow/Off-guard;
- unchanged `Burn (Scorched)`, `Bleed (Bleeding)`, and `Poison (Poisoned)`.

### 15.2 Displacement tests

Cover:

- Push 1 historical/default compatibility;
- Push >1 full movement;
- Push >1 partial movement when a later tile is blocked;
- Pull >1 full movement;
- Pull stopping adjacent to the source;
- Pull never occupying/passing through the source tile;
- Root blocking displacement;
- blocked terrain;
- board edge;
- occupied destination;
- elevation failure;
- Displaced only after at least one successful step;
- deterministic multi-recipient collision ordering;
- preview/commit parity.

### 15.3 Movement tests

Cover normal/rough/Frozen movement with:

- no status;
- Haste;
- Slow;
- Haste + Slow;
- Airborne + Frozen;
- Root;
- 10 AP minimum tile floor;
- unchanged Movement allowance.

### 15.4 Recovery tests

Cover:

- Heal 1 immediate only;
- Heal 2/3/4 scheduling;
- MP Rec 1/2/3/4 scheduling;
- rejection of ticks outside 1–4;
- HP/MP caps;
- Hex affecting every HP tick;
- no revive from future Heal ticks;
- removal of future recovery when recipient is defeated;
- same-action refresh/replace;
- different-action coexistence;
- repeat-use falloff on every scheduled tick;
- legacy Regeneration compatibility;
- preview/commit parity.

### 15.5 DoT/AoE tests

Cover:

- Burn cadence unchanged and representative Circle application;
- Bleed cadence unchanged and representative Line application;
- Poison cadence unchanged and representative Ground Circle application;
- exact legacy/current player-facing DoT labels preserved;
- no recursive/spontaneous DoT spreading;
- friendly-fire policy remains authored and respected.

### 15.6 Roster/content tests

Assert no enabled current Skill applies/requires:

- `hastened`;
- `delayed`;
- `borrowed-hour` status;
- `regeneration` status.

Assert every enabled current Skill/Essence produces valid compact tags and valid authoritative definitions.

Run targeted game-core/web tests, battle browser checks where practical, and repository-wide `pnpm check` before completion.

## 16. Documentation updates required with implementation

When code becomes current, reconcile at minimum:

- `docs/COMBAT.md`;
- `docs/GAME_MASTER_PLAN.md` or the appropriate current addendum where combat taxonomy is canonical;
- `docs/ROADMAP.md` if execution direction/status changes;
- `TASKS.md`;
- current Phase-4/continuation documentation;
- `docs/PLAYER_MANUAL.md` / generated current Manual content;
- `AGENTS.md` if its combat summary would otherwise become stale.

Historical documents remain historical and are not rewritten to pretend older mechanics never existed.

## 17. Implementation boundary

Implementation should be split into coherent verified increments:

1. shared schema + authoritative displacement/recovery/movement rules and unit tests;
2. current status/content migration and new Skill versions;
3. roster balance/AI metadata audit;
4. shared presentation/tag/Active Effects/forecast/log updates;
5. documentation reconciliation and full verification.

No production deployment is authorized by this design or its implementation commits.