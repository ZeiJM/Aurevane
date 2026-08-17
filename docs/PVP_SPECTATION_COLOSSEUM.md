# AUREVANE — PvP Spectation, Private Battle Keys & the Colosseum

**Status:** Authoritative social/PvP combat addendum subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/COMBAT.md`, `docs/BATTLE_INTERFACE.md`, `docs/COMBAT_USABILITY_BATTLEFIELDS_CONTROLS_RETREAT.md`, `docs/ROADMAP.md`, and later PvP/social specifications.

**Direction approved:** 2026-08-17.

AUREVANE should make important battles feel like events people can gather around. PvP is stronger when friends can watch, tournaments can attract an audience, high-level play can be learned from, and memorable fights can be shared afterward.

The central rule is:

> **Spectators may watch committed battle truth, but they must never become a side-channel for hidden information, uncommitted player plans, or privileged server state.**

---

# 1. Product Goals

The spectation system should support:

- shareable links to eligible in-progress battles;
- a **Colosseum** destination that lists public live battles;
- private friend sparring that does not appear publicly;
- a private **Battle Key** option for invited spectators;
- official tournament/event viewing;
- learning from strong players;
- post-battle replay/share continuity;
- spectator-friendly presentation without duplicating combat logic;
- anti-coaching and anti-information-leak protections;
- moderation/privacy controls;
- scalable read-only fanout for popular matches.

It should not turn every player's activity into public surveillance.

---

# 2. The Colosseum

The **Colosseum** is the player-facing live-battle discovery experience.

It may initially exist as a major PvP/social UI destination and later receive an authored in-world venue/presentation appropriate to AUREVANE's setting.

The Colosseum can show sections such as:

```text
FEATURED NOW
RANKED BATTLES
CASUAL / SPARRING
TOURNAMENTS & EVENTS
FRIENDS FIGHTING
RECENT PUBLIC REPLAYS
```

Only battles whose visibility policy permits discovery appear here.

Useful listing information may include:

- combatant display identities/badges allowed by privacy rules;
- mode: Casual 1v1, Ranked 1v1, 2v2, Tournament, Sparring, etc.;
- current round / broad match state;
- map/scenario name when public;
- public rating/tier where the queue exposes it;
- spectator count;
- live/delayed indicator;
- official/featured/event marker;
- approximate start time/duration;
- completed/replay state.

Do not expose hidden loadout information merely to make a listing more exciting.

---

# 3. Spectation Visibility Modes

Every spectator-eligible battle has an explicit visibility policy.

Initial conceptual modes:

## PUBLIC

- appears in the Colosseum where the battle type permits;
- shareable spectator link works;
- authorized audience may watch according to mode delay rules.

## UNLISTED

- does not appear in ordinary Colosseum discovery;
- anyone with the valid spectator link may request access;
- useful for sharing a casual fight with a group without advertising it globally.

## PRIVATE_KEY

- does not appear in public discovery;
- spectator link alone is insufficient;
- viewer must enter the Battle Key;
- designed for private sparring/friend groups.

## CLOSED

- no normal spectators;
- participants only plus exceptional audited staff/support access where authorized.

Queue/event rules may constrain which modes are selectable.

---

# 4. Consent & Defaults

Spectation should not surprise players.

## Friend / casual sparring

Recommended default:

> `PRIVATE_KEY` or `CLOSED`

before participants deliberately broaden visibility.

If a casual battle is to become publicly listed, all participating sides should consent during match setup unless the mode was explicitly entered as a public exhibition.

## Ranked PvP

Ranked spectation policy is queue-defined and disclosed before queue entry.

A good starting direction is:

- spectation can exist;
- public discovery may be configurable according to player privacy and queue policy;
- spectator feed is delayed;
- players cannot reduce the competitive delay themselves.

Official high-level/tournament queues may require public delayed spectation as a published rule.

## Tournaments / official events

Official matches may be publicly discoverable by rule and can be featured prominently.

Participants know that spectation is part of entering that competition.

---

# 5. Shareable Spectator Links

Eligible battles receive a stable opaque **spectator handle** distinct from internal battle authority IDs where practical.

Conceptually:

```text
/game/spectate/<opaque-handle>
```

The spectator URL grants no combat authority.

It resolves only to the viewer-safe spectator projection allowed for that battle.

For `PRIVATE_KEY` battles, the URL does **not** normally embed the key.

This avoids leaking the key through:

- copied browser history;
- referrer logs;
- screenshots;
- accidental forwarding;
- analytics URLs.

Players can copy:

- **Spectator Link**
- **Battle Key**

as two separate values.

---

# 6. Battle Keys

Private friend spectation uses a short human-readable Battle Key generated server-side.

Illustrative format only:

```text
EMBER-7KQ4
```

Requirements:

- sufficient entropy for its short lifetime;
- case-insensitive/readable where possible;
- avoid ambiguous characters where practical;
- server stores a secure verifier/hash rather than relying on plaintext persistence where feasible;
- rate-limit failed attempts;
- Battle Key applies only to spectator access, never participant control;
- key can expire with the battle/replay policy;
- authorized participant/host can regenerate or revoke spectator access according to mode rules;
- regeneration can optionally invalidate existing private spectator sessions when the user explicitly chooses `Revoke current spectators`;
- private key is visible only to eligible participants/hosts, never public spectators.

The Battle Key is convenience access, not a substitute for authentication/authorization architecture.

Initial implementation should require a signed-in AUREVANE account for private-key spectation so moderation/blocking/rate limits have a stable principal.

---

# 7. Spectator Projection

Spectators do not receive the participant battle snapshot wholesale.

They receive a dedicated **Spectator Projection** derived from committed authoritative state/events.

It may include what the mode declares public, such as:

- committed unit positions;
- public HP/MP/resources;
- public statuses;
- facing;
- committed actions and results;
- visible terrain/objects/objectives;
- turn order information permitted by the mode;
- public player identity/title/badge presentation;
- public timer/round state;
- sanitized battle log;
- final result.

It must not include unauthorized information such as:

- uncommitted selected actions;
- hovered targets;
- planned paths;
- browser planning state;
- private loadout slots not yet revealed by rules;
- hidden Reactions;
- hidden traps/statuses/objects;
- future RNG;
- raw RNG state;
- AI private evaluation/candidate data;
- anti-cheat/internal provenance;
- private team chat;
- Battle Keys;
- server secrets;
- story/spoiler data outside viewer entitlement.

Spectator projection should be a first-class viewer role, not CSS hiding fields that were already sent to the browser.

---

# 8. Competitive Spectator Delay

A turn-based tactical game is vulnerable to outside coaching even if spectators see only public information.

Therefore competitive modes should support an authoritative spectator delay.

Recommended starting direction for Ranked/Tournament play:

- server-managed delay around **one or more committed turns / roughly 45–60 seconds**, tuned by playtest;
- exact policy versioned per queue/tournament;
- spectator UI clearly labels `DELAYED`;
- participants cannot shorten the delay;
- delayed stream is based on committed event sequence, not client clocks;
- reconnecting spectators cannot skip forward past the allowed buffer;
- chat/reactions must not become a route around the delay.

A final production policy can use time, committed-turn depth, or a hybrid.

The objective is not secrecy about publicly visible game state forever. It is to prevent a spectator on voice chat from acting as a zero-latency tactical assistant.

---

# 9. Casual / Sparring Live Spectation

Private or casual sparring can allow true live spectation when participants consent.

Examples:

- friends testing builds;
- teaching sessions;
- guild practice;
- creator/community exhibition matches;
- casual tournaments whose rules permit it.

The lobby clearly shows:

```text
Spectators: Live / Delayed / Disabled
Visibility: Public / Unlisted / Private Key / Closed
```

The setting becomes locked or tightly controlled after match start so one participant cannot unexpectedly broadcast a private duel halfway through.

Visibility may be made **more private** during a match where safe, but broadening visibility after start should require the required participant consent.

---

# 10. Spectator Battle Interface

Spectators use the same battlefield renderer and authoritative visual language but a different control surface.

The spectator cockpit should emphasize:

- battlefield;
- initiative/timeline;
- public unit inspector;
- objective/score state;
- public combat log;
- round/timer;
- follow-action camera;
- manual pan/zoom/inspect;
- spectator count where useful;
- Live/Delayed/Replay state;
- leave spectator view.

It must **not** show a fake player Command Deck or clickable controls that imply the spectator can issue combat commands.

Useful spectator controls may include:

```text
Follow Action
Free Camera
Cycle Combatants
Open Combat Log
Toggle UI Density
Copy Spectator Link
Return to Colosseum
```

Replay later adds pause/speed/seek where supported by Battle Review/replay architecture.

---

# 11. Spectator Chat & Reactions

Spectator communication is optional and should arrive only with moderation support.

If implemented:

- spectator chat is separate from participant tactical/team chat;
- competitive participants should not see live spectator chat during the battle by default;
- spectators cannot send tactical pings onto the battlefield;
- chat follows normal mute/block/report/moderation systems;
- slow mode/rate limits are available for featured matches;
- official events may disable chat;
- lightweight reactions/emotes must not obscure tactical state or become spam.

A safe initial version can launch spectation **without spectator chat** and add it later in the Social World phase.

---

# 12. Blocking, Privacy & Harassment Safety

For private/casual matches:

- participant block rules can deny a blocked account private-key/unlisted access where policy allows;
- host/eligible participants can remove a private spectator;
- PRIVATE_KEY/CLOSED battles do not leak into friends/activity discovery unless explicitly allowed.

For genuinely public ranked/tournament matches, blocking cannot necessarily make the public event cease to exist for one blocked viewer, but it still blocks direct chat/contact/social interaction according to platform rules.

Do not expose spectator identity lists publicly by default if a simple count serves the purpose.

Private hosts may be shown an access list so they can remove invited viewers.

---

# 13. Colosseum Discovery & Anti-Stalking

The Colosseum should help people find interesting battles without becoming a stalking tool.

Possible filters:

- mode;
- ranked tier/band;
- friends;
- tournament/event;
- map;
- recently started;
- high spectator count;
- featured.

Privacy controls can limit whether a player's ordinary public-eligible matches are discoverable by name/friend activity where queue rules permit.

Official tournaments/featured competitive events may override ordinary discovery privacy as an explicit entry rule.

Do not publish private-key/unlisted battle metadata through search, activity feeds, APIs, or public presence indicators.

---

# 14. Featured Battles

The Colosseum may feature battles through approved rules such as:

- official tournaments;
- Event Staff/Owner-curated exhibitions;
- championship matches;
- automatically eligible high-level ranked matches under published policy;
- special live events.

Feature status changes presentation/discovery only.

It grants no battle power and cannot alter the underlying competitive ruleset mid-match.

Featured battles can have higher spectator fanout capacity and stronger presentation later.

---

# 15. Completed Battles & Replays

A spectator link should degrade gracefully when the battle finishes.

Instead of becoming a dead page:

```text
LIVE BATTLE
  ↓ completed
