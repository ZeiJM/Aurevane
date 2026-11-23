# AUREVANE — COMPLETE SKILL ENGINE, CONTENT SYSTEM, PUBLIC PRESENTATION, AND MASTER PANEL REDESIGN

## 1. The assignment and its full scope

Design and deliver one integrated overhaul of Aurevane’s **skill/gameplay engine, tag architecture, content creation, public and battle presentation, and entire Master Panel**. The skill engine is the foundation of this project—not an incidental part of a panel reskin.

The central rule is:

> **A supported, structured definition determines what something does. The engine executes it, the Master Panel edits it, and every public or battle display explains that same definition. Freeform descriptions never create gameplay rules.**

Apply this architecture to **Basic Skills** such as Move and Basic Attack; **Discipline Skills; Essence Skills; Resonances; future Items and equipment, including weapons; future Ascensions; and future Severences**. Include direct **Discipline creation and management**, not just individual skill editing.

Also redesign Combat Rules, Site Music, Staff & Access, Event Builder/Live Ops, and a new Players management page. Everything should be integrated, modular, logical, accurate, and simple to operate.

This is the complete replacement brief. Do not depend on another conversation to recover omitted requirements. Read the current `ZeiJM/Aurevane` repository, game-design documents, runtime, data definitions, tests, permissions, migrations, and relevant open work before proposing code changes. Do not claim that the behaviors described here already exist.

Another workstream is updating elemental tags. Reconcile its latest Owner-approved decisions without overwriting, duplicating, or reverting its work. Do not reset newer main to an older handover or absorb unrelated projects.

Begin with an evidence-based audit and integrated design, then a phased implementation plan. Obtain the applicable design/implementation approvals before building; this brief does not independently authorize destructive production changes or live deployment. Do not repeatedly reopen the Owner’s explicit requirements. Where this brief labels something a **recommended default**, distinguish it from an already approved gameplay decision and resolve material consequences before implementation.

## 2. Design the shared engine first

Audit inconsistencies across execution, validators, persisted definitions, targeting, timing, descriptions, and editors. Identify mechanics hidden in prose, hardcoded skill-specific branches, duplicate tag names, undocumented interactions, unsupported combinations, and values interpreted differently in different places.

Design a shared definition model separating **identity/source**, **behavior**, **presentation**, and **live instance state**. An item or Discipline can contain references to abilities without pretending to be a castable skill. A specific battle effect or primed skill is an instance of a definition, not a mutation of the global definition.

Keep these concepts distinct: content category; Attack/Recovery/Utility classification; Physical/Mystic scaling; damage family; activation mode; requirements; effect timing; and effect duration. A future Ascension can grant a manual ability, an automatic effect, an ongoing bonus, or a supported combination. Its source category does not decide its activation behavior.

Use reusable behavior groups when genuinely needed, with one straightforward group for ordinary skills. Support both **performing an action** and **modifying a qualifying action**. A resonance that adds an effect to an Ironfist attack must integrate at the correct composition stage, not become a separate delayed action that attempts to modify an already resolved attack.

Define a coherent authoritative execution sequence: identify the usable definition; compose eligible modifiers; check activation and requirements; resolve legal targets and geometry; commit costs/action use; perform applicable accuracy checks; resolve effects in explicit order; establish durations/timed effects; emit supported events; update cooldowns; and generate messages from actual outcomes. Document ordering differences where a mechanic requires them.

The server is authoritative. Client validation supports usability but never substitutes for execution checks. Repeated requests must not spend resources, apply effects, or award outcomes twice. Failures must explain the actual blocking rule.

Do not change unrelated damage formulas, progression balance, action economy, or resource recovery just to simplify the editor.

## 3. Modular tags and typed parameters

Create or consolidate one supported tag registry. Each tag should define its stable identity, editable display name, purpose, typed parameters and units, permitted recipients, applicable timing/duration/stacking rules, compatibility constraints, execution handler, and concise/full descriptions. Only expose settings relevant to that tag.

