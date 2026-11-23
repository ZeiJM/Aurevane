# Town topology, traversal and teleport correction — November 12

Source implementation evidence for task 4 of `2026-11-12-world-map-correction.md`. This is not production or human visual acceptance evidence. No remote mutation, deployment, commit or branch switch was performed by this worker.

## Authored geometry

All eight towns still occupy their existing root sector and surrounding eight districts (39 × 27 cells). Stable sector IDs, atlas addresses, local coordinates, original interaction landmarks, starting position and frontier approach remain unchanged. Each town now has its own nine-district building composition and distinct root focal footprint, rather than the same five-object root stamp. New grand focal art indices are 10–17; existing regional architecture remains indices 0–7.

| Town | Composed geography | Focal art index |
| --- | --- | ---: |
| Verdant Expanse | Winding woodland streets and a sinuous 27-cell-long river across three districts | 10 |
| Aureth Crown | Large surrounding solid walls, four broad cardinal gates, inner ring and reflecting pool | 11 |
| Frostmere | Irregular southwest lake, separated streets and a tall lodge footprint | 12 |
| Hollow Coast | Scalloped eastern inlet, waterfront avenue and asymmetric harbour districts | 13 |
| Glasswind Desert | Oval oasis with a surrounding market circuit | 14 |
| Emberreach | Rounded southeast thermal basin and angular streets, replacing the shared rectangular channel | 15 |
| Starfall Highlands | Separated rounded pools, stepped approaches and offset precincts | 16 |
| Umbral March | Irregular elliptical moat, two named bridge approaches and staggered streets | 17 |

Crown wall art uses index 9, grouped into coherent horizontal/vertical runs rather than one gate sprite per blocked cell. `WorldBuilding.wallFacing?: 'east' | 'south'` identifies vertical/horizontal runs. Width and height describe the actual blocked footprint. The renderer and generated art integration remain the parent worker's responsibility.

## Traversal and saved state

`w` is canonical shallow water and is walkable. All water authored inside towns uses `w`; existing wilderness deep water `~`, lava `l`, buildings `b` and walls remain blocked. Town roots retain the historical eastern PvP boundary: the main avenue uses `=` at local X ≥ 10, while the western root and surrounding districts retain their existing safety rules.

The pre-correction 72 town-sector rows are retained in `town-topology.legacy.json` solely as a public-geometry regression fixture. The tests compare every formerly walkable cell with the successor. Every newly blocked saved position has a canonical adjacent exit; route planning can leave that blocked origin in one step and cannot newly target it from legal ground. Placement rejects unsafe/overlapping facades instead of painting walkable holes beneath building art. No saved player is relocated.

The existing authoritative `isCurrentWorldRoute` and `resolveWorldIntent` behavior is retained: queued future steps that enter new blocked geometry are cancelled before settlement. An actual canonical building case proves the saved origin remains unchanged after a due tick. No grandfathered route can cross a new wall. Travel duration, adjacency and cross-sector road validation remain unchanged. Ownership of subsequent private-continent route-search performance work was handed to the coverage worker; this worker made no edits to `travel.ts`.

## Large discovery geometry integration

The shared `GRAND_DISCOVERY_SITES` module owns exact public site bounds. Atlas authoring removes dense trees and automatically generated scenic POIs from these grounds and their southern approach, preserving authored landmarks and existing roads. The valley is 60 × 40 cells (2,400), and the colosseum is 48 × 36 (1,728), both larger than a complete town (1,053). Every colosseum ground and approach cell is checked walkable.

New valley stream/basin cells use `w`, preserving saved dry positions and queued routes. Existing deep river `~` remains literal and blocked. This is a shallow scenic basin, not a new deep fall hazard; art depth must match that authority. No new interaction, quest, NPC, reward or progress receipt is introduced. Full-footprint scene proof, art, dressing suppression and visual capture are coordinated by the parent and other workers.

## Immutable teleport successor

The installed `2026-11-12-v1` registry and its hashes are not overwritten. `MASTER_TELEPORT_GEOMETRY_VERSION` is `2026-11-12-v2`. Migration `20261112183130_town_and_continent_teleport_geometry.sql` permits additive v2 rows and version-specific private bounds:

