# AUREVANE — Phase 1 Character Foundation Implementation Tickets

**Authority:** `docs/GAME_MASTER_PLAN.md` remains primary. These tickets translate Phase 1 of `docs/ROADMAP.md` into independently verifiable work. `docs/PROGRESSION_RETENTION.md`, `docs/NATURAL_PACING.md`, `docs/OFFLINE_PROGRESSION.md`, `docs/PLAYER_MANUAL.md`, `docs/MEDIA_PIPELINE.md`, and permanent repository guidance remain authoritative where applicable.

**Release gate before the first Phase 1 implementation merge:** Phase 0 production-verification issue #20 must be closed by successfully deploying and verifying the current production shell. Phase 1 planning may merge while that external Vercel gate is unresolved, but gameplay implementation must not be merged over an unverified Phase 0 production checkpoint.

## P1.1 — Account Entry + Player Profile Boundary

**Purpose:** Turn the existing authentication foundation into the player-facing account/profile flow that later character systems can safely trust.

**Scope:** polished sign-in/sign-up/account-entry surface using the existing Supabase Auth boundary; server-created player profile record/read model; authenticated game-shell route conventions; safe no-character versus character-present routing state; sign-out integration; server-authoritative account identity and private profile access.

**Affected modules:** `packages/game-core`, `packages/db`, `packages/validation`, `apps/web`, Supabase migrations, player-help content where applicable.

**Approach:** Authentication proves identity; server-side authorization controls private profile access. Do not expose service credentials. Do not create a second auth system. Reuse the F0.2 session-refresh/client boundaries and F0.3 structured server errors. The account profile is not the public character identity and should not duplicate character-facing game data.

**Automated tests:** migration/constraint tests; browser-role/RLS or server-only access tests as appropriate; auth-boundary tests; profile creation/read tests; unauthenticated redirect/rejection tests; sign-in/sign-out browser smoke coverage.

**Acceptance criteria:** a player can create/authenticate an account in a non-production environment, reach the authenticated AUREVANE shell, receive exactly one durable player profile, sign out safely, and cannot read another account's private profile by changing request data.

**Manual verification:** create a fresh staging/local account, authenticate, refresh/reconnect, sign out, and confirm the no-character state is stable and spoiler-safe.

**Visual / audio / media:** use the Phase 0 design system and central audio runtime. Create traceable art/audio requests only for genuine account-entry needs; do not use random login artwork or autoplay audio.

**Documentation impact:** add/update Account & Security basics, sign-in/sign-out help, and relevant troubleshooting copy. No Owner/Staff operations workflow is introduced.

**Dependencies:** F0.4. First Phase 1 implementation merge remains blocked by open production-verification issue #20.

## P1.2 — Character Domain Rules + Creation Contract

**Purpose:** Define one authoritative, testable character-creation model before persistence and UI multiply the rules.

**Scope:** character identity/creation types and validation; normalized public character name policy; body/presentation choice model; pronouns; official portrait reference; starter appearance reference; the four core attributes `Might`, `Finesse`, `Intellect`, `Resolve`; a small configurable starting-attribute budget; minimal structured Foundation Discipline choice metadata required by creation; level-1 initial state; progression-cycle metadata shape; creation command/result contracts.

**Affected modules:** `packages/game-core`, `packages/validation`, minimal `packages/content` starter metadata if required, tests.

**Approach:** Keep pure character rules free of React, Supabase, and browser APIs. Use one schema/source for creation validation. Foundation Discipline metadata at this stage is identity/onboarding content only: do not implement Discipline Mastery, Arts, Traits, Reactions, Movement Arts, Legacy Disciplines, Confluences, or Soulmarks before their roadmap phases. Exact starting values are configuration, not scattered UI constants.

**Automated tests:** valid/invalid identity cases; Unicode/normalization and reserved-name cases; attribute-budget invariants; Foundation Discipline reference validation; deterministic initial-state construction; no permanent build-trap validation.

