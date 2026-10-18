# Historical Resonance backend preview — October16 continuation

This bounded Task15 slice adds authenticated historical Resonance samples. It is not deployed and does not complete the historical editor or combat release gates. The modular foundation remains the separate live stream; the proposed roster rebalance and original unfinished combat integration still require their own acceptance before the broader Master Panel work.

## Implemented behavior

A no-Ability native Resonance can be sampled through the existing preview endpoint by explicitly supplying current reference Skill IDs. `previewRootSkillId` chooses the trigger; sequence mechanics additionally require `previewSetupSkillId`. Current definitions and versions resolve server-side. Disabled, unknown or canonical references reject; no Ability is discarded or fabricated. No-reference historical requests retain the previous rejection. Canonical Manual, Controlled, modifier, Ongoing and Automatic lanes retain their existing behavior.

The sample runs one immediate command or setup→trigger commands in a fresh deterministic native fixture using `executePv1fMatureSkillWithResonance`. Actual AP/MP, Requirements, geometry, hit dependence, payoff effects and armed/activated/expired transitions remain native. An unavailable command stops the sample. The helper never replenishes resources, forces a hit, advances turns or repositions units. Updated stat bridges remain attached. Responses explicitly project reference identities/versions, per-step legality and quotes, fixture participants including spawned/removed entities with explicit presence and null absent-resource values, HP/MP/AP/Barrier before/after, and allowlisted Resonance events; no raw private state or effect origins escape. Top-level ordinary forecast arrays stay empty rather than misrepresenting a reference Skill forecast as the Resonance result.

## Evidence

Implementation/reviewed source: `9efdf7d4b6289a2e79a786a2bd3eb632655f538b`; base `df1ac65868dd8ce833b8327f7303cd1ab00e22b6`.

Initial endpoint witness:4 expected admission failures plus11 passing guards (`232339236530Z-afac0819`) →15 GREEN (`232429415367Z-c7455a75`). Expanded21 cases pass (`232632709496Z-c44e00f5`), covering PvE/PvP, actual native sequence/immediate transitions, mismatch expiry, no forced hits, actual payoff differential, current published version and AP blocking, disabled/canonical references, invalid/group/auth guards, deterministic fixture and direct actual-input immutability. Focused369/9 passed before the final2 cases; final full-suite evidence will include them.

One test fixture used100AP outside the current Skill bounds; the resolver correctly rejected it. The test now publishes valid50AP setup and60AP trigger to demonstrate a truthful same-turn110AP failure. Initial union inference/missing target-origin/test-record typing errors were corrected. A reader diagnostic initially lacked the frozen source metadata; its completed rerun is retained. All failed logs remain in the recovery evidence. An early audit guard rejected an older completed root receipt while the new root was still running; that receipt is not counted as new verification.

Preservation: all141 native preview JSON records remain byte-identical (SHA256 `49050e22e414dd9ada6e16f69e809170c09b8b0dab2f57b915dd44bf337b3127`), all284 proposed Manual quotes remain byte-identical (`8b513e1284d6275fd410f405aead301ecf589748e12c8e9e68068295d1a43cfc`), and294 shared reader reports/HTML remain exact (297 groups/604 effects). Proposed roster manifest and six AI/native source hashes remain unchanged. These are local/static preservation checks, not native browser acceptance.

## Scope rulings and costs

1. **Same-turn fixed fixture only.** Multi-turn history requires the broader equipped-cycle workflow. Cost if wrong: a sequence legal in another real battle context may block in this sample.
2. **Current native reference Skills only.** The legacy executor appends native effects; that cannot safely augment modular Ability roots. Cost if wrong: published canonical reference Skills intentionally reject until an actual supported adapter exists.
3. **Backend capability first.** Historical editor reference selectors and actual-outcome rendering remain the next slice. Cost if wrong: owners cannot invoke the feature through the editor yet.

## Review and final verification

One combined read-only review returned0 Critical/2 Important/0 new Minor. Parent accepted both Important findings. A setup-created Summon removed by native damage caused resource projection to dereference a missing combatant; projection now uses before/after identity union with explicit presence and null absent resources. The actual step also dropped native Ground fire selection; every step now derives its own native fire geometry and the advertised trigger fixture uses the trigger's own flag. Both regressions failed against the reviewed implementation (`233221258911Z-24df5a21`,2RED/21GREEN) and pass after the single repair wave (`233241126552Z-4c10deca`,373/9focusedGREEN). Repaired source: `ffed8d1b8ef011fcaf0efa71c89080f833a8a626`. No rereview.

