# AUREVANE — Friends, Social Relationships & Notification Attention System

**Status:** Authoritative social-system expansion subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/SOCIAL_PRESENCE.md`, `docs/TAVERN_SOCIAL_WORLD.md`, `docs/PVP_SPECTATION_COLOSSEUM.md`, `docs/HOMESTEAD_WORLD_NAVIGATION.md`, `docs/LIVING_ECONOMY_SOCIAL_IDENTITY.md`, `docs/PUBLIC_NEWS_AND_MANUAL.md`, and `docs/MASTER_PANEL.md`.

**Direction approved:** 2026-08-17.

This document defines the persistent friend relationship layer and the in-game attention/notification layer that connects social, world, News, chat, PvP, party, Homestead, Vowbond and official system communication.

The central product rule is:

> **AUREVANE should make meaningful relationships and important information easy to find without turning every system into an intrusive red-dot machine.**

Friends are not merely a filter on Adventurers Online. They are a reusable relationship primitive that later systems may safely reference.

Notifications are not a replacement for Messages, News, World Pulse, chat, battle logs or the Chronicle. They point the player toward those authoritative surfaces.

---

# PART I — FRIEND RELATIONSHIPS

## 1. Relationship Identity

Friendship is fundamentally between stable authenticated player principals, while the public relationship is presented through the player's approved character identity.

This prevents social relationships from depending on a mutable display string while avoiding exposure of private account identity.

Conceptually:

```text
ACCOUNT PRINCIPAL A
      ↕ friendship
ACCOUNT PRINCIPAL B
      ↓
public current character/profile projection
```

If AUREVANE later supports multiple character identities per account, the friendship does not silently duplicate into several unrelated rows or become dependent on a rename.

The browser never decides that two players are friends merely because it renders a Friend badge.

## 2. Core Friendship States

The server should support an explicit relationship state equivalent to:

```text
NONE
OUTGOING_PENDING
INCOMING_PENDING
FRIENDS
BLOCKED
```

Block is a separate safety state with higher priority than friendship.

A friendship request is not automatically accepted because the requester already follows, messages, parties with, trades with, or Vowbonds with the recipient.

## 3. Sending a Friend Request

An eligible player may send **Add Friend** from appropriate surfaces such as:

- public/social profile;
- Adventurers Online;
- party member list;
- recent co-op players;
- eligible PvP post-match result;
- tavern/Common Room identity menu;
- search/discovery surfaces where public identity is legitimately available.

The server validates:

- requester identity;
- target identity;
- not self;
- block state;
- request/privacy policy;
- existing relationship;
- friend/request caps;
- rate limits;
- abuse restrictions.

The recipient receives an actionable Friend Request notification.

## 4. Accept / Decline / Cancel

Incoming requests support:

- Accept;
- Decline;
- Block where safety requires it.

Outgoing requests support:

- Cancel Request.

Declining a request should not create a dramatic social notification to the requester. The request simply stops being pending.

Repeated resend attempts after decline are cooldown/rate-limited.

Request expiry may be configurable so years-old pending requests do not accumulate forever.

## 5. Remove Friend

Either player can remove the friendship at any time.

Removal:

- is server-authoritative;
- immediately removes friend-only eligibility;
- does not delete old legitimate chat/history merely because the relationship ended;
- does not delete party/guild/Vowbond state through hidden side effects;
- does not automatically create an attention-grabbing `X removed you` notification.

Systems that require current friendship re-check it when used.

## 6. Friend Capacity

Friend capacity should be high enough for a persistent RPG but finite/configurable for operational safety.

An initial production planning range such as **200–300 mutual friends per account** is reasonable and must remain data-driven.

Do not sell extra friend slots as a premium advantage.

If real player behavior shows the cap is too low, increase it operationally rather than monetizing basic social connection.

## 7. Friend List Surface

AUREVANE should have a dedicated Friends surface, accessible from the social/presence family rather than forcing players to filter the global roster every time.

Recommended organization:

```text
FRIENDS
  Online
  All Friends
  Requests
  Recent Players
