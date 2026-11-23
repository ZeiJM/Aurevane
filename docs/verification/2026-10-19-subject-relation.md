# Native causal subject relations — 19 October 2026

Task2 of `docs/superpowers/plans/2026-10-19-essence-resonance-identity.md`, implementing the selected narrow shared addition in the linked design. The baseline audit/design/plan is committed as `b952664e`. No new content manifest, ordinary Skill/Basic, published record, migration or deployment is changed here.

The native requirement is:

```json
{"kind":"subject-relation","subject":"triggering","otherSubject":"owner","relation":"same-unit"}
```

Both roles use the existing owner/selected/affected/triggering vocabulary. Same Unit compares native combatant identity; Ally requires distinct identities on the same native team; Enemy requires distinct identities on different teams. Absent identity, absent teams for team relations, absent roles and an ambiguous affected frame fail closed. Existing historical contexts need not supply the additive optional metadata; their existing predicates remain unchanged.

`combatAbilitySubject` derives combatantId/teamId from encounter units. Existing immutable event-frame capture automatically freezes that metadata, so no authored target identity, public event payload or external trigger API is added. The validator rejects arbitrary role/relation fields and unknown mechanical keys. Relation leaves remain state filters, and the automatic anchor analysis checks both roles in every satisfying All/Any branch. The owner-only modifier availability quote defers a relation to a nonowner role until the actual action context exists.

Shared reports name both roles and explicitly distinguish Ally from Self. The existing Master requirement editor creates and edits the typed node directly. Automatic modifiers are already owner-bound; their manual-root context has no triggering actor, so authors should use action and owner/selected predicates there rather than adding an unnecessary triggering/owner relation.

## Verification

- Before implementation, the new core file produced five failing tests/one passing case: unsupported node, absent native identity/team and absent anchor recognition. The native command case rejected the unknown relation at real source capture. The missing-context case already failed closed.
- Before editor/report implementation, both new UI tests failed on absent output/typed creation. They now pass alongside43 existing shared editor/report assertions.
- Final combined core run:190 tests across nine files pass: subject relation, requirements, definition, event frames/dispatch, runtime, modifier composition, native command, released roster requirements and released roster activations.
- Shared UI run:45 tests across four files pass: relation authoring, canonical ability editor, ability definition readers and ability target report.
- Core and web package typechecks pass. Changed-file ESLint passes using the respective root/core and web configurations. Changed-file Prettier check and `git diff --check` pass.
- The native owner action produces a paid MP rebate; an unrelated same-Discipline enemy action does not. JSON restore preserves the once-owner-turn usage and prevents another rebate. Native snapshots establish identity/team distinctions, immutable-frame detachment and ambiguous affected-role denial.

Ruling: the old roster's exhaustive Requirement test is explicitly scoped to its eight released kinds, excluding the additive subject-relation kind until the new manifest selects it. Its exact historical inventory and definitions remain unchanged; native subject-relation coverage is separate. The forthcoming manifest must include an actual obtainable relation use and its own roster outcome coverage.

Ruling: focused verification is the assigned boundary. The controller owns the later full repository gate, independent whole-branch review, exact-head CI/native browser, hosted CAS, publication and deployment. No full build/browser/network gate was attempted here. Vite printed its existing config-loader/CommonJS future-default warning during web tests; all assertions passed.

The temporary audit extraction and test logs are under `/tmp/er-*`; the complete153-row source inventory remains `/tmp/essence-resonance-audit-20261019.json`. This handoff is local execution evidence, not live acceptance or a release claim.
