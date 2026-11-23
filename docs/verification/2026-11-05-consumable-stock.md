# Consumable stock settlement — source verification

Status: implemented locally, independently reviewed, not deployed. No hosted migration, inventory grant, publication or historical rewrite was performed.

## Authority and compatibility

New equipment preparation captures optional `consumptionPolicyVersion: 1` and each readied consumable's exact `ownedQuantity`. This encounter policy applies to every current Consumable independently of the retained Item definition's historical `consumeOnUse: false`. Unmarked frozen encounters retain their captured behavior. Source definitions, publications, Owner drafts and starter grant receipts are unchanged by this mechanism.

The canonical command preflight rejects empty stock before payment. An accepted Item activation records one private consumed-unit receipt, including misses and actual Reversal arming at zero AP. Ordinary provisional Controlled preparation/cancellation costs no stock. A committed delayed effect and later Reversal interception never charge again. Per-battle action caps remain independent; a new encounter refreshes the cap using the inventory's remaining stock.

The battle-head transaction validates immutable captured sources, usage/receipt deltas and exact recipient/stack ownership. Nonblocking outer admission locks and NOWAIT character/build/inventory locks prevent lock-order inversion. Stock decrement, inventory revision, exhausted equipment repair, private immutable consumption audit, battle snapshot, events, idempotency and privacy journal succeed or roll back together. Public inventory mutations remain blocked during pending/active battles.

Positive remaining stock stays equipped. At zero, only the exhausted stack is deleted and its readied slots clear; another owned stack is never selected or replenished automatically. The next encounter sees the repaired inventory. New current loadouts reject repeated Consumable identities through the separate equipment eligibility authority.

Startup replaces the version-one snapshot after activating sources. Its narrow exception permits no stock receipt/use and proves each newly introduced consumable against its exact admitted equipment. Only array-valued `tagPresentation` in the canonical/native presentation-binding contexts is normalized; source IDs, roles, quantities, requirements, tags, compiled use caps and mechanical payloads remain exact. Historical non-consumption encounters keep the existing startup behavior.

## Observed verification

- Initial real engine capture/consumption tests failed, then passed after scope capture and accepted-use settlement.
- 71 focused core/adjacent checks pass across `combat-item-consumption`, `combat-equipment`, `starter-items-combat` and `combat-controlled`: stock exhaustion, JSON reload, preview/rejection, accepted miss, duplicate command, delayed resolution, provisional Controlled prime/cancel/release, per-battle caps and malformed restored receipts.
- 61 focused DB/adjacent checks pass across `consumable-item-stock-settlement`, `item-inventory-migration` and `eight-slot-item-equipment-migration`.
- The final 12 consumption DB checks pass after extending the actual Reversal arming case through an incoming enemy hit and interception: exactly one owned unit and one audit receipt are spent.
- Real SQL tests cover exact replay, stale version, terminal finishing hit, other owned stack preservation, empty equipment on the next preparation, delayed/no-input turns, Controlled preparation/cancellation/release, retained captures, stock disappearance, removed/forged receipts, immutable/private audit ACL and rollback after later privacy-journal rejection.
- Full-migration PvE startup uses actual preactivation state, the shared production Tag binder, real automatic source activation and `create_battle_session_v2`. It was observed RED, then GREEN. Wrong compiled damage, stock quantity, source identity and same-version consumption receipt are rejected without inventory changes.
- The independent reviewer exercised existing real PvP active/terminal and World startup fixtures with the exact trigger injected into their predecessor-isolation setup: all three were observed RED before the compatibility fix and GREEN afterward. This supplements, rather than replaces, the full-migration PvE/admission checks.
- Both game-core and DB TypeScript checks pass. Focused ESLint, formatting and diff checks pass. The separate owner-only stock projection/native work is recorded by its owner; the private ledger is omitted from viewer snapshots.

PGlite tests verify real migration SQL and transaction rollback, not multi-connection database contention. The root integration task owns the final full quality/configured CI gates and any later release decision.
