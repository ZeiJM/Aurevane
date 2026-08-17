# AUREVANE — Public Rules Roadmap Integration

**Status:** Binding extension of `docs/ROADMAP.md` and `docs/ROADMAP_PUBLIC_INFORMATION.md` for the permanent public `/rules` surface, fair-play policy, versioned rule publication, moderation linkage, acknowledgement, and Master Panel operations.

**Authority:** `docs/GAME_MASTER_PLAN.md` remains primary. `docs/PUBLIC_RULES.md` defines the Rules product. `docs/PUBLIC_NEWS_AND_MANUAL.md` defines the sibling public information surfaces. `docs/MASTER_PANEL.md` defines staff operations.

**Direction approved:** 2026-08-16.

The roadmap principle is:

> **Rules join News and Manual as permanent public infrastructure early, then grow with the systems that create new conduct and fair-play risks.**

---

## 1. Permanent Public Information Trio

Once P1.7 lands, AUREVANE should maintain three canonical public routes:

```text
/news
/manual
/rules
```

They remain reachable:

- before account creation;
- before sign-in;
- when account services are unavailable;
- after sign-in;
- on phone, laptop, and desktop.

Public navigation should expose:

```text
NEWS
MANUAL
RULES
PLAY / SIGN IN
```

after login replacing the final action with an appropriate return-to-game path while preserving News/Manual/Rules access.

---

## 2. Phase 1 Extension — Amend P1.7

P1.7 **Public News + Adventurer's Guide Foundation** expands into the complete first public-information foundation.

The ticket remains after P1.6 and before Phase 2. This is not a new parallel Phase 1 implementation ticket.

### Add required route

```text
/rules
```

### Add public-shell behavior

- pre-login navigation exposes News, Manual, Rules, Play/Sign In;
- signed-in users may deliberately visit `/rules` without forced `/game` redirect;
- Rules read access does not depend on player-profile/character/account-readiness state;
- same responsive/accessibility requirements as News/Manual.

### Initial Rules scope

Implement the smallest truthful public Rules experience:

- Rules landing/page with stable section anchors or article routes;
- clear category/navigation structure appropriate to initial rule volume;
- visible last-updated/effective-version treatment;
- plain-language summaries;
- initial fair-play/conduct/account-security/staff-impersonation/exploit-reporting rules that correspond to actual released capabilities;
- no fake marketplace/PvP/guild policy before those systems exist;
- no security-sensitive anti-cheat detail;
- no public mutation path;
- safe validated/source-controlled content at current scale.

### P1.7 acceptance gate addition

An anonymous visitor can load `/rules`, understand the current fair-play/conduct expectations, and navigate there from the same public shell that exposes News and Manual.

The page remains usable when account services are unavailable.

### P1.7 naming

The GitHub ticket/title may be updated to **Public News + Manual + Rules Foundation** or equivalent so the third permanent surface is not hidden from implementation planning.

---

## 3. Phase 2 — Combat / Exploit Clarity

As tactical combat arrives:

- Rules gain any fair-play language needed for deliberate combat exploit abuse;
- Manual remains the source for legitimate combat mechanics;
- Rules should not prohibit ordinary clever use of intended mechanics merely because a strategy is strong;
- severe reproducible exploit reporting gets a clear private path before external cohorts grow;
- do not publish anti-cheat/detection implementation details.

PvE combat bugs should be distinguishable from intentional abuse.

---

## 4. Phase 3–4 — Buildcraft and Early Content Scale

As Disciplines, Confluences, Soulmarks, equipment, loadouts, and more player-supplied identity arrive:

- expand user-name/profile/media conduct rules only for features that actually exist;
- clarify deliberate build/loadout exploit abuse where necessary;
- material rule changes produce News impact;
- Manual and Rules link rather than duplicate mechanics;
- public search/deep links should keep policy easy to find.

No heavy moderation platform is required yet unless actual testing volume justifies it.

---

## 5. Phase 5 — First Rules Publishing Operations

Phase 5 already introduces the first real Master Panel public communications and live-world operations slice.

Add Rules operations to that same publishing architecture rather than creating a separate CMS.

### Public Communications MVP adds

- Rules draft/edit;
- anonymous preview;
- publish/schedule/supersede/archive;
- published/effective dates;
- linked News notice;
- linked Manual references;
- basic version history;
- audit records;
- restricted Rules publication permission.

Suggested permissions:

```text
rules.view
rules.edit
rules.publish
rules.schedule
```

Material policy publication should not be granted automatically to ordinary content/event staff.

### Phase 5 gate addition

Authorized staff can change a public behavioral/fair-play rule through a versioned, audited operation without editing application source code.

---

## 6. Phase 6–7 — Party / Co-op / Expeditions

As multiplayer cooperation grows, Rules can add policies actually needed for:

- disruptive party behavior where moderation requires explicit boundaries;
- griefing/intentional sabotage definitions only where necessary and enforceable;
- coordinated exploit abuse;
- Expedition leaderboard integrity;
- account/multi-box rules if co-op makes them materially relevant.

Avoid over-regulating normal tactical disagreement or imperfect play.