- v1 retains 32 × 24 / 768 private sectors and its original `teleport_master_player_v1` function unchanged.
- v2 uses 64 × 48 / 3,072 private sectors, accepts canonical shallow `w`, and is selected explicitly through new service-only `teleport_master_player_v2`.
- The existing trusted installer accepts either known release with the correct width/bounds, refusing hash changes within either release.
- New web service calls v2; selected-character authorization and native Staff fixture inventories include the new entrypoint. The UI now states 64 × 48 and accepts up to 3,072.
- Current Void selection still comes from locked server environment settings. No caller realm ID is accepted. Tests teleport to the last private sector under v2 and prove the old entrypoint rejects that expanded number.
- v2 uses its own request-operation fingerprint. A request key cannot silently reinterpret an older request under different sector numbering.

Keeping a separate RPC is deliberate rollout compatibility: selecting the newest geometry inside the old v1 RPC would reinterpret an old 32-column sector number during concurrent old/new application operation. Apply the additive migration before deploying the new application. The new application lazily installs only trusted geometry required by a reviewed teleport before committing it.

## Regression evidence

Observed RED failures before implementation covered: blocked shallow water; eight identical root compositions; absence of changed blocked town geometry; missing Crown walls/moat; missing immutable v2; rejected expanded private bounds; missing v2 RPC; and failure to replace a forged selected actor on that RPC. Additional RED checks found wall corner gaps and walkable holes beneath solid facade art; placement/grouping corrections made them pass. Scenic reservation initially failed on trees/generated POIs and subsequently passed.

The focused town guards additionally prove all nine districts and all preserved landmarks reachable from each historic town square, all four Crown perimeter gates open with solid intervening walls, every new building footprint solid, and no newly blocked legacy position stranded. Existing exact mainland journey-length checks remain intact.

The old 600,000-byte starter projection budget had a measured baseline of 599,914 bytes, only 86 bytes of headroom. Authorized town water and road data added approximately 2.55%: 615,208 raw bytes in the measured scene, with gzip increasing 34,418 → 35,464 bytes and compact scene gzip 15,431 → 16,030. Parent-approved guards are now 640,000 raw / 38,000 gzip / 18,000 compact gzip bytes. Existing privacy, scene-size and geometry assertions were retained.

Final commands and results are recorded below after the last concurrent integration run. The parent still owns whole-branch verification, native captures for all eight actual towns and the expanded discoveries, independent final review and controlled production release.

### Verified commands

| Check | Result |
| --- | --- |
| Web Vitest: atlas, town topology, discovery site authority, travel, terrain, player teleport, selected-character RPC, Players service, world service, teleport form and world workspace (11 files) | 208 tests passed in the final recorded integration run |
| `pnpm --filter @aurevane/db exec vitest run src/master-player-teleport.test.ts src/combat-content-record-lifecycle.test.ts` | 73 tests passed; includes actual migration chain, immutable releases, v1/v2 coexistence, selected-page authorization, private bounds and native Staff proof |
| `pnpm --filter @aurevane/web typecheck` | Passed after restoring missing tracked sparse metadata fixtures; the subsequent ocean export integration is present |
| ESLint over the 12 changed web TS/TSX files from `apps/web`, plus the two changed DB test files from the repository root, with `--max-warnings=0` | Passed |
| `git diff --check` | Passed |

The initial whole-web typecheck exposed missing tracked sparse `concept-ui/provenance.json` and `wayfarer/provenance.json`; they were restored from HEAD with no tracked file difference. The native DB suite similarly required its tracked sparse `captured_ability_startup.sql` fixture. A later concurrent ocean-export RED and public-discovery-proof RED were resolved by their owners before the passing run. No tests were skipped or weakened to hide these failures.

### Integration still owned by the combined release

- Interpret `w` as shallow liquid in local water rendering, public globe water and footstep effects; terrain collision remains canonical.
- Render grand regional art indices 10–17 and index-9 wall runs using `wallFacing`, with grounded pivots, readable gates and player occlusion.
- Keep large public discovery footprint proof separate from private discovery; honor the full shared site dimensions and preserve existing deep river cells.
- Run the complete exact-branch gate again after concurrent private route-search and rendering changes, then capture actual towns and giant discoveries at ordinary/minimum zoom before production.

Final integration refinement: Emberreach retains its original blocked lava rift and legal bridge beside its separate new rounded shallow thermal basin. This supersedes earlier wording that the old channel was replaced. The CLI-generated successor migration filename is20261112183130; SQL behavior is unchanged.