Damage power, percentages, flat resource amounts, tile distances, target counts, stacks, turns, and rounds must remain different value types. Never reuse the 1–20 damage scale for every numeric field. References between content records must use stable identifiers, not matching names or parsing text.

Provide reusable requirement predicates and event requirements rather than a new hardcoded tag for every possible threshold. For example, an HP comparison can configure subject, comparator, value, and percent-versus-flat units. A status check selects an existing status definition.

Provide a **Tag Library** with search, sorting, explanations, valid settings, compatibility guidance, and “Used by” relationships. Editors may configure implemented tags and approved presentation metadata. A genuinely new mechanic needs an implemented, tested handler before it becomes usable. Do not imply that typing a new tag name or description creates working behavior.

Identify missing tags necessary for the requested architecture and propose/implement them through the same supported system. Do not build arbitrary scripting, raw JSON authoring, or a general-purpose visual programming environment as the normal interface.

## 4. Standardized skill fields and notation

The editor and public popup must use the same parameter names, order, units, and formatting. Preserve the Owner’s requested fields, with contextual omission only when a field is genuinely inapplicable. Missing required configuration must cause a validation error, not an N/A display.

| Field                | Required design                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Type**             | Attack, Recovery, or Utility. Attack retains **[Physical]** or **[Mystic]**. Keep content category separate.         |
| **Cost**             | AP, MP, HP, or multiple simultaneous costs. Show None for no cost.                                                   |
| **Cooldown**         | None or X Turns; explicitly define whose turns and the tick boundary.                                                |
| **Requirements**     | None or supported, parameterized requirement tags, including event-based conditions.                                 |
| **Effects**          | Supported effect tags with their actual values, recipients, timing, duration, and relevant conditions.               |
| **Range**            | Numeric, bounded by the authoritative maximum for the largest supported battle map using its actual distance metric. |
| **Target**           | One or more of Self, Ally, Enemy, Ground.                                                                            |
| **Method**           | Ordinary target count, Line [x], Circle [x], or All.                                                                 |
| **Target Elevation** | Supported values 0–3, with the exact existing meaning made explicit.                                                 |
| **Line of Sight**    | Required or Not Required.                                                                                            |

Use compact, consistent formatting, such as **AP [1] · MP [20] · HP [10]**. These numbers are examples, not balance changes. Use brackets for tag values and a middle dot between independent entries. Logical All/Any groups require labels; punctuation must not determine gameplay.

Use restrained, consistent colors for semantic categories, values, durations, and linked terms. Avoid a rainbow of unrelated colors. Do not encode meaning by color alone.

Pay simultaneous costs atomically once per committed activation, not once per effect or recipient. Revalidate resources before committing. **Recommended HP-cost default:** leave at least 1 HP; lethal self-payment requires an explicit supported rule. HP payment is not automatically damage and should not trigger damage-received behavior unless deliberately specified.

Separate effect start timing from lifetime, tick frequency, remaining duration, and cooldown. Standardize whose turns count, when ticks occur, stacking limits, refresh/replace behavior, and rounding without silently rebalancing existing effects.

## 5. Target selection, effect recipients, and ground behavior

Separate **what the player selects**, **the resulting area**, and **who receives each effect**. A skill may damage an enemy, restore the user’s MP, and affect ground; those results must not be represented as one ambiguous Target paragraph.

Allow multiple permitted target categories, but do not assume every effect applies to all of them. Configure each effect’s recipient or a sensible inherited recipient. Distinguish the user, selected unit(s), affected units, affected ground, and supported triggering actors. Define whether Ally includes Self; the recommended default is to keep them separate.

Remove Terrain as a competing target type and migrate those references to Ground. Preserve actual map terrain, obstacles, elevation, surfaces, and ground-effect mechanics. Do not delete functionality merely because its old field used the word terrain.

