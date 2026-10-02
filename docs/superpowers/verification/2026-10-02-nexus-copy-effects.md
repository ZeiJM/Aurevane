# Nexus copy, spacing and inherent effect consistency

Owner-requested 2026-10-02. Base: current Main `0d14912667e8d2270dcb9a0d23af8ff91c1cc6f3`. Branch: `agent/nexus-copy-spacing-20261002`.

## Scope

- Remove only the Nexus subtitle “Master disciplines. Refine techniques. Prepare for what comes.” The Items subtitle and section selector remain.
- Add `0.65rem` after the Nexus technique/support summary, before Manage Techniques. Artwork sizes remain unchanged.
- Remove the duplicate Legal range prose from authored Skill details and the historical battle fallback. Preserve the standard Range field, area dimensions, recipient rules and all engine constraints. Reconcile the minimum report contract with this Owner refinement.
- Share effect label/magnitude/duration markup between authored Skills and inherent actions. Support Actions and basic Move/Attack use canonical formula-based summaries and labeled explanation bullets in Nexus and shared PvP/PvE command information. Guard's independent two-turn cooldown and Recovery's shared two-turn cooldown are preserved.

## Owner additions during implementation

- Desktop shared combatant cards place the avatar left and center HP/MP to its right, with two rows of ten active-effect icons below. Terrain samples and text are slightly larger. The existing board/preview/cockpit geometry stays fixed.
- The shared battlefield stylesheet animates only masked torch light and rising ember artwork, aligned with the original scenic image's center/cover crop. Pointer input is unaffected. Reduced-motion disables both animations. This is equally applicable to PvP, PvE and spectators, desktop and mobile; it adds no timers, canvas loop, client combat controller or moving layout.
- Both loadout routes use the same green active selector as management buttons.
- Discipline commits use the build version from the synchronized context and direct authoritative PUT, omitting the redundant POST preview. In-flight locking, selected-character identity, stale-version rejection, idempotency, attunement, allocation and uncertain-receipt recovery remain intact. Change Impact is derived from the prior committed context and returned authoritative context.
- AI Sparring accepts 0–2 AI allies and 1–(5 − allies) enemies, with at most six initial participants and two snapshot teams. Validation applies at HTTP and service boundaries. Each Recruit is uniquely spawned and has a scenario profile. Persistence role describes user control, not faction; AI allies use the non-user-owned role while their snapshot team is `players`.
- Each AI request completes one actor turn, allowing the existing automatic handoff to resolve consecutive allies/enemies without exhausting a shared multi-actor budget. Damage notices name all actual recipients. Surrender immediately concedes the friendly practice team; rematch retains original counts and excludes summons. Guided Fundamentals and Mastery Trial remain duels.

No migration or content activation. Existing action costs, targeting, AP, progression/rewards and PvP mechanics remain unchanged.

## Verification

- Four existing Skill-report tests failed specifically on the removed duplicate Legal range text before the implementation. After the shared helper changes, 53 focused tests across five files passed, retaining all ten field/order and mechanical-value assertions.
- The mounted Support preview reproduced zero rich-effect markers and zero explanation bullets before the fix. It now has one summary and one labeled bullet. Existing Move/Attack explanation tests failed before their missing descriptions were added; subsequent focused checks passed.
- Full local `TURBO_TELEMETRY_DISABLED=1 NEXT_TELEMETRY_DISABLED=1 pnpm check` passed after final application edits: formatting, lint, typecheck, 3,229 Vitest tests, seven Node checks and Production builds. A first check stopped on a formatting-only issue; it was corrected before the successful full rerun.
- Actual `CharacterArsenalShell`, header and production CSS mounted in Chromium: four desktop sizes (1280×720, 1366×768, 1536×614, 1920×1080), three Support choices and empty/equipped Skill rows — 24 states. Each had at least 10.39 px between summary and button, no panel/document vertical overflow, no runtime errors and unchanged art size. The removed subtitle was absent.
- Actual Techniques component: all three Support choices at those four desktop sizes plus 390×844 — 15 states. Each retained ten fields, exactly one explanation bullet, no Legal range prose, cream effect labels, gold magnitude and teal duration. Desktop preview/dialog dimensions remained identical when focus changed, with zero overflow.
- Existing inherent battle parameter tests exercise the real shared command and parameter rendering while replacing only the popup shell. They assert all ten fields, canonical Guard magnitude/duration/cooldown, Recovery resource percentages/shared cooldown and rich effect/bullet structure for Move, Attack and all Support choices.

