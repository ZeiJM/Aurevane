# November 3 starter Item reference

**Implemented source version 1; not live.** Independent whole-branch review, exact-head CI, coordinated migration/content release and Owner gameplay acceptance remain required. This reference describes the genuine source defaults; a later Master publication can change the current catalogue while captured battles retain their exact definitions.

All 47 Items use their adopted immutable `item.<identity>.art.v1` image and thumbnail. Full artwork provenance: [47-image manifest](../artwork/2026-11-03-starter-items.json). The implementation source is `packages/game-core/src/content/starter-items.ts`.

Every category has 40 positions. Gear stacks to 1; other starter stacks to 99. Equipment has Head, Body, Pants, Boots, Main Hand and Off Hand with a hard combined 100 QP limit. Equipping grants the listed passive; active actions require their equipped role. Main Hand weapon supplies Basic Attack, falling back to an Off Hand weapon. Only the selected equipment Support action replaces normal Support. Ordinary weapon attacks are unlimited subject to AP and ordinary legality. Supplies occupy a hand and have the listed uses per battle, refill in a new battle, and do not decrement owned quantities. No Item-level Requirements wrapper is active.

Action costs below are AP; the normal turn starts with 100 AP. Movement bonuses are tiles, Jump bonuses are elevation steps, and Evasion bonuses are percentage points. Damage entries are authored base/scaling values before engine Defense, damage policies and rounding, not a promise of flat HP loss. All starter active effects activate instantly. Turn durations use the shared status/Barrier lifecycle. Support cooldowns are two owner turns; supply and weapon attack cooldowns are None.

