# Character sprites and Event dialogue

This branch continues the Character and NPC, Event and dialogue requirements in
[the unified matrix](requirements.csv) after the ferry release. The implementation is
prepared for review before integration and any release.

## Player sprite allowance

Each character can confirm two designs in its lifetime. Creating a character through the
game spends the first on the selected starter or custom look. Characters that already exist
without a confirmed sprite have two uses. The database counts any active and pending manual
designs still recorded for existing characters. The earlier schema did not keep a complete
history of superseded designs, so a revision cannot reliably reconstruct prior confirmations.
Account shows the remaining uses and the warning before the final save. Old portrait settings
and the classic token preference are independent of the allowance.

The existing character lock, revision and transaction serialize concurrent confirmations.
Submitting the same selection again is idempotent. A design confirmed during a battle spends
one use and activates when its existing battle pin can safely be released. Activation and
creation replay leave the allowance intact.

## Sprite art direction

Nick's snowy World View concept is the reference for both player and NPC art. The close portrait
carries the face and identity. The field actor has compact proportions, directional footwork,
a grounded stance, painterly cloth and leather, deliberate rim lighting, and enough contrast
to preserve the silhouette over snowy terrain. Preview the field walk and each battle action
in four directions in the shared builder.

[Trail Scout turnaround](sprite-art/trail-scout-four-facings.webp) is an original four-direction
idle art candidate based on that reference. It establishes one silhouette and material treatment.
The [Scout layer sheet](sprite-art/trail-scout-layers-v01.webp) establishes shared foot and
shoulder alignment. The playable painted catalog adds three more base identities, five outer
garments, four carried accessories, two headwear styles and two face accessories. Players
can combine an Arcanist hat or bandana with a leather eyepatch or brass goggles. Outerwear,
carried accessories, headwear and face accessories have independent color controls. Each
slot has its original finish and fourteen additional colors. The builder composes the
selected layers in all four facings and carries head and face accessories into portraits.
The field walk
articulates each leg separately and moves the outer layer at the shoulders. The catalog is
available through creation, Account and NPC Design. The older appearance formats stay available
under their original versioned URLs. Each painted identity has five matching
portrait expressions for dialogue and preview.

The earlier [wardrobe verification](appearance-wardrobe.md) measures existing recipe variation at
gameplay scale. The painted catalog has its own raster checks at gameplay size and native wardrobe scenario.

## Dialogue and Events

The existing World dialogue presents the recovery and trial replies together as two explicit
paths. The Event Builder can author the replies, inspect the two paths, and rehearse each route
using the published Story NPC, draft lines and the same conversation window. Live runs use
captured reply labels only while the action is available. Rehearsal changes only the preview.
Live settlement, private state and reward authority stay on the original server paths.

NPC Design now accepts the shared cuffed sprite recipe. The application and database also
check that the requested combination is valid before returning or saving the design.
Authors can choose a portrait expression and build up to four layers of replies for a World
greeting. Each reply has a player choice, an NPC response, an optional expression and optional
follow-ups. Drafts can be saved before all the lines are written. Rehearsal uses the World
conversation window and history without publishing the draft.

The scene carries the greeting and its first choice labels. The protected reply endpoint
rechecks the selected character, movement, battle, NPC range and current publication revision.
It returns the selected response and its immediate choices. World publication and retirement
invalidate cached NPC scenes, and reads started before the change cannot refill that cache.
Published lines remain separate from later draft edits. These narrative replies are read-only. Existing quest, battle and
reward commands keep their own authority paths.

For public World Events, authors can select at least two supported Reach a location objectives
in a phase and set how many must finish. Event recovery counts completed objectives from the
pinned run and phase. Authored arrival and weather rules continue to own the contribution
that marks an objective complete. Authors can also route a phase to different later phases
using its first confirmed objective. Phase transitions and staff advances record untaken
intermediate phases as skipped. Published World NPC victories and genuine defeats are separate
objective producers. Event recovery reads the canonical battle receipt, excludes practice and
inactive event windows, and records one contribution per eligible battle and objective. The
Lanternward Watch starter demonstrates two authored routes at Farwater Span and Ferry Terminal.