FINAL RESULT
  ↓ replay ready when supported
BATTLE REPLAY
```

Visibility carries forward unless explicitly changed by allowed policy.

Examples:

- Public battle → public replay;
- Unlisted battle → unlisted replay link;
- Private-Key battle → replay still requires key/authorized access;
- Closed battle → participant/private record only.

Participants can later share eligible completed-battle replay links.

The replay uses committed authoritative events/versioned battle definitions rather than a screen recording.

---

# 16. Tournament / Event Spectation

Tournament framework should be able to provide:

- bracket → live match links;
- featured match stage;
- delayed public spectator feed;
- match status/result updates;
- replay archive;
- Event Staff/Owner feature/pin controls;
- official commentator/broadcast role later if justified.

A commentator role, if ever introduced, is a viewing entitlement—not a gameplay authority role and not another general staff role.

It may receive approved spectator tools but never private competitive information unless the tournament specifically defines an audited production-broadcast exception.

---

# 17. Spectator Count & Presence

Spectator count should be server-derived.

A participant may see a restrained indicator such as:

> `27 watching`

when the mode allows it.

Do not let spectator join/leave events spam the competitors' battle log.

Popular-match counts can be approximate/bucketed if that reduces realtime cost without misleading players materially.

---

# 18. Architecture & Fanout

Spectation should not attach hundreds of viewers directly to authoritative command processing.

Preferred architecture:

```text
Authoritative battle commits
  ↓
