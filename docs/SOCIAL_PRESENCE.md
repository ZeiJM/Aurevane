# AUREVANE — World Presence & Adventurers Online

**Status:** Authoritative social-presence specification subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`, `docs/TECH_ARCHITECTURE.md`, `docs/RESPONSIVE_EXPERIENCE_STANDARD.md`, `docs/MASTER_PANEL.md`, and `docs/ROADMAP_SOCIAL_PRESENCE.md`.

**Direction approved:** 2026-08-16.

AUREVANE is a persistent online world. The interface should make that fact perceptible even when the player is not currently grouped, chatting, or fighting another person.

The game therefore includes a persistent **Adventurers Online** presence surface: a compact online counter in the authenticated game-shell utility cluster, opening into a beautiful, searchable panel showing the characters who are currently publicly present.

The central product rule is:

> **Presence should make the world feel inhabited without turning player visibility into surveillance, clutter, or a performance problem.**

The player should be able to glance near the normal utility controls and think:

> **“There are 128 adventurers in AUREVANE right now.”**

Then, if curious, click the counter and see who is there.

---

## 1. Player-Facing Identity

Working player-facing terminology:

- **Adventurers Online** — panel title;
- **Online** — compact utility label;
- **World Presence** — internal/system terminology;
- **Available for Party** — optional social availability state;
- **Open to Challenge** — optional PvP availability state once PvP exists;
- **Away** — connected but idle/temporarily inactive;
- **Busy** — active but not currently inviting general interaction;
- **Appear Offline** — privacy state excluding the character from ordinary public presence surfaces.

The exact ornamental iconography may evolve with the Art Bible. Do not imitate a generic chat-app friends list.

---

## 2. Permanent Shell Placement

The primary trigger belongs in the authenticated shell's **compact utility cluster near Sound/Audio and Settings-style controls**.

Conceptually:

```text
AUREVANE                              ◇ 128 Online   🔊   ⚙
```

or, at smaller widths:

```text
◇ 128   🔊
```

The actual icon should be an original AUREVANE presence/traveler symbol rather than relying on a generic green-dot-only treatment.

### Why this location

The online roster is:

- globally useful;
- secondary to the current activity;
- worth glancing at frequently;
- not important enough to consume permanent world/battle canvas space.

It therefore belongs beside other persistent utilities, not in a large sidebar.

### Non-reflow rule

Opening the panel must **not push, resize, or displace** the current world map, character screen, settlement scene, battle board, Armory, or other primary canvas.

Use an overlay/drawer/sheet model consistent with `docs/RESPONSIVE_EXPERIENCE_STANDARD.md`.

---

## 3. The Compact Counter

The collapsed control shows at minimum:

- a presence icon;
- the current visible-online count;
- accessible text such as `128 adventurers online`.

The counter should feel alive but restrained.

Allowed presentation ideas include:

- a subtle luminous indicator;
- a soft one-time count transition when the value changes;
- a tiny region/world motif;
- a tooltip or accessible label explaining the control.

Avoid:

- constant pulsing that becomes visual noise;
- fake urgency;
- confetti when another person signs in;
- a giant promotional badge;
- notification sounds for ordinary presence changes.

### Counter meaning

The public count means:

> **number of unique currently present character identities that are eligible to appear publicly in Adventurers Online.**

It is **not**:

- number of browser tabs;
- number of websocket connections;
- number of database sessions;
- number of NPCs/bots;
- number of staff tools open;
- a marketing number inflated with recently offline players.

Multiple sessions/tabs for the same character count once.

Characters using `Appear Offline` are excluded from the ordinary public counter so the count and list remain conceptually consistent.

The Master Panel may separately expose operational totals such as total active characters, publicly visible characters, hidden staff/players, active sessions, and connection health.

---

## 4. Adventurers Online Panel

Clicking/tapping the counter opens the roster.

Recommended desktop composition:

```text
┌─────────────────────────────────────────┐
│ ADVENTURERS ONLINE                 128  │
│ The roads are busy tonight.             │
│                                         │
│ [ Search adventurers... ]               │
│                                         │
│ All   Friends   Guild   Nearby   Open   │
│                                         │
│ [portrait] Elyra          Lv 42         │
│            Frostmere • Available        │
│            [View] [Invite]              │
│                                         │
│ [portrait] Cairn           Lv 57        │
│            Away                         │
│            [View]                       │
│                                         │
│ ...                                     │
└─────────────────────────────────────────┘
```

The exact controls appear only when their underlying systems exist.

### Panel goals

The panel should let the player quickly answer:

1. How many people are around?
2. Who is online?
3. Do I recognize anyone?
4. Is anyone looking for a party or challenge?
5. What safe social action can I take?

It should not become a second social network feed.

---

## 5. Row / Character Presentation

A roster row may eventually show safe public information such as:

- approved/current portrait;
- public character name;
- level or appropriate progression display;
- title/badge where public;
- guild crest/name where public;
- broad region/location when privacy rules allow;
- presence state: Online / Away / Busy;
- availability state: Party / Challenge / Do Not Disturb;
- relationship marker: Friend / Guild / Party;
- relevant prestige treatment such as Rekindling marker where already public on the profile.

Do **not** automatically expose:

- email/account identity;
- exact coordinates or map tile;
- private quest state;
- private inventory;
- private saved builds;
- hidden Soulmark/build information;
- PvP queue strategy information;
- current private chat/party activity;
- staff permissions;
- IP/device/session data;
- invisible moderation activity.

The row is a social doorway, not a player-inspection exploit.

---

## 6. Character Actions

Actions grow progressively with the social systems.

Possible contextual actions include:

- **View Profile**;
- **Invite to Party**;
- **Add Friend**;
- **Message**;
- **Challenge**;
- **Invite to Guild** when authorized;
- **Block**;
- **Report**.

The panel must never show dead buttons for systems that do not yet exist.

Every meaningful action is server-authorized. Presence is not authorization.

Seeing a player online does not prove the viewer may message, invite, challenge, inspect private data, or bypass block/privacy rules.

---

## 7. Search, Filters, and Sorting

The core view is **All Online**.

As systems mature, useful filters may include:

- All;
- Friends;
- Party;
- Guild;
- Nearby / Same Region;
- Available for Party;
- Open to Challenge;
- Nation later where useful.

Search uses public character identity and safe indexed fields.

Do not require the client to download the entire online population merely to search it.

### Sorting

Default sorting should remain predictable and socially useful.

Possible priority:

1. party/friends/guild relationships where a filtered view calls for it;
2. availability;
3. stable public-name ordering.

Avoid ranking players by spend, monetization tier, or manipulative popularity scores.

If the population grows large, the All view may use paged/virtualized results while still representing the full online directory.

---

## 8. Location Visibility

Presence should reinforce the shared world, but exact location can become invasive or tactically exploitable.

Default stranger-facing location should therefore be **coarse** when shown at all.

Examples:

- `Frostmere`;
- `Emberreach`;
- `In an Expedition`;
- `In Battle`;
- `At the Tactical Hall`.

Avoid exposing to arbitrary strangers:

- exact map node during sensitive content;
- exact Expedition room;
- current PvP opponent;
- precise resource/rare-spawn location;
- hidden story location;
- stealth/event state that creates gameplay leakage.

Friends, party members, guild members, or explicit opt-in settings may permit richer location sharing later.

Party systems remain authoritative for party location/status; the public presence directory does not replace them.

---

## 9. Presence vs Availability

Do not confuse **online state** with **social availability**.

A character can be:

```text
ONLINE + AVAILABLE FOR PARTY
ONLINE + OPEN TO CHALLENGE
ONLINE + BUSY
AWAY
APPEAR OFFLINE
```

Availability is player intent.

Presence is connection/activity state.

This distinction prevents the roster from creating an expectation that every visible player wants unsolicited invitations.

### Invite-spam safety

Players should eventually be able to configure policies such as:

- anyone may invite;
- friends/guild only;
- party finder only;
- no unsolicited party invites;
- no unsolicited challenges;
- Do Not Disturb.

Server-side rate limiting and relationship/block checks apply to invitations.

---

## 10. Privacy

AUREVANE benefits from visible community, but ordinary players need reasonable control.

The mature system should support a privacy setting equivalent to **Appear Offline**.

When enabled for ordinary public presence:

- the character is excluded from Adventurers Online;
- the character is excluded from the public visible-online counter;
- strangers do not receive realtime presence notifications about them;
- privileged internal systems still know the session exists where operationally required;
- party/matchmaking/combat systems may expose the minimum presence needed to participants in that activity.

Privacy cannot be used to create gameplay exploits. For example, appearing offline does not make a player invisible to an opponent in an active match or to party members whose session depends on their connection state.

### Blocking

Blocking should override directory interactions.

Blocked relationships should not become a route for:

- repeated invites;
- messaging;
- exact presence tracking;
- profile harassment;
- challenge spam.

The exact mutual-visibility rule can be tuned during Phase 10 moderation design, but safety wins over social curiosity.

---

## 11. Staff and Moderation Presence

Staff may need to observe the live game without advertising their presence.

Therefore:

- staff/owner accounts are not automatically marked with privileged badges in the public roster;
- authorized staff may have an operational stealth mode when needed for moderation/support;
- hidden staff presence is visible to appropriately privileged Master Panel diagnostics;
- staff presence controls are audited where they affect moderation/security workflows;
- ordinary players cannot infer staff privileges from transport/session metadata.

Do not create a public `Admins Online` list unless explicitly approved later.

---

## 12. Technical Presence Model

Presence is ephemeral state and should be designed accordingly.

Conceptually:

```text
AUTHENTICATED CHARACTER SESSION
          ↓