## Ferry Terminal and the World map

The mainland terminal moves one sector south to the water's edge. Its public Key Location,
walking destination and boarding range share the new coordinates. A new terminal building and
moored vessel use original painted cutouts. The Ferryman has his own mariner's hat, green coat,
rope belt, portrait and anchored field sprite. The server projects his dock separately from
boarding eligibility, so ordinary movement around the dock retains his map and Nearby entry.
Talk still uses current server-projected interactions. Nearby also shows authored NPCs.

The globe retains the Uncharted Lands label and omits its purple diamond. The sidebar
still cycles Travel Points. On the map, a red dot shows the prospective destination and
the green confirmation button commits the existing World walking command.

The terminal migration changes the boarding location and return landing for the public ferry.
Existing ferry trip origins and saved World positions are preserved.

The passenger deck uses painted timber, cabin and rigging with a shaded navy hull and a
raised rail. The setting keeps the existing walkable deck and shared passenger positions.
Relative ocean and wake movement follows the crossing clock in calm weather as well as
wind. The departure shoreline recedes and the arrival shoreline comes into view. The
display respects reduced motion. Cabin and mast map labels are removed.

The active ferry now lands at a dry coastal terminal in each of the eight rotating
Uncharted realms. Each terminal connects inland to the existing refuge. Private
discovery stays local to the landing, and the normal return timetable, rotation
evacuation and legacy passage behavior are preserved.

Dense Uncharted groves use six painted tree silhouettes, deterministic clearings and
individual growth. Tree wind now eases through sheltered moments instead of stepping
between two strengths. Roots remain fixed as the upper canopy moves. Both changes are
visual. Deep water, lava and solid terrain keep their route restrictions, with bridges
and previously authored walkable crossings preserved.

Void tint is now composited once across touching dry cells. Both public and Void
ground sheets use the clean interior when mirroring textures. Movement dispatch
begins before the local path preview, and the compact approval includes one nearby
known route sector to avoid waiting for the next scene at the sector boundary.
During local movement, peer movement and camera settling, a matching ground
projection can be translated. A miss paints the individual terrain layers and
defers combining them until movement settles.

The unified matrix tracks broader authoring capabilities, signed-in desktop and mobile checks,
physical-device review and Owner playtesting. The Lanternward Watch is an authoring starter
and follows ordinary draft, publication and scheduling controls.

## Verification

- The PostgreSQL regression covers initial creation, legacy and pending looks, failed and stale
  submissions, final lock, identical retries, activation after battle and frozen battle art.
  The database suite runs it after applying all canonical migrations in embedded PostgreSQL.
  Hosted CI also runs it after a disposable Supabase database reset.
- Application checks cover existing appearance manifests, character creation authority,
  Account rendering and portrait settings, Event authoring fields, and World quest projection.
- Browser Smoke exercises rehearsal and the real, authenticated branches with their existing
  distinct XP and one-time weapon settlement. Physical-device and Owner visual acceptance
  require their own evidence.
- World coverage checks the walkable shoreline connection, ferry schedule and relocation,
  stable NPC projection, Nearby actions, list and globe selection, and the travel review flow.
- The added coastal coverage verifies a safe dock beside water and a dry route to the
  inland refuge in all eight realms. The migration-chain shared ferry test uses the
  mainland terminal's current boarding coordinates. Browser evidence for the
  revised flow is captured as `active-uncharted-ferry-terminal.png`.
- Renderer regressions cover a single translucent ground pass for multiple private
  themes and sample sustained wind at the balanced frame cadence to check for sharp
  jumps. The crossing receipt regression checks movement can animate into a known
  destination sector before full scene hydration.
- Dialogue coverage exercises incomplete draft saves, invalid tree limits, publication
  isolation, current-revision and range checks, and character ownership at the reply endpoint.
  The signed-in browser scenario authors and rehearses a conversation, publishes it,
  follows two routes from Nearby, and checks that it changes neither position nor progress.
