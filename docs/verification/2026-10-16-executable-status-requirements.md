# Executable final-roster statuses and Requirements

Status: local implementation, combined review and repository gate complete for this bounded checkpoint. Task15/16 and combat release remain open. No catalogue activation, hosted write, merge or deployment.

The new suites execute exact proposed roster captures through the real command engine, JSON restore and stat-driven validation. Eight Requirement kinds have a type-exhaustive case map checked against the accepted coverage inventory. All24 authorable status identities are compared against the actual runtime catalogue, with Lowered Guard and Displaced explicitly tested through their system/historical boundaries. Every ordinary status case asserts its observable mechanic and expiration after at most16 actual no-input turn transitions. Supporting fixtures are Level1 mechanical isolates, not full equipped builds or AI playtests.

## Runtime defects found by the new evidence

1. Canonical Discipline/Essence participants did not apply Revealed's existing Skill AP multiplier. Participant costs now reuse `revealedSkillApCost`, including manual/Automatic modifier affordability and the owner availability projection. Intrinsic captures remain unchanged; Basic and Resonance costs are excluded by source kind. Native adapters retain their already-transformed prices. Actual proposed Forceful Strike costs90AP and pays to10; Essence Unbroken Strike quotes130AP/6MP and rejects only insufficientAP; Aimed Shot with Keen Focus quotes110AP/3MP and rejects only insufficientAP at valid range. Removing only Revealed makes the same command legal. Actual captured Basic Attack remains30AP and pays to70. Keen Focus availability quotes20AP/3MP and rejects15AP, agreeing with command pricing.
2. Sensory's internally generated positive purge omitted removal mode and was mistaken for historical Cleanse when its list included Covert, implicitly removing unrelated Suppress. Generated packets now use existing `removalMode: 'specified'`. A genuine Smoke Vial → damaging action → opposing Chain Spark → Scout's Mark sequence preserves Suppress, removes Covert and applies Revealed. Historical explicitly captured mode-absent removal packets retain their existing classification and settlement; those dedicated immediate/delayed restore tests remain included.
3. Walking reconstructed a temporary encounter without the encounter's stacking policy, rejecting valid application-modifier rows under Airborne/Haste. Reconstruction now carries that already-selected policy into its tactical battle. Real Breakfall permits and commits a two-height step where the paired ordinary fixture is blocked; real Haste commits the discounted walk and spends the quotedAP/oneMovement. Historical policy absence is retained.

These are bounded fixes to already-required mechanics, not new roster rules. The294-record proposal is unchanged: SHA256 `bdceab2a7547845d15f20654c1dc758a97d6c104d2dad76c906364e4504cdd9f`.

## Status witnesses

| Runtime status | Exact proposed primary witness/version | Observable result and counter |
| --- | --- | --- |
| guarded | vanguard.brace@5 | Less incoming actualHP loss; both fixtures retain the same12Barrier. |
| exposed | aetherist.arcane-field@7 | Greater actualHP loss on the same available follow-up. |
| covert | shadehand.smoke-vial@6 | Actual source visibility becomes team-only, remains private after Invisible breaks; removing Covert clears projection. |
| revealed | farstrider.scouts-mark@5 | Genuine Sensory purges Covert; active Revealed doubles qualifying Skill AP, with commit/affordability/Basic counters above. |
| wet | tidecaller.water-lance@8 | Actual initiative order changes and the next actor follows it; committed base initiative/current actor stay intact. |
| frozen | frostweaver.ice-lance@8 | Current Chilled prevents changed final facing, allows the existing facing, normal movement and a legal attack. |
| conductive | stormsinger.arc-spark@8 | Actual Static Drain hits harder, consumes the charge and reapplies exactly one authored charge. |
| inspired | vanguard.rally@6 | Greater outgoing actualHP loss versus removing only Inspired. |
| blindside | shadehand.backstab@6 | Side attack grants the status and improves actual follow-up damage; front attack grants none. |
| suppress | aetherist.chain-spark@7 | Suppressed enemy deals less actualHP damage than the same enemy without it. |
| hexed | lifebinder.vital-sever@6 | Current Healing Down reduces real Mending Light recovery100→75 and next-round Channel MP recovery2→1. |
| invisible | shadehand.smoke-vial@6 | Hostile direct target rejects; removing only Invisible makes it legal; own actual attack breaks Invisible. |
| airborne | ironfist.breakfall@6 | Jump0→3 enables and commits the otherwise blocked elevated step; committed base Jump is unchanged. |
| haste | chronist.haste@5 | Quote saves10AP, real walking pays the quote and oneMovement. |
| burn | cinderweaver.cinder-bolt@8 | Captured21damage/20% profile/5pp decay gives a real first tick4HP. |
| bleed | ravager.gash@6 | Captured21damage/15% profile gives a real first tick3HP. |
| poison | resonance.farstrider-wildwarden.linked-sequence@6 | Actual Scout's Mark enables the ranged source; captured19damage/15% profile gives a real first tick2HP. |
| slow | farstrider.pinning-shot@5 | Enemy walking quote costs10AP more, actual walking pays it and oneMovement. |
| root | chronist.time-lock@5 | Movement rejects while the paired ordinary walk is legal; facing and a real damaging Skill remain legal. |
| reckless | ravager.frenzy@5 | Greater outgoing and incoming actualHP damage. |
| fortified | bastion.fortress@5 | Lower outgoing and incoming actualHP damage. |
| challenged | bastion.challenge@5 | Current Taunt reduces damage against another ally, preserves damage against its source. |
| mark | farstrider.scouts-mark@5 | Owner's actual hit forecast gains15pp; another ally's hit forecast gains none. |
| warded | cinderweaver.ash-ward@5 | Actual Burn enables Ash Ward; attacks from a genuinely burning enemy hurt less; removing only that enemyBurn removes the Ward benefit. |

