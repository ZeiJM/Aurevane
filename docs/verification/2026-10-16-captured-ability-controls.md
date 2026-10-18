# Captured ability controls — Task15 implementation checkpoint

This bounded milestone connects active Manual Resonances to the shared playable battle controller and makes equipped noncast abilities information-only. It does not activate the reviewed roster or establish browser, balance or combined combat-release acceptance. PvE and PvP use the same components at desktop and mobile breakpoints; artwork dimensions and slot count are preserved.

## Behavior

- The existing special artwork becomes an action button only when the acting owner has a captured Manual Resonance action. Its captured group supplies targeting, AP/MP/HP payment, cooldown and Controlled state. Multiple groups require explicit choice; neither another owner's reference nor a missing canonical reference supplies a fallback cast.
- The shared special adapter supplies action menus, descriptors and the configured special key. Controlled priming/release, self-target second presses and explicit group choices continue through the existing versioned preview/commit authority.
- Automatic/Ongoing/modifier-only Skills and Essences retain artwork and their full canonical information reader, display their activation type and do not offer a paid cast. Historical definitions without canonical metadata retain their established path.
- Noncast Skill/special and supernatural information shortcuts work during opponent turns, completed battles and execution locks. Text entry, open readers/dialogs, repeated events and browser modifier shortcuts keep their existing guards. Active commands remain blocked in those states.
- Owner-only Manual action projections add optional classification for menu routing. Public/spectator privacy, source identity/version/build-pair validation and server payment authority remain unchanged.

## Evidence

Focused coverage exercises actor-owned special references, absent/foreign captures, explicit multi-command choice, captured geometry/payment/Controlled metadata, truthful noncast cards/readers, fail-closed canonical descriptors, shared cooldowns and safe controller projections. Existing authority expectations were updated to assert the additional classification field exactly.

A fresh combined review found no command-authority bypass. Its Important keyboard finding received an executable failing shortcut regression before the fix: blocked-state readers were unreachable. The shared slot dispatcher now routes information before command gates, with enabled command callbacks retaining the existing self-action/selection path. The regression suite also guards its placement after text/input guards and before the controller command gate. RED receipt `20261016T030859068397Z`; focused post-fix 47 checks pass at `20261016T030921224349Z`.

Final post-fix `pnpm check`: exit0, **7,009 Vitest tests plus seven Node checks**, formatting/lint/types/build, receipt `20261016T030942263491Z` (03:09:42–03:11:42Z). Product source was unchanged during this run. The existing Vite native-config-loader advisory remains visible. The earlier full run found one exact-shape authority test expecting the old descriptor; its expected classification was added, without relaxing other assertions.

## Deferred display findings and remaining gates

Two Minor review findings remain in the mandatory before-release Task15 display audit: a canonical Manual Resonance without an active owner reference is captioned Passive instead of Unavailable; synthetic Resonance range highlighting lacks captured attack/recovery semantics and retains its first group's menu category after another group is chosen. Actual geometry and command resolution remain authoritative. The prior Ground repeated-subset wording finding remains open too.

This source/test checkpoint does not prove physical browser keyboard/touch/200% zoom or responsive geometry. Existing end-to-end battle suites require account/session provisioning; they were not run for this milestone. Protected Master authoring/publication, explicit Manual modifier selection, complete roster immutable-version application, event previews, concise plain-language/orange-effect readers, all-roster AI and low/high-level PvE/PvP balance remain pending. No hosted data, merge or deployment changed.