For ordinary targeting, display the allowed number of selections rather than another wordy method name. Recommended behavior is up to that number of distinct legal recipients, with stricter counts only when explicitly supported.

**Line:** hit every eligible recipient within the legal line footprint, not just the first unit. Reconcile the approved geometry and exact meaning of x before migration; never silently reinterpret it as a target-count cap. Show/test the resulting footprint and obstacle behavior.

**Circle:** use the user as the center and expand through grid-based square rings. Circle 1 covers the first surrounding ring; Circle 2 includes the first and second rings. Do not turn it into a remote-center circle or an outer-ring-only attack. Apply recipient filters; including the user requires Self. Do not imply that Range moves its center.

**All:** target every eligible recipient of the configured categories across the field, including Ground where supported, regardless of Range. State any remaining restrictions explicitly. The recommended default is that All bypasses range, not costs, requirements, or independently configured elevation/line-of-sight restrictions. Do not display a misleading numeric range limit for All.

Ground lifetime, start timing, entry effects, affected teams, and interactions belong in structured effect settings—not a sprawling Target row. Define whether repeated entry, multiple affected tiles, or overlapping areas apply an effect once or repeatedly. Preserve established rules unless a change is explicitly approved.

## 6. Unified Requirements, including triggers

The Owner explicitly wants triggers streamlined into Requirements, not a separate competing authoring system.

Use one system supporting state checks, action qualifications, and events. Distinguish “HP is below 30%” from “HP falls below 30%,” and “while equipped” from “when equipped.” A true state being checked repeatedly must not accidentally produce repeated activations.

A compact **Activation** setting—Manual, Automatic, or Ongoing—is the recommended design. Manual waits for a legal player request. Automatic responds to a supported event or defined condition transition. Ongoing maintains its effects while its requirements remain satisfied.

Support requirements at both ability level and effect level. A skill’s conditional self-cleanse must not prevent its damage merely because the user lacks the cleansed status.

Support explicit All/Any groups, relevant comparators, subjects, status presence/absence, resource thresholds, qualifying skill/category/Discipline tags, and supported battle events. Examples include taking positive HP damage, using a qualifying attack, reaching a round boundary, or having a primed skill. Validate unavailable event subjects and values. Do not pretend that unrelated past events are a supported sequence trigger.

For automatic behavior, define event phase, target references, costs, cooldowns, chances where relevant, once-per-action/turn/round/battle limits, and multi-target/multi-hit behavior. Avoid self-trigger loops, duplicate procs, and unlimited chains. Distinguish changing a qualifying action from reacting to its completed outcome.

Future Ascensions, Severences, weapons, and other items must reuse this architecture. A source may contain mixed behaviors without forcing every simple skill through a complicated editor.

## 7. Fourth timing: Controlled, including Rewind

Retain **Instant, Normal, and Delayed**, and add **Controlled**. Verify and preserve the documented existing timing boundaries: immediate, next global round, and one global round later respectively. Do not confuse any of these with effect duration.

**Owner-required Controlled behavior:** when a skill has an applicable tag configured as Controlled, its first use primes it. The cockpit skill button visibly indicates Primed. The player can use it again to activate when costs, requirements, targeting, and other legal-action conditions are satisfied. Release can happen in the same round or a later round; it must not require waiting for an automatic delayed timer.

Design this as authoritative **Prime → Release** state, not a browser-only marker. A refresh or reconnect must not lose a valid prime. Represent ready-to-release versus temporarily blocked clearly without redundant floating cockpit buttons.

Resolve these details explicitly in the design rather than treating earlier brainstorming as approval:

**Recommended defaults:** one prime per character/skill/battle; priming does not spend or reserve the ordinary activation cost or start its cooldown; full payment and action use happen once on legal release; a Controlled tag gates the whole selected action rather than letting its other effects fire during priming; rejected release retains the prime; a committed activation consumes it. Confirm the priming action-budget implications before implementation because free priming affects balance.

