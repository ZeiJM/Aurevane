# AUREVANE — Tavern Social World, Roadwright & Shared Conversation

**Status:** Authoritative feature specification subordinate to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/WORLD.md`, `docs/LORE_BIBLE.md`, `docs/SOCIAL_PRESENCE.md`, `docs/ITEMS_INVENTORY_LOADOUTS.md`, `docs/MONETIZATION.md`, `docs/PRODUCT_EXPERIENCE_CONTENT_SYSTEM.md`, `docs/MASTER_PANEL.md`, and `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md`.

**Direction approved:** 2026-08-16.

This document owns a specific missing layer of AUREVANE: **low-intensity shared-world activity and realtime social conversation that make taverns, halls, and settlements feel inhabited even when the player does not want to fight.**

It does not replace parties, guilds, direct messages, World Pulse, News, the Archive, nation warfare, or the main combat/progression loop.

The central rule is:

> **AUREVANE should offer something satisfying to do when the player wants to remain in the world but does not currently want a battle, grind, queue, or major quest.**

That activity should create world texture, quiet social contact, lore curiosity, and small useful discoveries without becoming mandatory progression or an idle-game farm.

---

# PART I — THE TAVERN AS A REAL GAME SPACE

## 1. Social-Hearth Thesis

Important settlements should eventually include a tavern, common hall, tea house, lodge, camp, public garden, guildhall, bathhouse, roadside inn, or culturally equivalent **social hearth**.

Do not carbon-copy one medieval tavern into every region.

The technical social systems may be shared, but each culture can express the space differently through:

- architecture;
- furniture and materials;
- music/ambience;
- NPCs;
- regional food/drink presentation;
- local sayings;
- games;
- notice boards;
- community-event state;
- nation/faction symbolism;
- local chat naming/presentation.

The purpose is not to build a 3D MMO tavern simulator. AUREVANE can create a convincing shared social place through strong scene art, responsive UI, presence, chat, small activities, NPC/world-state changes, and sound.

---

## 2. What the Social Hearth Provides

As underlying systems arrive, a social hearth can become a home for:

- local/Common Room conversation;
- Adventurers Online context;
- party formation hooks;
- guild/friend social actions;
- nation conversation later;
- event/world rumors;
- the low-intensity **Roadwright** activity;
- community puzzle/table state;
- local cosmetic/social unlocks;
- NPC chatter and story flavor;
- access to selected shops/services;
- contextual News/World Pulse/Chronicle links where appropriate.

It should feel like a place players visit because it is pleasant and socially useful, not because a daily quest forces them to click it.

---

# PART II — ROADWRIGHT: A QUIET IN-WORLD GAME

## 3. Working Player-Facing Name

**Roadwright** is the current working name for an old folk tabletop game played across AUREVANE's regions.

The name may change during world/naming review without changing the system identity.

The player-facing fantasy is simple:

> Travelers have been laying little roads across tavern tables for longer than anyone agrees.

At first it appears to be a charming regional strategy/puzzle pastime.

Over time, attentive players may realize that versions of the game from cultures that supposedly had little ancient contact share unusual motifs, route patterns, symbols, and rules.

That becomes a subtle lore thread rather than an exposition dump.

---

## 4. Roadwright Gameplay Shape

Roadwright should be low-energy, tactile, and easy to stop/resume.

A representative session might involve:

- a small tabletop board;
- a hand of carved road/landmark tiles or cards;
- placing and rotating pieces;
- connecting routes between inns, shrines, bridges, lanterns, gates, hills, rivers, ruins, or other regional symbols;
- satisfying optional pattern goals;
- avoiding dead roads, contradictions, blocked passages, or other simple constraints;
- occasionally choosing between two valid routes with different consequences;
- completing a compact route/pattern and seeing the table settle into a finished little journey.

The exact puzzle grammar should be prototyped for fun rather than over-specified before implementation.

Important qualities:

- understandable within a minute or two;
- enough combinatorial variation for repeated play;
- no reflex/timing requirement;
- no pressure to play efficiently;
- mouse, touch, keyboard accessibility where practical;
- save/resume support for a personal table;
- attractive table art, carved pieces, tactile movement, and quiet audio;
- useful in a five-minute break but capable of holding attention longer if the player wants.

---

## 5. Passive Means Low-Intensity, Not AFK Progression

Roadwright is “passive” in the emotional sense:

- calm;
- optional;
- low cognitive/physical intensity;
- easy to do while chatting or listening to ambience;
- no combat commitment;
- no matchmaking requirement.

It is **not**:

- leave browser open for six hours;
- automated currency generation;
- background XP;
- an energy timer;
- a click-every-30-minutes idle farm;
- a replacement for Wayfarer's Practice.

No continuous per-player background job is required merely because a table is open.

---

## 6. Personal Table

A player can maintain a current Roadwright table that persists across navigation/session interruption where practical.

The player may:

- start a new layout;
- continue an unfinished layout;
- inspect completed patterns;
- change cosmetic tile/table sets they have legitimately unlocked;
- abandon/restart without punishment;
- optionally share a finished layout/card with friends/social profile later.

Failure should not destroy a valuable resource.

Roadwright should encourage experimentation, not optimization anxiety.

---

## 7. The Common Road — Asynchronous Social Play

Selected taverns/social hearths can host a larger communal board called the **Common Road**.

This is not a leaderboard.

Players contribute toward a shared pattern or route over time. Depending on the final puzzle grammar, contributions might include:

- placing one eligible communal piece;
- choosing between two route branches;
- restoring/connecting a broken section;
- contributing a symbol earned from a personal Roadwright completion;
- voting through play on which of several paths the communal route follows.

The board can show tasteful social traces such as:

- recent contributor names/portraits where privacy allows;
- small “traveler marks” left by friends/guildmates;
- the total number of different adventurers who helped;
- regional decorations earned by the community.

Do not rank contributors by number of pieces, money spent, or hours played.

The emotional result should be:

> “Other people have been sitting at this table too.”

---

## 8. Social Interaction Without Chat Dependence

Roadwright should remain usable even before mature chat exists.

Possible asynchronous social touches include:

- leave a non-text traveler mark/emblem on a friend's completed table;
- offer a route suggestion from a small safe preset vocabulary;
- contribute to the Common Road;
- inspect a friend's publicly shared finished route;
- see that a guildmate/nationmate contributed to the same community pattern;
- unlock a tavern decoration or short communal tale when the shared route is completed.

User-authored free text belongs to the moderated chat/message systems rather than becoming an unmoderated hidden message channel inside a puzzle.

---

## 9. Roadwright Rewards

Roadwright must feel rewarding while remaining optional.

Preferred reward hierarchy:

### Primary rewards

- new table/board skins;
- carved tile sets;
- regional piece styles;
- social/profile display pieces;
- tavern/common-room decorations;
- small Archive annotations;
- **Rumor Leads** pointing toward optional world activity;
- discovery of regional sayings, folk stories, recipes, songs, symbols, or historical curiosities;
- communal visual/state changes when a Common Road is completed.

### Minor practical benefits

A successful table may occasionally provide a bounded **Rumor Lead** or **Road Note** that does something useful without creating direct combat power, for example:

- highlight one optional point of interest in a region the character can already access;
- reveal that a known vendor or event currently carries a relevant category of goods;
- point toward an existing side quest, Archive source, regional anomaly, or activity the player has not yet noticed;
- expose a known acquisition hint that the player could otherwise learn through ordinary world exploration/manual systems.

Information can be a reward.

### Optional low-value material rewards

If later testing shows Roadwright benefits from tangible rewards, they may come from existing low-impact reward catalogs such as ordinary tavern goods, common cosmetics, or modest one-time quest rewards.

Guardrails:

- no exclusive core combat power;
- no exclusive Discipline/Soulmark/Confluence/Mantle progression;
- no PvP rating;
- no rare tradeable economic farm;
- no repeatable XP/Mastery output large enough to become optimal progression;
- any useful item must have normal alternate acquisition;
- repeatable economic value must remain low enough that bots do not turn Roadwright into the best money-making activity.

The minigame should be played because it is pleasant and interesting, not because spreadsheets say every serious player must grind it.

---

## 10. Lore Integration — The Folk Game That Remembers Too Much

Roadwright can become a subtle long-form lore device.

Different regions/nations should have visibly different versions of the game, yet certain old motifs may recur:

- open circles;
- roads that split and rejoin;
- doors without walls;
- paired shadows;
- stars that must be enclosed or left outside a route;
- old “wrong” route rules whose meaning nobody can explain;
- a rare pattern that several cultures call by unrelated names but play identically.

Early interpretation:

> old traveler superstition and convergent folk tradition.

Later possibilities:

- Archive scholars notice the patterns predate accepted histories;
- a Closed Star source condemns a particular version of the game;
- an ancient route layout resembles a Great Vane diagram only after that mythology is publicly known;
- an NPC remembers a childhood rule whose wording echoes an older Aurevane title;
- a Common Road completed during a world event reveals a harmless but eerie historical clue.

Roadwright must never become the sole required source for central-story truth.

A player who ignores the minigame should still be able to understand the main story through the normal world/Archive path.

Players who love it should gain extra texture, connections, and satisfying “wait, I have seen that symbol before” moments.

---

## 11. Habit-Forming Without Manipulation

Roadwright is allowed to be compelling.

Use intrinsic retention:

- one-more-piece puzzle tension;
- satisfying completion;
- collections of regional table sets;
- personal unfinished boards worth returning to;
- gentle communal progress;
- new route grammars discovered through world travel;
- occasional lore connections;
- ambient music and social presence;
- seeing the Common Road evolve.

Avoid:

- destructive daily streaks;
- expiring puzzle rewards that punish absence;
- paid energy;
- loot-box reveal loops;
- artificial “come back in 20 minutes” gates;
- making the player leave the game open;
- a global score leaderboard that turns a calm activity into an obligation.

---

# PART III — SHARED CHAT ARCHITECTURE

## 12. Chat Should Reinforce Place and Allegiance

AUREVANE should support realtime player conversation, but the default social architecture should not be one permanently open global channel containing every nation and every player.

The desired hierarchy is:

```text
PARTY / DIRECT RELATIONSHIPS
        ↓
