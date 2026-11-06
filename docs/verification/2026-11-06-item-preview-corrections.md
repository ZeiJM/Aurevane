# Item preview corrections — implementation evidence

Status: implemented in the correction branch; configured exact-source CI and controlled release are pending. These corrections are **not live**. The preceding combined Item/Technique/Range release is already live and completed through PRs1021/1022; none of its operations should be replayed.

## Reviewed behavior

- The existing Item report tab state selects both the report and its header image. Item Details uses equipment art; Imbued Technique uses the captured technique art, with existing historical fallback. Keyboard return and changing Item identity reset correctly.
- Basic Support previews use the description from the same validated current publication as their artwork. The existing Basic Master Description field edits that text. Weapon Support has its own optional, bounded `actions.support.description` and Master Technique description field; public and captured readers preserve literal authored text and historical absence. The generic Support sentence is replaced in its existing position.
- The four weapon purposes describe Quickstep's reduced movement AP, Tower Guard's damage reduction, Storm Ward's maximum-HP Barrier and Kindle's direct Fire boost. No reward or extra mechanic is invented.
- Equipment and inventory names retain full text and wrap on word/hyphen boundaries, with smaller equipment type and unchanged artwork dimensions. Actual rendered containment remains a native-browser gate.
- The compact replacement footer is titled **Stat changes if equipped** and identifies removed equipment. Production read-only inspection established that Sunsplitter has no passive stats: equipping it removes Quickdraw Glove, losing Initiative6/PhysicalPower4. The regression preserves that correct calculation and source explanation. Existing new-publication protections against weapon passives remain intact; retained history is unchanged.
- Slot choices use compact consistent rows. Replacement-aware QP projection hides unaffordable choices while retaining server validation and other eligibility rules. Consumable quantity is inline beside its name.

## Verification actually completed

| Surface                                                                     | Evidence                                                                                                                                                              |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Combined Web UI, native publication forwarding, Master, media and roundtrip | 13 files, 125 tests passed after receipt-only main reconciliation                                                                                                     |
| Core description contract, defaults, capture and adjacent combat equipment  | 4 files, 66 tests passed; independently rerun by the metadata reviewer                                                                                                |
| Real SQL description and adjacent finalized-media authority/history         | 2 files, 25 tests passed; independently rerun by the metadata reviewer                                                                                                |
| Migration policy                                                            | 8 tests passed                                                                                                                                                        |
| Types                                                                       | Full Web `tsc --noEmit --incremental false`; core and DB typechecks passed                                                                                            |
| Static validation                                                           | Scoped root/Web ESLint with zero warnings, Prettier, browser-script syntax and `git diff --check` passed                                                              |
| Independent review                                                          | UI task, metadata/security task and final combined review approved with no blocking findings; final reviewer also passed19 focused tests and checked candidate hashes |

The combined Web command selects ItemDetails, ItemReportTabs, Support actions, Items, comparison, picker, equipment-stat presentation, Item technique media, current Support artwork/purpose, Nexus page forwarding, Item imbued editor, Basic editor and starter-item roundtrip tests. Existing runtime publication tests and source code retain the manual-only weapon guard.

Regression RED evidence preceded the image/title/generic-line correction, QP/stock correction, published Basic-purpose forwarding, parser/editor/SQL grammar and source successor changes. Subsequent focused GREEN evidence is recorded above. Counts from earlier intermediate runs overlap and are not added to these results.

Full local broad suites were not repeated for these bounded presentation/description changes. Relocated dependency resolution initially failed Web types; workspace links were corrected and clean nonincremental types passed without changing compiler rules. Local Playwright cannot launch because Chromium is absent. The configured Browser gate retains nine viewport sizes and adds full-name bounds/whole-word geometry for equipment and inventory plus actual four-technique image switching/decoding at desktop and mobile sizes. **No local rendered-fit or signed-in production acceptance is claimed.** No tests, thresholds, timeouts or required gates were weakened.

## Source freshness and release boundary

The isolated correction branch began at actual release merge `e6b63a9fe5803319a74c9242e0b4b76cc6f4a005` and fast-forwarded to receipt-only main `38631b7a930891954397a99585b165e2b7560837`. Its seven documentation paths do not overlap correction application changes; the combined Web/static checks were then run on the reconciled tree.

The only prepared migration is `20261106143000_item_technique_descriptions.sql`, an additive grammar/validator extension with private ACLs and no content writes. The only prepared source successors are the four source8→10 bodies in `2026-11-06-item-purpose-successors.json`; all43 other source bodies and hashes are unchanged. Source10 avoids the known completed release's publication9 floor. These are prepared candidates, **not installed content**.

Before release: require all applicable exact-source configured checks, refresh/reconcile main, independently review the final source, and verify merged-tree/source identity. Freshly audit hosted source/publication/version-floor/timing/media/Owner-draft state. Install only this additive grammar before description-bearing bodies. Register only the four exact audited successors and update only necessary current overrides through ordinary fresh Commit/CAS; the known three overrides would require fresh version11 only if the new audit permits. Preserve drafts, every immutable version/capture, inventory and gameplay. Do not broadly republish, grant or consume real stock for smoke tests.

A new controlled release requires a durable progress receipt before operations, existing deployment lock/domain protections, the established admission/retirement/drain sequencing and safe postflight. No correction build, hold, hosted migration, source registration, publication or deployment has occurred as of this implementation record. Previous production remains in service.
