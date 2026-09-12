# AUREVANE — Roadmap Integration: Discipline Atlas & Mastery

**Status:** Owner-approved roadmap extension activated during Phase 4.

**Activated:** 2026-09-12.

**Authority:** `docs/GAME_MASTER_PLAN.md` remains highest product authority. `docs/GAME_MASTER_PLAN_DISCIPLINE_ATLAS_MASTERY_ADDENDUM.md` defines the approved Atlas/acquisition/Mastery contract. `docs/GAME_MASTER_PLAN_BUILD_SYSTEM_ADDENDUM.md` and `docs/GAME_MASTER_PLAN_TECHNIQUE_REPEAT_USE_ADDENDUM.md` continue to define the active build grammar. `docs/PHASE_4_TICKETS.md` remains the main Phase-4 execution ledger for the wider roster/content release.

This roadmap extension was deliberately started during Phase 4 because the live roster and Mastery foundations now exist. It does **not** pull every world quest, secret initiation, Rekindling story route or all 36 combat libraries into Phase 4.

The purpose of the current work is to make the architecture truthful now so later content can plug into it without rewriting Mastery, Profile or release access.

---

# 1. Approved product direction

AUREVANE will present the 36 target Disciplines through a **Discipline Atlas** rather than a flat all-classes list.

The Atlas supports:

- six Foundation creation choices;
- mastery-dependent branches during the first journey;
- selected Rekindling-I traditions;
- Starcaller at Rekindling II;
- Spellwright at Rekindling III;
- veiled/secret discovery paths;
- release requirements separate from content publication;
- earned Mastery separate from temporary testing entitlement;
- qualitative class-budget communication so later classes do not imply vertical obsolescence.

The current approved roster map lives in `docs/GAME_MASTER_PLAN_DISCIPLINE_ATLAS_MASTERY_ADDENDUM.md` and the typed runtime-facing identity catalog in `packages/game-core/src/character/discipline-atlas.ts`.

---

# 2. Phase-4 implementation boundary

Phase 4 should implement the **system skeleton and truthful player presentation** for the Atlas while preserving the existing playable roster scope.

## Implement now

- typed 36-Discipline identity-level Atlas definitions;
- composable unlock-rule evaluator capable of Mastery, Rekindling, flags, ALL/ANY/COUNT-OF logic;
- publication state distinct from character eligibility;
- disclosure state capable of veiled/secret content;
- earned Mastery projection distinct from testing access;
- Profile integration showing Mastery and the Atlas cleanly;
- public Manual chapter explaining the complete system, class-budget philosophy and long-term map;
- tests proving testing access cannot publish unfinished classes or satisfy release prerequisites;
- server-authoritative testing policy for all **published** Disciplines;
- migration away from testing-as-fake-Mastery;
- final-release normalization requirement documented now.

## Do not pull into Phase 4 merely because the Atlas references them

- final world mentors for all 36 Disciplines;
- all secret initiation quests;
- final Loreeater monster-capture collection implementation;
- final Gravebinder/Oracle/Sanguinist discovery chains;
- full Unwritten Reach Starcaller sequence;
- Grand Formula Spellwright endgame encounter;
- complete current-cycle/historical-Mastery split across Rekindling;
- Passive Training Discipline Focus;
- final Mastery Rites for all 36;
- unpublished Disciplines' combat libraries;
- final Master Panel Atlas editor;
- final acquisition-enablement migration.

These remain staged future content/system work.

---

# 3. Current Phase-4 playable boundary

