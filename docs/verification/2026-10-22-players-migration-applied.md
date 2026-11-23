# Players migration — hosted application receipt, 2026-10-22

The owner explicitly authorized the Supabase browser fallback and completion of the full Master Panel before the final testing release. This receipt supplements the earlier failed connector attempts; it does not replace that history.

Project: `luazfeupwfgnilohfsya`. Applied migration: `20261020181057_master_players_recovery`.
Canonical file: `supabase/migrations/20261020181057_master_players_recovery.sql`.
Exact original source: 34,296 characters, SHA-256 `d003119d4a24a26b4f810a2d1d9ca35ef0fe3d80fe7f568abbed1e5ee8832599`.

The migration connector repeatedly returned an invalid/expired requestState. After secure GitHub account sign-in, the canonical SQL was copied from the repository UI, checked against its SHA-256, and applied in the Supabase SQL editor. The transaction wrapper included an advisory lock, absence and predecessor checks, the unchanged canonical body, and the original version/name/source in schema_migrations. Clipboard readback matched the complete prepared query before execution. The visible result confirmed application; subsequent database readback matched the original source checksum.

Postflight:
- All four new private support/recovery tables have RLS enabled and no table privileges for anon, authenticated, or service_role.
- All four public Players RPCs are service_role-only. Actual calls under anon and authenticated produced eight permission-denied results.
- All eight new private helper functions deny execution to those three roles.
- The snapshot predecessor body is preserved except for the intended sourceHash addition; replay remains STABLE.
- Five bounded ordinary committed snapshot reads supplied 64-character sourceHash values.
- No player corrections were made: support audit and revision row counts were zero.
- Security advisor warnings were unchanged. RLS-without-policy informational entries increased from 60 to64, corresponding to the four deliberately private tables.

The full Master/Content branch was recovered, reconciled with current main and the reviewed framework patch, and backed up at `ee06e003ecbab743a4395c355e8c36baf6b8e706`, tree `65d6449b7d34063db33c85161eeaa0ff10f19c42`. Local reconciliation `c4bc7649d5d709d3f04e917b193bc7c3571fa10e` has the same tree and a zero content diff after fetch.

Remaining authorized sequence: complete and review Content B/C/D, Rules/Music/World Environment, Events, final acceptance and native verification, then publish the completed Master Panel for live testing. Existing map work is preserved for afterward. No partial Master deployment is claimed by this receipt.
