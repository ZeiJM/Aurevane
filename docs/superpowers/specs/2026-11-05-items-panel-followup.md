# Items authoring, inventory and battle presentation followup

Status: Owner-requested source implementation in progress, not live. This work does not authorize deployment, hosted migrations, content publication or real inventory grants. The preceding Seal + Damage Up release is separate and complete.

## Current terminology

| Field | Meaning | Examples |
| --- | --- | --- |
| Class | Inventory grouping | Gear, Consumables, Materials, General, Event, Companion |
| Position | Legal equipment position(s) | Head, Body, Pants, Boots, Main Hand, Off Hand, Consumable 1 / Consumable 2; N/A when not equippable |
| Type | Item subtype | Weapon, Armor, Gloves, Consumable; N/A where not applicable |

Persisted `inventoryCategory`, `itemClass`, `hand-armor`, `battle-item` and equipment identities remain stable. Eight positions and the 100 QP budget remain authoritative. Main Hand weapons include swords, shields and staves. Two-handed weapons block Off Hand only; both consumable slots remain independent and usable, but must contain different Item identities (separate stacks of the same consumable do not bypass this rule). Historical captures and existing Owner drafts are preserved.

## Master Item panel

Search the effective Item definition's name, identity, Class, Type and Position before pagination, using draft then publication then source precedence. Keep other content search unchanged.

A compact grant toolbar finds characters by name and requires explicit recipient selection. An unresolved typed name must never silently target the actor's own character. Game Owner authority protects arbitrary-recipient grants; existing staff self-test permissions remain. Derive recipient ownership server-side, check current selection, locks, current catalogue/revision, quantity, capacity and deletion state, and retain immutable grant audit/deduplication. An uncertain outcome must retain the same request identity on explicit retry; switching Items must not discard an unresolved receipt.

Hide internal Display order without rewriting it. Keep long fields contained and one information popup per field rather than duplicated inline guidance. Compact the frozen header/actions/tabs to maximize the scrolling editor while retaining Commit controls. Class and relevant Type/Position/Hands controls must be understandable; automatic behavior wiring remains functional without raw redundant binding selectors.

Armor chooses Position. Gloves is the current name for the stable Off Hand armor identity. Weapons alone offer optional Imbued Technique authoring in its own tab through the shared Skill editor. The normal equipment Support mechanism exposes the technique as one selectable Support choice alongside Basic Support choices while equipped. Unequipping removes that option and restores the previous Basic Support. Attack and unrelated groups survive editing. Disabling removes only its owned technique group on Commit; re-enable while the same editor stays open to undo before Commit. Do not promise disabled technique persistence across reload that the schema cannot support.

Equippable Items may optionally require a minimum level, any listed currently equipped discipline and all configured minimum base Core stats. These are equip/admission requirements, independent of a behavior's combat Requirements. Missing equip requirements preserve unrestricted current behavior. Authoritative equip and new battle admission enforce them; no client-provided character facts or equipment bonuses may satisfy them. Rejected actions spend no costs and do not silently unequip or alter inventory/history.

## Inventory and equipment

Apply chosen sorts immediately through the authoritative writer, then refresh. Remove Save order, Reload Items and persistent top mutation success/error banners. Refresh after actions and once after failures without automatically replaying equip/unequip. Display genuine failure feedback locally. Preserve battle, capacity, current-catalogue, deletion and CAS guards.

Show only relevant filters and sorts for the selected Class; clear incompatible filters on changing tabs. Remove Unavailable as a filter without hiding or deleting owned archived/disabled Items. Inventory and equipment artwork share the actual cockpit artwork scale. Equipped slots show item name/QP above centered artwork and Position below; make Equipped badges noticeable. Remove the mannequin Template caption. Basic Attack slot shows the equipped weapon's name or Unarmed.

Clicking an empty equipment slot opens a compact wrapped horizontal picker of applicable owned Items with small artwork and names. Equipping uses the clicked position, or chooses an applicable position automatically from inventory; there is no position dropdown. Consumable slots preserve independent uses and require distinct Item identities.