Mounted local fixtures replace Next routing/image adapters; authenticated route/persistence and complete browser coverage are delegated to existing exact-head CI. Production private gameplay is not claimed by public smoke checks.

Independent review found no critical/important issues. Its minor Basic Attack wording concern was corrected: the explanation now states the physical-damage formula without claiming a mitigation path. The full local quality gate was rerun on that final source.

## Expanded verification

- Validation tests failed on valid multi-participant requests before the new contract; service tests failed on missing team counts and accepted over-capacity commands before wiring. All 36 valid combinations across three arenas now pass, plus forged counts/non-Sparring rejection.
- AI chain regressions cover 0/5, 1/4 and 2/3 setups with durable adjacent combatants; they count actual committed damage events and compare source/recipient teams, plus one-turn handoff, five AI actors and return to the local player. Surrender tests cover all three allied counts; rematch-count tests cover each valid setup and exclude a live summon.
- Mounted production Hall component, six desktop sizes (including 1024×576 and 1024×768) plus 390×844: linked dropdown clamping/options, mode-only visibility and actual POST payload pass. All desktop bodies/documents have zero vertical overflow; arena and participant controls are 44 px, with readable fonts. Mobile retains natural page scrolling.
- Mounted real discipline component: direct PUT starts without waiting on synthetic network latency; sequential swaps use returned versions; controls lock during held commits; rejection and committed-but-lost response both reread with GET and reconcile committed selection. No page errors.
- Mounted production PvP, PvE and spectator rails at 1280×720, 1366×768, 1536×614, 1920×1080 and 1024×576: avatars remain square and ≥32 px; HP/MP center beside them within 1 px; all twenty effects and six terrain types fit without scroll/overflow. Equal cards retain name/facing header and effects bottom. Board rectangles match baseline exactly. Shared key/log space gains 32.7 px at 1366×768 and 159.4 px at 1920×1080; shortest/narrow desktop reserves a 102 px card minimum for visible portraits and still fits six key types.
- Fire animation checks pass 18 mode/viewport/motion states: PvP, PvE and spectators × 1366×768, 1920×1080 and 390×844 × normal/reduced motion. Normal torch opacity changes, reduced-motion animation names are none, both layers ignore pointer input, board rectangles remain identical and no page errors occur.
- Existing authenticated Secondary flow now asserts direct PUT commits, and a new authenticated Sparring browser proof checks clamping, persisted six-person teams, map identity colors, whole-team surrender and same-composition rematch. It is included in Browser smoke's desktop/mobile focused set.
- Expanded review identified rematch/surrender/damage-summary integration gaps; these were corrected and covered before publication. Final independent review found no remaining correctness blockers. The final full `pnpm check` passed formatting, lint, typecheck, 3,251 Vitest tests, seven Node checks and Production builds. Two hook-dependency lint findings during expanded verification were corrected before the successful full rerun.

## Exact-head CI corrections

- Candidate `f9653c964c488499de7dfb8b53339ed48c457380` passed nine workflows but failed Browser smoke on the newly added persisted team-count proof. Its actual POST route directly creates the service and had omitted both validated counts despite the legacy handler forwarding them. The route now forwards both; three actual-route regressions failed before the correction, and five route tests plus the 35 service/AI/surrender tests pass after it. Capacity and passive-training exclusion remain enforced. Independent route/entry-point review found no further omissions.
- UI review caught 40 px participant selects and short-desktop Hall clipping at 1024×576. Participant controls now retain the existing 44 px standard; the narrow/short desktop composition reduces only gaps and fieldset padding. All content remains, including the fully visible Enter Battle button. The expanded seven-viewport mounted Hall probe passes with zero desktop body/document overflow and readable controls.

- Candidate `f7eaf33c396574fa29f719376a74cccfc17090db` resolved the Hall and route failures. Its UI review then caught two existing forecast assertions: on a narrow two-column rail, the enlarged terrain artwork was taller than wide. The final composition allocates wider thumbnails on normal desktops and compact one-column terrain entries at ≤1100 px. Fifteen mounted PvP/PvE/spectator cases retain larger artwork area and text than baseline, longer-than-tall samples, six terrain types without scroll, all twenty effect icons, and exactly unchanged map rectangles.
- Final corrected full `pnpm check` passed formatting, lint, typecheck, 3,256 Vitest tests, seven Node checks and Production builds.

## Integration and release

Exact-head CI, merge, deployment and live verification pending. Keep Git deployments locked until the authorized verified release; restore the lock after readiness.
