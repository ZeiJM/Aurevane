# Mobile log, artwork and chat follow-up

Status: local work from PR #978 merge `0af25cf982172aa870edef5ec08ed5b5e4ad4ba6`; not published or deployed.

Owner scope: remove duplicate dark mobile log heading, replace the picture timeline with expanded log while open and retain a compact gold return toggle, generate dark fantasy artwork for placeholder basic Chronicle actions, keep desktop chat's drag header visible below site/battle chrome, and hide the redundant full-capacity note in mobile Techniques while preserving selection limits and the selected count.

The original shared-browser guard reproduces the mobile heading defect. A subsequent run passes the mobile geometry cases and reproduces desktop chat dragging to5px beneath a44px header boundary. Original artwork identity tests fail four cases before wiring the generated sources. Evidence: `/tmp/av-log-art-red.log`, `/tmp/av-log-art-mobile-first.log`, `/tmp/av-log-art-artwork-red.log`.

No combat/movement rules, private captures, catalogue/data/schema/environment changes. Git auto deployments stay locked; no preview or staging. Local component fixtures do not establish hosted signed-in/physical-device/multiplayer acceptance. All exact-head configured CI and exact tested-tree merge verification remain required before the single final production.

## Generated art

### defenseless

Built-in image generation; optimized versioned WebP at `apps/web/public/media/skills/defenseless-dark-fantasy-v1.webp`, 768×768, quality88. Original generation retained outside git. Prompt:

Use case: stylized-concept. Asset type: square high quality raster artwork for a dark fantasy tactical RPG battle action thumbnail, readable when reduced to 48 pixels. Painterly cinematic realism, finely detailed worn metal, dramatic chiaroscuro with a crisp central silhouette, deep near-black background, restrained antique gold highlights. Single square scene filling the frame, no border, no typography, no letters, no numbers, no watermark. Subject: a battered medieval knight lowering a fractured iron shield, the open unguarded chest plate exposed, the shield angled down at the lower right. Close crop of armored torso and gauntleted forearm, no visible face. Fractured shield catches a subtle ember-red rim light. This represents voluntarily lowering guard and vulnerability, not an active magical barrier or a victory pose.

### mp-recovery

Built-in image generation; optimized versioned WebP at `apps/web/public/media/skills/mp-recovery-dark-fantasy-v1.webp`, 768×768, quality88. Original generation retained outside git. Prompt:

Use case: stylized-concept. Asset type: square high quality raster artwork for a dark fantasy tactical RPG battle action thumbnail, readable when reduced to 48 pixels. Painterly cinematic realism, finely detailed worn metal, dramatic chiaroscuro with a crisp central silhouette, deep near-black background, restrained antique gold highlights. Single square scene filling the frame, no border, no typography, no letters, no numbers, no watermark. Subject: two armored gauntlets gathering a brilliant blue and violet arcane wisp into a single luminous orb, faint magical filaments coiling inward above the hands. Close central composition, rich electric sapphire focal glow, shadowed ruined-stone atmosphere. This represents restoring magical energy, no potion, no weapons.

### chronicle-event

Built-in image generation; optimized versioned WebP at `apps/web/public/media/skills/chronicle-event-dark-fantasy-v1.webp`, 768×768, quality88. Original generation retained outside git. Prompt:

Use case: stylized-concept. Asset type: square high quality raster artwork for a dark fantasy tactical RPG battle action thumbnail, readable when reduced to 48 pixels. Painterly cinematic realism, finely detailed worn metal, dramatic chiaroscuro with a crisp central silhouette, deep near-black background, restrained antique gold highlights. Single square scene filling the frame, no border, no typography, no letters, no numbers, no watermark. Subject: an ancient weathered parchment battle journal open on dark stone, one metal quill and a faint amber ember hovering above the spine. Close three-quarter view, strongly legible book silhouette with luminous antique gold edge light, distant smoky ruins. Pages have only indistinct weathering, no writing or readable symbols. A neutral record of an unknown battle event, no weapon or specific skill depicted.

## Browser and review verification

The dark heading was the mounted desktop Chronicle heading beneath mobile parchment. Shared mobile styles now hide it and the picture track while the full reader extends over the reserved3.15rem timeline row; a compact gold round toggle remains at bottom right. The battlefield, preview and original44px footer keep their exact rectangles. The reader stays mounted, and its existing scroll owner and history expansion survive toggles/rotation. A rendered hit-test guard also caught an inherited overflow clipping rule despite correct bounding boxes; stronger scoped mobile overflow rules and a block scroll port resolve the actual paint boundary.

The final complete shared browser matrix passes with the final smaller type: narration13px, outcomes/round12.5px, actor14px and action13.5px with1.4body line height, scoped to the full mobile workspace. Desktop/separate completed readers retain their sizes. Nine PvE/PvP/spectator phone/landscape combinations verify actual round content, hidden duplicate header/track, painted/hit-testable reader down to the footer, reachable return toggle, exact board/footer stability and zero combat requests. The complete existing keyboard/pointer/attack/facing, nested readers, cooldown, spectator and long-name Terrain matrix also passes. Three new WebP assets decode at768×768 in the browser. Evidence: `/tmp/av-log-art-browser-complete.log`, `/tmp/av-log-art-final-evidence/`.

One fresh-context whole-branch review found an Important hidden-track live-follow issue: new events received while the full log was open did not advance the picture timeline on return. The permanent arrival regression failed before the repair (`/tmp/av-log-art-live-arrival-red.log`). The shared effect now defers hidden scrolling and resumes on log close while preserving explicit selection. Final full browser verification passes this guard in both playable modes, including55recorded actions, history expansion, final-entry clearance, rotation, keyboard toggle and no duplicate history fetch on toggles. No other Critical/Important/Minor findings were reported.

Desktop chat now fits its entire window below the measured visible site/battle chrome on open, drag, viewport resize and header resize. Four desktop viewport cases cover all edges, repeated dragging, changed external header height, draft survival and actual header hit testing. Transport, close behavior and mobile chat remain unchanged.

Complete Techniques picker verification passes six viewport combinations plus full4/4Discipline2portrait/landscape. The redundant full-capacity note is hidden only on mobile; Equip remains disabled, the4/4count remains visible and reading issues no save. Other eligibility/error messages remain. Evidence: `/tmp/av-log-art-management.log`. Artwork identity tests pass81cases; the existing support renderer's MP SVG expectation was separately reproduced failing and aligned to the generated MP source (all6support cases pass). No support cost, behavior or eligibility assertion changed.

## Final source quality gate

The complete final source passes formatting, lint, all eight package type checks,12,424Vitest cases plus seven Node checks and production build, using normal Turbo cache and two test workers. Log: `/tmp/av-log-art-quality-verified.log`, exit0. The earlier superseded run caught the MP support renderer's old SVG expectation; that exact consumer passes6/6 after alignment, and the complete final gate is green. Only verification documentation was appended after this gate.

Fresh main remains PR #978 merge `0af25cf982172aa870edef5ec08ed5b5e4ad4ba6`; no reconciliation needed. Publishing starts configured native CI for the exact new source. Continuous agent polling pauses after verifying runs start. This batch remains unmerged/not live until all gates pass and exact tested-tree merge/source verification is complete. Prior production `dpl_3YickdeFxnbCyTviuweKPLfVCg5y` remains unchanged.