Allow compact cancellation. Define cleanup on defeat, skill removal, battle end, or administrative ejection. Temporary inability to act should block release rather than silently discard the prime. Do not add an arbitrary expiration, auto-release, repeated stacking of primes, or cross-battle carryover.

Specify what is captured at priming and what is revalidated at release. For ordinary effects, current legal targets may be chosen on release unless a supported rule locks them earlier. Reject incompatible Automatic/Ongoing Controlled combinations without a defined player-release mechanism. Handle simultaneous clicks, stale commands, and definition updates safely.

**Set Rewind to Controlled once through an idempotent migration.** Do not reset an editor’s later timing choice on every deployment. Inspect its real mechanic and capture the relevant existing anchor/snapshot at priming, not at release. Preserve the intended state being rewound and legal destination checks. Do not invent HP restoration, refunds, inventory rollback, or rewritten battle history. Replace forced delayed execution with the intended manual release and explain blocked destinations.

## 8. Pierce as a damage family

Redesign Pierce as **Pierce Dmg**, alongside Neutral and elemental damage. The intended interpretation is bypassing the **damage recipient’s Armor**, not the caster’s own Armor; make that interpretation explicit in the design.

Keep its damage power on the standard 1–20 scale and its Armor bypass as a separate parameter. **Recommended bypass unit: 0–100%**. The Owner requested a defined amount, so confirm the percentage interpretation instead of presenting it as already settled.

Illustrative presentation: **Pierce Dmg [8] · Armor Ignored [30%]**. Descriptor: “Deals Pierce damage at power 8, ignoring 30% of the target’s Armor for this hit.” Neither number is a balance instruction.

Pierce remains separate from Physical/Mystic scaling and accuracy. It can miss under Standard accuracy. Ignoring Armor does not automatically ignore barriers, resistance, invulnerability, or every defensive rule, and it is not a permanent Armor debuff. Even 100% Armor bypass is not unrestricted true damage.

Provide a documented future Armor integration point: determine the applicable nonnegative Armor contribution and reduce it by the configured bypass for that hit. Do not redirect bypass into unrelated current defensive stats just because Armor has not been implemented.

Until Armor exists, do not falsely advertise a functioning Armor-reduction advantage. Clearly distinguish configured future behavior from effective current behavior in the editor and applicable public wording. Do not build the complete equipment/Armor system as an unrequested dependency.

Audit all legacy Pierce handlers, skills, tags, descriptions, validators, and tests. Migrate explicit compatible cases without doubling damage. Flag ambiguous elemental-plus-Pierce combinations rather than silently stripping their element or retaining two contradictory implementations.

## 9. Elemental coordination and preservation

Reconcile the other elemental workstream before modifying shared effects. Preserve the Owner’s decisions: Fire clears Chilled from its user, not hostile recipients, and does not remove enemy Drenched; applicable Frozen Ground converts to Steam for its remaining lifetime. Preserve whether self-cleanse occurs on an otherwise legal empty-ground use or miss according to the latest approved implementation, not merely on positive damage.

Keep Ice damage and its explicit Chilled tag consistently configured, as requested. Reconcile Storm’s Conductive behavior and Water’s Drenched/stacking Initiative reduction with the current approved definitions. Where those decisions live in separate tags, do not hide them back inside damage prose.

Do not turn unapproved illustrative stack percentages, caps, durations, or other earlier examples into balance changes. Preserve the separately approved percentage-based Suppress design if present; do not treat it as 1–20 damage power.

Migrate affected skills and descriptions together. A tag’s dictionary definition, a skill’s configuration, and runtime behavior must not disagree.

## 10. Public descriptions, linked terms, and battle popups

