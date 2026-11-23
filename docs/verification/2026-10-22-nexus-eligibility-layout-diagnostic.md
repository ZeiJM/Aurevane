# Nexus eligibility layout failure — actual native evidence

PR972 sourceb044/tree1050ff, UILayout39858544519/job120102941935. Downloaded only compact test-results artifact12461472253 (27,799,449 bytes), verified complete ZIP SHA25668a302eb154ecb7f6c290c75ffe1478e79c8af031f006170a0431a8300f9576b. No401MB UI-report archive downloaded. Extracted the actual failing test's attached metrics/screenshot from trace.zip; raw-content SHA1 values match the Playwright attachment identifiers.

At1366x768, the dialog and right preview report zero overflow. The learned-skill-list container reports95px horizontal overflow; the primary card grid reports95px horizontal/16px vertical overflow. Root visually inspected the attached screenshot: the added Eligible Discipline labels/selects extend across narrow cards and into adjacent content. This is concrete observed layout, not a timing/map failure. The final repair must preserve actual explicit eligibility, earned/testing truth, keyboard/touch access and existing geometry assertions. No source fix or rerun occurred during evidence extraction. Carry the bounded fix into D/final integration.

- nexus-b-1366x768.png:682231bytes, SHA256f4b8cdae76ef9b238a1d3a7c5370496da8a362301dc3a73ca0cfcf479b34fec2; attachmentSHA1be564112968e8ab5a274fb1e8f96710b9def9da3.
- nexus-b-1366x768-metrics.json:46034bytes, SHA2568486cbe797bc904c3dac890025bb93898b61e7c09ce3156348d4f4c6ad78904c; attachmentSHA19a0e645adfc0fe2d37b5f4c580af9686dada580d.

Both files reside in task-10-reconstruction. Only fake disposable native account data appears. Full trace/Auth/network contents were not exported. This preserves failure evidence; no final desktop/mobile/zoom acceptance is implied.
