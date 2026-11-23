# Captured Basic cockpit and information readers

Date: 2026-10-14. This is a non-deploying continuation of draft PR904, on the accepted targeting stack. Foundation Tasks1/2 remain live; this batch and the new roster are not live.

## Delivered boundary

The actual participant projection publishes an explicit owner-only Basic presentation inventory from active immutable captures. It contains saved names, descriptions, enabled state, artwork keys, typed AP/MP/HP costs, cooldown keys/durations, safe target geometry and rendered behavior information. It excludes authoring accuracy, raw definitions, private source identities and runtime execution records. Other owners and spectators do not receive these records. Historical absence retains the established native presentation; a known inventory lacking an action does not invent ownership.

The existing shared playable cockpit and information control consume this inventory for Basic Move, Basic Attack, the saved Support and Guided Fundamentals Guard practice. Renaming does not break report selection. Disabled and stale selected behaviors fail closed while their information remains readable. Each report retains the ten required fields, exact effect recipients/conditions/timing, native Attack scaling/stronger-power binding, percentage Recovery rounding and usage-limit explanations. The shared compact renderer retains orange/gold effect labels and bracket values. The cost formatter is a small shared module, so ordinary cockpit cost labels do not import the complete report builder.

The saved single Support governs Recovery choices and the R shortcut. A Guard-equipped owner without a Recovery technique receives an unavailable notice and sends no preview/commit request. Existing four Discipline slots and the Support slot remain; there is no extra auxiliary slot or geometry/artwork size change. Read-only affordability accounts for AP, MP and nonlethal HP payment, with command legality and payment still enforced by the server.

Native Move highlights use the captured per-traversal AP price and entered-tile cap, within live Movement, terrain/status, occupancy and Jump restrictions. Flat Move route highlights use the overall typed payment rather than charging traversal AP. This does not complete the outstanding flat command/controller routing described below.

## Meaningful verification

- Saved names/costs and renamed reports, a custom Basic cooldown key, edited traversal prices/caps, disabled Move and flat-payment highlights had observed failing assertions before their implementation. An initially omitted fixture cap was corrected and a valid cap failure observed before counting that regression.
- Fourteen new cases cover owner/private projection, immutable-versus-current names, complete reports, omitted unequipped Support, stale behavior references, AP/MP/nonlethal HP affordability, captured cooldowns, disabled movement and saved movement prices/caps. The added rough-terrain check confirms the existing entered-tile accounting and a 40 AP authoritative quote; it was already passing and is not claimed as a new defect.
- The final complete web suite passes **2,505 tests in 298 files**, plus **seven Node checks**, after the independent-review corrections. The initial affected focused run passes67 tests in6 files; the final complete run also covers the subsequently added cases and existing Support suite.
- Full formatting and lint pass. All eight package type checks pass. The forced uncached production build passes both build tasks. `git diff --check` passes. React review fixes preserve compiler-compatible memoization and complete hook dependencies; effect/status reporting is computed on the server, without new client fetching.
- Earlier unchanged core/DB/validation/audio/realtime/worker suites retain their preceding direct complete evidence in `2026-10-14-move-ai-integration.md`; they are not represented as fresh reruns for this UI batch.

## Independent review and correction

The combined independent reviewer found two Important report omissions and no Critical issue: native Basic Pierce lacked the stronger-Power formula, and zero-AP offensive flat Move lacked its runtime-derived owner-turn limit. Separate valid failing assertions reproduced both. An initial unsupported `powerScaling: null` in the test fixture was removed before counting those product failures. Pierce now retains both its saved scaling coefficient and Armor bypass. Free offensive Move uses the canonical server-side effective behavior for its mandatory limit and explains the shared action-group scope, without modifying saved definitions or adding private execution metadata. The independent fix review finds no remaining Critical/Important defect in this scoped batch and independently passes33 focused cases across4 files. This is source/focused-test acceptance; it does not establish native browser or whole-overhaul acceptance.

## Native failures and coherent fixture repairs

The preceding exact durable AI head `a96f13085748dd94c10257fba389053ed8f32d03` passes CI, five supporting engine/build workflows, Living Atlas, UI layout, Desktop Experience and Desktop Page Fit. Browser smoke fails four cases: one Recovery shortcut test attempts unequipped HP Recovery, and three Support tests expect an intent without its now-captured `behaviorId: use`. Representative Buildcraft fails the Mastery flow's unequipped Recovery command. Their actual logs were inspected; this is not a persistence failure.

The Mastery fixture now selects HP Recovery through the real Techniques radio, waits for its successful save and verifies that Discipline capacity is unchanged. The separate Recovery shortcut fixture saves that Support through the ordinary versioned build API before entering battle. Exact Support intent assertions now include the behavior identity. A native negative guard verifies that R on a Guard-only build does not arm an action or send authority requests. Victory, XP, duplicate-command, cooldown and resource assertions remain intact. These edits require native reruns on the resulting exact head; local web/build checks do not establish browser acceptance.

## Remaining release work

This is a Basic cockpit/reader checkpoint, not full Task3A/T7 acceptance. Move controller/path selection, flat Basic intent routing, generic captured Skill/Essence/Resonance readers, complete Master editors/previews, Controlled ready-only artwork overlay, and creative balanced all-tag roster design/application remain. Exact-head native PvP/PvE desktop/mobile checks and independent final integration review must pass before the authorized combat release. The reported miss-dependent secondary heal remains an explicit combat acceptance item. Account portrait PR902 remains separate. Remaining Master/world requirements follow the combat release, including world environment and rendering work. No schema change, hosted mutation or deployment occurs in this batch.