- The wardrobe browser scenario saves a painted look during Creation, adds independently
  dyed layers in Account, decodes the exact field atlas and verifies the permanent lock.
- The Event regression covers the independent objective quorum and both World NPC outcomes.
  It asserts that the unused phase is skipped and that replay grants no extra credit. The
  Lanternward Watch starter uses walkable coastal checkpoints and a shared ending.
- The historic route fingerprint still covers terrain and crossing geometry. The public
  Ferry Terminal is asserted as one additional landmark, together with the updated names
  of crossing routes into the terminal.

- The [previous timing repeat](https://github.com/ZeiJM/Aurevane/actions/runs/44536399502)
  passed 52 of 60 desktop movement cases. Eight multiplayer traces reached the
  destination with only six to eight intermediate peer steps. The worst captured
  frame included 160 ms of preparation and 99 ms of scenery drawing. The projection
  regression now verifies that newly decoded terrain can invalidate the cache mid-step
  without building a replacement viewport composite until motion settles. The full native
  repeat and its original assertion remain the acceptance gate.

- The [4cb60e0 timing retry](https://github.com/ZeiJM/Aurevane/actions/runs/44560786638)
  passed all three mobile crowd cases and 41 of 60 desktop cases. Eighteen peer runs
  fell short of nine visible steps. In the repeat-six trace, generating canvas resources
  used 1.94 seconds of CPU across both clients. The renderer now skips fully clipped
  ground planes and uses lighter sampling during movement. It retains the existing
  raster sizes, terrain and scenery order, and high-quality source art and idle sampling.
  The single rapid-click failure reached the neighboring tile after the camera moved
  between the test's coordinate read and input delivery. The Chromium test now binds
  the trusted pointer event to the time of the measured frame. It still checks that the
  exact intended destination receives server approval and settles. The successor needs
  the same authenticated desktop and mobile coverage and unchanged timing thresholds.

- Revision `2bc3ad0` passed [60 desktop timing cases and three mobile crowd cases](https://github.com/ZeiJM/Aurevane/actions/runs/44577616194).
  All forty simultaneous movement traces recorded at least nine visible steps.
  The longer [Living Atlas run](https://github.com/ZeiJM/Aurevane/actions/runs/44577616082)
  passed the simultaneous-attack check and 118 Atlas cases. Its remaining movement case
  recorded seven visible peer steps. The captured Chromium trace attributed 2.02 seconds
  of CPU across the two clients to producing canvas resources. The successor skips
  open-sea painting during movement when loaded opaque public ground covers the viewport.
  The regression checks the exact crossing, an unloaded sector gap and longitude wrap.
  The shoreline and all native timing assertions keep their existing behavior.

- Revision `bf3b076` passed Living Atlas, World timing, CI and the real PostgreSQL checks.
  [Browser Smoke](https://github.com/ZeiJM/Aurevane/actions/runs/44592156277) passed 466
  cases and failed the laptop wardrobe confirmation. The desktop and laptop scenarios
  saved the same final recipe on different characters in the same database. The appearance
  writer reserves each recipe across current and pending looks, so the second character
  could not confirm it. The laptop scenario now selects the Trail scout and retains the
  independent dyes, exact saved-recipe check, and permanent lock assertions.

- The wardrobe-only successor `343a712` passed Living Atlas and CI. Its
  [World timing run](https://github.com/ZeiJM/Aurevane/actions/runs/44629323735) passed all
  three mobile crowd cases and 50 of 60 desktop cases. Ten peer traces recorded eight
  visible steps. Several of those frames spent 116–155 ms in terrain rendering
  without rebuilding the source ground texture. Settled standard-density composites now
  use the same output-density sector bitmaps as moving frames. The local regression
  verifies the camera can outgrow the composite and reuse those bitmaps without
  allocating replacements during the route. The native nine-step minimum still applies.
