# Hosted current-content compatibility preflight

Read-only baseline, before Content migrations and StageC implementation. The completed final source must repeat this check before release; no hosted change or full Master acceptance is claimed.

Root queried the actual `read_combat_content_catalogue_v1()` output in fifteen bounded pages. Every page returned catalogue token `097c70bbe6c196fb5b2f2049b36d7ce8`. The local private snapshot contains294 current publications:141 Skill,17 Essence,136 Resonance. Snapshot798946 bytes, SHA256 `cce4cc5fa3c256fbdbb4be98aaf88a115f56313c0d41e07c7bd87355ce3781e6`. The payload and attribution identifiers are intentionally not committed.

Using actual `RpcPublishedCombatContentSource` and `createCombatContentResolver` at reviewed B sourcecf820d0d/tree1050ff, an isolated Vitest probe supplied the captured RPC body, resolved the complete current catalogue, required at least294 entries, and iterated all141 actual Skill rows through the production exact-version resolver. The external RPC mock returned the matching exact captured row; all production parsing/validation remained active. This proves current hosted-body compatibility with this reviewed source; it is not a postmigration RPC, physical SQL, draft/deep-history or final C/D proof.

First probe failed because its own `startsWith('basic.')` heuristic misclassified `unarmed.basic` as mature. Current catalogue parsing had already passed. Root corrected only the probe to use the exported production `isBasicSkillId`; no product source changed. The corrected probe passes1/1, exit0. Both outputs are preserved. The temporary test file was removed after execution. Command: `corepack pnpm --filter @aurevane/web exec vitest run src/server/combat/hosted-current-preflight.scratch.test.ts`.

- Initial output: `task-10-reconstruction/hosted-current-preflight-20261022.log.gz`, SHA256 `71a4b8e07927a8904cffc9f7edb9fc758036de855286590b6a3065c0061db644`.
- Corrected canonical-identity output: `task-10-reconstruction/hosted-current-preflight-canonical-ids-20261022.log.gz`, SHA256 `bd0d9f673a285a3f9cc42cd6964bdaadc9d10f546bf4412436f4c5f1cd0f0cbd`.

The inherited Vite native-config warning remains visible. No database write, Owner publication, player correction or deployment occurred. Final preflight also needs exact draft/deeper history preservation, physical publication rows and learned/build facts before/after reviewed migrations.