SERVER-VALIDATED PRESENCE LEASE
          ↓
PRESENCE AGGREGATOR
          ├── public visible count
          ├── paged public directory
          ├── relationship-specific views
          └── privileged operational metrics
          ↓
REALTIME INVALIDATION / DELTAS
          ↓
CLIENT REFRESHES AUTHORITATIVE VIEW
```

Supabase Realtime may be used as a transport mechanism where appropriate, but the public contract must not depend on vendor-specific client behavior.

### Authority

The browser may signal activity/heartbeat, but it does not authoritatively decide:

- that it is online forever;
- what character identity it represents;
- whether it is publicly listable;
- whether another player may see it;
- whether a social action is allowed.

Server/session identity and validated presence rules own those decisions.

### Lease/expiry

Presence should expire automatically after a bounded interval if a session disappears without a clean logout.

Exact heartbeat and expiry intervals are configuration/performance decisions, not player-facing hard-coded constants.

### Deduplication

Aggregate by stable character identity.

Multiple tabs, reconnects, or transient realtime subscriptions must not inflate the online counter.

---

## 13. Scale and Performance

The feature must work when there are 12 players online and when there are thousands.

Do not implement the global roster as:

> subscribe every client to every player's full presence object and render every row forever.

Use scalable patterns such as:

- aggregated count updates;
- paged server reads;
- bounded realtime invalidation;
- virtualized rows when needed;
- server-side search/filtering;
- relationship-specific subscriptions;
- sensible refresh/coalescing;
- indexed public-character fields;
- no N+1 profile queries.

The collapsed counter does not need sub-second precision.

A small coalescing delay is preferable to expensive global fan-out for every connect/disconnect event.

---

## 14. Offline, Away, and Stale Sessions

Presence should degrade gracefully.

Potential states:

- **Online** — active authenticated presence lease;
- **Away** — lease alive but inactivity threshold reached;
- **Busy** — player-selected or activity-derived social state;
- **Offline** — no valid presence lease;
- **Appear Offline** — valid presence exists but excluded from ordinary public visibility.

Do not show a character as online for hours because their laptop crashed.

Do not mark a player offline merely because one websocket briefly reconnects if the broader authenticated session remains healthy.

---

## 15. Battle and Full-Screen Activities

The presence trigger belongs to the global utility family, but the active experience remains primary.

In ordinary world/social/build screens:

- keep the compact trigger beside audio/settings.

In battle or other dense full-screen modes:

- keep the trigger visually compact;
- do not let the panel cover critical confirm/timer information by default;
- opening it never pauses authoritative PvP clocks;
- it may become a drawer/sheet with obvious close behavior;
- nonessential presence updates must not create audiovisual distraction during combat.

A timed PvP match must not become strategically exploitable through roster metadata.

---

## 16. Responsive Behavior

### Desktop / large laptop

Prefer a right-side anchored drawer/popover near the utility cluster, with enough width for portrait, name, status, and actions.

### Compact laptop

Use the same pattern with reduced row density and internal scrolling.

### Phone

The compact trigger may show icon + count.

Opening it should use a bottom sheet or near-full-height panel rather than a tiny desktop popover.

Phone requirements:

- large touch targets;
- easy search;
- no horizontal overflow;
- list virtualization/pagination as needed;
- explicit close action;
- Escape where hardware keyboard exists;
- focus restoration;
- safe-area handling.

The panel follows the permanent overlay rules in `docs/RESPONSIVE_EXPERIENCE_STANDARD.md`.

---

## 17. Visual Direction

Adventurers Online should reinforce AUREVANE's living-world identity.

It should feel more like opening a **traveler registry / living roster of adventurers** than opening a corporate admin table.

Possible visual ingredients:

- character portraits;
- restrained guild crests;
- warm/luminous region accents;
- small title/prestige marks;
- subtle world-map/cartographic ornament;
- readable material surfaces consistent with the Luminous Adventure direction;
- tasteful status symbols supported by text/icon shape, not color alone.

Avoid:

- spreadsheet appearance;
- giant dark rectangles with tiny white text;
- excessive rarity glows;
- animated presence dots everywhere;
- decorative backgrounds that reduce row readability;
- turning the panel into advertising space.

The online counter itself should remain elegant enough to live beside the sound control for years.

---

## 18. Social Identity and Discovery

The roster can create small but valuable persistent-world moments:

- noticing a famous PvP player online;
- recognizing a guild leader;
- seeing a friend return;
- finding someone available for an Expedition;
- discovering an unusual public title or Rekindling prestige;
- realizing an event has drawn many players online.

This supports the Master Plan's persistent-world/social-identity pillar without requiring an open-world 3D crowd renderer.

Do not gamify the online count itself into unhealthy streaks or rewards for keeping the browser open.

Presence is social context, not progression currency.

---

## 19. Telemetry

Useful privacy-respecting product telemetry may include:

- presence panel opened;
- filter/search usage;
- profile opened from presence;
- party invite initiated from presence;
- successful party formation originating from presence;
- challenge initiated from presence;
- directory load latency/error rate;
- count/list mismatch diagnostics;
- presence lease churn/reconnect rate;
- privacy setting usage in aggregate.

Do not log unnecessary detailed browsing behavior about which individual player someone repeatedly searched for unless a safety/abuse system explicitly requires narrowly scoped records.

---

## 20. Master Panel / Operations

The Master Panel should eventually show a richer operational view than the public roster.

Useful owner/staff metrics include:

- unique active characters;
- publicly visible active characters;
- hidden/stealth presence counts where authorized;
- authenticated active sessions;
- reconnect/churn rate;
- presence-service health;
- active characters by region/activity at safe aggregate levels;
- party/matchmaking population context;
- abnormal duplicate-session patterns;
- presence errors/stale leases.

Owner/support tooling may inspect a specific account's session/presence state when necessary for support, subject to permissions and audit.

The Master Panel must not expose raw secrets or turn presence operations into arbitrary impersonation.

---

## 21. Abuse and Security Requirements

Before production scale, test:

- spoofed character IDs;
- forged presence visibility;
- multi-tab/session count inflation;
- reconnect storms;
- stale lease cleanup;
- blocked-player visibility;
- invite/message/challenge spam;
- privacy-state leakage;
- unauthorized staff-presence inspection;
- scraping/rate-limit abuse;
- directory enumeration load;
- N+1/profile query amplification;
- exact-location leakage;
- PvP information leakage.

Presence endpoints should expose only the minimum public view model needed by the feature.

---

## 22. Relationship to Other Systems

### Public News / Manual

Adventurers Online is an authenticated in-game social feature by default. News and Manual remain intentionally public before login.

A future landing page may optionally display an aggregate population indicator, but public identity listing is not required and should not be introduced casually.

### World Pulse

World Pulse answers **what is happening**.

Adventurers Online answers **who is here**.

They may visually reinforce one another but remain separate surfaces.

### Parties

The presence panel can become one route into party formation, but party membership/realtime state remains owned by the party system.

### Friends / Guilds

Friends and guilds add filters, relationship priority, and actions. They do not own the underlying global presence count.

### PvP

PvP may add Open to Challenge and Challenge actions, but ranked queue state and matchmaking remain private/authoritative.

### Social Profile

The roster links into the public social profile rather than duplicating every profile field inline.

---

## 23. Definition of Success

The feature succeeds when:

- an authenticated player can see a compact accurate online count near the existing sound/utility controls;
- clicking it opens a polished responsive roster without displacing the primary game canvas;
- the roster represents unique active public character identities rather than connections/tabs;
- all visible online characters can be discovered through scalable browse/search/pagination;
- safe public character information is readable at a glance;
- privacy, blocking, and activity-sensitive information are respected;
- party/friend/guild/PvP actions attach progressively without redesigning the presence system;
- the feature makes AUREVANE feel more inhabited;
- the implementation remains efficient under large populations;
- owner/staff operations have richer diagnostics without leaking privileged data to players.

The desired emotional result is small but important:

> **AUREVANE should never feel like the player is alone inside a database when other people are actually there.**