Paired removal is test isolation, not a claimed gameplay Cleanse/refund. Applied status state is restored and validated before comparisons; no accepted payload is rewritten to force admission.

Lowered Guard uses actual PvP and AI timeout primitives: first fully idle turn queues it, next global round activates it, and actual incoming damage increases. A successful command or manual End Turn does not queue it. This is no-input system evidence, not a real AI decision or timer/UI acceptance. Displaced remains historical-only: actual current Shield Bash pushes one tile without a Displaced status, extra turn, AP or Movement refund; authoring the historical marker rejects, while its historical serialized row restores without adding resources/turns.

## Requirement witnesses

| Kind | Exact proposed primary witness/version | Eligible and counter outcome |
| --- | --- | --- |
| all | vanguard.second-wind@6 | Actual incoming hit crosses the threshold and spends4MP for80HP/Guard/one usage;3MP rejects the reaction, no-input lowHP grants nothing. |
| any | shadehand.exploit-opening@6 | Genuine Mark or Exposed setup enables actual hit and50AP payment; neither setup rejects. |
| resource-state | lifebinder.mend@6 | Ally350/1000HP heals120 and pays35AP/6MP, leaving65AP/14MP;351rejects only the Requirement, defeated ally is not revived. |
| resource-threshold-crossing | vanguard.second-wind@6 | Actual hit329→301 does not trigger;328→300 does, as does327→299; starting290 does not cross anew. |
| status-presence | shadehand.exploit-opening@6 | Mark on another target does not qualify; Mark on the selected target does, with actual damage/payment. |
| prime-presence | resonance.aetherist-chronist.linked-sequence@5 | Actual free Rewind prime enables a damage change975→973enemyHP; no prime, cancelled prime or insufficientMP does not. |
| event | vanguard.second-wind@6 | Genuine incoming damage triggers; actual Gather HP payment crossing the same threshold does not emit the eligible damage event or trigger recovery. |
| action | farstrider.keen-focus@5 | Actual Farstrider Aimed Shot attachment changesHP/cost; attaching to an otherwise legal Aetherist Arc Bolt rejects the modifier Requirement without changing input. |

The existing `below` crossing operator is inclusive on the reached side: before>threshold and after<=threshold. Initial test expectation that exactly300would not trigger was wrong; runtime source and actual immutable damage frames settled it. Proposed Second Wind prose says “crosses below30%HP”; carry that wording mismatch into the required public/editor reader audit rather than silently changing the accepted manifest or existing operator here.

## Verification and limits

Completeness RED receipts: Requirement inventory `065653754715`, status inventory `070055370679`. Initial Requirement fixture run `065900823795` failed only the incorrect strict-boundary assumption; corrected existing semantics GREEN `065946801036`:29tests/2files. Runtime RED `070931211011` demonstrated canonical Revealed and both walking failures; `071340982279` additionally demonstrated real Sensory removing Suppress. Conductive's initial guessed companion ID and event field were corrected to the actual Static Drain record and `targetCombatantId`; no runtime rule was altered for that fixture. Revealed setup was corrected to break Invisible with Arc Bolt, leaving Forceful Strike off cooldown. The modifier counter was corrected to valid ranged geometry. Availability-price RED `071536747454` demonstrated10AP incorrectly projected instead of20AP.

Focused final GREEN `071729890495`:135tests/7files, including the new39status/Requirement tests, existing20effect cases, native Skill/AI Revealed pricing, CSR and historical removal restore tests. Core typecheck `071743006910` and scoped lint `071904430498` pass. Shared effect helpers were moved without changing the existing effect scenario bodies; existing representative roster outcomes remain unchanged.

Still open: four activation-combination completeness, distinct class/four-Skill/Essence/Resonance cycles, every individual294record's actual outcome, real AI and Level1/100 PvE/PvP balance/twelve-round standards; full Ground immutable publication materialization and current Owner-edit/timing/hostedCAS reconciliation; actual prose/orange/derivedTags/editor/shared reader audit; native browser/picker/touch/keyboard/layout/accessibility and inherited Atlas motion. No Level1 fixture or local repository test closes those gates. No live ETA is established by this checkpoint.

## Combined review and evidence correction

