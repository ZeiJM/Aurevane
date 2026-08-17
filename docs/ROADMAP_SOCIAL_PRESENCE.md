# AUREVANE — Social Presence Roadmap Integration

**Status:** Binding extension of `docs/ROADMAP.md` for authenticated world presence, the persistent online counter, Adventurers Online directory, social actions, privacy, and operational scaling.

**Authority:** `docs/GAME_MASTER_PLAN.md` remains primary. `docs/SOCIAL_PRESENCE.md` defines the feature model. `docs/TECH_ARCHITECTURE.md` defines realtime/server-authority constraints. `docs/RESPONSIVE_EXPERIENCE_STANDARD.md` defines overlay/responsive behavior. `docs/MASTER_PANEL.md` defines privileged operations.

**Direction approved:** 2026-08-16.

The roadmap principle is:

> **Make AUREVANE visibly inhabited as soon as the shared world is meaningful, then let the same presence surface grow into parties, PvP, guilds, friends, moderation, and operations without rebuilding it.**

---

## 1. Cross-Cutting UI Placement Rule

Once implemented, the authenticated game shell includes a compact **Adventurers Online** trigger in the persistent utility cluster beside the existing Sound/Audio control and later compatible utility controls.

Conceptually:

```text
◇ 128 Online   🔊   ⚙
```

At compact widths:

```text
◇ 128   🔊
```

The trigger opens a non-reflowing roster overlay/drawer/sheet.

It must not permanently consume the primary world/battle canvas.

The current authenticated shell already places Audio in the global masthead utility position; the future presence trigger should evolve that utility cluster rather than introducing a competing global navigation area.

---

## 2. Phase 1 — No Presence Implementation

Current Phase 1 remains focused on the Character Foundation, Wayfarer's Practice, and the planned public News/Manual bridge.

Do **not** add fake online counters or premature realtime presence merely because the final placement is now known.

Phase 1 architectural guardrails:

- authenticated shell should remain capable of adding compact adjacent utilities;
- do not make Audio the only control that can occupy its masthead utility region;
- public character identity remains distinct from private account identity;
- no email/account identifiers may leak into future presence views;
- responsive overlay rules remain reusable.

There is no Phase 1 acceptance dependency on social presence.

---

## 3. Phase 2 — Combat Does Not Depend on Global Presence

Tactical Combat Core should not be delayed by a social directory.

However:

- battle/full-screen shell composition should preserve a compact global utility strategy;
- opening nonessential global utilities must not resize the tactical board;
- PvP-ready architecture must not assume global presence metadata is safe competitive information;
- realtime transport abstractions should remain reusable rather than combat owning the only realtime path.

No global online roster is required for PV-1 combat proof.

---

## 4. Phase 5 — First World Presence Foundation

**Primary implementation milestone.**

The first meaningful Adventurers Online implementation should arrive with the Living World / Story / Live Operations foundation, because this is the point where AUREVANE begins to behave like an inhabited shared world rather than only an account/character/combat prototype.

### Required Phase 5 scope

Implement:

- authenticated character-presence service/lease foundation;
- unique-character deduplication across tabs/reconnects;
- public-visible presence classification;
- exact **visible online character counter**;
- compact counter trigger beside Sound/Audio in the authenticated utility cluster;
- responsive **Adventurers Online** panel;
- All Online browse;
- character-name search;
- safe page/cursor loading rather than downloading the full world population;
- public character portrait/name/level or equivalent safe identity fields;
- coarse region/activity state only where safe and implemented;
- Online / Away / Busy representation as supported;
- initial `Appear Offline` privacy boundary if public listing is production-facing;
- server-authoritative visibility filtering;
- no account/email/private-state leakage;
- count/list consistency semantics;
- realtime invalidation/coalesced refresh sufficient to make the panel feel live;
- initial telemetry/performance diagnostics;
- phone/laptop/desktop acceptance.

### Phase 5 UX requirement

The presence surface should reinforce the same Luminous Adventure direction as the evolving world shell.

It must look like a living adventurer registry, not a database inspector.

### Phase 5 explicit deferrals

Do not pull forward merely for the roster:

- full friend system;
- direct messages;
- guild administration;
- PvP challenges before PvP;
- complete moderation suite;
- exact public location tracking;
- giant presence analytics platform;
- public pre-login player directory.

### Phase 5 gate

A player in the shared world can glance at the authenticated utility cluster, see a trustworthy online count, open the roster, find publicly visible online characters, and close it without disrupting the current world experience.

The list remains safe, responsive, and scalable enough for early external population tests.