**Acceptance criteria:** one pure server-compatible function can accept validated creation intent and produce a complete valid level-1 character seed state without database/UI dependencies; invalid or manipulated creation input is rejected consistently.

**Manual verification:** inspect representative creation payloads and confirm the rules are understandable, fast to complete, and do not require knowledge of future systems.

**Visual / audio / media:** no runtime media integration in this pure-domain ticket. Record any newly discovered portrait/appearance/creation-scene needs through the Media Pipeline for P1.3.

**Documentation impact:** define canonical player-facing wording for the four attributes, Foundation Discipline selection, pronouns/presentation, portrait and starter appearance. Keep later Soulmark/Legacy concepts contextual rather than exposing unavailable choices.

**Dependencies:** P1.1.

## P1.3 — Authoritative Character Creation + Persistence Experience

**Purpose:** Deliver the first major Phase 1 player milestone: an authenticated player can create and permanently own a valid AUREVANE character.

**Scope:** character persistence migration; account ownership and slot index; case-insensitive normalized public-name uniqueness/availability handling; authoritative creation transaction; idempotent/retry-safe create command; server-owned `created_at`, `cycle_started_at`, and activity/accrual-safe timestamp foundations; initial attributes/level/XP/Foundation Discipline reference; protected create/read API/service path; polished responsive character-creation flow; success/reconnect/resume behavior.

**Affected modules:** `packages/game-core`, `packages/db`, `packages/validation`, `packages/realtime`, `apps/web`, Supabase migrations, `content/art-requests`, `content/audio-requests`, player-help content.

**Approach:** The browser submits creation intent; the server reconstructs/validates the authoritative seed and persists it atomically. Use a slot index with one enabled base slot rather than a schema that can never support future additional character slots; do not implement premium slots or alternate-character commerce. Character state remains private/server-authoritative. Do not trust browser timestamps, level, XP, attribute totals, or Foundation Discipline metadata. Repeated submissions must not create duplicate characters.

**Automated tests:** migration constraints; normalized-name uniqueness race; cross-account ownership denial; duplicate/retry/idempotency tests; manipulated attribute/level/timestamp payload rejection; create/read service tests; real authenticated end-to-end browser/API creation test; responsive and keyboard browser smoke coverage.

**Acceptance criteria:** a new authenticated player can complete character creation in a few minutes, persist exactly one valid base-slot character, refresh/reconnect and receive the same character, while duplicate requests and cross-account tampering cannot duplicate or steal state.

**Manual verification:** create a staging/local character at desktop and mobile widths; refresh/reconnect; attempt a duplicate submit; confirm identity, chosen presentation, portrait fallback/asset, Foundation Discipline and attributes persist correctly.

**Visual / audio / media:** create traceable requests for required starter portraits, character-creation key art/background treatment, and restrained creation UI/confirmation audio where useful. Integrate only approved assets; requested assets use the existing graceful fallback system.

**Documentation impact:** add the Character Creation practical guide/contextual help, name rules, attribute-allocation explanation, Foundation Discipline choice explanation, and what can/cannot be changed later where the implementation establishes that rule.

**Dependencies:** P1.2.

## P1.4 — Character Profile + Derived Stat Framework

**Purpose:** Make the permanent character readable and useful while establishing the derived-stat calculation boundary required by later combat/equipment/Discipline systems.

**Scope:** authoritative character profile read model; profile presentation; four-attribute display/help; derived-stat calculation module and versioned/configurable base coefficients; initial derived values required by the Master Plan such as HP/MP, physical/mystic power, defenses, accuracy/evasion, critical chance, initiative, movement/jump and status resistance where the current rules can define them coherently; source/provenance shape for later modifiers; responsive profile UI and media hooks.

**Affected modules:** `packages/game-core`, `packages/db`, `packages/validation`, `packages/ui`, `apps/web`, configuration/content data, tests, player-help content.