| Item / identity | Category · class / position | Tier | QP | Default quantity | Real passive/effect | Action · AP · uses |
|---|---|---:|---:|---:|---|---|
| Wayfarer Hood (`wayfarer-hood`) | gear · armor / Head | D | 5 | 1 | Passive: Evasion +1 percentage points | None |
| Ember-Stitched Cowl (`ember-stitched-cowl`) | gear · armor / Head | C | 14 | 1 | Passive: Mystic Power +12 | None |
| Warden Helm (`warden-helm`) | gear · armor / Head | A | 26 | 1 | Passive: Physical Defense +18; Mystic Defense +10 | None |
| Traveler Jerkin (`traveler-jerkin`) | gear · armor / Body | D | 6 | 1 | Passive: Physical Defense +6 | None |
| Stormweave Robe (`stormweave-robe`) | gear · armor / Body | B | 20 | 1 | Passive: Mystic Defense +16; Mystic Power +8 | None |
| Duskplate Cuirass (`duskplate-cuirass`) | gear · armor / Body | S | 38 | 1 | Passive: Physical Defense +32; Mystic Defense +20 | None |
| Roadworn Trousers (`roadworn-trousers`) | gear · armor / Pants | D | 4 | 1 | Passive: Initiative +3 | None |
| Reinforced Greaves (`reinforced-greaves`) | gear · armor / Pants | C | 14 | 1 | Passive: Physical Defense +10; Jump +1 | None |
| Shadowstep Leggings (`shadowstep-leggings`) | gear · armor / Pants | A | 24 | 1 | Passive: Evasion +4 percentage points; Initiative +6 | None |
| Trailbound Boots (`trailbound-boots`) | gear · armor / Boots | C | 12 | 1 | Passive: Movement +1 | None |
| Galewalker Boots (`galewalker-boots`) | gear · armor / Boots | A | 28 | 1 | Passive: Movement +2 | None |
| Quickdraw Glove (`quickdraw-glove`) | gear · hand-armor / 1-hand | C | 8 | 1 | Passive: Initiative +6; Physical Power +4 | None |
| Wardstone Bracer (`wardstone-bracer`) | gear · hand-armor / 1-hand | B | 16 | 1 | Passive: Mystic Defense +12<br>Ward: Barrier 8% maximum HP (self), 2 turns | Support · 30 AP · unlimited · cooldown 2 · self |
| Iron Shortsword (`iron-shortsword`) | gear · weapon / 1-hand | C | 9 | 1 | Attack: Physical Damage: base 5 + 12.5% Physical Power | Basic Attack · 30 AP · unlimited · enemy range 2 |
| Hollow Dagger (`hollow-dagger`) | gear · weapon / 1-hand | D | 6 | 1 | Attack: Physical Damage: base 3 + 8.5% Physical Power | Basic Attack · 20 AP · unlimited · enemy range 1 |
| Buckler of Patience (`buckler-patience`) | gear · weapon / 1-hand | C | 12 | 1 | Attack: Physical Damage: base 4 + 10% Physical Power; Guarded 10%: reduced incoming damage (self), 1 turns | Basic Attack · 30 AP · unlimited · enemy range 1 |
| Twinfang Blade (`twinfang-blade`) | gear · weapon / 1-hand | B | 20 | 1 | Attack: Physical Damage: base 3 + 8.5% Physical Power; Physical Damage: base 3 + 8.5% Physical Power | Basic Attack · 40 AP · unlimited · enemy range 1 |
| Tower Shield (`tower-shield`) | gear · weapon / 1-hand | A | 30 | 1 | Attack: Physical Damage: base 3 + 8.5% Physical Power<br>Passive: Physical Defense +18; Mystic Defense +10<br>Guard: Guarded 30%: reduced incoming damage (self), 2 turns | Basic Attack · 30 AP · unlimited · enemy range 1<br>Support · 30 AP · unlimited · cooldown 2 · self |
| Stormcaller Staff (`stormcaller-staff`) | gear · weapon / 1-hand | B | 22 | 1 | Attack: Storm Mystic Damage: base 5 + 15% Mystic Power; Conductive 10%: increased Storm damage taken; damaging Storm hit consumes the existing charge (enemy), 1 turns | Basic Attack · 35 AP · unlimited · enemy range 3 |
| Emberbrand (`emberbrand`) | gear · weapon / 1-hand | A | 28 | 1 | Attack: Fire Physical Damage: base 6 + 13% Physical Power; Remove Chilled (self)<br>Passive: Direct Fire damage +10% (matching packets only) | Basic Attack · 35 AP · unlimited · enemy range 1 |
| Sunsplitter (`sunsplitter`) | gear · weapon / 2-hand | S | 50 | 1 | Attack: Physical Damage: base 8 + 21% Physical Power | Basic Attack · 50 AP · unlimited · enemy range 1 |
| Mender Salve (`mender-salve`) | battle-items · battle-item / 1-hand | C | 8 | 12 | Use: Recover 12% maximum HP (self) | Item · 35 AP · 3/battle · self |
| Clarity Draught (`clarity-draught`) | battle-items · battle-item / 1-hand | C | 8 | 12 | Use: Recover 12% maximum MP (self) | Item · 35 AP · 3/battle · self |
| Purifying Incense (`purifying-incense`) | battle-items · battle-item / 1-hand | B | 14 | 12 | Use: Cleanse all debuffs (self) | Item · 30 AP · 2/battle · self |
| Whetstone Charm (`whetstone-charm`) | battle-items · battle-item / 1-hand | C | 12 | 12 | Use: Damage Up 15%: increased outgoing damage (self), 2 turns | Item · 25 AP · 2/battle · self |
| Ironbark Tonic (`ironbark-tonic`) | battle-items · battle-item / 1-hand | C | 12 | 12 | Use: Fortified: Physical/Mystic Defense +15%, outgoing damage −15% (self), 2 turns | Item · 25 AP · 2/battle · self |
| Swiftleaf Tea (`swiftleaf-tea`) | battle-items · battle-item / 1-hand | B | 14 | 12 | Use: Haste: ordinary Move costs 10 less AP per tile (self), 2 turns | Item · 20 AP · 2/battle · self |
| Emberflask (`emberflask`) | battle-items · battle-item / 1-hand | C | 10 | 12 | Use: Fire Mystic Damage: base 8 + 8% Mystic Power; Remove Chilled (self) | Item · 30 AP · 3/battle · enemy range 3 |
| Vulnerability Oil (`vulnerability-oil`) | battle-items · battle-item / 1-hand | B | 16 | 12 | Use: Vulnerable 15%: increased incoming damage (enemy), 2 turns | Item · 25 AP · 2/battle · enemy range 3 |
| Frostbind Powder (`frostbind-powder`) | battle-items · battle-item / 1-hand | B | 16 | 12 | Use: Chilled: prevents choosing a different final facing (enemy), 2 turns | Item · 25 AP · 2/battle · enemy range 3 |
| Smoke Veil (`smoke-veil`) | battle-items · battle-item / 1-hand | B | 18 | 12 | Use: Guarded 20%: reduced incoming damage (self), 2 turns | Item · 25 AP · 2/battle · self |
| Ward Sigil Scroll (`ward-sigil-scroll`) | battle-items · battle-item / 1-hand | A | 22 | 12 | Use: Barrier 20% maximum HP (self), 2 turns | Item · 35 AP · 1/battle · self |
| Ashwood Plank (`ashwood-plank`) | materials · material | D | 0 | 12 | Display-only sample; no usable, crafting, quest or companion mechanic | None |
| Ironvein Ore (`ironvein-ore`) | materials · material | D | 0 | 40 | Display-only sample; no usable, crafting, quest or companion mechanic | None |
| Dusk Petal (`dusk-petal`) | materials · material | D | 0 | 1 | Display-only sample; no usable, crafting, quest or companion mechanic | None |
| Wyrm Scale Shard (`wyrm-scale-shard`) | materials · material | D | 0 | 1 | Display-only sample; no usable, crafting, quest or companion mechanic | None |
| Glimmer Dust (`glimmer-dust`) | materials · material | D | 0 | 99 | Display-only sample; no usable, crafting, quest or companion mechanic | None |
| Lantern Oil (`lantern-oil`) | general · general | D | 0 | 1 | Display-only sample; no usable, crafting, quest or companion mechanic | None |
| Rope Coil (`rope-coil`) | general · general | D | 0 | 1 | Display-only sample; no usable, crafting, quest or companion mechanic | None |
| Worn Map Fragment (`worn-map-fragment`) | general · general | D | 0 | 1 | Display-only sample; no usable, crafting, quest or companion mechanic | None |
| Travel Rations (`travel-rations`) | general · general | D | 0 | 1 | Display-only sample; no usable, crafting, quest or companion mechanic | None |
| Letter of Introduction (`letter-introduction`) | event · event | D | 0 | 1 | Display-only sample; no usable, crafting, quest or companion mechanic | None |
| Cracked Aurevane Sigil (`cracked-aurevane-sigil`) | event · event | D | 0 | 1 | Display-only sample; no usable, crafting, quest or companion mechanic | None |
| Gatewarden Token (`gatewarden-token`) | event · event | D | 0 | 1 | Display-only sample; no usable, crafting, quest or companion mechanic | None |
| Hearthbite Treat (`hearthbite-treat`) | companion · companion | D | 0 | 1 | Display-only sample; no usable, crafting, quest or companion mechanic | None |
| Bond Ribbon (`bond-ribbon`) | companion · companion | D | 0 | 1 | Display-only sample; no usable, crafting, quest or companion mechanic | None |
| Travel Collar (`travel-collar`) | companion · companion | D | 0 | 1 | Display-only sample; no usable, crafting, quest or companion mechanic | None |