---

## 5. Phase 6 — Party & Co-op Integration

When parties arrive, presence becomes a practical group-formation surface.

Add as appropriate:

- **Available for Party** state;
- party-status marker;
- party invite action from presence rows;
- invitation eligibility and rate limiting;
- party-member priority/filter;
- same-region/Nearby filter at a safe abstraction level;
- current party members' richer operational connection state where needed by the party UI;
- party-finder relationship without replacing the dedicated party finder;
- reconnect behavior that does not flicker players incorrectly between online/offline.

### Co-op guardrail

Adventurers Online should make it easier to find people, but progression-critical co-op cannot depend on manually cold-inviting arbitrary names from the global roster.

A proper party finder remains required for scalable co-op formation.

### Phase 6 product metric

Track whether presence-originated invitations actually produce parties rather than merely generating invite spam.

---

## 6. Phase 7 — Expedition Context

As Expeditions mature:

- allow an availability state such as `Looking for Expedition` only if useful and not redundant with party finder;
- public activity may say `In an Expedition` without exposing room/seed/rare-route information;
- party members may receive richer Expedition session presence through the authoritative party/Expedition systems;
- presence should help surface social opportunity during Expedition events without becoming an exploit for rare content tracking.

Do not expose exact active Expedition branches or hidden encounters globally.

---

## 7. Phase 8 — PvP Integration

When PvP exists, add carefully scoped competitive presence features.

Potential additions:

- **Open to Challenge** availability state;
- direct Challenge action from eligible roster/profile rows;
- challenge eligibility checks;
- challenge spam/rate-limit controls;
- `In Battle` public activity where safe;
- optional PvP rank/title presentation only if already public on the social profile.

### Competitive privacy rule

Do not expose through global presence:

- ranked queue search timing;
- queued opponent pool;
- exact opponent;
- private loadout;
- hidden current Discipline/Soulmark tech if profile rules do not already publish it;
- tactical location/state that aids stream-sniping or targeted queue manipulation.

### Ranked population analytics

Public presence count is **not** the matchmaking concurrency metric.

PV-5 uses actual queue/match telemetry rather than assuming `players online` means `players available for ranked 2v2`.

---

## 8. Phase 9 — Scale With the Content Population

As the Discipline roster and player population expand:

- load-test the directory with realistic concurrent populations;
- confirm list/search queries remain bounded;
- avoid loading build/Discipline details per row unless the public profile contract requires them;
- preserve stable presence identity independent of whichever Discipline/build a player currently equips;
- ensure saved-loadout switching cannot leak private competitive choices through presence deltas.

No Mantle/Soulmark/Confluence data should become publicly exposed merely because presence exists.

---

## 9. Phase 10 — Mature Social World Integration

This is the major social expansion of Adventurers Online.

Add:

- Friends filter and relationship markers;
- Guild filter and public guild identity;
- Add Friend action;
- Message action;
- guild-invite action where the acting player has permission;
- mature privacy settings;
- Do Not Disturb / invite policies;
- block integration;
- report integration;
- social-profile preview/navigation;
- last-seen handling only where privacy policy approves it;
- richer public titles/prestige identity where already part of profile design;
- social/moderation telemetry;
- anti-harassment protections.

### Phase 10 design goal

The panel should evolve from:

> **“Who is online?”**

into:

> **“Who is online, who do I know, and what appropriate social action can I take?”**

without becoming the entire social system inside one drawer.

Friends, messages, guilds, profiles, and moderation retain their own full surfaces.

---

## 10. Phase 11 — Economy Safety

Marketplace/economy systems should not turn presence into a real-time target list for harassment or manipulative solicitation.

Do not add unsolicited `Trade` spam directly from global presence unless a future explicit trade-request system has appropriate controls.

If trade/social commerce interactions are ever added:

- respect block/privacy;
- enforce rate limits;
- use authoritative trade services;
- do not expose inventory holdings through presence.

---

## 11. Phase 12 — Nation Presence

When nations exist, useful optional additions may include:

- Nation filter;
- public nation allegiance marker where game rules make it public;
- nation-event availability states;
- broad aggregate online population by nation in appropriate nation UI.

Do not automatically expose enemy-nation exact player locations during warfare.

Presence cannot become free strategic reconnaissance.

---

## 12. Phase 13 — Master Panel Presence Operations

The complete Master Panel should gain a **Presence / Population** operational view integrated into Overview/System/Social tooling as appropriate.

Owner/authorized staff capabilities may include:

- true unique active-character count;
- publicly visible count;
- hidden/stealth count at authorized aggregate/detail levels;
- active authenticated session count;
- region/activity aggregate distribution;
- presence lease health;
- stale lease diagnostics;
- reconnect/churn telemetry;
- duplicate-session anomalies;
- party/matchmaking population context;
- account/character presence inspection for support;
- abuse/rate-limit diagnostics;
- feature flags/configuration for public presence behavior where warranted.

### Staff privacy/security

Privileged visibility of hidden presence must require explicit permissions.

Support/moderation inspection is audited where appropriate.

Do not expose raw authentication secrets, IP/session tokens, or provider credentials through the panel.

---

## 13. Phase 14 — Visual / Audio Polish

Polish the social-presence experience alongside the broader Luminous Adventure shell.

Potential work:

- final original presence/traveler icon;
- high-quality compact portrait treatment;
- guild/nation/prestige micro-badges;
- tasteful world/cartographic ornament;
- drawer/sheet transitions;
- subtle count-change animation;
- responsive density refinement;
- reduced-motion behavior;
- empty/error/reconnect state polish.

Do **not** add ordinary login/logout sounds for every global player event.

Presence should make the world feel alive without becoming noisy.

---

## 14. Phase 15 — Hardening

Before production scale, test and harden:

- presence spoofing;
- character-identity impersonation attempts;
- forged privacy flags;
- count inflation with tabs/sessions;
- stale-session cleanup;
- sudden disconnect/reconnect storms;
- Supabase/realtime transport interruptions where applicable;
- directory pagination/search under load;
- large online populations;
- blocked-user visibility;
- privacy-state leakage;
- invite/message/challenge spam;
- rate limiting;
- exact-location leakage;
- PvP queue/opponent leakage;
- staff stealth/privileged presence authorization;
- scraping/enumeration abuse;
- mobile overlay accessibility;
- keyboard/focus restoration;
- screen-reader labels and status semantics;
- degraded-mode behavior when presence is unavailable while the core game remains healthy.

### Failure-isolation rule

A presence-service outage must not make the whole game unavailable.

If the roster cannot load:

- show a restrained unavailable/reconnecting state;
- do not invent a zero count that implies nobody is online;
- preserve combat/world/account functionality where unaffected.

---

## 15. Validation / Product Questions

When the feature reaches real players, evaluate:

- Does the counter make the game feel more inhabited?
- Do players open the roster voluntarily?
- Can they find someone they recognize?
- Does party formation improve?
- Does the panel create spam/harassment?
- Do privacy controls feel understandable?
- Does it remain useful at both low and high population?
- Does the exact online count become demoralizing at very low population, and if so can the game improve social concentration rather than lying about the number?
- Does the UI remain elegant enough to sit beside Audio permanently?

Never fake population numbers to solve a low-population product problem.

If low concurrency creates poor social experience, solve the underlying population/activity concentration problem through scheduling, party finder, matchmaking, events, and acquisition—not false presence.

---

## 16. Ticket Integration Rule

When a future implementation ticket first touches authenticated global presence, it must read:

- `docs/GAME_MASTER_PLAN.md`;
- `docs/AI_DEVELOPMENT_QUALITY_MANDATE.md`;
- `docs/SOCIAL_PRESENCE.md`;
- `docs/ROADMAP_SOCIAL_PRESENCE.md`;
- `docs/TECH_ARCHITECTURE.md`;
- `docs/RESPONSIVE_EXPERIENCE_STANDARD.md`;
- applicable social/party/PvP/Master Panel docs;
- current `TASKS.md`.

The one-active-implementation-ticket rule remains unchanged.

Planning this feature does not authorize pulling it into the current Phase 1 implementation.

---

## 17. Final Roadmap Shape

```text
PHASE 1
Know where the utility will eventually live; do not implement it early
        ↓
PHASE 5
Online counter + Adventurers Online global directory
        ↓
PHASE 6
Party availability + invite integration
        ↓
PHASE 7
Expedition-safe activity context
        ↓
PHASE 8
Challenge/PvP presence integration
        ↓
PHASE 10
Friends + Guild + Messages + Privacy + Block/Report maturity
        ↓
PHASE 12
Nation-aware social context where safe
        ↓
PHASE 13
Owner/staff population diagnostics
        ↓
PHASE 14
Premium visual polish
        ↓
PHASE 15
Scale, privacy, abuse, reconnect, accessibility hardening
```

The feature is intentionally small in the shell and broad in consequence:

> **one compact number beside Sound should become a doorway into the fact that AUREVANE is a world full of other people.**
