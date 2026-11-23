# World first-approval latency implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement the dependent steps inline, with an independent review before publication.

**Goal:** Remove the reproduced first-click pause caused by a redundant roster lookup delaying approval beyond the three-step preview.

**Architecture:** Keep verified JWT identity and fresh active-session/selected-character checks. Keep session verification first, validate the selected-character cookie address, and consolidate ownership/deletion eligibility into the existing mandatory World RPC. Avoid the roster RPC, which also materializes deletions. Keep command serialization, route clocks and bounded preview unchanged.

**Tech Stack:** Existing Next route handler, server authentication services, World repository/controller/motion, Vitest and native browser gates.

**Spec:** Owner October14,14:40 Trinidad report: starts walking, stops for a second, then continues; requires uninterrupted movement. The #906 receipt leaves human acceptance open.

## Constraints and evidence

- Based on fresh main81fd91dd0964de9a1fbe181392d285a10a4fc339; production remains36fbe14cdd44e2f4562e5cc4235e3cd484cbdb89.
- No migration or configuration change. Production commit definition matches the pacing migration/flat committed-state contract.
- Preserve200ms ordinary steps,600ms unconfirmed preview,40-step settlement, fresh session ownership, selection/deletion checks and blocking/range rules.
- Preserve independent peer reads and immediate legal Attack dispatch. No art/layout change.
- Baseline33 controller/workspace/confirmation checks pass. Signed-in browser and production request timings remain unavailable.

## Review focus

- Missing/invalid JWT never starts a World operation.
- Revoked lease rejects before any World operation.
- Absent/malformed/foreign/deleting selection cannot permit a World response or mutation.
- Session verification and canonical SQL ownership/deletion checks must precede initialization, movement and Attack.
- Slow wire latency exceeding the unchanged preview cannot be represented as approved movement; distinguish injected latency from hosted acceptance.

## Task1: Reproduce and shorten first approval

**Files:** `apps/web/src/app/api/world/approval-latency.test.ts`; `apps/web/src/world/command.ts`; `apps/web/src/app/api/world/route.ts`; existing route/auth tests.

**Interface:** Existing private World `identity(): Promise<{ userId: string; characterId: string }>` resolves the selected canonical UUID after unchanged `getAuthenticatedActor()`. Export existing unchanged UUID predicate as `isWorldUuid`; every handler branch must enter the existing ownership/deletion RPC before any World response/mutation.

- [x] Add a handler/repository/controller/motion regression with175ms resource-boundary latency: serial approval at700ms exhausts600ms preview. Require no idle samples at600/650ms, approval at525ms and exact arrival.
- [x] Observe RED on current source before production edits.
- [x] Keep actor.ts unchanged; read the selected-cookie address after verified session, retaining existing mandatory World ownership/deletion gates. No pre-lease roster operation.
- [x] Cover missing JWT, revoked lease, absent/malformed cookie, canonical ownership/deletion failure and no World commit before authorization.
- [x] Run focused World/auth checks, full quality and exact-diff review.

## Task2: Verify and release

- [x] Retain held/peer/Attack/privacy native cases and all assertion limits; record approval-timing evidence where meaningful.
- [x] Separate injected175ms latency from measured production RTT.
- [x] Refresh main, publish an isolated PR and wait for all triggered exact-head CI, Atlas and complete responsive workflows.
- [x] Merge verified source, deploy the exact merge under the standing related-release authorization, confirm canonical READY/source/entry/error health and retain open human acceptance.

Review checkpoint: the initial parallel-read prototype passed its timing guard but is rejected before publication because get_character_slots_v2 finalizes overdue deletions and may abandon battles. Actor.ts is restored exactly; the final approach eliminates that redundant roster operation. The baseline cookie-aware regression again fails at600ms before the narrowed change and passes with525ms approval afterward. Production read_world_state_v1 and commit_world_state_v1 definitions are inspected read-only: ownership/pending-deletion denial precedes world-state initialization/update. Their SQL/grants are unchanged.

Local final-source quality exits0:5,681 Vitest tests, seven Node checks, formatting/lint/types/builds. Evidence: docs/verification/2026-10-14-world-first-approval-latency.md. Independent review and exact-head release steps remain pending.

Final review: no critical/important finding; independent88 checks pass. Ruling: retain existing SQL as selection authority; malformed command/cookie mismatch may precede ownership denial without private response. World stops materializing roster deletions; existing roster entry points retain cleanup. Cost if wrong: eligibility must be restored before release; owner/deletion SQL and regression guards are verified.

Release complete for testing: PR #908 / `5135e35e73a88a4d8aa9aaaf0218852df06a7f51`, tested tree `08d7ea009d54a450287c119276ced0576bec2557`, Production `dpl_8Ws132vHEPJ4riaB2sqMhBxYx46g` READY20:57:56.518Z. CI/Atlas/complete Browser all pass. Final receipt: docs/verification/2026-10-14-world-first-approval-latency.md. Hosted gameplay and human acceptance remain open.