LOCAL COMMON ROOM
        ↓
GUILD / SOCIAL GROUPS
        ↓
NATION HEARTH
        ↓
OPEN ROAD — TEMPORARY CROSS-NATION WORLD ACCESS
```

This makes belonging somewhere socially meaningful.

---

## 13. Core Channel Types

Channels appear only when their underlying system exists.

### Party

For the current party/co-op group.

Owned by the party system, not the global chat directory.

### Whispers / Direct Messages

Private person-to-person communication subject to privacy/block/moderation rules.

### Guild

Guild members only, with optional officer/system subchannels later when justified.

### Common Room

Local social conversation for a tavern, settlement, or appropriate shared social hearth.

This is the most diegetic “tavern chat” layer.

A player visiting a settlement can talk to others currently participating in that social space without needing nation membership.

### Nation Hearth

Nation-wide social channel for characters currently aligned with that nation and eligible to participate.

It should feel like the normal broad social home of a nation, not like a secret military radio.

### Open Road

A deliberately limited cross-nation/world conversation channel.

This is where players from different nations can mingle globally without making cross-nation global chat the permanent default social environment.

---

## 14. Nation Hearth Is Social, Not Perfectly Secret Intelligence

Nation Hearth may become socially valuable during campaigns, but it should not be treated as an unbreakable secure military channel.

Reasons:

- players may stream/screenshare;
- future multiple-character/account rules may complicate allegiance;
- screenshots/copied text always exist;
- attempting perfect information secrecy would produce fragile anti-alt policies.

Therefore:

- Nation Hearth should avoid automatically exposing exact war intelligence, hidden objectives, or private tactical telemetry;
- dedicated nation-operation/war-room tools may later have stricter eligibility if the campaign design genuinely needs them;
- exact player locations and privileged campaign state come from authoritative nation/party systems, not free text chat.

---

# PART IV — OPEN ROAD WORLD BROADCAST

## 15. Why World Chat Is Limited

A permanent unrestricted world channel would flatten regional/nation identity and can become noisy, spammy, difficult to moderate, and socially dominant.

AUREVANE instead treats global conversation as temporarily **opening the road** between otherwise distinct social hearths.

The player chooses when they want that wider crowd.

---

## 16. Daily Free Open Road Access

Production planning default:

> **Every eligible account receives up to 4 hours of Open Road access per server day at no cost.**

The exact value is configurable and should be validated with real usage.

Important rules:

- allowance is **account-scoped**, not per character, to prevent trivial alt multiplication;
- it does not bank across days;
- no login streak is required;
- the player explicitly toggles **Open Road** on/off;
- time is consumed only while Open Road is enabled and the authenticated account has a valid active presence lease;
- logout/disconnect stops consumption after a short reconnect grace;
- entering Away state may auto-pause consumption after a configurable threshold so an accidentally enabled channel does not waste hours while the player is gone;
- server time owns the allowance;
- the browser cannot edit remaining minutes;
- receiving and sending Open Road messages both require active access so the channel is truly opt-in rather than a permanent global feed with paid speaking rights.

The UI must show remaining access clearly without turning it into a flashing countdown.

---

## 17. In-Game Extension Item — Roadspeaker Writ

Working item name: **Roadspeaker Writ**.

This is an ordinary in-game social/economy item, not a premium-cash product.

Recommended production default:

- purchasable for **Crowns** through appropriate ordinary in-game shops/services once the economy exists;
- may also be granted through suitable ordinary gameplay/content where useful;
- character/account binding as required to prevent speculative trading abuse;
- not a player-market investment vehicle;
- activating one grants **+1 hour** of Open Road access for that account for the current server day;
- at most **4 bonus hours** may be activated in one server day by default;
- therefore the default maximum is **8 hours of Open Road participation per day** (4 free + 4 extended), subject to later tuning;
- unused Writ items remain in inventory; the game must not consume a Writ if the daily extension cap has already been reached.

The exact item name, Crown price, extension amount, and cap are data-driven balance values rather than eternal promises.

### Why cap the extension

The goal of the item is:

- a small Crown sink;
- a choice for highly social players;
- an in-world explanation for extended cross-nation communication.

The goal is **not** to let the richest character purchase permanent dominance of the only global conversation space.

---

## 18. No Real-Money World Voice

Do not sell Open Road access time through the normal premium store.

AUREVANE may sell non-disruptive cosmetic chat/profile flourishes under `docs/MONETIZATION.md`, but normal ability to participate in player conversation should not become a real-money toll.

No premium tier receives superior message priority, faster chat, immunity from slow mode, increased moderation privileges, or unlimited world access.

---

## 19. Open Road Eligibility

To reduce bot/spam abuse, world broadcast may require modest normal eligibility such as:

- verified authenticated account;
- valid character;
- completion of basic onboarding or another small legitimate milestone;
- account/character not currently muted/suspended from the channel.

Do not require high level, rare progression, payment, or nation membership merely to talk globally.

A new player should reasonably be able to reach the social system without a long grind.

---

# PART V — CHAT EXPERIENCE

## 20. UI Placement

Chat belongs to the persistent social-utility family without stealing the main game canvas.

Possible mature shell composition:

```text
◇ 128 Online    Hearth/Chat    🔊    ⚙
```

or a similarly compact original AUREVANE treatment.

The exact final iconography/layout should be validated against utility-cluster complexity.

### Desktop

- compact chat trigger;
- non-reflowing drawer/overlay by default;
- optional user-pinned compact dock only if it does not shrink battle/world canvases unreasonably;
- channel tabs/list;
- clear unread indicators without fake urgency;
- easy minimize.

### Mobile

- bottom sheet / near-full-height social panel;
- large channel controls;
- keyboard-safe composer;
- no horizontal overflow;
- easy dismiss/focus restoration.

### Battle

Chat must never obscure critical PvP clocks, target confirmation, or board state by default.

World/Nation chat can remain minimized during battle. Opening chat does not pause authoritative battle timing.

---

## 21. Channel Presentation Should Feel In-World

Avoid Discord-clone presentation where possible.

Possible names and flavor:

- **Common Room** — local;
- **Nation Hearth** — broad nation social channel;
- **Open Road** — world/cross-nation;
- **Guild Hall** — guild;
- **Whispers** — direct messages.

Different nations may skin/name their Nation Hearth differently while preserving the same technical channel role.

For example, one nation may present the space as a civic hall, another as a fire circle, another as a tea court, another as a military commonhouse.

The implementation reuses one channel system; the world does not reuse one identity.

---

## 22. Realtime and Persistence Model

Chat is server-authoritative communication state.

Conceptually:

```text
AUTHENTICATED CHARACTER
  ↓