## Grants, editing and repair

Opening Items initializes the source through the shared immutable source/version-floor authority and invokes one atomic starter wrapper. Master catalogue reads and valid staff grant requests use the same source initializer. Master Commit appends a new current version; Restore Default selects the real version-1 source. It never rewrites prior definitions or captures.

A durable `starter-items.2026-11-03.v1` receipt is final. Refreshes do not regrant or revalidate its original defaults. First initialization filters the current available, enabled defaults and records the actual granted payload. Later unarchiving does not top up a completed receipt. Archived owned Items remain visible as unavailable; disabled Items remain visible and inspectable, but are excluded from Equippable and included in Unavailable.

If every default is unavailable, or a pending/active battle prevents ownership changes, the inventory remains readable and no completed grant receipt is written. If the full available grant cannot fit, the entire grant is deferred with a visible capacity notice; no partial quantities or false receipt are stored. Explicit staff grants retain their atomic capacity rejection. The wrapper locks catalogue before account/inventory and rechecks the receipt after locking.

## Automated weapon balance reference

The engine fixture uses level 1, equal Physical/Mystic Power 100 or 200, equal Physical/Mystic Defense 0/50/150, Accuracy 14000 basis points, Evasion 0, critical chance 0, status resistance 0 and the current captured damage policies. Both units share each profile. The comparison Skill is the approved current `vanguard.forceful-strike` candidate (Forceful Strike), at 45 AP; unarmed costs 30 AP. Every entry executes real canonical quote/commit, including weapon replacement of Basic Attack. This is bounded automated evidence, not human balance acceptance.

Weapons target approximately 60–70% of comparable Discipline damage per AP at the zero-Defense reference; shields deliberately give up more output for defense/Guard. Utility and range remain real tradeoffs: Iron Shortsword retains its 30 AP and lower damage but reaches range 2 with normal line-of-sight handling, where unarmed cannot attack. A canonical distance-2 quote/commit test proves that distinction. The current unarmed baseline is more efficient per AP than these weapon baselines in the measured profiles; the requested Discipline-relative band therefore does not establish a universal weapon upgrade over unarmed. This tradeoff is explicit for Owner balance review. Higher Defense and integer rounding shift ratios. Twin attacks retain two separately mitigated packets. Heavy raw damage must be assessed with its 50 AP cost and 50 QP/two-hand commitment.

