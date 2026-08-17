# AUREVANE — Public Rules, Fair Play & Conduct

**Status:** Authoritative public-rules specification subordinate only to `docs/GAME_MASTER_PLAN.md` and complementary to `docs/PUBLIC_NEWS_AND_MANUAL.md`, `docs/PLAYER_MANUAL.md`, `docs/MASTER_PANEL.md`, `docs/TECH_ARCHITECTURE.md`, `docs/MONETIZATION.md`, and `docs/ROADMAP_PUBLIC_RULES.md`.

**Direction approved:** 2026-08-16.

AUREVANE requires a third permanent public information surface alongside News and the Manual:

- **News** — what changed or is happening;
- **Manual** — how released game systems work;
- **Rules** — what behavior, account use, fair-play conduct, and competitive/social activity are allowed.

The canonical public route is:

```text
/rules
```

The central rule is:

> **A player should be able to understand AUREVANE's behavioral and fair-play expectations before creating an account, and staff should be able to enforce those expectations against stable, versioned rules rather than vague unwritten policy.**

The Rules page is a player-facing game policy surface. It is **not** a substitute for future legal Terms of Service, Privacy Policy, cookie disclosures, or other legally required notices.

---

## 1. Permanent Public Access

`/rules` must remain available:

- before account creation;
- before sign-in;
- when account services are unavailable;
- after sign-in;
- on phone, laptop, and desktop;
- from sensible global/footer navigation.

Once the public information foundation exists, the public shell should expose at least:

```text
NEWS
MANUAL
RULES
PLAY / SIGN IN
```

Authenticated players may still deliberately visit `/rules` without being forced back into `/game`.

Do not create a separate contradictory in-game Rules copy.

---

## 2. Separation From Manual and News

### Manual answers

> How does the game work?

Examples: Movement, Jump, Weight/Load, PvP timing, trading mechanics, progression, buildcraft.

### Rules answers

> What am I allowed to do with those systems and with other players?

Examples: exploit abuse, automation, harassment, account sharing policy, win trading, staff impersonation, real-money trading policy, report abuse.

### News answers

> What changed, and when does a new rule/policy take effect?

A material Rules change should normally have an accompanying News notice.

Rules should link to Manual sections when a behavioral rule depends on understanding a mechanic, rather than restating the whole mechanic.

---

## 3. Rules Page Experience

The Rules page should be clear, attractive, and easy to scan — not a 40,000-word wall of legal prose.

A mature `/rules` experience may contain:

```text
RULES HERO / SHORT PROMISE
QUICK PRINCIPLES
SEARCH
CATEGORY NAVIGATION
RULE CARDS / ARTICLES
EXAMPLES
ENFORCEMENT / APPEALS
RECENT RULE CHANGES
LAST UPDATED / EFFECTIVE VERSION
```

Visual direction should align with AUREVANE's Luminous Adventure/public editorial identity while prioritizing readability and seriousness.

Use restrained icons/illustrations where useful. Do not gamify sanctions or make enforcement feel theatrical.

---

## 4. Recommended Rule Categories

The mature Rules system should be able to cover categories such as:

### Fair Play & Game Integrity

- cheating;
- unauthorized clients/tools;
- botting/automation;
- exploit abuse;
- deliberately duplicating items/currency/rewards;
- manipulating authoritative state;
- packet/request tampering;
- abusing reconnect/idempotency flaws;
- knowingly using severe bugs for unfair advantage.

### Accounts & Access

- account ownership/security expectations;
- account sharing policy;
- multiple-account policy;
- simultaneous/multi-box behavior policy;
- compromised accounts;
- credential trading/selling;
- staff never asking for passwords/secret credentials.

The exact multiple-account/account-sharing policy must be deliberately approved before enforcement; do not invent it through code defaults.

### Community Conduct

- harassment;
- threats;
- hate/targeted abuse;
- sexual harassment;
- doxxing/private-information abuse;
- spam/flooding;
- malicious impersonation;
- disruptive behavior in social systems.

### Names, Profiles & User-Submitted Media

- prohibited names;
- impersonation;
- abusive imagery/text;
- copyright/provenance requirements where uploads are allowed;
- evasion of filters/moderation;
- profile/guild naming expectations.

### PvP & Competitive Integrity

- win trading;
- rating manipulation;
- intentional queue collusion;
- tournament collusion;
- match fixing;
- exploiting disconnect/timer rules;
- smurf/multi-account policy where applicable;
- stream-sniping or information abuse only if/when a specific competitive policy is needed.

### Economy, Trading & Real-Money Activity

- scam/deception policy;
- real-money trading;
- account/item sales;
- chargeback/fraud abuse;
- marketplace manipulation;
- laundering duplicated/stolen goods;
- prohibited external exchange where applicable.

Exact economy policies should be authored when those systems exist rather than publishing speculative restrictions years early.

### Events / Guilds / Nations

- event-specific integrity;
- guild/nation abuse;
- coordinated exploit use;
- leaderboard manipulation;
- impersonating official events/staff.

