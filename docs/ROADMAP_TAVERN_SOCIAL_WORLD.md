# AUREVANE — Tavern Social World Roadmap Integration

**Status:** Binding roadmap extension for low-intensity tavern/social-hall activity, Roadwright, local/nation/world chat, Open Road access limits, and their operations/hardening.

**Authority:** `docs/GAME_MASTER_PLAN.md` remains primary. `docs/TAVERN_SOCIAL_WORLD.md` defines the feature model. `docs/WORLD.md`, `docs/SOCIAL_PRESENCE.md`, `docs/ITEMS_INVENTORY_LOADOUTS.md`, `docs/MONETIZATION.md`, `docs/MASTER_PANEL.md`, and `docs/PROJECT_GOVERNANCE_AND_COMPLEXITY.md` govern their respective boundaries.

**Direction approved:** 2026-08-16.

The roadmap rule is:

> **Give players a pleasant reason to remain in AUREVANE when they do not want combat, but do not use a minigame or chat system to hide a weak core game or create mandatory retention chores.**

---

## 1. Cross-Cutting Rules

- Roadwright is a low-intensity optional world activity, not AFK progression.
- Its best rewards are lore texture, optional world leads, social/cosmetic expression, and communal state rather than exclusive power.
- Repeated play must not become an optimal XP/Mastery/Crowns/material farm.
- Common Road social contribution is cooperative/asynchronous and **not leaderboard-ranked**.
- Chat uses server-authorized channel eligibility, identity, moderation, block/privacy and rate limits.
- Local/nation conversation is the normal broad social fabric; cross-nation **Open Road** is opt-in and time-limited.
- Open Road time is never sold for real money.
- Roadspeaker Writ or equivalent is an ordinary in-game Crown sink only after the normal economy exists.
- Do not expose hidden tactical/nation/PvP information through chat metadata.
- Do not add a permanent chat panel that reduces the battlefield/world canvas merely because realtime chat exists.

---

## 2. Phases 1–4 — No Premature Social Minigame/Global Chat

Do not interrupt current character/combat/build validation with a tavern metagame.

Preserve only clean boundaries:

- public character identity remains separate from account identity;
- global utility shell can eventually host a compact social/chat trigger beside presence/audio without heavy reflow;
- typed item/effect architecture must not block a later non-combat social consumable;
- world/content architecture should allow settlement activities that are not combat;
- no fake tavern lobby, fake population, or placeholder world chat.

Phase 2–4 success still depends primarily on combat/buildcraft proof.

---

## 3. Phase 5 — First Quiet-World / Roadwright Proof

**First implementation target for the low-intensity activity.**

Phase 5 already introduces the Living World, authored settlements, story/event state, Archive/lore delivery, World Pulse, social presence, and the first useful Master Panel/world operations slice. This is the right environment for one small Roadwright proof.

### Required representative scope

Implement Roadwright only after the representative settlement/tavern/social-hall experience exists.

A first slice should include:

- one culturally authored social hearth;
- one simple polished Roadwright ruleset;
- personal persistent table/save-resume state;
- attractive tile/card/table presentation through the Media Pipeline;
- quiet audio/interaction feedback;
- no reflex/timer requirement;
- one or more optional pattern goals;
- at least one bounded Rumor Lead / Road Note integration pointing toward existing world content;
- no exclusive combat-power reward;
- no repeatable economy output worth bot farming;
- first **Common Road** communal board or an equivalent small asynchronous community interaction if the population/tooling supports it;
- recent-contributor/social traces without ranking;
- spoiler-safe first lore motifs;
- phone/laptop/desktop accessibility;
- telemetry needed to tell whether people voluntarily play again.

### PV-3 relationship

Roadwright is allowed to support the Return-Loop/Retention phase, but it must **not be used to manufacture retention metrics for a weak main game**.

Evaluate separately:

- core game return behavior;
- Roadwright voluntary use;
- whether Roadwright leads players back into world exploration/social activity;
- whether rewards rather than intrinsic play are driving usage.

If the puzzle is weak, improve/replace it rather than inflating rewards.

### Explicit Phase 5 deferrals

- no mature realtime player chat suite merely because a tavern exists;
- no Nation Hearth before nations;
- no Open Road access economy before stores/economy;
- no giant catalog of regional Roadwright variants;
- no deep central-story reveal hidden behind the minigame;
- no leaderboard.

---

## 4. Phase 6 — Party Communication

Party/co-op requires immediate communication even before the mature social world.

Implement appropriate **Party chat/communication** with:

- authoritative party membership checks;
- block/safety policy appropriate to an active party;
- bounded recent history/reconnect behavior;
- mobile/desktop usability;
- no leakage to nonmembers;
- no dependency on Open Road allowances.

Roadwright may optionally gain simple party/friend social touches only if cheap and useful; do not delay co-op for them.