| Power | Defense | Weapon | Damage / AP | Damage per AP | Discipline damage / per AP | Unarmed damage / per AP | Weapon / Discipline per AP |
|---:|---:|---|---:|---:|---:|---:|---:|
| 100 | 0 | Iron Shortsword | 23 / 30 | 0.767 | 56 / 1.244 | 29 / 0.967 | 61.6% |
| 100 | 0 | Hollow Dagger | 15 / 20 | 0.750 | 56 / 1.244 | 29 / 0.967 | 60.3% |
| 100 | 0 | Buckler of Patience | 19 / 30 | 0.633 | 56 / 1.244 | 29 / 0.967 | 50.9% |
| 100 | 0 | Twinfang Blade | 30 / 40 | 0.750 | 56 / 1.244 | 29 / 0.967 | 60.3% |
| 100 | 0 | Tower Shield | 15 / 30 | 0.500 | 56 / 1.244 | 29 / 0.967 | 40.2% |
| 100 | 0 | Stormcaller Staff | 28 / 35 | 0.800 | 56 / 1.244 | 29 / 0.967 | 64.3% |
| 100 | 0 | Emberbrand | 28 / 35 | 0.800 | 56 / 1.244 | 29 / 0.967 | 64.3% |
| 100 | 0 | Sunsplitter | 40 / 50 | 0.800 | 56 / 1.244 | 29 / 0.967 | 64.3% |
| 100 | 50 | Iron Shortsword | 15 / 30 | 0.500 | 36 / 0.800 | 19 / 0.633 | 62.5% |
| 100 | 50 | Hollow Dagger | 9 / 20 | 0.450 | 36 / 0.800 | 19 / 0.633 | 56.2% |
| 100 | 50 | Buckler of Patience | 12 / 30 | 0.400 | 36 / 0.800 | 19 / 0.633 | 50.0% |
| 100 | 50 | Twinfang Blade | 18 / 40 | 0.450 | 36 / 0.800 | 19 / 0.633 | 56.2% |
| 100 | 50 | Tower Shield | 9 / 30 | 0.300 | 36 / 0.800 | 19 / 0.633 | 37.5% |
| 100 | 50 | Stormcaller Staff | 18 / 35 | 0.514 | 36 / 0.800 | 19 / 0.633 | 64.3% |
| 100 | 50 | Emberbrand | 17 / 35 | 0.486 | 36 / 0.800 | 19 / 0.633 | 60.7% |
| 100 | 50 | Sunsplitter | 26 / 50 | 0.520 | 36 / 0.800 | 19 / 0.633 | 65.0% |
| 100 | 150 | Iron Shortsword | 8 / 30 | 0.267 | 22 / 0.489 | 11 / 0.367 | 54.5% |
| 100 | 150 | Hollow Dagger | 5 / 20 | 0.250 | 22 / 0.489 | 11 / 0.367 | 51.1% |
| 100 | 150 | Buckler of Patience | 7 / 30 | 0.233 | 22 / 0.489 | 11 / 0.367 | 47.7% |
| 100 | 150 | Twinfang Blade | 10 / 40 | 0.250 | 22 / 0.489 | 11 / 0.367 | 51.1% |
| 100 | 150 | Tower Shield | 5 / 30 | 0.167 | 22 / 0.489 | 11 / 0.367 | 34.1% |
| 100 | 150 | Stormcaller Staff | 11 / 35 | 0.314 | 22 / 0.489 | 11 / 0.367 | 64.3% |
| 100 | 150 | Emberbrand | 9 / 35 | 0.257 | 22 / 0.489 | 11 / 0.367 | 52.6% |
| 100 | 150 | Sunsplitter | 15 / 50 | 0.300 | 22 / 0.489 | 11 / 0.367 | 61.4% |
| 200 | 0 | Iron Shortsword | 42 / 30 | 1.400 | 91 / 2.022 | 50 / 1.667 | 69.2% |
| 200 | 0 | Hollow Dagger | 28 / 20 | 1.400 | 91 / 2.022 | 50 / 1.667 | 69.2% |
| 200 | 0 | Buckler of Patience | 33 / 30 | 1.100 | 91 / 2.022 | 50 / 1.667 | 54.4% |
| 200 | 0 | Twinfang Blade | 56 / 40 | 1.400 | 91 / 2.022 | 50 / 1.667 | 69.2% |
| 200 | 0 | Tower Shield | 28 / 30 | 0.933 | 91 / 2.022 | 50 / 1.667 | 46.2% |
| 200 | 0 | Stormcaller Staff | 49 / 35 | 1.400 | 91 / 2.022 | 50 / 1.667 | 69.2% |
| 200 | 0 | Emberbrand | 48 / 35 | 1.371 | 91 / 2.022 | 50 / 1.667 | 67.8% |
| 200 | 0 | Sunsplitter | 70 / 50 | 1.400 | 91 / 2.022 | 50 / 1.667 | 69.2% |
| 200 | 50 | Iron Shortsword | 28 / 30 | 0.933 | 60 / 1.333 | 33 / 1.100 | 70.0% |
| 200 | 50 | Hollow Dagger | 18 / 20 | 0.900 | 60 / 1.333 | 33 / 1.100 | 67.5% |
| 200 | 50 | Buckler of Patience | 22 / 30 | 0.733 | 60 / 1.333 | 33 / 1.100 | 55.0% |
| 200 | 50 | Twinfang Blade | 36 / 40 | 0.900 | 60 / 1.333 | 33 / 1.100 | 67.5% |
| 200 | 50 | Tower Shield | 18 / 30 | 0.600 | 60 / 1.333 | 33 / 1.100 | 45.0% |
| 200 | 50 | Stormcaller Staff | 32 / 35 | 0.914 | 60 / 1.333 | 33 / 1.100 | 68.6% |
| 200 | 50 | Emberbrand | 31 / 35 | 0.886 | 60 / 1.333 | 33 / 1.100 | 66.4% |
| 200 | 50 | Sunsplitter | 46 / 50 | 0.920 | 60 / 1.333 | 33 / 1.100 | 69.0% |
| 200 | 150 | Iron Shortsword | 16 / 30 | 0.533 | 36 / 0.800 | 19 / 0.633 | 66.7% |
| 200 | 150 | Hollow Dagger | 11 / 20 | 0.550 | 36 / 0.800 | 19 / 0.633 | 68.8% |
| 200 | 150 | Buckler of Patience | 12 / 30 | 0.400 | 36 / 0.800 | 19 / 0.633 | 50.0% |
| 200 | 150 | Twinfang Blade | 22 / 40 | 0.550 | 36 / 0.800 | 19 / 0.633 | 68.8% |
| 200 | 150 | Tower Shield | 11 / 30 | 0.367 | 36 / 0.800 | 19 / 0.633 | 45.8% |
| 200 | 150 | Stormcaller Staff | 19 / 35 | 0.543 | 36 / 0.800 | 19 / 0.633 | 67.9% |
| 200 | 150 | Emberbrand | 17 / 35 | 0.486 | 36 / 0.800 | 19 / 0.633 | 60.7% |
| 200 | 150 | Sunsplitter | 28 / 50 | 0.560 | 36 / 0.800 | 19 / 0.633 | 70.0% |