Redesign the full skill popup and its bottom descriptors alongside the engine, not after it. Use concise, polished English explaining what happens, to whom, how strongly, for how long, and under what meaningful conditions. Avoid implementation notes, generic filler, repeated rows in prose, and janky generated language.

Provide three related presentations from the same definitions: **full mechanic explanation**, **compact tag explanation**, and **specific ability/live-instance wording**. For example, explain generically that damage uses a relative 1–20 power scale rather than exact HP damage; a particular technique can simply state its actual damage family and power.

Keep full descriptions, compact battle descriptions, and use/result messages distinct. Do not use a static skill explanation as a message falsely claiming that an attack hit. Condition-dependent effects must remain conditional in wording.

Permit compact repeated-value formats such as Burn [20/15/10%] only when they correctly represent its actual progression. Make the percentage basis, tick order, lifetime, and important special behavior discoverable. Do not shorten descriptions by removing meaningful mechanics.

When another supported tag is referenced, style it consistently and let hover, keyboard focus, or touch open its shared compact explanation. Use actual tag references, not naive text replacement. Referencing Steam must not imply every Fire attack unconditionally creates it. Avoid endless nested tooltips and keep touch dismissal usable.

Upgrade public technique cards, cockpit skill information, character-rail skill popups, active-effect popups, and battle messages. A live status popup should show actual supported stacks, current combined magnitude, remaining duration, and relevant readiness—not only a dictionary entry or an ambiguous “2 turns.”

Show category/activation clearly for passive Resonances or future triggered abilities, without forcing them into a castable-skill layout full of N/A rows. Preview illustrative manual, modifier, automatic, ongoing, mixed-recipient, and Controlled examples before accepting the design.

## 11. Master Panel structure and low-scroll design

Use **Game Content** as the proposed umbrella name, not Skills for everything. Recommended primary destinations are **Game Content, Combat Rules, Events & Live Ops, Players, Staff & Access, and Site Music**. Avoid a redundant Overview page of large decorative cards.

Within Game Content, expose **Disciplines; Skills with Basic/Discipline/Essence filters; Resonances; Items; Ascensions; and Severences**, plus access to the shared Tag Library. Keep category extensions on a shared editor foundation rather than six disconnected implementations.

Retain Aurevane’s visual identity while removing oversized headers, repeated branding, large decorative images, excessive whitespace, long explanatory banners, unnecessary badges, routine reason boxes, and visible policy bureaucracy. Preserve the appropriate account-menu access route and shared game footer/online-user controls.

Use searchable lists, compact toolbars, contextual sections, editable tag controls, and a responsive preview panel. Keep Save/Publish and dirty/draft status easy to reach. Prefer focused tabs and progressive disclosure over one towering form. Avoid replacing scrolling with confusing modal chains or too many clicks.

Minimize scrolling at ordinary desktop sizes, including approximately 1366×768 and 1440×900. Paginate or efficiently render long lists. Avoid nested scroll traps, horizontal overflow, clipped controls, and tiny text. Necessary scrolling must remain usable at zoom and on smaller screens; zero scrolling must not become more important than accessibility.

## 12. Manual creation and direct Discipline management

Authorized editors must be able to **create new content by hand**, not only modify existing seeded records. Support creating, editing, duplicating into a new draft, searching, sorting, filtering, previewing, publishing, and archiving where applicable. Make unpublishing dependency-aware and do not break active player references.

Provide a real **Discipline editor** covering name/identity, description, relevant media, supported eligibility and progression settings, linked skills, supported resonance relationships, unlock conditions, ordering, and public presentation. Reuse the actual game model rather than inventing a new progression system.

Allow creating a new skill directly within a Discipline and associating an eligible existing skill without duplicating its definition. Show “Used by” and reverse relationships. Edits must reach the real player-facing Discipline/progression systems, not just a disconnected catalogue. Preserve appropriate shared relationships, and do not force Basic or Essence skills into fake Disciplines.