Initial reviewed-source full gate passed8,960 Vitest plus7 Node checks, all quality checks and both builds with complete root tail (`232704618123Z-c43fbad9`). Its hashed package-log archive is retained separately. Repaired-source final full gate passes **8,962 Vitest plus7 Node checks**, all formatting/lint/type checks and both builds. The first repaired root (`233250558248Z-b697917f`) exited0 with complete package build logs but truncated saved root stdout; its raw log and hashed package archive remain unchanged. ONE exact-source cached replay (`233647705850Z-f697960d`) exits0 with the complete successful root build tail. No third replay or new code change. Turbo/Next telemetry explicitly disabled. Existing Vite loader and React DOM advisory output remains unsuppressed. Source/preservation identities and all receipts travel with the recovery bundle.

### Individual review scope rulings

| Behavior set aside by reviewer | Parent ruling and reason | Cost if wrong |
| --- | --- | --- |
| 1. Editor reference selectors and outcome display | Remain next backend-first slice; no UI edited. | Owners cannot invoke samples in editor yet. |
| 2. Multi-turn sequences, regeneration and expiry | Keep explicit same-turn contract; no turn progression added. | Multi-turn-legal sequences may block here. |
| 3. Canonical Ability roots with appended historical effects | Reject until supported by native engine; never discard Ability. | Canonical published references are unavailable here. |
| 4. Arbitrary equipped/captured battle history | Fresh fixture only; full equipped-cycle acceptance stays open. | Sample does not validate a player's actual build/history. |
| 5. Future Ground/delayed ticks | Correct current command is required and I2 fixed; no future turn simulation. | Later persistent outcomes remain unverified. |
| 6. Summon AI/lifetime/rich display | Same-turn spawn/removal and bridge correctness required and I1 fixed; future behavior remains open. | Later Summon turns/expiry are not established. |
| 7. Hosted authorization/RLS/publication races | Local authorization/current resolution verified; hosted/CAS gates remain open. | Hosted access/race behavior could differ. |
| 8. Roster balance, AI redesign and schema | No source/content changes there; preservation guards retained. | This slice provides no new balance or schema acceptance. |
| 9. Browser/mobile/keyboard/AT/human gameplay | No UI changed; retain independent native acceptance gates. | Local tests do not establish usability or real gameplay acceptance. |
| 10. Deployment and final release | Not performed; root quality is one local gate. | No live availability or release acceptance follows. |
| 11. Inherited16 Minors | Keep explicitly deferred; no opportunistic polish wave. | The recorded minor limitations remain. |

### Deferred Minors

No new Minor findings. Sixteen inherited: Rewind witness origin; Supporting Shot version pin; Ongoing pair dynamic pin; repeated bounded AI discovery; admission double prefix; ranged direct negative commit witness; independent Defense positive-HP reconciliation; exact Arsenal history labels/values; singular clock grammar; Burn tick wording; Master inline reference sizing; cross-status actual-input immutability witness; legacy duplicate component keys; unknown-reference matching-text witness; display the returned local RNG-consumption value; name the owner-only resource/status bound in Automatic sample copy. The new direct-input test is scoped to this historical helper and does not claim to close the inherited cross-status witness.

## Still open before combat release

Historical editor wiring; complete battle/editor/equipped-cycle integration; full roster AI/PvP/counterplay and natural-round balance; native keyboard/touch/assistive-technology/layout checks and Atlas motion; Owner current-content/history/CAS/publication reconciliation; combined release review, then publishing/deployment when authorized and human testing. No hosted write/publication/activation/migration application/main merge/deployment occurred in this slice. High remains sufficient; ETA remains provisional16–30 active hours, with weekly usage availability affecting calendar time.

## Checkpoint

Only this report follows the tested repaired source. The isolated branch is retained, with recovery bundle/evidence preserved on the existing source-backup branch after byte/object verification. Main remains `29506e293e81abef1b0b8a46099618ab3ae3f0ae`; the deployment lock remains unchanged. No release claim.