## Verification and release boundaries

Local automated coverage includes strict schema/art/manifest coverage; real migrated SQL/service/repository initialization, current/pinned publication and Master edit/restore metadata; stack 12/40/99 and atomic capacity boundaries; actual engine AP/status/passive/two-hit/element/finite-use/reset behavior; desktop and 390/412px native Arsenal, Item editor and PvE/PvP/spectator battle flows with these genuine definitions.

The existing real PostgreSQL gate now contains 17 two-backend schedules, including five for the new starter wrapper: simultaneous first loads and both transaction orderings for archive/disable. Local migrated PGlite verifies the fixture bodies sequentially. The controller verified all 17 real two-backend schedules at milestone source `68534dd` (exact-tree remote mirror `033588b9283d7af834642d58cbce04a08371a974`, Battle Session DB run `41649787585`, job `125964586526`); authenticated battle HTTP tests also passed. Final source still requires exact-head CI after the reach and documentation changes. No local PGlite result is presented as PostgreSQL concurrency proof.

No hosted data, publications or deployment were changed by starter implementation. The controller must reconcile current source, pass independent review and exact-head required CI (including native races), apply the additive migrations in order, refresh current publication candidates with CAS and preserved drafts/history, then carry out the separately authorized coordinated release. Git deployment remains disabled. Human testing remains open in the [Owner checklist](2026-11-03-owner-combat-items-checklist.md).