---

## 5. Phase 7 — Expedition Context

Expedition communication may reuse Party chat with activity-specific system messages.

Do not expose hidden Expedition route/seed/rare-room information to public social channels automatically.

Roadwright can gain Expedition-themed cosmetic tiles/folk variants only if content throughput supports them; this is polish/content, not a core Phase 7 gate.

---

## 6. Phase 8 — PvP Communication Safety

PvP does not require global player chat, but chat foundations must anticipate competitive abuse.

Requirements before mature competitive social chat:

- block/report boundaries;
- no exact queue/opponent telemetry attached to messages;
- no staff/official impersonation;
- rate-limit/harassment safeguards;
- post-match social actions must not become forced trash-talk exposure;
- tournament/event announcements use official systems rather than unverifiable chat lines.

PvP chat, if any, must be deliberately scoped per mode.

---

## 7. Phase 9 — Content Scale Check

Before creating many Roadwright variants, measure the real production cost of:

- puzzle rules/validation;
- art/table/tile sets;
- regional flavor/lore;
- Rumor Lead relationships;
- common-board content;
- responsive testing.

Reuse the technical puzzle framework but author regional identity intentionally.

Do not produce 20 shallow reskins to satisfy a checklist.

---

## 8. Phase 10 — Mature Social World + Common Room Chat

This is the first major general chat milestone.

Add a shared social communications foundation integrated with Friends/Guilds/Messages/Moderation and `docs/SOCIAL_PRESENCE.md`.

### Required Phase 10 chat scope

- **Common Room** local/settlement/social-hearth chat;
- **Guild** chat when guild membership exists;
- **Whispers / Direct Messages**;
- public-character message identity;
- server-authorized channel membership;
- bounded recent history/reconnect;
- block/report/mute/Do Not Disturb integration;
- rate limits and anti-flood handling;
- moderation permissions/audit foundation;
- safe profile/presence links;
- responsive chat drawer/sheet;
- unread treatment without manipulative notification spam;
- no permanent canvas reflow in battle/world by default.

### Roadwright social expansion

As useful:

- friend/public finished-table sharing;
- non-text traveler marks;
- richer recent contributor identity;
- guild/community Common Road themes;
- chat/context links from a tavern table without allowing hidden unmoderated text notes.

### Explicit deferrals

- no Nation Hearth until allegiance exists;
- no Open Road access timer/item before Phase 12;
- no paid chat priority.

---

## 9. Phase 11 — Economy Foundation for Social Goods

Stores/vendors/item systems now exist, making an ordinary social consumable possible.

Do not ship a dead Roadspeaker Writ before Open Road exists.

Prepare only the reusable item/vendor rules needed so Phase 12 can publish it cleanly:

- non-combat social-use item category/tag where necessary;
- server-authoritative consume/grant semantics;
- account-scoped effect support when explicitly permitted;
- binding/non-tradable policy;
- provenance/economy telemetry;
- no premium-catalog dependency.

Roadwright economic output is reviewed here to ensure it does not become a Crown/material farm that indirectly supplies unlimited social-access items.

---

## 10. Phase 12 — Nation Hearth + Open Road

**Primary nation/world-chat milestone.**

Nations now exist, and the ordinary economy can support the extension item.

### Nation Hearth

Implement:

- nation-wide chat eligibility tied to authoritative active character allegiance;
- cultural player-facing treatment per nation where appropriate;
- server-authorized membership;
- block/report/mute/moderation integration;
- no exact hidden war telemetry automatically attached;
- nation-event/system notices clearly distinguished from player speech;
- scalable realtime delivery and bounded history.

Nation Hearth becomes the normal large social home for nation-aligned characters.

### Open Road

Implement cross-nation/world chat as a deliberately limited optional channel.

Production defaults from `docs/TAVERN_SOCIAL_WORLD.md`:

- 4 free account-scoped hours per server day;
- explicit Open Road on/off toggle;
- allowance consumed only while enabled with active authenticated presence;
- disconnect/Away handling that avoids wasting allowance;
- server-authoritative remaining time;
- both read and send require active Open Road access;
- clear calm remaining-time UI;
- no daily streak requirement.

### Roadspeaker Writ

Publish the ordinary in-game extension item with defaults:

- purchased for Crowns from appropriate ordinary shops/services;
- no real-money purchase path;
- +1 Open Road hour per activation;
- no activation above the configured daily bonus cap;
- recommended default 4 bonus hours/day, making default maximum 8 total hours/day;
- bound/non-speculative behavior as defined by economy design;
- safe atomic consume + account allowance grant;
- duplicate/retry protection;
- pricing and caps data-driven.

### Nation-information guardrail

Nation Hearth is social, not guaranteed secret military communications. If nation warfare needs protected operational channels, design those separately with their own eligibility rather than pretending ordinary chat can prevent screenshots/alts/streams.