---

## 7. Phase 8 — PvP / Competitive Integrity

This is a major Rules expansion point.

Before meaningful ranked/tournament play, explicitly publish policies for:

- win trading;
- rating manipulation;
- intentional queue collusion;
- tournament/match fixing;
- disconnect/timer abuse;
- multi-account/smurf behavior if restricted;
- exploit use in competitive play;
- prohibited information/coordination abuse only where a clear policy is justified.

The Manual owns queue mechanics. Rules own integrity/conduct.

Material competitive policy changes require News communication.

If a Rules acknowledgement system exists by then, especially consequential competitive changes may require acknowledgement before ranked participation rather than globally blocking the account.

---

## 8. Phase 9 — Roster / Build Scale

No new general Rules engine is required merely because more Disciplines exist.

Continue to:

- distinguish balance/meta strength from exploit abuse;
- avoid banning strategies simply because they are unpopular;
- use balance patches for intended-but-overpowered mechanics and sanctions only for actual rule violations;
- keep Rules references stable across renamed content.

---

## 9. Phase 10 — Social World / Moderation

Phase 10 is the largest conduct/moderation expansion.

Before mature friends/messages/guild/social systems open broadly, Rules should cover as needed:

- harassment;
- threats;
- hate/targeted abuse;
- sexual harassment;
- doxxing/private information;
- spam/flooding;
- malicious impersonation;
- abusive names/profile/guild content;
- report abuse;
- sanction evasion;
- staff impersonation.

Moderation tooling should link reports/cases/sanctions to stable Rule IDs/versions.

Add:

- player-facing report categories aligned to Rules;
- sanction reason templates referencing the violated rule;
- appeal workflow guidance;
- internal permission separation between moderation and Rules publication.

---

## 10. Phase 11 — Economy / Trading Rules

Before player economy systems can create real abuse opportunities, deliberately approve and publish policy for relevant areas such as:

- scams/deception;
- real-money trading;
- account/item sales;
- market manipulation where prohibited;
- duplicated/stolen goods;
- chargeback/fraud abuse;
- multi-account resource funneling if restricted.

Exact policy must match the actual economy architecture and monetization model.

Do not copy generic MMO rules that cannot be operationally enforced.

---

## 11. Phase 12 — Nations / Large-Group Integrity

Nation/campaign systems may require additional policy for:

- coordinated exploit use;
- ranking/campaign manipulation;
- malicious impersonation of staff/official events;
- nation/guild leadership abuse only where the game provides an enforceable rule boundary.

Political rivalry/role-play should not be mistaken for harassment simply because players compete intensely; conduct policy should focus on actual prohibited behavior.

---

## 12. Phase 13 — Mature Rules & Moderation Operations

The complete Master Panel should mature Rules into an operational system.

Add as justified:

- granular Rules permissions;
- rule version/diff history;
- effective-date scheduling;
- acknowledgement policies;
- linked News publication requirements;
- dependency preview;
- historical rule lookup from moderation cases;
- rule-linked report/sanction analytics;
- emergency unpublish/supersede controls;
- localization architecture if localization is real;
- audit and rollback/supersession tooling;
- owner review for high-impact policy changes.

### Acknowledgement

Support versioned acknowledgement for genuinely material changes.

Prefer narrow affected-system gates when possible:

```text
new ranked integrity policy
→ acknowledge before Ranked

new trading/RMT policy
→ acknowledge before Trading/Marketplace
```

rather than blocking all play unnecessarily.

Legal consent remains separate.

---

## 13. Phase 14 — Editorial / Accessibility Polish

Polish `/rules` as part of the public editorial experience:

- refined typography;
- category/icon system;
- concise rule cards;
- examples/callouts;
- mobile navigation;
- search;
- readable effective/change history;
- Luminous Adventure consistency without trivializing enforcement;
- accessibility review.

Do not turn sanctions/rule-breaking into collectible or gamified presentation.

---

## 14. Phase 15 — Security / Abuse Hardening

Hardening should test:

- public access under auth outages;
- draft/scheduled rule leakage;
- staff publication permissions;
- rule-version race conditions;
- acknowledgement consistency;
- sanction-to-rule historical references;
- XSS/rich-content safety;
- public search leakage;
- anti-cheat detail exposure;
- staff/report privacy;
- moderation abuse/privilege escalation;
- high-traffic access after major incidents/changes;
- accessibility and stable deep links.

---

## 15. Ticket Impact Rule

Once Rules exists, player-facing tickets should consider:

```text
RULES IMPACT
- none
- existing rule link/update
- new conduct/integrity rule
- acknowledgement impact

NEWS IMPACT
- rule-change notice required?

MANUAL IMPACT
- mechanic documentation changed?
```

Do not require a Rules update for ordinary internal refactors or balance tuning that does not change permitted behavior.

---

## 16. Success Condition

The public-information model becomes:

```text
NEWS   → What changed / what is happening?
MANUAL → How does the game work?
RULES  → What behavior is allowed?
```

All three are readable before signup, stay available after login, and eventually share the same safe versioned Master Panel publication infrastructure without becoming duplicate systems.