```

A friend row may show, subject to privacy:

- portrait;
- character name;
- title/badge;
- Online/Away/Busy/Offline;
- coarse location/activity;
- party/challenge availability;
- guild/nation identity where public;
- contextual actions.

Useful actions grow as systems exist:

- View Profile;
- Message;
- Invite to Party;
- Challenge / Spar;
- Watch Battle where allowed;
- Visit Homestead where allowed;
- Vowbond proposal where eligible;
- Remove Friend;
- Block;
- Report.

Do not show buttons for unavailable systems.

## 8. Presence & Privacy

Friendship may allow richer presence than stranger-facing presence, but only within explicit privacy rules.

Possible mature settings:

```text
Who can see when I am online?
- Everyone allowed by public presence
- Friends and permitted groups
- Nobody / Appear Offline

Who can see my broad activity/location?
- Everyone
- Friends
- Party/Guild only where applicable
- Nobody
```

Even friends should not automatically receive:

- exact hidden quest coordinates;
- rare gathering location;
- Expedition room/seed;
- ranked opponent/search timing;
- unrevealed story area;
- private build planning.

`Appear Offline` remains respected except where an active shared system must reveal minimum session state to direct participants.

## 9. Blocking Overrides Friendship

Blocking a player should, as a single safe operation where practical:

- cancel pending friend requests both directions;
- remove active friendship;
- prevent new friend requests;
- prevent ordinary direct messages;
- prevent unsolicited party/challenge invitations;
- prevent friend-only Homestead access;
- suppress ordinary presence tracking between the pair;
- suppress direct @mention notification delivery where appropriate;
- prevent friend-based spectator shortcuts;
- feed the moderation/report system where the player chooses to report separately.

Blocking does not manipulate matchmaking outcomes in a way that can be abused to avoid strong opponents unless the PvP rules explicitly support that.

## 10. Recent Players

A bounded Recent Players list can help people reconnect after:

- co-op;
- party content;
- eligible casual PvP;
- social activities.

It must not become a stalking history.

Requirements:

- short/bounded retention;
- no exact historical location trail;
- blocked users suppressed;
- ranked opponent discovery respects competitive privacy;
- Add Friend uses the normal request flow.

## 11. Vowbond Integration

For safety and intentionality, a mature Vowbond proposal should normally require the two players to already be Friends.

Friendship alone grants no Vowbond benefits.

Ending a friendship does not silently dissolve an existing Vowbond; the Vowbond system has its own explicit lifecycle and safety rules. Blocking may trigger or require the protective Vowbond handling defined by that system.

## 12. Homestead Integration

Friendship becomes one valid Homestead access policy:

```text
Private
Vowbond Partner
Friends
Guild
Invite Only
Public Visit
```

Friend status is checked at visit authorization time.

Removing/blocking a friend revokes friend-derived visit access without deleting the Homestead or moving items.

## 13. Party / Co-op Integration

Friends are convenient invite targets, not mandatory party members.

Friends may receive:

- faster friend-list invitation flow;
- optional `Available for Party` presence;
- party notifications;
- richer shared activity presence where allowed.

Party Finder remains necessary; co-op must not require an established friend network.

## 14. PvP / Colosseum Integration

Friends may later:

- challenge each other to casual sparring;
- create Private Key / Closed friend battles;
- receive friend-spar invitations;
- use a `Friends Fighting` Colosseum filter where the battle is visible to them;
- open eligible friend spectator links;
- share eligible replays.

Being friends never bypasses spectator privacy, ranked delay, hidden-information filtering or Battle Key rules.

---

# PART II — NOTIFICATION & ATTENTION SYSTEM

## 15. Notification Philosophy

Notifications should answer:

> **What happened that may deserve my attention?**

They should not become a duplicate permanent record of every game event.

Canonical content remains in its owning system:

- News article → News;
- direct message → Messages;
- tavern mention → Chat;
- friend request → Friends/Requests;
- party invitation → Party;
- PvP invitation → PvP;
- event state → World Pulse/Event;
- moderation action → Account/Moderation notice;
- Trade House transaction → Economy record.

The notification points to that source.

## 16. Global Notification Trigger

The authenticated shell should eventually contain a compact **Notifications / Alerts** trigger in the global utility cluster.

Conceptually:

```text
◇ 128 Online   ✦ 5   🔊   ⚙
                 ↑
           unread attention