**Approach:** Derived values are calculated from one authoritative rule source, not stored as independently editable browser values. Keep the calculation pipeline small: current Phase 1 inputs are attributes/level and explicit configuration; later Discipline/equipment/effect modifiers may plug into the same typed contribution boundary without implementing those systems now. Mark balance coefficients as tunable configuration rather than pretending first-pass numbers are permanent production balance.

**Automated tests:** deterministic derived-stat calculations; boundary/min/max attribute scenarios; config validation; profile authorization/read-model tests; browser accessibility/responsive tests; no duplicate formula definitions across server/UI.

**Acceptance criteria:** an authenticated player can view a polished profile that accurately reflects the authoritative character identity, four attributes and derived stats; changing browser state cannot alter authoritative values; one tested calculation source owns each formula.

**Manual verification:** compare displayed values against server-calculated values for several test characters and confirm help text makes the four attributes/derived stats understandable without exposing late-game spoilers.

**Visual / audio / media:** use approved/requested portrait presentation through the media registry; create additional profile-frame/icon requests only where the screen genuinely needs them. Profile ambience/music is not introduced solely for this ticket.

**Documentation impact:** add/update Character, Attributes and Derived Stats manual sections plus contextual stat definitions. Exact displayed formulas should come from authoritative structured configuration where practical to reduce documentation drift.

**Dependencies:** P1.3.

## P1.5 — Level 1–100 XP Progression + Telemetry Foundation

**Purpose:** Establish server-authoritative Character XP/level progression that can later be fed by combat, quests, world content and Wayfarer's Practice without hard-coded pacing traps.

**Scope:** versioned/configurable Level 1–100 XP thresholds and level cap boundary; pure XP-to-level resolver; authoritative XP grant/apply service; transactional/idempotent progression changes; source/provenance records; initial progression telemetry; profile XP/level progress presentation; level-up event/invalidation contract; configurable development baseline rather than final six-month balance.

**Affected modules:** `packages/game-core`, `packages/db`, `packages/validation`, `packages/realtime`, `apps/web`, Supabase migrations/configuration, analytics/telemetry boundary, media requests if needed.

**Approach:** No browser endpoint may simply choose its own XP award. Authoritative game services will eventually call the progression service with validated reward provenance. Keep a single versioned XP curve/config source and make the level cap tunable for future Master Panel control. Do not implement visible day gates, Horizon countdowns, Rekindling, Discipline Mastery, or repetitive-grind rewards here. Track milestone speed so later natural-pacing tuning can use evidence.

**Automated tests:** full threshold/level resolution; exact-boundary and cap behavior; invalid/negative/overflow award rejection; duplicate-idempotency tests; concurrent XP awards; version/config validation; telemetry provenance tests; profile progress rendering.

**Acceptance criteria:** server code can atomically award Character XP from an authorized source, advance through multiple levels correctly up to the configured cap, record provenance/telemetry, and refresh the character profile; client manipulation cannot self-award progression.

**Manual verification:** use a non-production controlled test path/fixture to exercise single-level, multi-level and cap scenarios and confirm profile progression/level-up feedback matches authoritative results.

**Visual / audio / media:** use restrained level-progress feedback consistent with the existing shell. Create a traceable level-up UI/SFX request if a dedicated cue is warranted; do not improvise a production effect.

**Documentation impact:** add/update Level vs Discipline Mastery explanation, Character XP basics, level-cap wording, and spoiler-safe progression guidance. Explain meaningful goals rather than promising arbitrary calendar unlocks.

**Dependencies:** P1.4.

## P1.6 — Wayfarer's Practice: Balanced Practice Foundation

**Purpose:** Add the approved absence-protection/return loop once normal Character XP exists, without turning AUREVANE into an idle timer game.

**Scope:** authoritative `last_active_at`/practice accrual anchors and claimed-through boundary; versioned Wayfarer's Practice configuration; Balanced Practice only; deterministic server-side elapsed-time/accrual calculator; modest direct Character XP report; initial Rested Momentum balance/representation; generated Training Report provenance; idempotent atomic claim command; basic Training Report UI; telemetry; realtime/profile refresh.

