# Controlled Rewind prime anchor checkpoint

This extends the Controlled core on PR #904. It is part of Task 4, not a completed Controlled feature or a live release. The preceding durable source is `e6e459506b32e9cc56d1b6ea25fa9d8c9cc09ad9` (local `e34f03bb9d3e4dddd13cdc560c42c65ffc9f8246`, tree `e8a68c93363dea87b5d33a63555709651af412e1`).

Controlled self-Rewind now saves the owner's actual position when the whole Manual action is primed. The private prime and admission history hold separate copies of that tile. Strict restoration checks the exact coordinate fields, safe integer coordinates, board membership and agreement between the prime and its admission. Non-Rewind primes retain their six-field identity without an anchor.

Preparation copies the saved anchor into the internal quote. The issued command capability captures it before before-use reactions; only authenticated, bound, single-use consumption returns it to native settlement. Client intent and public resolution context acquire no anchor field. Forecast, final admission, native execution, interrupted actor-only settlement and mixed delayed scheduling use that same position. No turn-origin, resource, Movement or action-history snapshot is restored.

Landing checks use current Root, occupancy, traversal and versioned elevation/Jump authority. Invalid pre-payment release retains its prime and resources. A before-use Root after payment interrupts the return and retains the consumed cost/admission. A delayed packet stores the prime tile at release, then rechecks live landing at activation; a blocked packet expires with a blocked receipt and no new prime or refund. Existing non-Controlled cast-position and historical turn-origin semantics remain.

Conditional actor capability validation now respects the captured recipient eligibility of each packet. An ineligible Rewind cannot block an otherwise legal whole action. Shared full descriptions identify the prime-position anchor for both immediate Rewind and delayed Rewind inside a Controlled action.

## Verification

- Observed feature RED: all initial eight actual parser/capture/prime/walk/preview/commit cases reject Controlled Rewind because dedicated anchor authority is absent.
- Observed conditional RED: an occupied anchor makes an ineligible Rewind packet reject another eligible packet. Filtering actor capability checks by captured eligibility makes that real command pass.
- Observed reader RED: both Controlled and delayed Rewind descriptions say cast tile. The shared report now says the tile saved when the whole action was primed, preserving the no-refund explanation.
- Twelve real core acceptance cases cover a prime tile distinct from turn origin and release position, exact AP/MP/nonlethal HP payment, unchanged Movement/history, JSON restoration and actual round boundaries, occupied/impassable/elevated/Root-blocked admission, delayed activation, malformed anchors, paid before-use interruption, ineligible packet coexistence, detached single-use command authority and blocked delayed activation.
- The focused five-file core set passes 128 tests; the parsed shared report passes three tests.
- Fixture corrections (missing Root source identity, invalid status payload keys, attempted in-place capture edit and the initial report's hostile target envelope) are excluded from product RED evidence. Two inferred test types found by the first full gate are corrected before rerunning.

Final direct `pnpm check` exits 0: fresh core 3,096 tests in 160 files, fresh web 2,572 tests in 305 files plus seven Node checks. DB 96/15 and validation 92/9 are successful cached results; unchanged audio 17/3, realtime 3/1 and worker 2/1 are also cached. Formatting, lint, all eight package type checks and both builds pass, with web rebuilt. No test failure remains in the final run. This is local repository evidence; native integration and hosted acceptance remain pending. Durable checkpoint identifiers follow in the PR and ledger. Current GitHub `main` resolves to `29506e293e81abef1b0b8a46099618ab3ae3f0ae`; a direct fetch returned HTTP 502, so the repository connector independently confirmed that unchanged commit.

## Remaining Task 4 work

Stored/global Controlled timing, explicit service intents with authoritative persistence/CAS, bounded AI, owner-safe readiness/blocked DTOs, the existing shared controller's ready-only artwork light and native input matrices remain. The idempotent one-time Rewind content migration, preserving later Owner edits, also remains. Controlled Summon still fails closed pending its explicit destination authority. No editor/UI, content publication, hosted data or deployment change is claimed here. The complete combat roster rebalance and remaining Master/world work are still open.
