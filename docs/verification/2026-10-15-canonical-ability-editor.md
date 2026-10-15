# Shared canonical Ability form

Task10 form subset from local36f956c51a4bed400bc4bd60a136107d0bf51199 / durable1094d3426b89d335467eaa6fb5e0a88b078e95df / tree1138c4d6a620435dc3acd3e1ebf9248ff82f8593, draftPR904. No hosted mutation, migration, publication, merge or deployment is performed. This is not completion of Task10, all Basic authoring, the final roster or the requested release.

## Implementation

The actual Skill, Essence and Resonance editor components now select a shared `AbilityDefinitionEditor` whenever the canonical property is present. They retain their existing identity/text/media/review controls; native records retain their old forms. Canonical records no longer edit stale native cost/effect fields, normalize away authored targeting, or enter the historical Resonance combo normalizer. Native ground-area normalization is skipped for canonical Skill drafts.

The shared form edits the actual engine definition, with no alternate mechanics schema:

- Ordered behavior groups; Manual/Automatic/Ongoing activation, action/modifier mode, classification/family, AP/MP/HP costs, independent cooldown and Requirements, usage limits, private standard/fixed accuracy, and Automatic target subject.
- Recursive All/Any, resource state/percentage/crossing, status presence, prime presence, event and action predicates. Group Requirements and conditional effect Requirements remain separate.
- Typed targets: team targeting or independent categories, selected unit/Ground delivery, shapes/reach, selection count, elevation, line of sight and Ground affected teams. Existing geometry is retained; switching targeting rules is explicit. The independent-category control reflects the current core three-selection bound, while team targeting retains the existing canonical16-selection budget. No policy number is added to the form.
- All registered payload families reuse the existing typed native controls where their structures match. Move, Pierce, maintained damage bonus and captured Summon profiles have explicit specialized controls. Recovery displays percentages while storing canonical basis points. Summon templates reuse an existing supported builtin profile instead of inventing new canon.
- Each effect has its own inherited or explicit timing. Controlled is offered for supported whole Manual actions; registry-only timings and unsupported Summon combinations stay blocked. The core validator provides named compatibility messages while a draft is incomplete. Invalid canonical mechanics keep their form controls and suppress a misleading/broken player preview.
- Effect notes are aligned by stable group/effect identities across add/remove/reorder operations. Skill/Essence notes are escaped text. Resonance does not offer an unsupported per-effect-note field. Canonical Damage/Pierce, including Damage nested inside a canonical Summon profile, do not offer the old boolean Piercing control; Pierce uses explicit equipment-Armor percentage and does not offer incompatible Vengeance.

There are no new production requests, global listeners or artwork changes. The form uses existing responsive editor styles and native controls. The test harness alone registers its inspection snapshot in an effect, with cleanup; its initial render-time global assignment was rejected by the existing immutability lint rule and corrected before acceptance.

## Verification

Three actual editor-render tests fail before implementation: missing canonical controls in Skill/Essence and a forbidden legacy-normalizer exception in Resonance. They now pass. Twenty additional cases cover every registered payload's typed control surface and an invalid Move21 draft that remains editable with a named error instead of a failed player preview. All70 covering cases across six editor/effect/profile files pass. Web type generation/TypeScript and scoped source/fixture/script lint pass. The initial full gate stops on the test-harness immutability rule noted above; the corrected full `pnpm check` exits0:6,065 Vitest plus7 Node checks, formatting, lint, eight typechecks and both build tasks pass. Evidence: `canonical-editor-verified-check.log`. No source edits follow that gate before the checkpoint.

The non-deploying native workflow adds an authoring context at1366×768/390×844 to the existing fourteen reader contexts. It changes AP/HP, fixed hit chance, cooldown, a resource Requirement, attached Move, Damage, per-effect Controlled timing, Pierce percentage and maintained bonus; adds/removes a group; reorders an effect through a real incompatible state; checks stable escaped notes; and parses the final snapshot with the actual engine parser. It records focused cost/Move/Ongoing captures and horizontal page bounds. This is production form interaction with fixture state, not a claim of hosted Save/Publish or gameplay execution.

## Explicit remaining gates

The actual Master page still needs the complete current catalogue, all five Basic choices and their complete source/text/media/history workflow. Reference pickers, current draft loading for regular Skills, create/duplicate/archive/restore/CAS workflows and the full operational workspace remain Task5/10 work. Existing deterministic preview/review still needs explicit selection among multiple Manual actions and honest handling of definitions whose groups are Automatic/Ongoing; the new form does not claim that preview integration is finished. Persisted malformed drafts and all requested 200%/1440px workflow states still require their full integration acceptance. The final editor → save → publish → new battle outcome chain remains a release gate.

React review: local per-group picker state only, no new production effects/listeners/requests; immutable updates and stable group/effect keys; existing responsive CSS and native labelled controls; bounded registry/parser loops and direct imports. The fixture-only inspection registration has effect cleanup. No source or artwork authority is moved to the client.
