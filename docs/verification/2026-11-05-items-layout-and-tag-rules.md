# November 5 post-release Item layout and tag rules

Status: source implementation and verification in progress; this refinement is not deployed.

The earlier Items release remains live on `dpl_D79wgdgrFWWjf3kom6sfypujPk6F`.
This work starts from main `e4dd343b9c441fa65d50027b3b5df2f541a51e45` on an isolated
`agent/equipment-fit-20261105` branch. It does not authorize another deployment or hosted publication.

## Owner direction and implementation

- Fit all eight equipment positions in the ordinary desktop panel without an internal equipment scroll.
  Preserve the existing shared cockpit/inventory/equipment artwork size. Use compact horizontal
  desktop cards, bounded portrait painting and consistent gutters. Keep mobile cards readable.
- Tighten inventory name rows without changing artwork, quantities, equipped badges or actions.
- Item facts: Tier, Quality Points, Maximum stack; then Class, Position, Type. Uses per battle is
  the seventh/last field where applicable. Consumable Position reads `Consumable Slot`.
- Give popup summaries and reports a consistent measure, align report values beside labels,
  and retain wrapping. Remove the duplicate armor/glove stat-change footer.
- Weapons: Manual Basic Attack plus optional Manual imbued technique, no held passives.
  Armor/gloves: passive modifiers only, no active actions/bindings. Enforce current publication
  rules server-side and restrict the shared editor; retain historical grammar unchanged.
- Remove Emberbrand/Tower Shield held passives and Wardstone Bracer’s Warding Prayer. Keep
  Kindle/Tower Guard selectable for their weapons. Preserve QP/cost/duration/stock/requirements.
  Emberbrand attack scaling changes from 1300 to 1400 basis points to retain the existing
  tested weapon damage-per-AP band after removing the passive; base Fire damage stays 6.
- All current Item action timing follows the global tag policy. Remove source-wide hardcoded
  Instant wrappers. Inventory reads the current policy once per refreshed state and Master
  preview consumes the same timing context; battle reports continue using captured policy.
- Stat reports use names such as Evasion [+1%], Initiative [+3], Movement [+2]. Evasion 100
  stored basis points means +1 percentage point; values/formulas do not change. Omit repeated
  Requirements maintenance wording. The Requirements row and enforcement remain intact.
- Profile green/red contribution hover/click lists only equipment names and signed contributions.
  Ordinary stat help stays accessible by clicking/keyboard on the stat itself.

## Current hosted evidence (read-only)

The actual live timing policy is version 11 with `tagAuthority: global`. Explicit Instant tags:
Summon, Sensory, Displace, MP Drain, Blindside, Conductive, Remove Status, Barrier Change,
Create Terrain. Return to Turn Start is Controlled. Damage Up (`inspired`) has no override,
so ordinary global rules use next-round activation. No timing setting was changed by this work.

A read-only audit of all 47 Item records found a maximum version floor of 5. The exact 20
source candidates use version 6. The candidates, pre-change bodies and timing policy are in
[the successor audit](2026-11-05-items-polish-successors.json).

The previous three-successor audit/receipt remains historical and unchanged. Source version 6
must never replace retained bodies at versions 1/2/4/5. Existing admitted battles retain their
captured definitions/policy, including old weapon passives and old armor Support selections.

For a later authorized release, refresh record revisions/version floors, Owner drafts and current
bodies before source registration. Only Emberbrand currently has a publication that needs the new
role body: normal fresh-CAS Commit after source6 registration projects publication7, subject to
fresh state. Timing-only publications already obey global timing; do not broadly republish them.
Wardstone and Tower Shield currently use immutable-source fallback. A removed current equipment
Support can be repaired through the ordinary chooser/unequip fallback; no batch rewrite of
characters, drafts, inventory, historical versions or battles is part of this change.

## Verification selection

First reproduced the desktop bug: at 1536×614 the original equipment panel overflowed by 281px.
The new native guard checks every slot is already inside the panel without scrolling, actual
image size remains equal to inventory/cockpit, and text/art stay inside cards. Popup tests retain
focus, direct mutation, sorting, stale/lost-response recovery, QP, distinct consumables and stock.

Focused and adjacent checks cover:

- all 47 source bodies with exactly 20 audited successors and 27 unaffected defaults;
- current publication role rejection plus retained historical parses;
- actual Kindle commit/pending/round activation under Normal, Delayed and Instant global policy;
- inventory/preview timing reports and actual disposable-DB Item reads/writes;
- ordinary weapon/consumable mechanics under an explicitly chosen global Instant test policy
  (isolates mechanical assertions from the separate real timing tests);
- readable stat amounts/units, metadata order, armor footer omission and Profile source-only hover;
- full native Items/Arsenal fixture with production CSS across nine existing shell sizes,
  actual static artwork, modal actions, keyboard/touch and retained Support chooser recovery.

Final results, independent review and fresh-main reconciliation will be recorded after execution.
No hosted grant, consumption, migration, source registration, publication or deployment is tested
by issuing real writes. Existing Vercel Git deployment locks remain unchanged.
