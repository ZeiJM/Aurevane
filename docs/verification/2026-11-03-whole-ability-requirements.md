# Whole-ability Requirements and one explanation per Tag

Status: implemented on the Items feature branch; prospective content corrections only. No hosted definition, draft, publication pointer, historical version or encounter was changed.

## Current evidence and intended behavior

A read-only query of the existing project `luazfeupwfgnilohfsya` at **2026-11-03 07:10:53.653952 UTC** scanned all **303 active publications**, recursively checking canonical effect wrappers for nonnull `requirements`. Exactly **13** current records matched; none had an Owner draft. The bounded export retains their exact current definitions, revisions, version floors and catalogue token in `release-assets/2026-11-03-whole-requirements-live-audit.json`. It contains only affected bodies; the SQL predicate scanned every active publication. This is a timestamped observation, not a continuing claim about live state.

Stalwart Strike v6 has unconditional Damage12 and Damage5 gated by Fortified on Self. The former reader's Requirements None and packet caveat therefore reflect the stored definition. The current correction makes Fortified the prerequisite for the complete activation while retaining both damage packets. Generic teaching copy now appears once per stable Tag across behavior groups, and native Skill/Summon explanation readers use the same stable-identity grouping principle; every Effects row, distinct custom note and historical packet condition remains available.

| Current identity | Reviewed correction |
| --- | --- |
| `bastion.stalwart-strike` | Whole Fortified on Self |
| `cinderweaver.scorch` | Whole Burn on selected enemy |
| `essence.aetherist.aether-nova` | Whole Self MP strictly above 75% |
| `essence.farstrider.deadeye-barrage` | Whole Marked on selected targets |
| `frostweaver.brittle-ice` | Whole Chilled on selected enemy |
| `frostweaver.shatter` | Whole Chilled on selected enemy |
| `ravager.desperate-execution` | Preserve Self HP strictly below 35%; require Self Reckless as well |
| `ravager.open-wound` | Remove the Bleed prerequisite from the same Bleed packet; retain whole None |
| `shadehand.execution-cut` | Preserve selected enemy HP strictly below 35%; require Vulnerable as well |
| `stormsinger.conductive-bolt` | Whole Conductive on selected enemy |
| `tidecaller.crushing-wave` | Whole Drenched on selected enemy |
| `wildwarden.close-quarry` | Repair Enemy Single aim, maximum range 1; whole selected Marked; Move and MP stay on Self and Damage targets the selected enemy |
| `wildwarden.pursuit-shot` | Whole selected Marked |

Promoting a packet prerequisite intentionally gates formerly unconditional sibling effects. Brittle Ice/Shatter, Conductive Bolt and Crushing Wave retain their authored status-inflicting sibling packets while becoming visible combo prerequisites requiring that status before activation. Those differ from Open Wound, whose Bleed packet itself required preexisting Bleed and failed on a fresh enemy. Only that direct same-effect self-gate is removed. Exact existing comparators, thresholds, costs, packet order/values and media remain; Close Quarry has the explicitly reviewed aim/recipient repair.

## Current authoring and historical boundaries

Commit Now uses the shared pure normalizer and reports each correction. Compatible matching predicates can become a whole prerequisite; distinct competing predicates or unavailable affected/selected subjects remain blocked for explicit review. Only the two reviewed identities above combine differing existing and packet conditions; arbitrary definitions are never silently ANDed. The editor refuses to offer promotion of a direct same-effect status prerequisite and retains explicit removal. Current request validation rejects residual hidden packet prerequisites.

Core per-packet eligibility and exact historical parsers remain intact. Recipient legality, immunity, conditional-cleanse candidate filters, timing and engine damage mechanics are not authored packet Requirements and are not removed. Public historical caveats stay attached to their original effect ordinal within the single Tag explanation. Saved media and private accuracy fields retain their original authority/privacy boundaries.

## Offline audit and prospective publication

The exact read-only export query is `scripts/audit-whole-requirements.sql`. Save its single result object locally; the offline command does not fetch a new snapshot itself.

Run from the repository root:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/audit-whole-requirements.mjs --snapshot docs/verification/release-assets/2026-11-03-whole-requirements-live-audit.json --output docs/verification/release-assets/2026-11-03-whole-requirements-candidate.json
```

The command has no network or database writes. It shares the exact current-authoring normalizer, records exact before/after digests and prospective monotonically increasing versions, and aborts if unresolved conditions remain. `--check-current` returns nonzero when the supplied current export still needs corrections. It accepts either this bounded SQL audit or a fresh complete `publications` export. The committed candidate is prospective and is not proof of publication. Vitest runs the actual command and checks deterministic candidate equality, absence of hidden current prerequisites, strict canonical behavior validation and idempotence for all 13.

Before an authorized publication, re-read all current publications and recursively audit again, including Owner edits/new definitions. Bind the reviewed candidate to fresh full target definitions, revisions, highest versions/version floors, current catalogue CAS and absence of target drafts. Abort changed baselines or conflicting drafts. Revalidate the full prospective catalogue and timing through the existing authoring machinery, then use normal atomic versioned commits with verified Owner identity. Read back every changed current definition; preserve all prior immutable bytes, unrelated publications/drafts, finalized media and captured encounters. An ambiguous commit response requires readback before retrying. Never overwrite historical cohort JSON or silently force the captured audit token after state advances.

## Verification map

Focused RED cases reproduce missing whole Stalwart gating, accepted hidden current prerequisites, Open Wound's same-effect Bleed condition, duplicate cross-group bottom explanations and lost custom notes beside captured Tag teaching copy. Restoring the historical Open Wound gate in the real command fixture reproduces zero Bleed applications on a fresh enemy; the corrected captured definition produces one application and exactly three scheduled Bleed ticks through reload.

All 13 prospective definitions have actual canonical command witnesses: unmet whole prerequisites reject before mutation/payment, and satisfied visible prerequisites permit real enemy damage settlement. Close Quarry additionally verifies caster movement and its authored 4 MP payment/3 MP recovery. Core hidden-packet historical execution remains unchanged. Focused and adjacent checks cover current corrector/validation, the existing legacy-requirement controls, shared readers/linked references and content publication/resolver boundaries. The parent integration owns the combined repository quality/build/browser gate; these scoped checks do not claim deployment or authenticated hosted gameplay acceptance.

Final scoped verification: **2,391 tests in 137 files pass**, covering the complete Character and Master combat-content component directories plus current authoring validation/service/store/handler, the shared corrector, actual-current audit/command witnesses and battle public projection readers. Web route generation/TypeScript, scoped ESLint with zero warnings, Prettier, Node script syntax and `git diff --check` pass. The expanded run initially found six presentation compatibility edges (native output shape, Ground/unit identity, stale linked metadata and captured Tag wording precedence), all repaired and reverified. Its separate historical Fortified fixture-context failure was corrected by the equality workstream in commit `3fd898b`; that committed correction is included in the final passing run. Fresh main remains `b8f6b68`. No full repository suite/build/native browser run is claimed for this isolated workstream; those remain the parent integration gate.