The currently published roster contains seventeen Disciplines (PR #455, 2026-09-12):

```text
FOUNDATIONS
Vanguard
Farstrider
Shadehand
Ironfist
Aetherist
Lifebinder

ADVANCED / SPECIALIST
Bastion
Ravager
Edgedancer
Wildwarden
Runeblade
Dawnshield
Cinderweaver
Frostweaver
Stormsinger
Tidecaller
Chronist
```

These have the current Phase-4 playable libraries, Essences and Resonance coverage. Chronist retains its Aetherist Adept + Rekindling I normal release gate; testing access remains separate. The Profile Atlas is inside the Discipline Management popup.

The remaining Atlas identities are design-level planned nodes until their actual content is separately published.

Testing access must not turn a planned node into a runtime class.

---

# 4. Phase-4 Mastery state

The live Mastery foundation already provides:

- per-character Discipline Mastery progress;
- stages at 100 / 300 / 600 / 1,000 XP;
- Standard/High Mastery Trial reward path;
- immutable battle-origin/build checks;
- committed Technique-use evidence;
- idempotent one-claim-per-battle authority;
- 4/2/2 advanced Technique learning milestones;
- all-eight Technique demonstration requirement before ordinary 1,000-XP Master completion;
- prerequisite checks for published advanced Primary acquisition.

This is retained.

The mature design adds later stage challenges and Discipline-specific Mastery Rites. Phase 4 does not pretend those world-authored rites are complete merely because the data model names them.

---

# 5. Correct testing architecture

## Problem discovered during this extension

The earlier Phase-4 convenience system represented testing access by inserting `support` rows into `character_discipline_masteries` using source:

```text
active-player-discipline-testing:v1
```

When the later Phase-4 Mastery migration connected mastery facts to numerical progress, those support facts were backfilled as **1,000 XP / Master**.

That was acceptable for immediate roster testing before earned Mastery mattered, but it is not safe as the long-term acquisition architecture.

Simply removing the testing trigger at release would leave test characters apparently legitimately Mastered.

## Corrected direction

Testing entitlement becomes a separate server-owned policy:

```text
EARNED MASTERY
    separate from
RELEASE ELIGIBILITY
    separate from
EFFECTIVE TESTING ACCESS
```

During Phase 4:

```text
published Discipline + testing_open = selectable
```

while:

```text
release eligibility = real authored prerequisite evaluation
```

The UI can therefore say:

```text
TESTING ACCESS
Release path still requires Vanguard Adept
```

instead of falsely saying:

```text
MASTERED
```

---

# 6. Database migration strategy

The additive Phase-4 migration for this extension must:

1. introduce a server-only Discipline unlock policy state with `testing_open`;
2. retire the old testing-Mastery grant triggers/functions;
3. remove only the exact known old testing support Mastery facts;
4. reset numerical Mastery that was populated solely because of those exact testing facts;
5. preserve legitimate gameplay/system/owner/migration Mastery provenance;
6. preserve legitimate Technique demonstration history;
7. compute earned stage independently of testing entitlement;
8. compute release eligibility independently of testing entitlement;
9. compute effective selection eligibility as release eligibility OR published testing access;
10. keep existing catalog/server APIs compatible where possible;
11. add a richer server-only Atlas progress projection for Profile;
12. continue to grant full active published Technique libraries while testing is open without recording earned Mastery.

Applied migrations are never rewritten.

---

# 7. Testing Skill entitlement caveat

Existing development characters may already possess durable Skill-unlock rows that were provisioned while all published Disciplines were effectively mastered for testing.

The current extension does not destroy those rows during Phase 4 because doing so would defeat the Owner's explicit requirement that all published classes remain freely testable until development completes.

New testing-provisioned Skill facts should use explicit support provenance where possible.

**Final release must include a dedicated normalization migration**, not merely `testing_open = false`.

That migration must remove/deactivate testing-only learned Techniques above legitimate earned stage while preserving real learned facts and then repair any now-illegal active loadout safely.

This is a mandatory release gate.

---

# 8. Profile experience

Profile remains the character's build-management home.

The existing Discipline Management → Mastery & unlocks surface becomes the player-facing Atlas workspace rather than adding a disconnected top-level app.

It should show:

- total Atlas scope;
- currently published scope;
- character Rekindling history;
- per-published-Discipline earned Mastery XP/stage;
- Technique demonstration count;
- visible acquisition path;
- unmet eventual release requirements even while testing access is open;
- Mastery Rite identity where authored;
- Atlas bands;
- planned/open nodes;
- opaque veiled nodes when interactive secrecy applies;
- qualitative class-budget profile;
- explicit testing-access notice during development.

The Profile Atlas should remain collapsible/secondary to the immediate active build so ordinary loadout changes stay concise.

---

# 9. Public Manual experience

The public Manual receives a dedicated illustrated chapter rather than forcing the complete Atlas into generic prose blocks.

The chapter should explain cleanly:

- what a Discipline is;
- why the Atlas is not an upgrade tree;
- the 36 target identities;
- Foundation / First Journey / R1 / R2 / R3 bands;
- Mastery stages and current numerical thresholds;
- eight learned Techniques versus four selected;
- current 4/2/2 advanced learning cadence;
- Technique demonstrations;
- mature stage challenges and Mastery Rites;
- Secondary eligibility;
- pure Essence versus mixed Resonance;
- class-budget / anti-obsolescence philosophy;
- breadth versus specialist depth;
- Rekindling memory/Echo route direction;
- Passive Training ceiling direction;
- secret Discipline philosophy without publishing exact hidden puzzle solutions;
- current Phase-4 testing override and published-vs-planned distinction.

The copy should read like a shipped game manual, not an engineering specification.

---

# 10. Browser secrecy requirements

Secret gameplay must not depend on CSS hiding.

For unrevealed secret **planned** nodes, the normal Profile Atlas projection should not transmit:

- canonical secret class ID;
- canonical secret name;
- exact hidden requirement flags;
- exact hidden initiation steps;
- qualitative mechanics that function as an unintended spoiler where avoidable.

It may transmit an opaque placeholder such as:

```text
Veiled Discipline
Discovery required
```

The public Manual can intentionally acknowledge broad roster identities at Owner discretion while withholding exact secret solutions. Public marketing knowledge and a character's in-world reveal state are separate concerns.

---

# 11. Class-budget acceptance

Every Discipline receives an identity profile for design/readability axes such as:

```text
Reliability
Flexibility
Setup
Rule Access
Execution
```

These are not additive point totals and not star-tier rankings.

Human balance acceptance must verify:

- Foundations remain viable in endgame PvE/PvP;
- late classes do not receive automatic coefficient superiority;
- unusual rule access has readable costs/counterplay;
- advanced setup requirements produce meaningful upside rather than busywork;
- low-complexity classes do not become statistically inferior by default;
- Resonance/Essence options keep older Disciplines relevant as the roster expands.

Do not “balance” the Atlas by making every profile sum to the same arbitrary number. The profile is explanatory, while actual combat budgets live in authored effects/stats and telemetry.

---

# 12. Future implementation sequence

## Phase 4 — active now

- [x] Establish 36-node typed Atlas identity map.
- [x] Define Mastery/Rekindling/secret unlock-rule algebra.
- [x] Separate publication from acquisition eligibility.
- [x] Separate testing entitlement from earned Mastery in the new migration design.
- [x] Add Profile Atlas projection/UI.
- [x] Add public illustrated Manual chapter.
- [x] Document final-release normalization requirement.
- [x] Pass repository quality/type/unit/build gates on exact branch head. (PR #455 release evidence in `PHASE_4_TICKETS.md`.)
- [x] Pass database migration/security validation. (PR #455 release evidence in `PHASE_4_TICKETS.md`.)
- [ ] Complete explicit phone/desktop Atlas browser validation. PR #455 records authenticated Profile/Atlas and earned-Mastery evidence; this continuation adds a dedicated responsive Atlas check.
- [ ] Complete explicit public phone/desktop Manual Atlas browser validation in the current continuation. Prior generic browser passes are not a dedicated Atlas layout check.
- [x] Review exact diff against concurrent Phase-4 work and merge only after main reconciliation. (PR #455 release evidence in `PHASE_4_TICKETS.md`.)

The checked gates above describe the completed Atlas release; the explicit responsive Atlas/Manual checks remain tracked separately. The newly authorized gameplay-tag/terrain continuation has its own fresh verification and release gate in `docs/superpowers/plans/2026-09-12-phase4-combat-completeness.md`; prior results do not validate later code.

## Later roster publication work

For every newly published Discipline:

- add versioned Primary profile;
- author eight Techniques;
- author pure Essence;
- author all required Resonance pair coverage;
- add AI legality/weights;
- add PvE/PvP tuning hooks;
- add media identity/hooks;
- add Mastery/Atlas content metadata;
- add acquisition/reveal content where the world system exists;
- run pair-coverage and missing-content validation;
- ensure testing entitlement grants the new **published** node during development.

## Mature world acquisition

When exploration/quests/Archive/Rekindling world systems support it:

- replace abstract flag placeholders with stable authored quest/achievement IDs;
- implement visible mentor routes for ordinary advanced Disciplines;
- implement secret reveal chains;
- implement stage principle/adaptation challenges;
- implement Discipline-specific Mastery Rites;
- implement current-cycle versus historical Mastery/Echo routes where approved;
- add Master Panel authoring/operations surfaces.

## Final acquisition-enablement release

- close `testing_open`;
- normalize testing-only Skill facts;
- validate every character's earned stage;
- validate Primary/Secondary legality;
- safely repair illegal active build/loadout state;
- prove ordinary player progression can reach every non-secret visible requirement;
- prove repeatable discovery routes exist for secret Disciplines;
- run pacing simulations against first-journey and R1/R2/R3 timing;
- verify no release-required combat power depends on one-time FOMO;
- release only after explicit Owner approval.

---

# 13. Automated validation requirements

At minimum, tests should prove:

- Atlas contains exactly 36 unique identities;
- exactly six Foundations;
- current published count matches actual Phase-4 content;
- testing access never makes `publication=planned` selectable;
- testing access never changes `releaseEligible`;
- R1/R2/R3 conditions evaluate separately from Mastery;
- ALL/ANY/COUNT-OF logic is deterministic;
- Spellwright can accept any approved three specialist magical Masters rather than one hardcoded trio;
- veiled API projection does not leak secret planned IDs/names/flags;
- earned Mastery reads remain accurate while testing is open;
- old explicit testing support Mastery facts are removed without deleting legitimate Mastery;
- Secondary availability remains open for published test classes;
- full published libraries remain testable;
- when a test fixture disables testing, normal prerequisite and 4/2/2 provisioning behavior returns.

---

# 14. Human validation requirements

Automation cannot prove the Atlas is enjoyable.

Human testing should eventually answer:

- Does the Profile Atlas make the next goal obvious without feeling like homework?
- Are ordinary visible prerequisites understandable without an external wiki?
- Do veiled nodes feel intriguing rather than arbitrary?
- Do Mastery Trials test actual class identity rather than merely damage output?
- Are players willing to remain Vanguard/Farstrider/etc. after unlocking later options?
- Do advanced classes feel expressive rather than simply more complicated?
- Does Rekindling introduce new learning questions instead of repeating the first journey?
- Does the public Manual help players appreciate the system without spoiling discovery?

The Owner's current requirement that all published classes remain freely available for testing is specifically useful for answering these questions before release gates are activated.

---

# 15. Completion definition

This Phase-4 extension is considered implemented when:

1. the authoritative design/roadmap documents are committed;
2. the typed Atlas and evaluator pass tests;
3. testing entitlement and earned Mastery are separated authoritatively;
4. Profile shows the Atlas and real earned progress without mislabelling testing access;
5. Manual contains the full polished system explanation;
6. responsive/browser and database gates pass;
7. the implementation is reconciled against current main;
8. the exact verified tree is merged/released through the normal repository process.

It does **not** require all 36 combat libraries or all secret world quests to be authored in Phase 4.
