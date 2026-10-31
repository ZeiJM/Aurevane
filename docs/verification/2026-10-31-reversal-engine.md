# Reversal engine and shared readers — local implementation

This feature is based on `38882cdb9cc088aede1836fdd837e0e5b879fdef` in an isolated `agent/reversal` worktree. It implements the Owner's uploaded October 31 Reversal specification and subsequent clarifications. Root owns the Master editor controls, browser acceptance and final integration/release. This receipt is implementation evidence, not a deployment or catalogue-publication claim.

## Captured contract

The `reversal` payload requires `version: 1`, `recipient: 'actor'`, one `physical` or `mystic` family, and three balance fields: `reflectionBasisPoints`, `attackerMaxHpCapBasisPoints`, and `defenderMaxHpCapBasisPoints`. Reflection permits 1–100000 basis points; each HP cap permits 1–10000. The factory uses Self, Physical, 10000/2000/2500. It does not change an existing Skill's costs or cooldown.

Version 1 fixes one trigger, front and side eligibility, unconditional rear bypass, expiry at the next actual owner turn start, and Strain through the next complete actual owner turn. These are read-only policies, not unsupported programmable fields. Unknown trigger/arc/duration fields and non-Self recipients are rejected. Reversal requires a Manual Self utility action. Automatic/ongoing preparation, an attack classification/family on preparation, offensive preparation packets, multiple Reversals and another Controlled companion are rejected. Ordinary Instant/Normal/Delayed utility companions retain their timing; native Summon companions do not receive a forced Instant override.

Preparation uses the existing Controlled prime intent and shared atomic command payment, cooldown, activation limits, native event session and captured-source authority. Ordinary Controlled preparation remains free. Reversal cannot be manually released. Cancellation remains available through cooldown and resource depletion, provides no refund, removes its genuine prime and incurs Strain. The internal preparation flag is never an intent field or public DTO.

Summon abilities use a genuine captured tactical-entity source with their pinned AP/MP/HP costs and requirements. Optional `cooldownOwnerTurns` accepts 0–99; absence/zero retains no cooldown. The normal shared cooldown engine owns positive values. Summon AI can choose preparation, remembers earlier offensive Basic attacks before the first adapter capture, and preserves one authored ability per turn. Expiry/defeat atomically removes the Summon's captured sources, Controlled records, usage, maintained/truth records and private Reversal rows.

## Packet and turn behavior

Interception occurs after the ordinary incoming outcome, mitigation and a pure Barrier probe, before HP mutation. A successful interception leaves the defender's Barrier untouched. Eligibility uses the authoritative Physical/Mystic family, including dynamic Basic Attack family, and live source position versus defender facing. Unknown origins/families, misses, rear attacks and zero would-be HP loss do not consume the counter. DoTs and environmental/system returns do not enter the direct-damage interceptor.

Return damage floors the authored percentage of would-be HP loss and caps it by the lower authored attacker/defender Max HP ceiling. An authored Summon outgoing-damage ceiling remains an additional limit. The attacker's existing current-policy Barrier may absorb the return. Only actual returned HP loss is reported; a zero-HP return cannot earn damage memory or break Invisible. Return settlement has a dedicated `reversal_triggered` receipt and no returned `damage_applied` receipt, so it cannot seed Counter/Reflect, Absorb, Vengeance or Endure credit. No second accuracy or critical draw occurs. The existing reaction budget is shared. If the returned damage defeats the attacking actor, later packets in that action stop under normal defeat authority.

The approved version-1 dependent-effect binding uses the nearest preceding Damage for each recipient. An intercepted hit suppresses its following negative status, DoT, Push/Pull or negative MP-drain add-ons until the next Damage. Other area recipients and later hits continue. A negative effect before any Damage is independent. Remove Status, Sensory/Reveal, terrain and actor utility remain independent. This binding is activated by an actual Reversal interception; it does not reinterpret unrelated historical action metadata.

Already armed Counter/Reflect and Endure expiry are defensive system returns, outside offensive Skill command admission, and retain their existing rules. New attack-classified Manual or Automatic commands are suppressed while armed; Strain allows only the normal inherent Basic Attack as an offensive fallback, plus legitimate utility/movement. Strain is dedicated system authority and has no ordinary apply/copy/cleanse/dispel surface.

The armed window survives a global round change. Expiry and Strain use actual owner start/end boundaries, including a queued packet resolving before the incoming owner's start. Manual cancellation does not count the remainder of its preparation turn as the required complete Strain turn. Practice termination records the normal Reversal end receipt without refunding payment.

## Reveal, visibility and presentation

A successful current Reveal can affect Covert, Invisible or an armed Reversal. Its real status settlement disarms the authoritative record and applies the existing Revealed profile; pending/delayed Reveal does not disarm early. Same-action resolving Reveal is ordered before Damage for an armed target, while its original accuracy/resistance/timing masks stay aligned. Active Revealed blocks preparation; pending presentation does not. No legacy AP penalty is added to current Reveal.

Preparation is normal utility Skill use and retains existing Covert visibility. Actual positive return HP loss breaks Invisible through the same native removal primitive used by ordinary offensive actions. Current Covert is action-information protection and is not automatically removed by ordinary attacks; Reversal retains that behavior. Captured command visibility is preserved.

AI planning and public targeting forecasts use a team-relative knowledge copy that removes only Covert-hidden enemy Reversal/Primed records, matching existing active/pending Covert visibility. Actual commands settle against the untouched original state. Regression tests prove identical AI choices for identical public information, no hidden Skill/reaction disclosure in a targeting preview, and a genuine counter on the later committed attack.

Shared full/compact Skill, native Summon, battle, spectator and Chronicle readers expose authored family/percentages/caps, the armed expiry and Strain rules. Owner commands show paid Prepare or Cancel, never manual Release. Public profiles are synthesized read-only facts; `reversalState`, source execution inventories, command bookkeeping and preparation flags are stripped. The additive SQL migration registers only the Reversal identity while preserving previously approved finite identities and data.

## Verification boundary

Focused checks cover paid preparation, HP cost, cooldown, rejection/retry/reload, family/facing, original RNG, Barrier probes, caps, multiple packets/area recipients, source defeat, actual turn clocks, cancellation, Reveal timing, offensive Automatic commands, genuine Basic fallback, native Summon AI/cooldown/expiry and shared readers/privacy. An independent review reproduced and helped close the first-Summon-capture offense-history gap. The preceding-negative-effect and Summon-ceiling cases follow explicit Owner clarifications.

Final root integration must reconcile the other October 31 tag work, run configured full release gates and native browser acceptance, and decide publication/deployment. No full repository suite, browser run, live database migration, content publication, push or deployment is claimed by this isolated implementation.

Final isolated test results:

- Core: 462 tests across 22 focused files passed, including 40 dedicated Reversal cases. Core TypeScript passed.
- Web: 268 tests across 12 focused files passed, including actual atomic service payment/reload/retry/abort and hidden-counter targeting-preview privacy.
- SQL: 3 isolated PGlite migration tests passed; no live database was used.
- An adjacent Recruit service test retained obsolete BUR/POI text-icon assertions even though the pinned base already renders SVG icons. Those assertions now check the actual Burn/Poison semantic SVG identities and accessible labels; its actual server DoT/tick/duration assertions remain intact.

On this isolated base, full app TypeScript still requires the root-owned native editor exhaustive branches for the new Reversal opcode (`skill-effect-editor.tsx` and `skill-effect-list-editor.tsx`). Root is implementing those controls separately. This is not reported as a passing application typecheck.