### Roadwright nation expansion

Where content throughput justifies it:

- nation/regional tile/table variants;
- culturally different Common Road presentation;
- nation/world events influencing harmless puzzle motifs/rumors;
- subtle cross-cultural lore similarities that later Archive content can contextualize.

No nation receives a competitive gameplay advantage because its Roadwright version is “better.”

---

## 11. Phase 13 — Complete Tavern / Chat Operations

Add mature owner/staff operations through the Master Panel.

### Chat operations

Authorized controls/analytics may include:

- channel configuration and enable/disable;
- Open Road free/bonus allowance configuration;
- Roadspeak/Writ linkage inspection;
- slow mode / emergency lock;
- player chat timeout/mute/suspension;
- report queue and message context;
- moderation reason/duration/audit;
- official staff-message identity controls;
- retention policy;
- spam/rate-limit telemetry;
- active users/messages by channel at aggregate levels;
- block/report/abuse trends;
- message-delivery/realtime health;
- nation/channel health;
- emergency cross-nation channel disable without affecting Party/Guild/DM unnecessarily.

### Roadwright operations

Where content volume warrants:

- puzzle definition/version editor;
- regional table/theme relationships;
- Common Road definition/schedule/state;
- Rumor Lead/content relationships;
- lore/spoiler classification;
- media relationships;
- reward validation;
- preview-as-player;
- reset/recovery tools;
- analytics;
- staged publication/rollback.

Do not allow arbitrary executable code/SQL in puzzle or chat configuration.

---

## 12. Phase 14 — Art, Audio & Social Atmosphere Polish

Taverns/social hearths should become some of AUREVANE’s most inviting non-combat spaces.

Polish:

- culturally distinct social-space art;
- Roadwright boards/pieces/animations;
- tactile placement/connection feedback;
- quiet regional music/ambience;
- subtle Common Road completion moments;
- chat channel iconography/material treatment;
- Nation Hearth cultural identity;
- Open Road visual state/countdown treatment;
- responsive drawer/sheet behavior;
- reduced-motion/accessibility;
- unread/mention sounds that remain configurable and non-fatiguing.

Do not make global chat visually louder than the world itself.

---

## 13. Phase 15 — Hardening

Test/harden:

### Roadwright

- invalid puzzle states;
- deterministic/server-authorized reward claims;
- duplicate completion/claim attempts;
- Common Road concurrent contributions;
- bot/economy farming;
- malformed content references;
- spoiler leakage;
- save/resume corruption;
- mobile drag/place alternatives and keyboard accessibility;
- large communal participation performance.

### Chat

- forged author/channel/nation IDs;
- private/guild/party channel access attempts;
- block/privacy bypass;
- spam/flood/duplicate messages;
- Unicode/control-character abuse;
- message-size/link/scam abuse;
- report/mute race conditions;
- staff impersonation;
- moderation-permission escalation;
- reconnect/subscription storms;
- message-history pagination/load;
- realtime fan-out at realistic population;
- Open Road timer/client-clock manipulation;
- account/alt allowance multiplication;
- Roadspeak Writ double-consume/rollback/idempotency;
- Crown-price/vendor authority;
- cross-nation strategic metadata leakage;
- emergency channel shutdown/recovery.

---

## 14. Validation Gates

### Quiet-world gate

Before scaling Roadwright widely, demonstrate that representative testers:

- understand it quickly;
- voluntarily play again without large rewards;
- enjoy completing/resuming boards;
- perceive the Common Road as social rather than competitive;
- use Rumor Leads to discover world content;
- do not feel obligated to grind it.

### Chat gate

Before treating Open Road defaults as stable, measure:

- Nation Hearth/Common Room health;
- Open Road participation and average enabled duration;
- percentage of users exhausting free allowance;
- Writ usage;
- report/block/spam burden;
- whether global chat is drowning out nation identity;
- whether the cap is so restrictive that social players disengage;
- realtime/moderation operational cost.

Tune the 4h/+4h defaults with evidence while preserving the design principle that cross-nation world chat remains **available but not permanently dominant**.

---

## 15. Definition of Success

By mature implementation:

- AUREVANE has at least one genuinely enjoyable thing to do when a player wants to stay in-world without combat;
- taverns/social hearths feel culturally specific and inhabited;
- Roadwright adds quiet habit-forming satisfaction and lore texture without becoming required progression;
- asynchronous communal play connects players without a leaderboard;
- realtime chat supports local, party, guild, direct and nation relationships cleanly;
- Nation Hearth feels like a real social home;
- Open Road allows chosen cross-nation mingling through a generous but bounded daily window;
- highly social players can extend that window through ordinary Crown economy, not real-money privilege;
- the system remains safe, moderated, scalable, responsive, and consistent with AUREVANE’s world rather than looking like a generic chat plugin.