Single fresh reviewer `/root/status_requirement_review`, gpt-6-astra High, reviewed `883b63a7e2b16a7d77f44655b395d050208a38d2..d218bf2888e348c264dd7c0220da5d5e3f2e4a76`:0Critical/0Important/1Minor, bounded approval subject to the parent full gate. The reviewer independently ran the two new suites39/39 and traced pricing, capture, removal and walking dependencies without changing source. No second reviewer or rereview.

M1 reports Mend's remaining65AP/14MP as expenditure. Parent independently found the same factual error during review and regrades it Important for the verification handoff: an incorrect accepted price can propagate into the required balance/reader audit. The one scoped correction changes only the report to actual expenditure35AP/6MP, leaving65AP/14MP. Direct comparison against the exact accepted ability costs fails RED `072429861126` at65/14 and passes GREEN `072505416572` at35/6. Runtime and tests are unchanged by this correction; the full suite below remains the exact tested source. No deferred Minor from this review; the two prior effect-test Minors remain carried in their own report.

## Final source gate

Tested source `d218bf2888e348c264dd7c0220da5d5e3f2e4a76`, tree `b5b71a750094208813f8799db2c31089cc2cced9`. Full `pnpm --reporter=append-only check` receipt `20261016T072119139523Z`,07:21:19–07:24:26UTC, exit0:7,753Vitest tests (4,078core/3,429web/246other),7Node checks, formatting/lint/all8typechecks, worker and web build commands. The terminal log ends before Next's completion summary; verification `072505506776` confirms fresh nonempty BUILD_ID, compiled app/build manifests, required server files, routes and prerender manifests all written during this run. The truncated final stdout is not treated as additional browser/runtime evidence. The preexisting Vite native-config advisory remains recorded rather than suppressed.

The final report descendant is docs-only. Main refreshed unchanged at `29506e293e81abef1b0b8a46099618ab3ae3f0ae`, an ancestor of this source; deployment lock remains false. Durable recovery checkpoint follows. No full-suite repetition is necessary for a report-only correction; no product change followed the tested source.

## Individually ruled review exclusions

Each line is an explicit parent ruling, not a waiver of the parent plan.

| Excluded behavior | Ruling and reason | Cost if incorrectly treated as complete |
| --- | --- | --- |
| All294 individual outcomes | Open; identity witnesses cover mechanics, not every record. | Broken individual abilities can remain. |
| Four activation combinations | Open; next dedicated executable inventory pass. | Inert or incorrectly activated groups. |
| Distinct class/earned four-Skill cycles | Open; fixtures do not equip full legal loadouts. | Unusable earned builds. |
| Every Essence/Resonance's experiential uniqueness | Open; requires individual equipped comparisons. | Duplicate or meaningless choices. |
| Level1/100 PvE/PvP and twelve-round balance | Open; fixed Level1 isolates are not balance builds. | Severe pacing/power imbalance. |
| Real AI choice/viability | Open; genuine timeout primitives do not make actual AI choices. | AI cannot use the roster. |
| Every repeated-event/free-prime/no-input dominance loop | Open; applicable witness bounds pass, all interactions remain required. | Free/infinite or dominant loops. |
| Full interrupted Move/reached-origin acceptance | Existing Move and final integration gates retained; this fix preserves constructor policy only. | Attacks from unreached tiles or broken interrupted commands. |
| Full Ground immutable publication/materialization | Open; existing provisional bridge is not catalogue activation. | Native/canonical publication divergence. |
| Current Owner-edit/timing reconciliation | Open; requires fresh actual publication state. | Owner changes overwritten or wrong clocks. |
| HostedCAS/locks/concurrent publication | Open; local core evidence cannot prove hosted transactions. | Lost updates or duplicate writes. |
| Stale browser/alternate character/directRPC authority | Task8/16 acceptance retained; unaffected protected service boundary. | Expiry/revocation bypass. |
| Complete malformed nested/captured/pending/summon matrix | Existing guards/full suite retained; this is not recertification of every schema/security input. | Invalid or private state accepted. |
| Whole public/API/RSC privacy/history fallback | Open final reader/privacy audit; no reader changes here. | Hidden truth leaks or false historical information. |
| Prose/orange/derivedTags/editor/shared-reader consistency | Open; includes Second Wind inclusive-boundary wording. | Misleading player/Owner decisions. |
| Native picker/touch/keys/mobile/200% zoom | Open; actual native interaction evidence is still required. | Inaccessible or unusable battle controls. |
| Atlas motion | Separate inherited unresolved gate retained. | Held-key/peer motion regressions. |
| Concurrent build/claim/recovery/settlement/late worker | Existing service/DB gates retained; unaffected by this core range. | Duplicated/lost persistent state. |
| Broader Master/Staff/Players/Events/Music/world | Parent scope retained; combat checkpoint does not close it. | Missing authorized product work. |
| Full gate/whole branch/merge/deploy | Parent owns exact full gate above; whole-branch release remains open and merge/deploy are not performed. | Premature unverified release. |
