# AUREVANE — Roadmap Integration: PvP Spectation & the Colosseum

**Status:** Binding roadmap companion for the already-started PvP/spectation platform and its later mature competitive expansion.

**Reconciled:** 2026-08-23

**Authority:** Subordinate to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/ROADMAP.md`, `docs/COMBAT.md`, `docs/BATTLE_INTERFACE.md`, and the applicable PvP/spectation domain specification.

This version supersedes the older sequencing assumption that Battle Keys, direct spectation, spectator communication and spectator battle presentation were wholly future Phase-8 work. Those foundations were deliberately delivered during the extended Phase-2 battle-platform cycle and are now official roadmap credit.

The rule going forward is:

> **Reuse and harden the delivered direct-PvP/spectation foundation. Phase 8 builds the mature competitive, discovery, privacy, delay, season and Colosseum product around it rather than rebuilding it.**

---

# 1. Phase 2 — Delivered PvP / spectation foundation

Phase 2 is now **Tactical Combat & Battle Platform**.

## Direct PvP foundation already delivered

The current reusable platform includes, as implemented in the present repository/runtime direction:

- server-authoritative PvP lobby/session boundaries;
- participant mapping and authorization;
- lobby/Battle Key style joining foundations;
- shared persisted PvP battles;
- multiple battle-format configurations, including current 1v1, 2v2, 3v3, three-way and flexible-team variants;
- authoritative battle turn/timing foundations;
- surrender/forfeit/result handling foundations;
- reconnect, handoff and polling/realtime hardening;
- active-session gameplay/navigation protections;
- shared battle chat/communication foundation;
- responsive desktop/mobile PvP presentation;
- multi-combatant battle presentation foundations;
- shared committed battle logs.

## Spectation foundation already delivered

The current reusable platform includes:

- keyed read-only spectation;
- spectator authorization and join/leave behavior;
- read-only committed battle projection;
- spectator presence/roster/count;
- spectator battle communication foundation;
- spectator committed battle log;
- responsive spectator battlefield presentation;
- spectator combatant/terrain Inspect foundations;
- spectator mutation restrictions;
- session/security regression coverage.

## What Phase 2 still does not claim

Delivered direct spectation does **not** mean the mature competitive spectator product is complete.

Still later:

- formal PUBLIC / UNLISTED / PRIVATE_KEY / CLOSED visibility policy;
- broad public live-battle discovery;
- Colosseum destination/product;
- ranked/tournament spectator delay;
- replay product maturity;
- competitive information-disclosure policy;
- tournament integration;
- featured-match operations;
- high-volume spectator fanout;
- mature moderation/privacy controls;
- ratings/matchmaking/seasons/ranked product integration.

These gaps remain later work rather than reasons to remove the existing foundation.

---

# 2. Phase 5 — World / venue compatibility

When the living world arrives:

- establish a coherent world/service destination concept for future arena/Colosseum access;
- do not require a final physical Colosseum venue before competitive PvP matures;
- world navigation can later expose `Colosseum / PvP` cleanly;
- official world events may reference exhibitions/tournaments without creating a separate battle stack;
- venue presentation must route into the same authoritative PvP/spectator services.

No duplicate world-specific spectator implementation should be created.

---

# 3. Phase 6 — Co-op / realtime compatibility

Party/co-op work should reuse the battle-session and realtime foundations already proven by direct PvP.

Preserve distinct roles for:

- participant/control authority;
- ally/party information;
- non-participant read-only observers;
- safe reconnect and sequence/versioned state.

Do not collapse spectator identity into participant authority merely because both consume battle state.

---

# 4. Phase 8 — Competitive PvP, Spectation & Colosseum maturity

Phase 8 is no longer “implement spectation from zero.”

Its job is to audit the inherited Phase-2 foundation and add the mature competitive product layers below.

## A. Visibility policy

Add explicit versioned visibility state such as:

```text
PUBLIC
UNLISTED
PRIVATE_KEY
CLOSED
```

Queue/mode/tournament policy constrains valid choices.

For casual friend sparring:

- default to private/unlisted/closed behavior appropriate to current product direction;
- broadening discovery requires the applicable participant/host consent policy;
- one participant must not unexpectedly expose a battle after start where policy forbids it.

For ranked/tournament:

- queue/event policy controls discoverability;
- competitive delay is mandatory where live spectation is enabled.

## B. Shareable spectator access

Mature the existing keyed spectator access into explicit shareable spectator handles/routes.

Requirements:

- spectator access never grants participant command authority;
- viewer authorization remains distinct from participant authorization;
- private secret material is not exposed unnecessarily in URLs/client state;
- participant/host controls follow explicit policy for copy/revoke/regenerate where applicable;
- completed eligible links can transition to final result/replay rather than becoming dead surfaces.

## C. Private Battle Keys

Preserve and harden the already-built key concept.

Mature requirements include:

- one-battle/replay scope;
- adequate entropy for expected lifetime;
- failed-attempt rate limiting;
- authenticated/stable viewer identity where required;
- safe verifier/hash handling where appropriate;
- explicit regeneration/revocation policy;
- no gameplay-control escalation;
- private battles absent from public discovery.

## D. Dedicated spectator projection

Continue deriving spectators from committed authoritative battle state/events.

Public projection may include:

- positions;
- HP/MP/resources;
- statuses that are legitimately public;
- facing;
- initiative/timeline;
- committed actions/results;
- objective state;
- sanitized battle log;
- public identities;
- final result.

Projection must exclude information spectators are not entitled to know, including where applicable:

- uncommitted planning;
- hovered/planned paths or targets;
- future/raw RNG state;
- hidden build/status/object information;
- private team communications;
- AI private reasoning;
- anti-cheat/provenance internals;
- secret keys/server credentials.

Do not send secret fields merely to hide them with CSS.

## E. Competitive spectator delay

Ranked/tournament live spectation should use a server-owned delay policy.

Initial tuning may target roughly one or more committed turns / about 45–60 seconds, but exact values are versioned and evidence-tunable.

Requirements:

- authoritative event buffering;
- reconnect cannot jump ahead;
- alternate HTTP/replay endpoints cannot bypass the delay;
- UI clearly labels delayed state;
- participants cannot lower competitive delay.

## F. Casual live spectation

Casual/private sparring may support live spectation under the applicable visibility/consent policy.

Setup should clearly communicate spectator state such as:

```text
Spectators: LIVE / DELAYED / DISABLED
Visibility: PUBLIC / UNLISTED / PRIVATE KEY / CLOSED
```

## G. Spectator cockpit maturity

Build on the existing read-only battlefield experience.

Mature spectator controls may include:

- Follow Action;
- Free Camera;
- combatant cycling;
- unit/tile Inspect;
- battle log;
- density controls;
- Copy Spectator Link;
- Return to Colosseum;
- replay controls when viewing completed battles.

Participant Command Deck controls never appear as actionable spectator controls.

## H. Colosseum MVP

Add a player-facing Colosseum using the same underlying PvP/spectator systems.

Initial surfaces may include:

```text
FEATURED
PUBLIC LIVE BATTLES
RANKED / CASUAL FILTERS
TOURNAMENTS when available
FRIENDS FIGHTING where privacy permits
REPLAYS where policy permits
```

Listings expose only public metadata permitted by battle/mode/privacy policy.

Prioritize reliable discovery, privacy and battle readability over building a giant sports portal.

## I. Competitive PvP integration

The spectator product must integrate with the Phase-8 competitive work:

- ranked 1v1 / 2v2;
- matchmaking/ratings;
- Arena Tempering;
- seasons;
- tournaments;
- competitive build snapshots;
- Skill/Resonance/Essence/Soulmark/Mantle/equipment legality as those systems exist;
- disconnect/abandon policy;
- map/spawn/side-bias analysis;
- competitive telemetry.

Do not create duplicate PvP-only Skills/build definitions merely for spectator or queue presentation.

## Phase-8 spectator gate

Before calling mature competitive spectation ready:

- spectator access cannot issue participant commands;
- private-key battles are not publicly discoverable;
- key brute-force attempts are rate-limited;
- hidden information does not leak through spectator payloads;
- ranked/tournament delay cannot be bypassed;
- an invited private casual spar can be watched according to policy;
- an eligible public match can be opened from the Colosseum;
- match completion transitions cleanly to final result/replay where allowed;
- spectator fanout does not multiply battle mutation execution or materially damage participant latency.

---

# 5. Phase 9 — Competitive content expansion

As build/content variety grows:

- spectator projection must correctly classify newly public/private mechanics;
- new Soulmark/Mantle/Resonance/Essence/equipment interactions must not leak unrevealed information;
- Colosseum filters may expand to mode/rank/map/build identity where useful and safe;
- eligible public replays can become learning material;
- unreleased/hidden content must not be exposed through spectator metadata.

---

# 6. Phase 10 — Social spectation

When the mature social world exists, extend the existing spectator platform with features supported by actual social demand:

- Friends Fighting discovery where privacy allows;
- spectator chat moderation/mute/block/report integration;
- optional slow mode for featured matches;
- private spectator access-list/removal controls where justified;
- friend/follow shortcuts to eligible battles;
- richer replay sharing;
- profile/history links to eligible public competitive replays;
- spectator privacy preferences.

Competitive participants should not receive live spectator tactical coaching through the product by default.

Spectators cannot place tactical pings onto participant battlefields.

---

# 7. Phase 12 — Nations / arena identity

As nation identity matures:

- nation capitals/regions may receive culturally distinct arena/Colosseum entrances or presentation;
- they route to the same underlying PvP/matchmaking/spectator systems;
- nation events may feature exhibitions where appropriate;
- visibility/delay/security rules remain consistent regardless of visual venue.

Do not create incompatible spectator stacks per nation.

---

# 8. Phase 13 — Colosseum / tournament operations

Add safe Owner/Event Staff operational surfaces for:

- feature/unfeature eligible matches;
- official exhibition/tournament stage configuration;
- ranked spectator delay/version configuration;
- visibility defaults per queue/event;
- spectator capacity/fanout health;
- replay retention policy;
- private access support/revocation with audit where justified;
- tournament bracket → live match linking;
- emergency spectation disable;
- spectator-chat controls;
- moderation/support diagnostics without leaking hidden competitor state.

Event Staff may curate authorized presentation but cannot secretly change competitive battle rules or reveal private state without separately approved authority.

---

# 9. Phase 14 — Spectator presentation polish

Polish the Colosseum/spectator experience so important battles feel like events:

- premium Colosseum visual identity;
- featured-match cards;
- clear LIVE / DELAYED / REPLAY treatment;
- strong portrait/title/badge presentation;
- tournament bracket presentation;
- responsive layouts;
- follow-action camera transitions;
- spectator-safe audio mix;
- readable battle log/score/objective presentation;
- restrained crowd ambience where appropriate;
- replay controls/transitions.

The battlefield remains the star.

---

# 10. Phase 15 — Spectator security & scale hardening

Harden:

- Battle Key brute-force/rate limiting;
- handle enumeration resistance;
- private/blocked discovery leaks;
- spectator→participant authorization escalation;
- hidden build/status/RNG leakage;
- delayed-feed bypass through every transport/replay/reconnect path;
- second-account/voice-coaching threat model;
- spectator-chat abuse/spam where chat exists;
- spectator reconnect/order correctness;
- completed battle/replay visibility carry-forward;
- hundreds/thousands of spectator fanout on representative featured matches;
- spectator-count/realtime cost;
- participant mutation latency under spectator load;
- tournament traffic spikes;
- privacy/account deletion/replay-retention interactions;
- audit integrity for operational spectator actions.

---

# Product principle

The Colosseum is not merely a list of matches.

Its long-term purpose is to make AUREVANE combat socially legible:

> players should be able to watch a championship duel, share a private sparring battle, study an expert replay, gather around an event match and recognize famous fighters—without spectators compromising the battle they came to watch.

The direct spectator foundations already built are the beginning of that product, not throwaway Phase-2 code.