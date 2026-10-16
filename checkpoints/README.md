# AUREVANE source checkpoint

This branch preserves recoverable source only. It is not a production release or an implementation PR.

- Exact local implementation commit: `6051477d3f6f9a69831c8412fc8d5ab9d3d077fa`.
- Exact implementation tree: `534be874e1b171266d072590e979c61622bbed22`.
- Required existing baseline: `6790f4c9ff9343dee7b39e2f87999c2f1a3d7454`.
- Bundle SHA-256: `db2455e69297f6165e7413dde8a314c59ed4fe662188409599dbe1181663839e`.
- Design-only checkpoint:158 candidates (136 Skills,17 Essences,5 retained Basics).158 actual record/Ability checks pass. Full completeness remains intentionally red:136 missing pair identities plus total count,316 passes/137 failures. No runtime candidate activation, hosted write or deployment.

The original Owner approved backup to ZeiJM/Aurevane (recovered source chat R0234–R0235); current continuation uses that approved workflow. The shell has no push credentials, so the connected GitHub tools stored this verified Git bundle. It retains the original exact commit rather than recreating its authorship/hash through the API.

To recover after checking out the prerequisite baseline: `git bundle verify checkpoints/roster-6051477d.bundle`, then `git fetch checkpoints/roster-6051477d.bundle refs/checkpoints/roster-6051477d:refs/heads/recovered-roster-6051477d`. Do not reset main or activate these unfinished designs. Automatic Git deployment lock is preserved.
