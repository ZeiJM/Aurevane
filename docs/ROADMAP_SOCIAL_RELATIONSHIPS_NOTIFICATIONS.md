# AUREVANE — Roadmap Addendum: Friends, Social Relationships & Notifications

**Authority:** Binding roadmap integration for `docs/SOCIAL_RELATIONSHIPS_NOTIFICATIONS.md`, subordinate to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/ROADMAP.md`, `docs/ROADMAP_SOCIAL_PRESENCE.md`, `docs/ROADMAP_TAVERN_SOCIAL_WORLD.md`, `docs/ROADMAP_PVP_SPECTATION_COLOSSEUM.md`, `docs/ROADMAP_LIVE_EVENTS_HOMESTEAD_NAVIGATION.md`, and `docs/ROADMAP_LIVING_ECONOMY_SOCIAL_IDENTITY.md`.

**Direction approved:** 2026-08-17.

This module schedules the persistent Friend relationship system and the notification/unread-attention system without disrupting current Phase-2 implementation.

The sequencing rule is:

> **Notification plumbing arrives when the living world starts generating real things worth notifying about; the core Friend relationship arrives with co-op, before PvP and the mature social world depend on it.**

This addendum intentionally moves the **core Friends system earlier than the older Phase-10-only social-presence wording**. Phase 10 remains the mature social expansion, but Friends must exist before then so parties, PvP, spectation and Homesteads do not each invent a temporary relationship system.

---

# Current Phase 2 — No Feature Pull-Forward

Do not implement Friends, DMs, tavern mentions, global notification center, browser push, social feeds, or notification badges inside the current P2.6/P2.7 combat work.

Current compatibility requirements only:

- public character identity remains distinct from private account identity;
- stable authenticated account principal exists for future relationship ownership;
- the global utility shell can later add compact Presence/Notifications controls without reflowing battle;
- battle/full-screen modes can suppress noncritical overlays;
- no current combat authorization should depend on social relationship strings.

P2.7/PV-1 remains about combat usability, battlefield scale, facing, controls and practice exit.

---

# Phase 5 — Notification Foundation + Living-World Attention

Phase 5 is the correct first implementation point for the **in-game notification infrastructure** because News, World Presence, events, World Pulse and a real shared world now exist.

## A. Notification domain foundation

Implement a typed server-backed notification model capable of representing:

```text
SYSTEM / ACCOUNT
SOCIAL
MESSAGES
MENTIONS
INVITES
NEWS
WORLD / EVENTS
ECONOMY
COMPETITIVE
```

Only categories with real Phase-5 producers need active UI yet.

Required technical properties:

- stable recipient account principal;
- typed source system/reference;
- created/read/expiry state;
- safe presentation payload;
- dedupe/coalesce key where useful;
- aggregate unread counts without loading all history;
- server-authoritative mark-read / mark-category-read / mark-all-read;
- realtime invalidation for responsiveness;
- persistent unread state across devices;
- notification deep links re-authorize against the source system.

Do not build a generic arbitrary-HTML notification engine.

## B. Authenticated shell notification trigger

Add the first compact Notifications/Alerts control to the authenticated utility cluster when the living-world shell is ready.

Requirements:

- restrained unread badge/count;
- responsive drawer/sheet;
- no world/battle reflow;
- keyboard/focus accessibility;
- `99+` or equivalent count cap;
- clear empty/error/reconnect states.

## C. News unread state

Integrate authenticated unread News:

- per-account read state;
- News navigation badge/dot/count as appropriate;
- opening an article marks that article read;
- historical content import does not create a huge false unread backlog;
- newly published significant News may create a Notification Center item;
- minor corrections do not automatically re-alert everyone.

Anonymous `/news` remains unchanged and publicly readable.

## D. World/Event notifications

Use the new attention layer sparingly for real world-state changes:

- major event start;
- tracked/followed event update;
- meaningful event phase change;
- official world/service announcement.

World Pulse remains the richer context source.

Do not notify every player about every world-state write.

## E. Initial system/account alerts

Support only necessary product/system notices such as:

- maintenance/service state;
- action-required account notices;
- official moderation/account restriction notice once those systems exist.

Critical presentation remains rare.

## Phase-5 gate

A signed-in player can leave News unread, return on another session/device, see a truthful unread indicator, open the notification/news destination, and clear the appropriate unread state without duplicate alerts or authorization leakage.

---

# Phase 6 — Core Friends System + Party Social Integration

**Primary Friends implementation milestone.**

Friends arrive with Party & Co-op rather than waiting for Phase 10.

## A. Friend relationship state

Implement authoritative relationship operations:

- Send Friend Request;
- Accept;
- Decline;
- Cancel outgoing request;
- Remove Friend;
- Block integration;
- request expiry/cooldown/rate limiting;
- configurable friend/request caps.

Server state should distinguish at least:

```text
NONE
OUTGOING_PENDING
INCOMING_PENDING
FRIENDS
BLOCKED / safety override
```

Relationship ownership uses stable authenticated account principals, not mutable character names.

Public UI exposes only approved character identity.

## B. Friends UI

Add a dedicated Friends surface with at least:

```text
ONLINE
ALL FRIENDS
REQUESTS
RECENT PLAYERS
```

Initial row actions:

- View Profile;
- Invite to Party when eligible;
- Remove Friend;
- Block;
- Report where available.

Message/Challenge/Homestead/Vowbond actions appear only when their owning systems exist.

## C. Presence integration

Update Adventurers Online:

- Friends filter becomes real;
- Friend relationship marker;
- friend-specific presence projection where privacy permits;
- friend availability for Party;
- no exact hidden activity leakage;
- Appear Offline remains respected.

This supersedes older roadmap wording that postponed the actual Add Friend relationship until Phase 10.

## D. Friend request notifications

Use the Phase-5 notification system for:

- incoming friend request;
- request accepted;
- friend-origin party invitation.

Friend request notification should support direct Accept/Decline if source eligibility remains valid.

Do not notify a user that somebody removed them as a friend.

## E. Party/co-op integration

Friends become convenient party targets:

- invite from Friends list;
- invite from presence/profile;
- relationship-aware anti-spam;
- party invite expiry/action state;
- notification → party deep link;
- block overrides invite eligibility.

Party Finder remains independent and required.

## F. Party chat mention foundation

If Party chat ships in this phase, add the first server-validated `@mention` path for Party chat only if implementation cost is reasonable.

Requirements:

- recipient must be an eligible party/channel member;
- server resolves mention identity;
- mention alert respects block/mute/DND;
- notification links to accessible context;
- no arbitrary client-generated mention alerts.

If Party chat mention UX would materially delay co-op, the generic mention engine may wait until Phase 10, but the chat message identity/channel model must remain compatible.

## Phase-6 gate

Two players can become friends, see each other in Friends, safely party-invite one another, remove/block each other with immediate permission effects, and cannot forge relationship state from the browser.

---

# Phase 7 — Expedition Social Context

Extend Friends/Notifications without creating new relationship types.

Useful additions:

- friend `Looking for Expedition` availability where appropriate;
- Expedition party invites use the same invite notification machinery;
- party/Expedition system messages do not flood global Notifications;
- friend presence may say `In an Expedition` without exposing room/seed/route;
- Recent Players may include legitimate co-op partners with bounded retention.

Do not expose hidden Expedition opportunities because someone is on a friend list.

---

# Phase 8 — PvP + Friend Sparring + Colosseum Integration

PvP should reuse Friends instead of inventing `rivals/contacts` just for challenges.

## A. Friend challenges

Add:

- Challenge/Spar from friend row/profile;
- challenge invitation notification;
- expiry/accept/decline;
- Open to Challenge availability;
- block/DND/rate-limit checks;
- no ranked queue manipulation through friend relationships.

## B. Private friend sparring

Friend-created casual battles can default naturally into the spectator policies already defined:

- PRIVATE_KEY;
- CLOSED;
- optional UNLISTED/PUBLIC with consent.

Friends do not bypass Battle Key/privacy rules.

## C. Friends Fighting

Colosseum can now implement its `Friends Fighting` filter when the friend relationship system and battle visibility permit it.

Requirements:

- only matches the viewer is authorized to discover;
- Appearing Offline/private battle policy remains respected;
- ranked delay remains mandatory where applicable;
- no exact private opponent/loadout leakage from Friends presence.

## D. Competitive notifications

Support appropriate alerts for:

- casual challenge;
- tournament participation/action requirement;
- match/replay ready where useful;
- season result/reward claim only when implemented.

Do not send noisy notifications for ordinary matchmaking state changes.

---

# Phase 9 — Scale & Abuse Review

As population/content grows:

- load-test Friends list and relationship lookups;
- ensure friend checks do not create N+1 queries across presence/party/PvP;
- review cap assumptions against real player networks;
- test large unread notification histories and aggregate counts;
- ensure build/loadout changes do not generate social notifications;
- ensure presence deltas do not become a hidden notification flood.

Relationship and notification infrastructure should be boring and scalable before Phase 10 adds much more social volume.

---

# Phase 10 — Mature Social World, DMs, Mentions & Privacy

Phase 10 remains the major social-expression milestone.

## A. Direct Messages / Whispers

Implement mature person-to-person messaging integrated with Friends/Block/DND.

Requirements:

- server-authorized sender/recipient eligibility;
- bounded conversation history/retention policy;
- unread conversation counts;
- global notification coalescing (`5 messages from Elyra` rather than five global rows);
- message deep links;
- block/mute/report;
- responsive conversation UI.

Default unsolicited-message policy should be conservative and configurable, e.g. Friends / shared-group eligibility rather than assuming every stranger may DM everyone.

## B. Common Room / Guild chat mentions

Implement reusable `@mention` support for released chat channels:

- Common Room / tavern;
- Guild;
- Party if not already implemented;
- later Nation/Open Road channels automatically reuse it.

Server mention rules:

- exact eligible public identity resolution/autocomplete;
- recipient must have permission to see the accepted message;
- blocked/muted/suppressed messages do not notify;
- mention rate limiting;
- no ordinary-player `@everyone` spam;
- clicking a mention cannot bypass channel eligibility.

## C. Mature notification settings

Add Settings controls for in-game attention categories:

- DMs;
- Mentions;
- Friend Requests;
- Party Invites;
- Challenges;
- News;
- World Events;
- sound/toast behavior where applicable.

Do Not Disturb integrates with appropriate social categories.

Critical account/security messages remain non-suppressible where required.

## D. Social actions

Friends UI can now expose:

- Message;
- Guild-related actions where permitted;
- richer profile navigation;
- social availability/privacy;
- friend-specific last-seen only if privacy policy approves it.

## E. Vowbond

Vowbond proposal normally requires existing friendship.

Add:

- proposal notification;
- explicit Accept/Decline;
- expiry/revalidation;
- no random-stranger proposal spam;
- block/safety override.

Friend removal alone does not silently dissolve an existing Vowbond.

## F. Homestead social foundation

Friends become an official Homestead visitor policy for the later full Homestead system.

Prepare/implement relevant social permission primitives without building Phase-12 property early.

---

# Phase 11 — Economy Notifications

As Trade House/crafting/commissions arrive, reuse Notifications for meaningful transaction state only.

Examples:

- item sold;
- commission accepted/completed;
- commission requires action;
- escrow resolution;
- listing expired where useful.

Requirements:

- coalesce routine sales where appropriate;
- notification links to authoritative Trade House/history;
- no inventory contents embedded unnecessarily;
- no solicitation/trade spam through friend/presence surfaces;
- friend status does not bypass escrow/economy protections.

---

# Phase 12 — Nations, Homesteads & Wider Chat

## A. Homestead Friends integration

Full Homestead implementation supports the visitor policies:

```text
Private
Vowbond Partner
Friends
Guild
Invite Only
Public Visit
```

Friend status is checked at visit time.

Removing/blocking a friend revokes friend-derived access immediately.

Add Homestead invitation notification only when an explicit invite is used.

## B. Nation Hearth / Open Road mentions

Reuse the same server-validated mention engine for:

- Nation Hearth;
- Open Road.

Do not create a separate mention/notification implementation per chat channel.

Nation/privacy rules still govern channel access and notification excerpts.

## C. Nation/event social attention

Use restrained notifications for followed/important nation events, not every campaign tick.

Friends do not expose enemy-nation exact positions or warfare intelligence.

---

# Phase 13 — Master Panel / Moderation Operations

Add safe operational tooling for Friends/Notifications.

## Moderator capabilities

Moderator tooling may support:

- report-linked social context;
- invite/request/message/mention abuse evidence within policy;
- social timeout/mute/block-support flows;
- friend-request/challenge spam diagnostics;
- official moderation notice issuance through typed templates/commands;
- audit trail.

Moderators do not receive unrestricted private-message browsing merely because the data exists.

## Game Owner / operations

Owner-authorized configuration may include:

- friend cap/request expiry/rate limits;
- notification retention by category;
- toast/badge feature flags;
- News/global alert policy;
- event-notification policy;
- service-health metrics;
- queue/backlog/delivery errors;
- emergency social-notification disable;
- typed official system notices.

## Content/Event Staff

Content/Event Staff may create notification-producing content only through their authorized systems:

- published News;
- approved Event definitions/announcements;
- content operations.

They do not gain arbitrary `send notification to every account` power unless the Owner explicitly grants an approved narrow capability.

---

# Phase 14 — Presentation Polish

Polish Friends/Notifications into the final AUREVANE visual language:

- original friend/social/alert iconography;
- attractive portrait rows;
- elegant relationship markers;
- badge colors with shape/text accessibility;
- restrained unread animations;
- polished notification drawer/sheets;
- high-quality toast transitions;
- notification sounds only where useful and user-configurable;
- reduced-motion support;
- phone/laptop/desktop density;
- no generic social-media appearance;
- no permanent red-dot clutter.

Official System/Moderator notices must be visually distinct from player-created titles/badges.

---

# Phase 15 — Social/Notification Hardening

Dedicated tests should cover:

- forged Friend relationships;
- duplicate Accept/Decline races;
- block/remove/accept race conditions;
- request spam and cooldown bypass;
- friend-cap edge cases;
- privacy/Appear Offline leakage;
- Friends Fighting private-match leakage;
- unauthorized Homestead friend access;
- Vowbond proposal spam;
- mention spoofing;
- mention-to-hidden-channel leakage;
- notification recipient forgery;
- deep-link authorization bypass;
- unread-count inflation/desync;
- notification flooding;
- coalescing correctness;
- expired invitation acceptance;
- cross-device read synchronization;
- blocked-user message/mention/invite suppression;
- moderator/official notice impersonation;
- thousands of friends/presence rows where operationally relevant;
- large unread histories;
- realtime disconnect/reconnect behavior;
- notification suppression during timed PvP;
- accessibility/focus/keyboard behavior;
- degraded mode where notification service failure does not break core gameplay.

---

# Canonical Implementation Sequence

This addendum changes **roadmap planning**, not today's implementation ticket.

Canonical high-level sequence:

```text
CURRENT
P2.6 Recruit AI + Tactical Hall
  ↓
P2.7 / PV-1 Combat Usability & Battlefield Scale
  ↓
Phase 3–4 combat/build expansion as gated
  ↓
Phase 5 Notification Foundation + News/Event attention
  ↓
Phase 6 Core Friends + Requests + Party integration
  ↓
Phase 8 Friend PvP/Sparring/Colosseum integration
  ↓
Phase 10 DMs + mature chat mentions + social privacy/Vowbond
  ↓
Phase 11 economy notifications
  ↓
Phase 12 Homestead/Nation/Open Road integrations
  ↓
Phase 13 operations
  ↓
Phase 14 polish
  ↓
Phase 15 hardening
```

Do not pull these systems into current Phase-2 implementation simply because their design is now authoritative.

The purpose of specifying them now is to ensure every later social feature plugs into one coherent relationship and attention architecture instead of creating incompatible one-off friend lists, unread counters and alert systems.