### Staff / Moderation

- staff impersonation;
- false reports;
- report-channel abuse;
- obstruction of moderation;
- expectations around appeals;
- staff authority is bound by permissions/audit and does not grant arbitrary player-facing power.

---

## 5. Rule Object / Stable Identity

Each enforceable rule should have stable identity independent of its display title.

Conceptually:

```text
rule_id
slug
category
title
short_summary
body_blocks
examples_allowed
examples_prohibited
severity_guidance_internal_or_public_subset
public_visibility
status
version
effective_at
published_at
last_updated_at
supersedes_version
related_manual_refs
related_news_refs
acknowledgement_policy
```

Do not expose internal moderation notes, staff identities, investigation methods, anti-cheat thresholds, abuse-detection logic, or security-sensitive details in the public read model.

---

## 6. Versioning and Effective Dates

Rules are versioned public policy.

Material changes should preserve historical context.

Recommended lifecycle:

```text
DRAFT
→ REVIEW / PREVIEW
→ SCHEDULED (optional)
→ PUBLISHED / EFFECTIVE
→ SUPERSEDED
→ ARCHIVED
```

A rule change should distinguish:

- **published_at** — when players can read it;
- **effective_at** — when enforcement under the new version begins.

This permits advance notice for consequential changes.

Do not silently rewrite a major rule and pretend the prior wording never existed.

Minor spelling/accessibility fixes need not create dramatic public change notices, though version history may still retain them internally.

---

## 7. Enforcement Must Reference the Rule Version

Moderation/sanction records should eventually be able to cite:

```text
RULE_ID
RULE_VERSION
ALLEGED / CONFIRMED EVENT TIME
EVIDENCE / INTERNAL CASE REFS
ACTION TAKEN
STAFF ACTOR
APPEAL STATE
```

This matters because policy can change.

If an action happened under version 3, staff should be able to determine what version 3 actually said rather than applying version 7 retroactively by accident.

The public player-facing sanction message may summarize the violated rule without exposing sensitive evidence or anti-abuse methods.

---

## 8. Exploit Policy Philosophy

AUREVANE should distinguish accidental discovery from intentional abuse.

A useful public principle is:

> **Finding a bug is not misconduct. Deliberately exploiting a serious bug for unfair advantage, duplication, progression, ranking, economy gain, or disruption may be.**

Players should have a clear private reporting path for severe exploits.

Do not require players to publicly disclose reproducible exploit steps in News/community spaces.

Emergency mitigation may disable a feature before the full investigation is complete.

---

## 9. Automation / Botting

Because AUREVANE includes tactical combat, persistent progression, economy, PvP, and social systems, automation policy must eventually be explicit.

The Rules page should distinguish approved accessibility/quality-of-life behavior from prohibited gameplay automation.

Examples of questions the final policy must answer:

- Are input remappers allowed?
- Are macros allowed, and if so under what limits?
- Are unattended actions prohibited?
- Can external tools read public game data?
- What constitutes botting?
- What accessibility tooling is explicitly permitted?

Do not let anti-bot policy accidentally prohibit ordinary accessibility technology.

Exact rules should be approved before enforcement and remain consistent with actual technical detection capabilities.

---

## 10. Multiple Accounts / Account Sharing

These policies can materially affect economy, PvP, social play, and abuse prevention.

Therefore AUREVANE must publish explicit policy before those behaviors become meaningful.

Do not rely on an unwritten assumption such as:

> “Everyone knows alt accounts are forbidden.”

or:

> “Anything is allowed because the UI technically permits it.”

When approved, the policy should address relevant distinctions such as:

- owning multiple accounts;
- simultaneous control;
- funneling resources;
- self-match/collusion;
- bypassing limits/sanctions;
- account sharing;
- household/shared-device false positives;
- testing/staff accounts.

The exact production policy remains an owner/design decision until deliberately set.

---

## 11. Competitive Rules

`/rules` owns conduct/integrity policy, while the Manual owns queue mechanics.

For example:

Manual:

> Ranked 1v1 uses these timing/disconnect/rating rules.

Rules:

> Deliberately coordinating losses to manipulate rating is prohibited.

This separation keeps competitive policy understandable.

Material competitive integrity updates should link between News, Rules, and the relevant Manual page.

---

## 12. Economy Rules

When player trading/marketplace/crafting/economy systems arrive, the Rules page should clearly state behavioral boundaries that cannot be inferred from mechanics alone.

Potential areas include:

- fraud/scams;
- exploit-derived goods;
- external real-money exchange;
- account selling;
- market manipulation/coordination where prohibited;
- chargeback abuse;
- staff grants/compensation not being tradable when configured that way.

Do not publish economy rules before the actual system design determines what behavior needs regulation.

---

## 13. Reports, Sanctions, and Appeals

The Rules page should explain at a high level:

- how to report conduct;
- what information helps;
- that false/malicious report abuse may itself violate rules;
- common sanction types once implemented;
- whether temporary restrictions, suspensions, bans, chat restrictions, competitive restrictions, rollback/removal of illegitimate gains, or other actions exist;
- how appeals work;
- that severe security/fraud cases may have limited public detail.

