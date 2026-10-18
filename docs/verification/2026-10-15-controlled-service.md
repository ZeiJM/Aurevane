# Controlled battle command integration

This Task 4 checkpoint extends verified Rewind source `c393c95d607b298ea703314f8e05b00a8a06a194`. It is not a complete Controlled release or a hosted deployment.

The existing strict battle intent parser now admits `ability-prime` and `ability-cancel-prime`, containing only an action ID and exact Manual behavior ID. A caller cannot submit a source identity, destination/anchor, definition, cost, target or walking route with either command. Release remains the existing explicit `action` command, retaining its selected group, current targets, modifiers and optional Move route. The canonical kernel requires the exact private prime before a Controlled action can commit.

The shared battle service resolves references against the current turn owner's admitted immutable build or captured equipped Basic. It never reads current published content to replace that capture. Existing owner/session/turn, expected battle version, request fingerprint, idempotency replay, snapshot validation, privacy journal and atomic repository commit paths remain mandatory. Free state changes pass through the Controlled runtime without paid action events, usage, resource payment or cooldown. A failed lookup, unsupported group, duplicate prime or illegal release never reaches persistence.

Prime and cancel do not have targeting previews. Both the preview request parser and direct preview service reject them, instead of falling through to the historical end-turn explanation. Target selection/forecast remains part of the ordinary paid release flow.

## Verification boundaries

Observed RED: the two new reference-only command kinds fail the real parser, and two actual service tests cannot submit them. After admission and dispatch are implemented, free prime, cancellation and paid release pass. A further actual preview regression initially resolves to `end-turn` instead of rejecting; the parser and service guards correct that result.

Ten parser cases cover the two accepted command kinds, six authority-bearing extra fields, and rejection of both state commands as previews. Five actual service cases cover free private persistence, JSON reload, single paid release, duplicate replay, stale version rejection, cancellation without renewing the allowance, invalid preview, unaffordable release retention, and missing action/group denial. The service uses the production core/capture/parser/projector code with an in-memory repository adapter. Its replay and commit assertions establish the service/repository handoff; they are not a new hosted SQL or concurrent multiplayer claim. Existing transaction SQL is unchanged.

The focused parser set passes 54 tests. The focused four-file service/preview/PvP set passes 76 tests before the two final denial cases; the final authority file passes all 20 tests. Validation and web types pass after formatting. The initial reload test incorrectly accessed a mock not exposed by its fixture; it now uses the fixture's real JSON snapshot replacement operation. This fixture correction is excluded from feature RED evidence.

Final direct `pnpm check` exits 0: fresh web 2,577 tests in 305 files plus seven Node checks, fresh validation 102/9, cached core 3,096/160, DB 96/15, audio 17/3, realtime 3/1 and worker 2/1. Formatting, lint, all eight package type checks and both builds pass; web is rebuilt. No final test failure remains. Exact-head native integration and hosted acceptance remain pending. Durable checkpoint identifiers follow in the PR and ledger. Current main remains `29506e293e81abef1b0b8a46099618ab3ae3f0ae`.

## Remaining

Configured/stored Controlled tag timing and the Master selector, bounded AI prime/release/cancel decisions, owner-safe readiness/blocked projection, existing artwork's ready-only light, native PvE/PvP input matrices and idempotent one-time Rewind content migration remain. The compatible tag timing selector is included in the Owner's requested partial combat release. Broader Master UI/weather work follows. Full Task 4 and whole-branch review remain open; no live change is claimed.
