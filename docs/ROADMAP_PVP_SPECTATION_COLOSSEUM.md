# AUREVANE — Roadmap Addendum: PvP Spectation & the Colosseum

**Authority:** Binding roadmap integration for `docs/PVP_SPECTATION_COLOSSEUM.md`, subordinate to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/ROADMAP.md`, `docs/BATTLE_INTERFACE.md`, and `docs/COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md`.

**Direction approved:** 2026-08-17.

This module schedules shareable live-battle links, private Battle Keys, Colosseum discovery, delayed competitive spectation, replays, and spectator operations without expanding current Phase-2 implementation scope prematurely.

---

# Current Phase 2

Do **not** implement the full spectator system in P2.6 or P2.7.

The only current compatibility requirement is architectural:

- preserve authoritative committed battle events/versioned snapshots;
- avoid coupling read-only battle presentation to participant command authority;
- keep public/known battle information separable from private/internal state;
- do not make the browser the only source of battle history.

The existing structured authoritative event model and Battle Review direction are the intended future source for spectator projections.

No Colosseum, Battle Keys, public listings, spectator sockets, or spectator chat are required in Phase 2.

---

# Phase 5 — World / Venue Presentation Compatibility

When the living world arrives:

- reserve a coherent world/service destination concept for future PvP arena/Colosseum access;
- do not require the final physical Colosseum venue before PvP exists;
- world navigation/menu architecture should later be able to expose `Colosseum / PvP` cleanly;
- official world events can later reference exhibition/tournament locations without rewriting world routing.

No live PvP spectation implementation is required here.

---

# Phase 6 — Realtime Observer/Fanout Compatibility

Party/co-op realtime work should preserve an explicit non-participant viewer role boundary for later spectation.

Add only if required by the realtime architecture:

- read-only subscription/fanout capability distinct from participant-control channels;
- sequence/versioned committed-event delivery;
- viewer-safe projection boundary;
- reconnect by committed spectator sequence;
- no spectator mutation authority.

Do not expose a public spectator product surface merely to satisfy this seam.

This prevents Phase 8 from having to rebuild realtime combat transport around an assumption that every connected viewer is a player.

---

# Phase 8 — PvP + Spectation MVP

Phase 8 is the main implementation phase for the spectator system because direct challenges, casual/ranked PvP, matchmaking, seasons and tournaments become real here.

## A. Battle visibility policy

Add explicit spectation visibility state:

```text
PUBLIC
UNLISTED
PRIVATE_KEY
CLOSED
```

Mode/queue rules constrain valid choices.

For casual friend sparring:

- default to `PRIVATE_KEY` or `CLOSED`;
- broadening to PUBLIC requires appropriate participant consent unless the match was created as a public exhibition.

For ranked/tournament:

- queue/tournament policy defines whether discovery is public/optional;
- competitive delay is mandatory where spectation is enabled.

## B. Shareable spectator links

Implement opaque spectator handles and routes such as:

```text
/game/spectate/<opaque-handle>
```

Requirements:

- spectator link grants no participant authority;
- link resolves through a dedicated spectator authorization boundary;
- private key is not embedded in the URL by default;
- participants can copy spectator link separately from Battle Key;
- completed eligible links transition to final result and later replay rather than becoming dead links.

## C. Private Battle Key

Implement server-generated human-readable Battle Keys for private sparring.

Requirements:

- scoped to one battle/replay;
- sufficient entropy for lifetime;
- failed-attempt rate limiting;
- stable authenticated viewer principal;
- verifier/hash rather than client-authoritative plaintext state;
- participant/host regeneration and explicit revocation policy;
- key never grants gameplay control;
- private battles remain absent from public discovery/search/activity surfaces.

## D. Spectator Projection

Create a dedicated read-only spectator projection from committed authoritative battle state/events.

Projection may include public:

- positions;
- HP/MP/resources;
- statuses;
- facing;
- initiative/timeline;
- committed actions/results;
- objective state;
- sanitized combat log;
- public identities;
- final result.

Projection must exclude:

- uncommitted player planning;
- hovered targets/planned paths;
- future RNG/raw RNG state;
- hidden loadout/Reactions/statuses/objects;
- private chats;
- AI private reasoning;
- internal anti-cheat/provenance;
- Battle Keys/server secrets.

Hidden fields must not be sent and merely CSS-hidden.

## E. Competitive spectator delay

Ranked/tournament spectation starts delayed.

Initial tuning target:

- around one or more committed turns / roughly 45–60 seconds;
- exact queue policy versioned and testable;
- server event buffer owns delay;
- spectator reconnect cannot jump ahead;
- replay endpoints cannot bypass the live delay;
- UI clearly labels delayed state.

Participants cannot lower competitive delay.

## F. Casual live spectation

Casual/private sparring can support live spectation when participants consent.

Lobby/setup clearly shows:

```text
Spectators: LIVE / DELAYED / DISABLED
Visibility: PUBLIC / UNLISTED / PRIVATE KEY / CLOSED
```

Visibility cannot be unexpectedly broadened by one participant after match start.

## G. Spectator cockpit

Build a read-only battle cockpit using the normal battlefield renderer and public inspector/timeline/log components.

Spectator controls include as appropriate:

- Follow Action;
- Free Camera;
- cycle combatants;
- inspect units/tiles;
- Combat Log;
- UI density;
- Copy Spectator Link;
- Return to Colosseum.

Do not show participant Command Deck controls.

## H. Colosseum MVP

Add a player-facing Colosseum with at least:

```text
FEATURED
PUBLIC LIVE BATTLES
RANKED / CASUAL FILTERS
TOURNAMENTS when available
FRIENDS FIGHTING where privacy permits
```

Listings show only public metadata allowed by the battle/mode policy.

Initial filters can remain modest; prioritize fast discovery and privacy correctness over a giant sports portal.

## I. PvP surrender integration

Spectator/result presentation must correctly represent official surrender/forfeit outcomes from the combat-exit roadmap.

A surrendered match remains a legitimate completed competitive result and transitions to final result/replay according to visibility policy.

## Phase-8 spectator gate

Before calling PvP spectation ready:

- shareable links cannot issue commands;
- private-key battles are not publicly discoverable;
- key brute-force attempts are rate-limited;
- hidden information never appears in spectator payloads;
- ranked/tournament delay cannot be bypassed by refresh/reconnect/alternate endpoints;
- a private casual spar can be watched live by an invited friend;
- an eligible public match can be opened from the Colosseum;
- a match finishing while watched transitions correctly to final result;
- spectator load does not multiply combat mutation execution.

---

# Phase 9 — Competitive Content Expansion

As PvP/build variety grows:

- spectator projection understands newly public/hidden combat mechanics correctly;
- new Reactions/Soulmarks/Confluences do not leak pre-reveal information;
- Colosseum filters can expand to mode/rank/map where useful;
- public replays become useful learning material for released build systems;
- avoid exposing unreleased/hidden build definitions through spectator metadata.

---

# Phase 10 — Social Spectation Features

When the mature social world exists, expand spectation with:

- Friends Fighting discovery where privacy allows;
- spectator chat if moderation tooling is ready;
- chat mute/block/report integration;
- optional slow mode for featured matches;
- private spectator access list/removal for hosts;
- follow/friend shortcuts to eligible public/unlisted battles;
- richer replay sharing;
- profile/history links to eligible public competitive replays where desired;
- spectator privacy preferences.

Competitive participants do **not** receive live spectator chat by default.

Spectators cannot place tactical pings onto participant battlefields.

Do not block core spectation launch on chat; read-only watching is the higher-priority feature.

---

# Phase 12 — Nations / Arena Identity

As nation identity matures:

- nation capitals/regions may receive authored arena/Colosseum entrances or culturally distinct PvP presentation;
- these can route to the same underlying PvP/spectator systems rather than fragmenting matchmaking;
- nation events can feature exhibition battles where appropriate;
- spectators remain governed by the same visibility/delay/security rules regardless of visual venue.

Do not create separate incompatible spectator stacks per nation.

---

# Phase 13 — Colosseum / Tournament Operations

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
- spectator-chat controls if chat exists;
- moderation/support diagnostics without exposing raw hidden competitor state.

Event Staff may curate presentation for authorized events but cannot change competitive battle rules or reveal private state unless explicitly granted a separate approved capability.

---

# Phase 14 — Spectator Presentation Polish

Polish the Colosseum and spectator cockpit so important battles feel like events:

- premium Colosseum visual identity;
- featured-match cards;
- clear LIVE / DELAYED / REPLAY treatment;
- strong player portrait/title/badge presentation;
- tournament bracket presentation;
- responsive spectator layout;
- follow-action camera transitions;
- spectator-safe audio mix;
- readable combat log/score/objective presentation;
- restrained crowd/spectator ambience where appropriate;
- replay controls and transitions;
- no generic admin-table appearance.

The battlefield remains the star of the spectator experience.

---

# Phase 15 — Spectator Security & Scale Hardening

Add dedicated hardening for:

- private Battle Key brute-force/rate-limit tests;
- opaque handle enumeration resistance;
- blocked/private discovery leaks;
- spectator-to-participant authorization escalation;
- hidden loadout/Reaction/status/RNG leakage;
- delayed-feed bypass through websocket/HTTP/replay/reconnect paths;
- second-account/voice-coaching threat review;
- spectator chat abuse/spam if chat exists;
- spectator reconnect/order correctness;
- completed battle/replay visibility carry-forward;
- 100s/1000s spectator fanout load on representative featured matches;
- spectator count approximation/realtime cost;
- battle mutation latency under heavy spectator load;
- tournament/featured traffic spikes;
- privacy/account deletion/retention interactions for replays;
- audit integrity for operational feature/private-access actions.

---

# Product principle

The Colosseum is not merely a list of matches.

Its long-term purpose is to make AUREVANE combat socially legible:

> players should be able to watch a championship duel, send a friend a private sparring key, study an expert replay, gather around a live event match, and recognize famous fighters—without spectators compromising the match they came to watch.