Do not promise a specific appeal response time unless operations can reliably meet it.

Moderation should be consistent, auditable, and permission-bound.

---

## 14. Rule Severity and Proportionality

Not every violation deserves the same response.

The system should support proportional enforcement based on factors such as:

- severity;
- intent;
- harm;
- repetition;
- prior sanctions;
- scale of illegitimate gain;
- evasion/obstruction;
- safety/security risk.

The public page can explain the principle without publishing exploit-friendly thresholds such as exact anti-cheat trigger numbers.

---

## 15. Acknowledgement of Material Changes

Most Rules edits should not interrupt play.

For genuinely material changes, a published rule version may declare an acknowledgement requirement.

Possible behavior:

- show a concise change summary after sign-in;
- link to the full public rule;
- require acknowledgement before selected affected systems (for example trading or ranked PvP) rather than unnecessarily blocking the entire account when a narrower gate is sufficient;
- record rule version + acknowledgement timestamp server-side.

Do not use acknowledgement dialogs for typo changes or routine wording cleanups.

Legal consent requirements, if any, remain a separate legal/compliance concern.

---

## 16. News Integration

Material rule changes should normally generate or require a News communication impact:

```text
NO PUBLIC NOTICE REQUIRED
RULES CHANGE NOTE REQUIRED
NEWS POST REQUIRED
NEWS + RULES ACKNOWLEDGEMENT REQUIRED
```

Examples of material changes:

- changing account-sharing policy;
- changing bot/macro policy;
- changing real-money trading policy;
- major PvP integrity rule;
- new moderation/reporting system;
- significant sanction/appeal process change.

The Rules page is the canonical current policy; News is the historical announcement/context.

---

## 17. Manual Integration

Rules may link to relevant Manual mechanics.

Examples:

- exploit rule links to the affected system guide without exposing exploit steps;
- win-trading rule links to Ranked PvP overview;
- marketplace conduct links to Trading/Marketplace guide;
- Weight exploit examples can link to Load mechanics if needed.

Do not duplicate changing numeric mechanics into Rules text.

---

## 18. Master Panel / Publishing

Once Phase 5 public communications operations exist, authorized staff should be able to manage Rules through controlled publishing.

Capabilities should grow toward:

- create/edit rule drafts;
- categorize;
- preview anonymous presentation;
- set public/effective dates;
- link Manual/News;
- publish/schedule/supersede/archive;
- set acknowledgement requirement where authorized;
- review version diff/history;
- emergency unpublish only under strict permissions;
- audit every privileged change.

Suggested granular permissions may include:

```text
rules.view
rules.edit
rules.publish
rules.schedule
rules.acknowledgement.manage
```

High-impact policy publication should be limited to Owner/appropriate trusted operations roles rather than every content editor.

---

## 19. Moderation / Support Integration

When moderation tooling arrives, a case/sanction should be able to select the relevant stable Rule ID/version.

The system can then support:

- rule-linked report categories;
- consistent sanction reasons;
- appeal context;
- analytics by rule category;
- historical policy lookup;
- staff review of changed policy.

Do not let ordinary moderators edit the rules they are enforcing unless they separately hold Rules publication permissions.

---

## 20. Public Safety / Security Boundary

The public Rules surface must not reveal:

- anti-cheat implementation details;
- detection thresholds;
- hidden moderation flags;
- private evidence;
- reporter identity;
- staff investigation notes;
- private account data;
- secret staff identities;
- unreleased security mitigations;
- exploitable reproduction instructions.

Transparency means clear expectations and process, not publishing the abuse-prevention playbook.

---

## 21. Accessibility and Readability

Rules should be understandable without specialist legal knowledge.

Use:

- plain-language summaries;
- clear headings;
- examples where ambiguity is likely;
- stable anchors/deep links;
- accessible contrast/focus;
- phone-friendly layouts;
- screen-reader-compatible structure;
- dates in clear human-readable forms;
- explicit status/effective-date treatment.

Where a legal document later uses more formal language, Rules may link to it without becoming equally opaque.

---

## 22. Initial Rules Foundation

The first `/rules` release should be intentionally small and truthful.

Before mature social/PvP/economy systems exist, initial public rules can focus on:

- respectful conduct;
- fair play / no cheating or exploit abuse;
- account-security basics;
- staff impersonation;
- report severe bugs/exploits privately;
- user-submitted names/media rules only to the extent those features exist;
- current account behavior policies that have actually been approved.

Do not publish pages full of fake rules for marketplaces, guild wars, or tournaments that do not exist yet.

The page grows with the product.

---

## 23. Success Condition

The Rules system succeeds when:

- a prospective player can read expectations before signing up;
- current players can easily verify policy;
- staff enforcement cites stable rule identity/version;
- material changes are announced rather than silently rewritten;
- the page remains readable and attractive;
- policy does not leak security-sensitive details;
- Rules, Manual, and News reinforce one another without duplicating responsibilities.
