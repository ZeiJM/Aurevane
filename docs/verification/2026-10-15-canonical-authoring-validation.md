# Canonical publication validation bridge

Task5/10 integration subset from local2acbf7eb365ba449f626cb50809c6a43d3e96930 / durable568691b6265394227b7b7b979335567a6900f157 / tree4c0e66d5070b223397971e419f50381afe10fd57, draftPR904. No hosted mutation, migration, publication, merge or deployment is performed. The actual Master forms, complete kind/archive/dependency workflows and creative roster remain unfinished.

## Reproduced defect

The engine and core content validators already treat a present canonical Ability as the mechanics authority. The application authoring service still checked a Skill's legacy target/effect fields and always tried to materialize native PvE/PvP actions. That deliberately throws for canonical definitions. Essence validation inherited this path. Resonance validation unconditionally called the legacy combo normalizer after the canonical validator had succeeded, producing `canonical-activation-required` instead of a valid publication.

Seven new actual-service regressions fail before the correction: canonical Skill/Essence/Resonance validation plus publication, and exact canonical Cleanse validation for Basic/Skill/Essence/Resonance. The fixture preserves each real identity/source envelope; stale legacy fields deliberately conflict with the valid canonical mechanics. The original service rejects those unused legacy effects or enters a forbidden legacy normalization path. Basic partial Cleanse was incorrectly accepted.

## Correction

- The existing real core validators continue to validate canonical group structure, supported tags/combinations, typed targeting, Requirements, costs and payloads. A malformed present Ability does not select the legacy fallback.
- Native-only current target/DoT checks and native action materialization run only when there is no canonical Ability. Existing native validation remains intact; this does not change combat formulas or the core Ability parser's supported mechanics.
- Canonical groups receive the same application-level standard Cleanse rule as native authored Skills. Diagnostics name `ability.behaviors[i].effects[j].payload.statusIds`; Essence prefixes `skill.`. The helper reads already validated top-level group payloads, does not mutate them, and preserves Dispel and the actual parser's capabilities. It is not a claim of complete recursive summon-profile text/authoring validation.
- Canonical Resonances bypass the historical Result normalizer. Native Resonances still use their original setup/trigger/result validation.
- Registered media checks, identity/version/source validation, operator authorization, publication kind, CAS and the guarded prospective catalogue boundary remain unchanged.

The seven tests exercise actual service validation and the in-memory versioned repository, including a real publish/read round trip, immutable input and correct stored Skill/Essence/Resonance kinds. Partial canonical Cleanse fails with the exact group path; the complete standard list passes for all four sources. These are service/repository tests, not hosted SQL or editor/browser acceptance.

## Verification and remaining work

All63 authoring-service tests pass. Covering126 tests across seven service/handler/preview/store/catalogue/resolver files pass; web type generation/TypeScript and scoped lint pass. Final direct `pnpm check` exits0:6,042 Vitest plus7 Node checks, formatting, lint, eight typechecks and both build tasks pass. Evidence: `canonical-authoring-full-check.log`. No source changes follow that gate before the checkpoint.

Master's actual current page still enumerates only builtin regular Skills, and its existing forms do not provide the complete canonical/Basic workflow. The Resonance editor itself still assumes a legacy combo. Those are explicit next integration gates; this validation bridge must not be represented as a finished editor or as permission to publish the final roster early.
