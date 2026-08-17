# AUREVANE — Phase 0–2 Retroactive Compatibility Audit

**Audit date:** 2026-08-17  
**Implementation boundary:** P2.6 — Recruit AI + Tactical Hall Vertical Slice  
**Disposition:** No speculative Phase 0/1/2 schema or runtime expansion is required by this audit.

This audit reconciles the already-built Phase 0–2 foundations against later-approved identity, staff authority, profession/economy, item/enchantment, Homestead/Vault, and persistent-event requirements.

The rule applied here is intentionally conservative: a later feature being absent is **not** an early-phase defect. An early fix is warranted only when the current implementation hard-codes a shape that would force destructive redesign or create an authority/security contradiction later.

## A. Personal Title identity boundary — compatible; no early schema change

Current identity already separates:

- stable account identity (`auth.users.id` / `player_profiles.user_id`);
- stable character identity (`characters.id`);
- character display identity such as name, portrait, presentation and appearance;
- gameplay stats/progression from presentation fields.

Nothing requires Personal Titles, earned titles, Display Title selection, or Official Badge state to be embedded in the existing character row now.

Future Phase 10 implementation can add additive authoritative structures for:

- the immutable Personal Title text entitlement;
- earned-title entitlements/collection;
- selected Display Title reference;
- Official Badge projection derived separately from staff/Owner authority.

Official Badge must remain an authority-derived presentation fact, not a title string that grants permissions.

**Result:** no migration or domain field added in Phase 1/2.

## B. Owner/staff authorization boundary — compatible; no early role system

The existing request path already has the required secure spine:

```text
authenticated Supabase principal
→ verified server-side subject / userId
→ server-authoritative service/command boundary
→ private authoritative persistence
→ durable command/event history
```

Existing code does not authorize from a character name, display string, or client-authored `isAdmin` flag. The intended Owner character name `Zei` therefore has no authority meaning.

The browser Supabase client receives only public URL/publishable configuration. Service-role/secret credentials are isolated behind `server-only` server code, and private authority tables/functions revoke direct browser-role mutation.

Later staff authorization can add server-side role/capability resolution against the stable account principal. The approved future authority classes remain exactly:

- GAME OWNER;
- MODERATOR;
- CONTENT STAFF;
- EVENT STAFF.

Normal players are not a staff role.

Future privileged commands must resolve current capability server-side and append an auditable privileged-action record. Existing actor keys, command names, idempotency records and append-only event conventions are compatible with that model.

**Result:** no `/master`, staff table, staff UI or capability grant system is pulled into Phase 0–2.

## C. Professions/economy future-proofing — no blocker exists yet

No production item/material/profession ownership subsystem has been implemented in Phase 0–2, so the runtime has not committed to an incompatible ownership shape.

When the profession/economy phase becomes active, the authoritative item model should follow the existing canonical design:

- stable Item Definition/material IDs separate from display names;
- owned Item Instance/stack identity where required;
- one Craft specialization and one Gathering specialization;
- profession level/XP stored independently for each active specialization;
- immutable/historical crafted provenance using stable character/content identifiers plus display snapshots where useful;
- explicit item location/ownership state capable of inventory, equipped/loadout, Vault, Trade House escrow/listing, commission escrow and other justified states;
- enchantment references/state attached through normal item definitions/instances rather than profession-specific combat branches.

Approved profession choices remain:

**Craft:** Weaponwright, Outfitter, Enchanter.  
**Gathering:** Prospector, Forager, Tracker.

**Result:** adding placeholder tables now would be speculative and would make the later authoritative item architecture harder, not easier.

## D. Future enchantments in combat — compatible with typed combat grammar

Phase 2 combat already uses typed/versioned action, targeting, status and effect definitions. Damage, healing, resource changes and status application resolve through the same combat grammar rather than source-specific scripts.

The stat-driven combat bridge also records typed provenance for the combat profile that was frozen into the encounter.

Future equipment/enchantment resolution can therefore occur before battle snapshot creation by resolving the active authoritative loadout into:

- stat/profile contributions;
- granted/modified action definitions;
- status/effect references;
- typed triggers/requirements as those primitives are implemented.

Combat should receive the resolved legal definitions/state, not ask whether an item happened to be crafted by an Enchanter.

No code such as `if itemWasCraftedByEnchanter` is required or justified.

**Result:** no Phase-2 enchantment seam needs to be added now.

## E. Titles/badges versus combat — correctly isolated

Current combat authority uses combatant IDs, teams, committed tactical state, stat profiles and provenance. Player-control determination is not derived from a title, badge, character name or other display string.

The current cockpit maps combatant identity to simple presentation labels only. A future compact Display Title/Official Badge treatment can be layered onto presentation without changing combat resolution or permission checks.

**Result:** no title/badge combat fields added.

## F. Homestead Vault versus combat-carried inventory — no conflicting assumption

Phase 0–2 has not yet implemented general owned-item inventory or an equipment/loadout snapshot. Consequently there is no current rule that every owned item is automatically usable in combat.

The later inventory domain must preserve distinct authoritative locations/availability, including at minimum:

```text
owned + carried / equipped / active loadout
≠
owned + Homestead Vault
```

A Vault item is not combat-accessible merely because the character owns it. Deposits/withdrawals later become authoritative atomic item-location moves, and an item must never simultaneously be equipped, traded/escrowed and stored.

This matches the canonical Homestead requirement that the Vault is expanded **non-combat storage** and does not increase combat consumable limits.

**Result:** no Homestead/Vault implementation is pulled forward.

## G. Persistent Events composing combat/world systems — compatible

P2 combat already distinguishes persisted battle instances from versioned rules/content:

- each run has a battle/session identity;
- battle state carries rules/content versions;
- actions/statuses use stable typed IDs and versions;
- scenario-derived combat profiles carry source identity/version provenance;
- committed events are append-only and ordered.

A future persistent Event definition must reference stable published content/encounter definitions and then invoke the existing encounter, battle, quest, reward, world-marker, vendor and economy systems. It must not clone any of those engines.

One future implementation detail is intentionally deferred: a persistent Event should reference a stable **encounter/content definition ID**, not a generated per-run `battleId`. Phase 2 has not hard-coded event identity into `battleId`, so that definition reference can be added additively when the encounter/event catalog actually exists.

**Result:** P2.6 introduces no event-specific combat engine and requires no event seam now.

## Audit conclusion

The retroactive additions reveal **zero destructive early-phase architectural blockers**.

Already-established foundations are sufficient because they preserve:

- stable account and character principals;
- server-only authority boundaries;
- additive persistence evolution;
- typed/versioned combat content;
- presentation strings isolated from power/authorization;
- no premature inventory-location assumptions;
- versioned battle/content identities that future systems can compose.

Therefore this audit deliberately adds **documentation only**. It does not add title fields, staff roles, profession tables, item tables, enchantment state, Vault storage or Event infrastructure before their canonical phases.

P2.6 remains the active implementation ticket. After its exact validation/merge gate, the next canonical ticket is **PV-1 — Tactical Combat Proof**.