Allow new Resonances, Ascensions, Severences, and Items to be manually authored using supported fields and behavior groups. Future categories must have meaningful saved definitions—not empty Coming Soon tabs. However, authoring a future record does not make unimplemented equipment, acquisition, transformation, or progression behavior playable. Block publication/activation of unsupported functionality with a specific explanation.

Protect essential Basic actions and referenced content from unsafe deletion. Renaming must not break stable references. Do not offer audio or unrelated mechanical fields on containers where the game has no meaningful use for them; surface applicable specialized fields consistently.

## 13. Text, media, and hidden accuracy editing

Provide **Parameters, Text, Media, and History** sections or an equivalently compact design. The parameter editor must mirror the public presentation rather than exposing unrelated internal terminology.

Text editing must cover public descriptions, compact battle text, and relevant activation/result messages. Provide **Insert Reference** controls for supported subjects and values, such as User, Selected Target, Affected Targets, Ability, triggering actor, configured power, duration, and actual outcomes when available. Include local writing guidance and examples. Handle singular/plural forms and reject broken references. Do not require remembering special syntax.

Bind mechanical values and linked terms to actual definitions wherever possible. Allow appropriate manual wording without letting prose override mechanics. Validation can flag inconsistencies but must not pretend to prove arbitrary freeform English matches gameplay. Sanitize presentation input and distinguish trusted templates from unrestricted content.

Allow image/audio upload from the editor’s computer, replacement/removal, and relevant existing-asset selection. Preview the real crop and sound. State supported formats/limits clearly. Retain media needed by current content, previous snapshots, or active records.

Add internal **Accuracy: Standard / Fixed**. Standard uses ordinary accuracy/evasion rules. Fixed uses an editor-defined 0–100% chance that ordinary accuracy/evasion modifiers cannot alter; Fixed 100% always succeeds at the applicable hit check. It does not bypass costs, requirements, legal targeting, immunity, or damage mitigation.

Do not add a second evasion check that defeats Fixed 100%. Recommended ordinary behavior is one check per affected recipient shared by hit-dependent effects, with explicit multi-hit rules where needed. Separate attack accuracy from an effect’s independent application chance.

Only show Accuracy where a hit check is relevant. **Keep it out of public cards, public previews, descriptions, and public API data—not merely hidden by CSS.**

## 14. Real previews, publishing, versions, and attribution

Render previews with the actual public/battle components: full popup, compact skill information, linked tag explanations, applicable live-effect display, and sample use/result messages. Include media and Controlled indicators where relevant. Support appropriate sample contexts and a Draft/Published comparison without pretending sample text is a full battle simulation.

Editing saves a draft, not an immediate live change. Publish validates the complete record and updates parameters, references, text, hidden settings, and media together. Prevent stale edits from silently overwriting another editor’s published work. Show specific validation failures beside the relevant controls.

Retain **current plus two previous published versions** as the recommended interpretation of the requested two restore points. Draft saves do not consume history. Show who authored the present version and when, and preserve attribution for the previous snapshots. Record the publisher separately where different.

Restore a prior snapshot into a draft, preview it, and publish it as a new current version. Preserve the original snapshot’s author and identify the restoring actor/source. Restore the full configuration, including hidden accuracy and media references. Validate against supported tag definitions; restoring content is not rolling back the entire engine.

Publication must not split an in-flight action or primed snapshot across incompatible definitions. Define when changes reach active versus new battles and preserve suitable internal consistency safeguards. Never expose those safeguards as user-managed policy-number chores.

No change reasons are required. Do not apply content restoration blindly to staff grants, live event execution, rewards, or player-state changes; these need their own safe operations.

## 15. Combat Rules, timing/elevation settings, and simpler administration

Redesign the existing effect-timing and elevation-change screens into compact focused sections. Preserve the actual elevation mechanics and validations while improving presentation. Keep global elevation-change rules distinct from a skill’s Target Elevation field.

