# Universal support actions — November 2, 2026

Status: implemented and independently reviewed; final local quality gate and native browser checks pass. Source only, not live.

The Owner retires Guard as a selectable Skill and adds three universal support actions alongside HP Recovery and MP Recovery. Guarded and other existing defensive statuses remain legitimate mechanics. Saved historical encounters and immutable content versions retain their captured definitions.

| Action | Cost | Cooldown | Current behavior |
| --- | --- | --- | --- |
| Pilfer | 15 AP | 1 owner turn | Adjacent attack, 4 base Pierce damage without offensive-power scaling or critical hits; ordinary damage modifiers and Barrier still apply. Loot is an inert future-system hook with no inventory, currency, reward or random theft mutation. |
| Fleetstep | 30 AP | 2 owner turns | Up to 4 legal tiles through the existing independent movement allowance. |
| Invocation | 45 AP, 10 MP | 4 owner turns | Call Vesper, a silver-blue mythical moon drake, for 4 completed summon turns. One owned active or pending Invocation summon at a time. |

Vesper is a small horned moon drake with turquoise eyes and a luminous crescent tail, not a plant creature. It has 40 HP, 12 MP, Movement 4, Jump 1, Initiative 25, Accuracy 80%, Evasion 10%, Armor 4, Ward 6, Physical Power 16, Mystic Power 20 and 25% summon potency. Its standard AI uses Moon Bolt: 45 AP, no MP, range 1–3, line of sight, 4 base ward-mitigated damage. Captured spawn profiles preserve literal stats, artwork identity and completed-turn lifetime.

Invocation is the sole current Summon source; Pilfer is the sole current Loot source. Current authoring and new encounter captures enforce this restriction without removing historical parsers. Wildwarden's `renewing-herbs` stable identity receives a new Briar Snare version: 35 AP, 5 MP, range 3, elevation 1, line of sight, 8 Physical Damage and Root for 2 turns, cooldown 3. Old Summon versions remain readable.

The source migration retires current Guard metadata, replaces active/saved Guard support choices with HP Recovery through audited versioned updates, and admits the five current choices. It preserves immutable versions, drafts, publication rows and exact historical idempotent receipts. New Basic metadata is seeded without fabricating published mechanics or overwriting Owner-authored versions. Current catalogue lists exclude Guard while exact historical lookup remains available.

Original generated action icons and Vesper portrait are committed as static WebP assets with generation identifiers in the image registry. Existing finalized uploaded artwork takes precedence. The shared summon portrait component admits the exact registered static portrait and retains its initial fallback on image errors.

Release requires the compatible application and reviewed migration together, plus verification of any installed catalogue overrides. No hosted migration, publication or deployment is performed by this implementation step. Final local quality gate, native browser verification and independent review receipts will be recorded before the successor PR commit.

Guided Fundamentals now captures HP Recovery for its support lesson and starts the player at 75% HP. The actual canonical Recovery command completes the lesson; historical policy-absent captures retain their Guard criterion. Shared controls use the captured practice action even when the saved current Support choice is Pilfer.

Combined verification: `pnpm check` passes 15,984 Vitest tests, seven Node tests, formatting, lint, types and production build. Final-source command-feedback Chromium and 76 targeting cases pass. Full evidence and release limits: `docs/verification/2026-11-02-battle-support-feedback.md`.