```

Exact iconography must be original and consistent with the Art Bible.

Opening Notifications uses a drawer/sheet/overlay and never permanently shrinks the world or battlefield.

## 17. Badge Semantics

Use badges intentionally.

Recommended approach:

- numeric unread count for direct/actionable items;
- `99+` cap for extreme counts;
- restrained dot for low-priority new content where a number is unnecessary;
- critical styling reserved for genuine account/service urgency;
- category badges on News, Messages, Friends/Requests and chat surfaces where relevant.

Do not put a red badge on every menu item merely because something changed.

## 18. Notification Categories

The internal model should support categories equivalent to:

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

Presentation can group these into fewer player-facing tabs if that is cleaner.

Each notification carries typed metadata rather than arbitrary HTML/script.

## 19. Priority Classes

A useful priority grammar:

```text
CRITICAL
ACTION_REQUIRED
DIRECT
INFORMATIONAL
```

Examples:

**Critical**
- account/security problem;
- forced maintenance state affecting current play;
- serious moderation/account restriction.

**Action Required**
- friend request;
- party invite;
- Vowbond proposal;
- trade/commission approval where later required.

**Direct**
- unread direct message;
- @mention;
- casual challenge;
- Homestead invitation.

**Informational**
- News article;
- event announcement;
- transaction completed;
- replay ready.

Critical must remain rare enough to mean something.

## 20. Unread State

Unread state is server-backed so it follows the account across browsers/devices.

The system should support:

- unread/read per notification;
- mark one read;
- mark category read;
- mark all read;
- opening the authoritative destination may mark the relevant notification read;
- aggregate unread counts generated without loading every historical row;
- expiry/archival according to category.

Do not store the only copy of a Message or News post inside a notification row.

## 21. News Unread Treatment

Authenticated players should be able to see that official News has unread articles.

The News navigation/utility may show a small unread count/dot.

Important rules:

- read state is per authenticated account;
- public anonymous News remains readable without unread state;
- minor historical imports do not suddenly create hundreds of `new` alerts;
- News publication can define whether it should create an aggregate Notification Center item;
- the News page itself may count all genuinely unread recent articles while the global Notifications badge may surface only attention-worthy/published-recent items.

Do not turn every correction typo into a fresh global alert.

## 22. Direct Messages

When Whispers/DMs arrive:

- Messages receives its own unread count;
- the global notification count may include unread conversations according to product tuning;
- multiple unread messages from one conversation should generally coalesce rather than create 17 independent global rows;
- clicking the notification opens the relevant conversation;
- block/mute/Do Not Disturb policies apply.

## 23. @Mentions in Chat

Supported chat channels may allow autocomplete-backed `@CharacterName` mentions.

A mention notification is generated server-side only when:

- the sender's message was accepted;
- the recipient identity resolves legitimately;
- the recipient was eligible to receive/view that channel/message under the channel rules;
- block/mute/privacy rules permit delivery;
- the message was not suppressed by moderation;
- mention rate limits are satisfied.

Do not trust arbitrary client-highlighted text as proof of a mention.

Mention surfaces may include:

- Party chat;
- Common Room / tavern chat;
- Guild chat;
- Nation Hearth;
- Open Road;
- other approved social channels.

A mention alert can contain a short safe excerpt and channel/location label and deep-link to the message context where retained/access remains valid.

If the user no longer has access to the channel/context, the system must not leak the hidden transcript through the notification.

## 24. Mentions Should Not Become Spam Weapons

Anti-abuse controls should include:

- autocomplete over eligible public identities rather than free account identifiers;
- per-sender/channel mention limits;
- ignore mentions from blocked users;
- DND/mute preferences;
- no `@everyone`/`@all` for ordinary players unless a specifically designed channel role later permits it;
- staff/system broadcast mentions use privileged typed commands, not fake player text.

## 25. Friend Requests & Social Notifications

Friend-request notification states should support actionable UI:

```text
Nick sent you a friend request.
[Accept] [Decline]
```

After settlement the notification becomes non-actionable/history or disappears according to retention policy.

Useful friend-related notifications may include:

- request received;
- request accepted;
- friend came online only if the player explicitly opts into such alerts later;
- friend invited you to a party;
- friend challenged you;
- friend invited you to a Homestead.

Do **not** notify when somebody quietly removes you as a friend.

## 26. Invitations

Party, challenge, Vowbond, Homestead and other time-sensitive invitations need:

- expiry time;
- Accept/Decline where appropriate;
- authoritative eligibility re-check on acceptance;
- stale notification treatment when the invitation expires;
- no success merely because an old notification button remained open in a browser tab.

## 27. World & Event Alerts

World/event systems may create notifications for:

- event begins soon;
- event is now active;
- event phase changed where materially relevant;
- a tracked event objective changed;
- an event the player explicitly followed is resolving;
- major server/world announcement.

Avoid notifying every player about every minor world-state mutation.

World Pulse remains the richer contextual source.

Players should eventually be able to follow/mute selected event categories where appropriate.

## 28. Notification Behavior During Battle

Notifications must not sabotage combat readability.

During ordinary PvE:

- noncritical alerts may queue quietly;
- a subtle badge may update;
- avoid large toast overlays over the board.

During timed/ranked PvP:

- suppress ordinary social/news toasts until safe moments/end of match;
- critical account/service notices remain possible if genuinely necessary;
- no mention/friend alert should cover the timer, forecast or command controls.

## 29. Toasts vs Notification Center

Short-lived toast alerts are allowed for immediate context, but they are not the durable source.

Use toasts for things such as:

- Friend request received;
- Party invitation received;
- Message from current friend;
- relevant action succeeded/failed.

Use the Notification Center for durable unread attention.

Do not require players to catch a 4-second toast to know something happened.

## 30. User Preferences

Mature Settings should allow category-level attention preferences.

Examples:

```text
In-game toast: On/Off per supported category
Sound cue: On/Off where supported
Mentions: On
Direct messages: On
Friend requests: On
Party invites: On
News: badge only / notification / muted
World events: followed only / important / muted
```

Critical account/security messages cannot be completely suppressed when acknowledgement is legally/security operationally required.

Do not allow paid tiers to receive more reliable notifications.

## 31. Optional Browser / Push Notifications

External/browser push is not required for the initial in-game notification system.

If added later:

- explicit browser/device permission required;
- opt-in by category;
- no hidden marketing push;
- privacy-safe text on lock screens;
- no competitive hidden-state leakage;
- clear device management/revocation.

Email remains an account/security/support communication channel where appropriate and is not automatically mirrored for every in-game notification.

---

# PART III — TECHNICAL & SAFETY MODEL

## 32. Typed Notification Event

Conceptually:

```text
Notification
  id
  recipient_account_id
  category
  type
  priority
  source_system
  source_reference
  created_at
  expires_at?
  read_at?
  action_state?
  safe_presentation_payload
  dedupe/coalesce_key?