Inspect popups use space compactly. Show only Equip/Unequip actions and proven green/red stat changes (including capped Evasion from authoritative base facts) in the action area; non-equipment offers disabled Cannot be equipped. Remove comparison headings, replacement reports, QP prose and optional-removal controls. Preserve required legal replacements and budget rejection; never silently remove extra gear merely to fit QP. Equipped and non-equipment popups have no mostly empty action column. Remove the Flavor notice and repeated passive-maintenance sentence. Uses per battle appears once as a structured field beside Maximum stack, below Class; retain unrelated activation limits. A weapon with an available Imbued Technique has a separate reader tab for that technique; no such tab appears without one.

## Shared readers and battle controls

All effect parameters must be visible without horizontal scrolling or clipping in inventory, battle and shared readers. Short phrases remain one line; long phrases wrap naturally at readable size. Preserve colors, help, complete effects, timing, recipients and historical semantics.

The battle Item button remembers the last consumable selected from the preview pane for both artwork and information. Retain selection across other action choices, while validating identity against the current battle/actor and available captured Items. Selection never commits an action by itself. The preview's information trigger uses the same round gold style as cockpit information controls. Preview rows omit Consumable 1/2 labels, retain allowed/remaining uses and show safe owner-visible stock on hand; each committed use decrements the equipped owned stack once under the current consumption policy, while old captured battles retain their literal policy. Do not expose opponent/spectator private inventory quantities.

Battle Item information popups match Skill information: title, Parameters and effect explanations. Omit thumbnail/consumable header and duplicated per-battle usage prose/bullets. This does not remove inventory's structured uses field.

## Consumable stock and battle uses (latest Owner clarification)

This supersedes the earlier refill-only/no-stock-consumption rule. Every accepted committed consumable activation spends one unit from its actual equipped owned stack. Rejected commands and previews spend none; command retries, delayed effects and duplicate settlement cannot spend a second unit. Provisional Controlled preparation/cancellation does not consume stock. A fully committed Reversal arming activation does consume one unit (including an authored zero-AP activation), because its buff and activation usage are committed at that point; the later automatic interception spends no additional stock. The battle commit and stock settlement must be atomic, with an inventory revision update and current ownership/locking protections. An accepted activation consumes stock even if its effect misses; acceptance is distinct from a successful hit.

The Item remains equipped while that stack has sufficient copies. When the stack is exhausted, remove its assignments. Never refill or substitute another stack automatically, even when it has the same Item identity. The player must manually equip another stack from inventory when ordinary equipment changes are permitted. Preserve the existing prohibition on player loadout changes during pending/active battles.

Each captured consumable action also retains its authored legal uses-per-battle cap, reset for each new battle. Resetting that cap does not create stock. The two consumable positions cannot contain the same Item identity, even from different stacks. Reject duplicate readiness and new admission until repaired; existing invalid loadouts remain manually repairable without automatic inventory mutation. Defensive handling of historical captures must never create a second spend of one owned unit.

Keep an editable Uses per battle control for consumables in Master and one structured inventory-popup field. Stock shown in battle must follow the authoritative remaining count, without exposing private opponent/spectator inventory. Pin the new consumption policy for newly admitted battles; do not reinterpret historical or already active captures.

## Item-engine audit and release boundary

Audit all 47 source/effective Items against the current Skill engine, including Damage Up scopes, effects and descriptions. Correct demonstrated mismatches with reviewed immutable successors, never rewrite historical definitions. Current findings are Emberbrand's Kindle Fire-only intent missing explicit Fire scope, Vulnerability Oil's misleading next-opening wording and Ward Sigil's misleading single-use wording. Existing current publications override new source versions until a separately authorized normal versioned Commit; prepare exact successor candidates and record the boundary truthfully.

Run focused regression and real authority tests, responsive native component verification, independent review and the full applicable quality gate after stabilization. Configured exact-head checks remain mandatory. Refresh main before finalization, preserve concurrent work, keep Git automatic deployments disabled and push without force. No human acceptance, hosted change or live release is implied by a passing local test or source PR.