CHANNEL ELIGIBILITY + BLOCK/MUTE/RATE CHECK
  ↓
SERVER ACCEPTS MESSAGE
  ↓
STABLE MESSAGE ID + MODERATION METADATA
  ↓
REALTIME DELIVERY TO ELIGIBLE SUBSCRIBERS
  ↓
BOUNDED RECENT HISTORY / RETENTION
```

The browser may submit message text and a target channel identity. It does not decide:

- which nation channel it belongs to;
- whether Open Road time remains;
- whether it is muted;
- whether another player has blocked it;
- whether it may access a private/guild/party channel;
- message timestamps/author identity;
- staff badge/authority;
- moderation outcome.

Do not broadcast raw account IDs, emails, session metadata, IPs, or privileged role data.

---

## 23. Bounded History

Realtime chat needs enough recent history to remain conversational after navigation/reconnect, but AUREVANE does not need to load an infinite transcript into every client.

Use:

- bounded recent history;
- pagination for older retained messages if product need justifies it;
- explicit retention policy;
- privileged moderation/audit records separate from ordinary client history where required;
- no N+1 profile loads per message.

Direct-message history and public-channel retention may have different policies.

---

# PART VI — MODERATION, PRIVACY & ABUSE

## 24. Player Controls

Mature chat should support as appropriate:

- block;
- mute channel locally;
- report message/player;
- hide/ignore specific users;
- Do Not Disturb for direct contact;
- invite/message privacy policies;
- optional profanity/content filter presentation settings where implemented.

Blocking must be enforced server-side for communication paths where it applies.

---

## 25. Staff Controls

Authorized moderation tooling should eventually support:

- channel mute/timeouts;
- player chat mute/suspension;
- slow mode;
- emergency channel lock;
- message removal/redaction where policy allows;
- report queue;
- context around reported messages;
- audit trail;
- reason/duration;
- appeal/support references where applicable;
- channel health/spam metrics.

Staff messages/announcements should be visibly distinguishable only when the staff member intentionally speaks with an authorized official identity.

Do not reveal hidden staff presence simply because they can moderate chat.

---

## 26. Spam / Bot Protection

Before production scale, protect against:

- rapid flood spam;
- duplicate-message spam;
- link/scam spam;
- bot-created account swarms;
- repeated mentions/DM harassment;
- Unicode/control-character abuse;
- impersonation;
- oversized messages;
- channel-switch abuse;
- reconnect/subscription storms;
- World-access timer manipulation;
- multi-character attempts to multiply account-scoped Open Road allowance;
- Roadspeaker Writ duplication/refund exploits.

Use server-side rate limits and normalized safe message handling.

Do not make anti-spam thresholds public if doing so materially assists evasion.

---

## 27. Nation / PvP Information Safety

Chat should not automatically reveal:

- exact character coordinates;
- hidden battle/queue state;
- private loadout;
- stealth state;
- unrevealed Expedition route;
- privileged nation-campaign telemetry;
- hidden event eligibility.

Players can of course voluntarily tell each other things in text. The game itself should not attach tactically sensitive metadata to their chat messages unless explicitly intended.

---

# PART VII — RELATIONSHIP TO OTHER SYSTEMS

## 28. Adventurers Online

`docs/SOCIAL_PRESENCE.md` answers **who is here**.

Chat answers **what eligible players are saying to each other**.

The two systems integrate through public character identity, presence, block/privacy, and social actions, but neither owns the other.

A presence row may eventually offer Message. Chat may allow clicking a public character name to open the profile/presence action surface.

---

## 29. World Pulse / News

Official world communication is not ordinary player chat.

- **News** — official durable public announcements/history;
- **World Pulse** — current in-world activity/state relevant to the character;
- **Chat** — player conversation;
- **staff/system announcement** — controlled operational message, clearly labeled and not forgeable by ordinary players.

Do not rely on transient chat to communicate a balance change, maintenance window, rule update, or important live-event instruction that should be durable in News/World Pulse.

---

## 30. Manual / Rules

The Manual should explain channel types, Open Road allowance, Writ behavior, privacy/blocking, and basic chat controls once released.

Rules should govern harassment, spam, scams, impersonation, hateful/abusive content, doxxing/privacy abuse, PvP collusion/win-trading communication, and other conduct as relevant to released systems.

Do not hide enforcement-sensitive anti-abuse thresholds in the public Manual.

---

## 31. Economy

Roadspeaker Writ is an ordinary economy sink, not premium monetization.

Its Crown price and shop availability should be controlled through normal item/vendor systems once Phase 11+ economy exists.

It must not become a rare speculative trade commodity or a premium entitlement.

Roadwright repeat play must not become the best route to farm Crowns/materials for buying Writs.

---

## 32. Nations

Nation Hearth arrives when nations are real.

Before allegiance exists, players use local Common Rooms, Party, Guild/Whispers as those systems become available.

Nation Hearth can gain cultural skins, event messages, and nation-season context without becoming a second nation-state backend.

---

# PART VIII — PRODUCT VALIDATION

## 33. Roadwright Validation

Do not assume a calm minigame is good merely because it is thematic.

Test:

- voluntary repeat use after novelty;
- average/median session length;
- whether players return to unfinished personal boards;
- Common Road contribution without leaderboard pressure;
- whether Rumor Leads create useful world exploration;
- whether the activity cannibalizes or supports the core loop;
- whether rewards feel pleasant but non-mandatory;
- whether players understand the puzzle without a long tutorial;
- bot/economy exploit potential.

If players only use it for rewards, improve the activity or remove the rewards rather than bribing them harder.

---

## 34. Chat Validation

Track privacy-respecting signals such as:

- active Common Room/Nation/Open Road participation;
- unique speakers versus lurkers;
- Open Road toggle duration and exhaustion rate;
- Writ activation rate;
- message/report/block rate;
- spam moderation interventions;
- party/guild formation originating from chat;
- chat retention across sessions;
- whether Nation Hearth remains socially active when Open Road exists;
- whether the 4-hour free default feels generous, irrelevant, or overly restrictive.

Do not optimize for raw message count. Ten meaningful conversations can be healthier than ten thousand spam lines.

---

## 35. Definition of Success

This direction succeeds when:

- a player can log in tired of combat and still enjoy remaining in AUREVANE;
- Roadwright is intrinsically pleasant enough to play without progression coercion;
- its lore gradually rewards attention without blocking the main story;
- the Common Road makes other players perceptible without creating a leaderboard race;
- local/nation chat creates social identity and belonging;
- Open Road lets the entire world mingle for a limited chosen window without erasing nation boundaries;
- extended global access uses ordinary in-game economy rather than premium cash;
- chat is safe, moderated, responsive, scalable, and server-authorized;
- the social layer feels like part of the fantasy world rather than a generic website chat widget.