**Affected modules:** `packages/game-core`, `packages/db`, `packages/validation`, `packages/realtime`, `apps/web`, Supabase migrations/configuration, analytics/telemetry, media/audio requests where useful.

**Approach:** Calculate lazily from server-controlled timestamps; do not run per-character background timers/jobs. Browser time/timezone is display-only. Balanced Practice is the only Phase 1 focus. Do not add Discipline Focus/Mastery accrual before Phase 3. A claim may grant XP and Rested Momentum but cannot complete story, quests, bosses, Expeditions, PvP rank, Confluences, Soulmarks, Horizon trials, Archive discoveries, rare equipment, event participation, economy output or Rekindling eligibility. Claims atomically advance the claimed-through boundary and are safe under retries/reconnects.

**Automated tests:** deterministic accrual-window tests; minimum-offline threshold; multi-day cap/reduced-rate configuration; client-clock irrelevance; focus/config version validation; duplicate/concurrent claim tests; XP application integration; Rested Momentum accounting; activity-anchor behavior; no prohibited reward types; Training Report browser tests; telemetry tests.

**Acceptance criteria:** after a meaningful absence, a character can receive one server-generated Training Report, claim it exactly once, gain the configured bounded Character XP/Rested Momentum, and see authoritative profile/progression refresh; short reconnect loops, client-clock changes and duplicate submissions cannot farm rewards.

**Manual verification:** in local/staging controlled test time, exercise short absence, normal absence, capped absence, duplicate claim and refresh/reconnect scenarios; confirm the return experience is satisfying but restrained and never blocks active play.

**Visual / audio / media:** build a compact, readable Training Report using the Phase 0 design system. Create traceable return/claim audio or illustration requests only if they materially improve the experience; no flashing countdowns, destructive urgency or random reward-box styling.

**Documentation impact:** add the Wayfarer's Practice/Training Report guide, Balanced Practice, Rested Momentum explanation, caps/guardrails, what offline training can and cannot accomplish, and troubleshooting for missing/already-claimed reports.

**Dependencies:** P1.5.

## Explicit Phase 1 Deferrals

The following are deliberately **not** pulled forward merely because later systems touch character state:

- tactical combat and combat AI — Phase 2;
- Discipline Mastery, Arts, Traits, Reactions, Movement Arts, Legacy Disciplines, Confluences and Soulmarks — Phase 3;
- the full initial playable Discipline set — Phase 4;
- world/quest/story/events/Archive/World Pulse — Phase 5;
- full inventory/equipment gameplay — later roadmap work unless a concrete Phase 1 dependency proves a minimal schema is required;
- Discipline Focus/offline Mastery — Phase 3 extension of Wayfarer's Practice;
- Horizon/world milestone gates, visible or hidden endgame qualification, Rekindling and Veteran Edge — later phases as specified;
- premium character slots/commerce — monetization phase;
- full Owner/Master Panel character controls — progressive operations/Phase 13, with only minimum safe operational boundaries added alongside systems when actually required.

## Phase 1 Milestones

```text
P1.1  Account can enter the authenticated game shell
  ↓
P1.2  Character creation rules are authoritative and testable
  ↓
P1.3  FIRST MAJOR PLAYER MILESTONE — create + persist a permanent character
  ↓
P1.4  Character has a useful profile, attributes and derived stats
  ↓
P1.5  Character can progress through authoritative Level/XP foundations
  ↓
P1.6  Returning after time away produces a safe Training Report
```

## Phase 1 Gate

Phase 1 is complete when an authenticated player can create and persist a valid permanent character through a polished responsive flow; view the authoritative character profile, four attributes and derived stats; progress through a configurable server-authoritative Level/XP model with telemetry; and claim a bounded idempotent Wayfarer's Practice Training Report calculated from server time.

The browser must not be able to determine or forge valuable character state, timestamps, XP, level, offline elapsed time or offline rewards. The data model must preserve future progression-cycle/Rekindling and additional-character-slot extension points without implementing those future systems early. Phase 0–1 automated/database/browser/security regressions must remain green.