Allow effect tags to be searched, filtered, and sorted by name or timing in either direction. Use an intentional timing order: Instant, Normal, Delayed, Controlled. Display sorting must not alter execution order. Keep timing assignments authoritative and shared; do not create competing copies in different editors.

Remove mandatory reasons from panel forms and the corresponding relevant request validation. Do not silently submit invented reasons. Retain automatic actor/time/action records and appropriate confirmations for sensitive operations without covering the screen in audit widgets.

Remove visible policy/revision numbers and manual policy-management workflows. Editors change the settings and use straightforward Save Changes. Internal concurrency identifiers or snapshots may remain where required for correctness, but the Owner should not have to manage numbered policies.

## 16. Site Music

Replace the current complicated layout with **Global Music** plus a compact page-override list.

Global Music supports an uploaded file, a direct audio URL, or No Music. Each page supports **Use Global, Custom Track, or No Music**. Custom Track supports upload or direct URL. Explicit page silence overrides Global. Global silence must still permit a page’s custom track.

Use actual page names/routes and show the effective track or inherited/silent state. Provide search, preview, replace, remove, and reset-to-global controls. Do not require raw path editing for ordinary tasks. Migrate existing broader route rules carefully rather than silently changing coverage.

All enabled music loops indefinitely. Preserve player volume/mute and playback permissions. Avoid overlapping players; keep the same track continuous across pages that use it, and replace/stop it when the effective selection changes. Site music must remain separate from skill audio.

Validate uploads and usable direct media URLs, provide understandable playback errors, and retain uploaded assets durably. Do not fall back to global music on a page explicitly set to No Music.

## 17. Staff & Access

Allow finding/adding staff by character name or email. Either entry route should resolve the verified identity and show all linked character accounts. **Only the specifically selected character receives the assigned powers.** Shared email is for account discovery, not automatic authority inheritance.

Create clear role presets aligned with the actual game-design permission model: content administration, event administration, and global administration, with player-support/music/settings permissions mapped appropriately. Do not invent or rename canonical roles without checking the approved design. Show a readable effective-permissions summary rather than a raw wall of flags.

Preserve the single protected Game Owner and nondelegable powers. The Owner can revoke delegated access at any time or assign access for X days. Offer No Expiry or a positive number of days, with the resulting expiry date/time displayed.

Enforce expiry/revocation on protected server actions and existing sessions, not only by hiding controls or waiting for scheduled cleanup. Recalculate authority on character switching. Prevent delegated users from elevating themselves or editing player identity/role state to bypass authority rules.

Keep the main directory concise: character, authorized identity details, role/scope, status, expiry, and Edit/Revoke. Put linked characters and details in a focused editor. No mandatory change reasons; preserve automatic attribution and concise sensitive-action confirmation.

## 18. Players: inspection, edits, and force-ending stuck battles

Add a **Players** page searchable by character name with disambiguation where needed. Show relevant profile, verified account linkage, source stats/resources, progression, Disciplines, skills, Resonances, existing inventory/equipment, supported future data, location/activity, statuses, battle state, and useful recent actions according to permission. Never expose passwords, authentication tokens, or unrelated secrets.

Allow direct legitimate gameplay edits through validated authoritative operations. Recalculate derived values, preserve stat/level caps and relationships, prevent stale overwrites, and distinguish writable fields from calculated or protected information. Avoid a raw-database editor. Do not invent editors for nonexistent systems or grant staff powers through player support.

Handle edits during battle safely: use supported battle operations, defer a change, or explain why it is blocked instead of overwriting live combat state blindly.

Provide **End Battle & Eject — No Rewards** for bug-related stuck/infinite battles. Identify the character and encounter, then require a concise confirmation, not a reason essay.

Terminate/remove participation through the authoritative lifecycle, clear encounter locks and queued-action links, discard encounter-only effects and primes, return the player to a valid non-battle state, and update clients. Persist a no-reward outcome that late workers and repeated requests cannot bypass.