versioned committed battle events / snapshots
  ↓
viewer-safe spectator projection
  ↓
delay buffer where required
  ↓
read-only spectator fanout/cache
  ↓
Spectator clients
```

Spectators:

- cannot call participant command endpoints;
- cannot hold participant-control tokens;
- cannot mutate battle state;
- cannot subscribe directly to private participant-only channels;
- reconnect by spectator sequence/version;
- can be served from scalable read-oriented infrastructure as audience grows.

A highly watched battle should increase spectator read/fanout load, not linearly multiply authoritative combat mutation work.

---

# 19. Reconnect & Sequence Safety

Spectator stream data is sequence/versioned.

On reconnect:

- viewer re-authenticates spectator entitlement;
- current permitted stream position is resolved;
- ranked delay is preserved;
- missed allowed committed events are replayed or a safe spectator snapshot is supplied;
- viewer cannot request future/buffered events beyond their permitted delay position.

---

# 20. Security Requirements

- opaque spectator handles must not grant participant authority;
- private Battle Keys are rate-limited and scoped to one battle/replay;
- spectator permissions are checked server-side on every initial authorization/reconnect;
- viewer projection is entitlement-aware;
- hidden/private fields are never merely visually hidden client-side;
- failed key attempts are rate-limited/auditable enough to detect abuse;
- spectator endpoints do not reveal whether a guessed private battle exists beyond safe error semantics where practical;
- participant block/private policies are applied server-side;
- internal battle IDs, service credentials, RNG state, private logs and anti-cheat data remain protected;
- delayed mode cannot be bypassed by alternate API endpoints, replay endpoints, websocket subscriptions, or refresh behavior.

---

# 21. Competitive Integrity

Spectation must be tested against:

- voice-chat coaching;
- second-account spectating;
- stream sniping;
- hidden loadout leakage;
- future-turn/RNG leakage;
- timing advantage;
- spectator delay bypass;
- participant impersonation;
- private key brute force;
- replay becoming available before a delayed live match actually reaches completion for spectators;
- spectator chat conveying current tactical information to players.

Competitive delay and information projection are server rules, not frontend etiquette.

---

# 22. Moderation & Operations

Moderator capabilities may include, when spectator social features exist:

- spectator-chat moderation;
- account mute/ban enforcement;
- report review;
- private spectator abuse investigation;
- removing disruptive spectators from chat/access where policy allows.

Event Staff may operate official exhibition/tournament presentation only through approved event/tournament tools.

The Game Owner retains final configuration authority.

Neither Moderator nor Event Staff receives raw battle/database authority merely because spectation exists.

---

# 23. Master Panel / Colosseum Operations

Later operational controls should include:

- global spectation enable/disable emergency control;
- visibility defaults by mode;
- ranked spectator-delay configuration/version;
- tournament spectation rules;
- featured match pin/unpin;
- spectator capacity/fanout health;
- Battle Key/private-access support tooling with audit;
- replay retention policy;
- abuse/rate-limit telemetry;
- spectator-chat controls if chat exists;
- no raw private-state viewer for ordinary staff.

---

# 24. Telemetry

Useful privacy-respecting aggregate events may include:

- spectate_opened;
- spectate_authorized;
- spectate_denied_reason_class;
- battle_key_failed;
- battle_key_authorized;
- colosseum_match_opened;
- spectator_reconnected;
- replay_opened;
- spectator_count_peak;
- spectator_delay_health;
- share_link_copied;
- public/private/unlisted usage distribution.

Do not log plaintext Battle Keys or unnecessary viewer browsing behavior.

---

# 25. Definition of Success

The system succeeds when:

- a player can send a friend a spectator link to an eligible live battle;
- private sparring can remain absent from public discovery and require a Battle Key;
- public battles can be browsed through the Colosseum;
- ranked/tournament viewers cannot obtain zero-delay coaching information;
- spectators see only committed information they are entitled to know;
- the spectator UI is readable and clearly read-only;
- popular matches scale through read-only fanout rather than stressing combat mutation paths;
- completed eligible battles transition naturally into results/replays;
- privacy, blocking and moderation rules remain coherent;
- watching skilled AUREVANE combat becomes a social/learning activity in its own right without compromising competitive integrity.