```

The payload contains presentation-safe identifiers/data only.

Do not embed executable markup or private source-system state.

## 33. Delivery Model

Authoritative system action:

```text
DOMAIN EVENT
   ↓
notification policy
   ↓
server persists/coalesces notification if required
   ↓
realtime invalidation / unread aggregate
   ↓
client refreshes safe notification projection
```

Realtime delivery can make it feel immediate, but persisted unread state remains authoritative for durable notifications.

## 34. Coalescing

The system should reduce noise.

Examples:

- `5 new messages from Elyra` rather than five global rows;
- one updated tournament notification rather than a new row for every bracket refresh;
- one friend request notification per active request;
- one News publication notification per article;
- repeated transient errors should not create dozens of player notifications.

## 35. Security / Abuse

Test and guard against:

- forged recipient IDs;
- forged friend state;
- duplicate request acceptance;
- request spam;
- notification flooding;
- unread-count inflation;
- client-forged `read` state for another account;
- mention spoofing;
- hidden channel transcript leakage through mention previews;
- blocked-user notification leakage;
- expired invite acceptance;
- race between remove/block/accept;
- private PvP/Homestead information appearing in generic notifications;
- notification deep links bypassing normal authorization.

## 36. Moderation

Moderator tooling eventually needs visibility into abuse reports and narrowly scoped social context, not unrestricted social surveillance.

Friends/notifications must integrate with:

- Block;
- Mute;
- Report;
- chat moderation;
- invite spam controls;
- account sanctions.

Official Moderator/System messages must be visually impossible to confuse with a custom player title.

---

# PART IV — SUCCESS CRITERIA

This system succeeds when:

- players can send, receive, accept, decline, cancel and remove friendships safely;
- blocking overrides friend-derived access immediately;
- Friend relationships integrate with Presence, parties, PvP, Colosseum, Homesteads, Vowbond and chat without bypassing those systems' permissions;
- the Friend list is useful even when the global online population becomes large;
- unread News, DMs, friend requests, invites and @mentions are hard to miss;
- notification badges are informative rather than omnipresent;
- mention delivery is server-validated and cannot leak inaccessible chat;
- unread state follows the account across devices;
- battle gameplay is not covered by irrelevant notifications;
- notification deep links never bypass the owning system's authorization;
- social spam and block/privacy rules are enforced server-side;
- AUREVANE feels socially connected without demanding constant attention.