Do not grant XP, currency, loot, wins, ranking gains, or other battle rewards from the recovery. Do not accidentally treat it as an ordinary defeat penalty or revoke unrelated previously earned rewards. Preserve established resource-recovery rules rather than inventing refunds.

For shared encounters, remove only the selected character where safely supported. If the whole encounter must be voided, explicitly identify other affected participants and use no-contest handling rather than silently ejecting others or rewarding an opponent. Handle races with normal completion, record the actor/outcome automatically, and make repeated recovery requests safe.

## 19. Events & Live Ops

Audit and retain the useful existing Event Builder and Live Ops capabilities. Combine them into a coherent event workspace with a compact list and focused authoring/live-operation views.

Show event identity, state, scope/location, schedule, and relevant participation at a glance. Organize supported setup, phases/objectives, eligibility, content references, rewards/aftermath, and preview without one oversized form. Use readable reference pickers, not unexplained internal IDs. Reuse actual content definitions rather than duplicating skill/item rules inside events.

Make timezone and affected audience clear. Separate draft edits from live changes. Expose only supported lifecycle actions and their real consequences; do not offer decorative Pause/Resume or recovery controls that have no safe runtime implementation.

Preserve scheduling, publication, global-scope permissions, concurrency checks, and reward guarantees. Emergency stopping must reconcile queued work and settlement, not merely change a displayed status. Repeated actions must not duplicate rewards or replay irreversible effects.

No mandatory written reasons. Keep concise confirmation for consequential live actions and unobtrusive automatic attribution.

## 20. Migration, verification, and required deliverables

Produce an integrated design and implementation plan organized around shared dependencies: engine/tag definitions and contracts; targeting/requirements/timing; shared presentation; content/Discipline creation; panel shell and publication; Controlled/Rewind and Pierce; remaining operational pages; migration and end-to-end verification. Adjust sequencing to real repository dependencies and parallel elemental work.

Create a requirement-to-implementation checklist covering every section of this brief. Identify what already exists, what changes, what is missing, what is future authoring only, and where each requirement will be tested. Do not call future authoring support complete if it is merely an empty tab, and do not call a future runtime complete because a record can be saved.

Inventory legacy content before migration. Preserve stable references, supported behavior, and retained media/snapshots. Report ambiguous or unsupported conversions instead of deleting data. Remove obsolete names, handlers, prose-driven exceptions, and UI paths only after their consumers have migrated. Provide rollback/recovery arrangements for consequential changes.

Test the entire chain: **editor → definition → validation → publication → authoritative execution → public/battle presentation**.

Cover creation and relationships across content types; Basic action safety; AP/MP/HP costs; requirement subjects and state/event semantics; automatic/modifier behavior; targeting shapes and mixed recipients; Ground migration; timing versus duration; Controlled/Rewind reconnects, cancellation, invalid releases, and duplicate commands; Pierce’s power/bypass separation; elemental preservation; hidden accuracy and public serialization; text/reference consistency; media; publication/history/concurrent editors; staff character scoping/expiry/revocation; direct player edits and no-reward battle recovery; music precedence/looping; and event lifecycle/reward idempotency.

Verify actual screens and interactions at desktop, narrow widths, and browser zoom. Common workflows must be demonstrably easier with less unnecessary scrolling, not merely pass a build. Test permissions by calling protected operations, not just inspecting hidden buttons.

Deliver the repository-grounded architecture, final screen/interaction design, shared schemas and tag contracts, all migrations and compatibility decisions, phased implementation plan, tests/results, and an honest completion report. Distinguish designed, implemented, merged, migrated, deployed, and awaiting Owner acceptance. Never claim live success without verification.

**The finished project is one connected system: a modular skill engine; manual creation and management of its content; clear public and battle presentation; and a compact, capable Master Panel that operates all of it consistently.**