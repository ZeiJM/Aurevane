# Task 12 fix round 1 — same-reviewer combined SPEC + QUALITY review

**SPEC: compliant. QUALITY: approved. Remaining/new findings: 0 Critical, 0 Important, 0 Minor.** Prior I1 and M1 are closed. This accepts the bounded Task 12 source repair together with the unchanged portions assessed in the original combined review; it does not close physical, hosted, authenticated application or Task 13/release gates.

## Identity and scope

Reviewed fix BASE `dd62fd6aaa9579e3df145abc2dba524835123f4f` through frozen HEAD `7579590227d333839f4a31ec63d3012df4e3d1ed`, tree `1a3967fb5107b1d5f3b7d038fc6d22efb851ee2f`, in `/workspace/scratch/e5db2ba73c1a/aurevane-master-complete-20261025`. Independently read back HEAD/tree and clean status. Verified the handed-off complete fix package is 142306 bytes with SHA-256 `d88b8e73f53936f4022a67e2b3af96be247b8c5cdf04ca9f6d7de42a389a30d9`.

Read the exact fix brief and appended implementation report, reviewed the five changed product/test files and contextual fix diff, and reused the original combined review for unchanged backend/kernel/migration boundaries. Confirmed that product changes are limited to the two Event clients, the shared audience helper, and the existing component fixture/browser script. The remaining change is coordinator/review/evidence documentation. Product source at final HEAD is identical to tested checkpoint `dd120821f1083e8df2df2349a24b0aff25091270`.

No source/index/HEAD/ref/ledger mutation, remote action, helper agent, suite rerun, or browser rerun was performed by this reviewer. There was no unresolved new-source doubt requiring an additional execution probe.

## Closure of I1 — event identity owns transient action state

**Closed.** `apps/web/src/components/master/events/event-builder-client.tsx:177–193` centralizes clearing confirmation, preview, scheduled handle and schedule inputs. Identity replacement also resets base/draft tokens and history. `loadWorkspace` at `:250–263` clears actions before awaiting the load and uses the shared replacement path before installing the loaded event's actual version context, preserving the original draft base. New Event at `:382–386` and the manual Event key change handler use the same replacement path.

The scheduled handle now stores the owning event key (`:357–358`). Both the Unschedule handler (`:364–365`) and its disabled condition require that key to match the displayed event. Thus the previously reproduced A→B cancellation path cannot silently retain A's run under B. Busy-field behavior continues to prevent identity edits during an in-flight authoring request. No backend contract was introduced to compensate for client state.

The permanent actual-component regression exercises confirmation-only A→B, scheduled A→B, New Event and manual identity replacement. It asserts cleared approval, absent old preview, disabled Unschedule even after rechecking confirmation, and no cancellation requests in those scenarios. New/manual saves must send null base/draft tokens under the new identity. A fresh B schedule/cancel then verifies B's own returned run ID `44444444-4444-4444-8444-444444444444`, state version 7 and fresh confirmation; the fixture rejects a wrong target/version. The original stale draft-base-2 publication assertion remains.

The original I1 RED receipt fails on the checked approval surviving replacement; the exact committed expanded workflow passes. These are meaningful regression assertions for the reported UI/API boundary, not proof of physical cancellation.

## Closure of M1 — readable, scope-appropriate audience references

**Closed.** `apps/web/src/components/master/events/event-audience.ts:1–11` resolves known region names from the existing catalogue, labels global scope All players, and explicitly labels unresolved references. The authoring region select (`event-builder-client.tsx:610–628`) displays names while keeping canonical keys as values. Historical unknown keys are preserved as explicitly unresolved options instead of silently remapped.

Node/cohort controls (`:630–650`) are separate custom inputs without the region datalist; changing to those kinds starts an empty reference and displays the lack of a catalogue/membership resolver. The shared helper is used in catalogue options, authoring audience text, preview and live summaries/search. No invented reference catalogue, audience executor or backend rule was added.

The expanded workflow verifies visible Region labels and canonical values, changes to Frostmere and inspects the submitted canonical `frostmere` preview scope, checks node/cohort controls and unresolved limits, and checks global scope removes custom inputs. The live participation summary must show `Region · Verdant Expanse`. The original M1 RED receipt records the missing readable-region control. Inspection of the committed desktop authoring, mobile live-run and CSS-zoom preview screenshots confirms the new readable labels and retained layout.

## Verification inspected

- Independently verified all 15 fix-round raw/gzip receipt hashes. The original 455879-byte verification ledger prefix is byte-for-byte unchanged from fix BASE. All pre-existing evidence artifacts are byte-for-byte unchanged.
- Read the original identity/audience RED outputs and the exact committed-source browser, type, lint and format outputs/argv. Intermediate failed attempts remain present and accurately marked exit 1, including filenames containing “green.”
- Exact-source browser command: `env AV_EVENT_WORKSPACE_BROWSER_EXECUTABLE=/tmp/av-chromium-current/chromium AV_EVENT_WORKSPACE_EVIDENCE_DIR=docs/verification/task-10-reconstruction/task12-fix1-committed node apps/web/scripts/event-workspace-browser-regression.mjs`. Recorded exit 0; all complete workflows pass on Chromium 153.0.8010.0 at 1366×768, 390×844 touch, and 1366×768 CSS zoom 2.
- Recorded `corepack pnpm --filter @aurevane/web exec tsc --noEmit`, package-config ESLint with `--max-warnings=0` on all five affected files, and Prettier on those files exit 0 at `dd120821f`.
- Reviewed that the added assertions retain the original unsupported-reference guard, non-mutating preview, reason-free request/fingerprint boundary, keyboard live operations, exact live state-version sequence 1–6, touch navigation, minimum section-control height and horizontal overflow checks. No forced clicks, skips, raised timeouts or weakened original assertions were introduced.

## Unchanged limits

The browser evidence uses actual production components with explicit local HTTP/session/shell fixtures. It does not establish full authenticated application/API/database integration or physical cancellation. Chromium 153 and CSS zoom 2 are not pinned 151 or true browser 200% acceptance. Physical two-connection PostgreSQL/cron/native-chain execution, physical devices, exact-head full check, hosted migration apply, deployment and final whole-branch/Task 13 acceptance remain open exactly as recorded in the original review. The earlier 53 focused tests were not rerun or newly claimed for this UI-only repair. Unchanged internal state-version/UUID presentation remains the previously classified Task 13 observation, not a reopened repair finding.
