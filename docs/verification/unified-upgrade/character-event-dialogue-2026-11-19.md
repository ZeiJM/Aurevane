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
The companion portrait, separate painted art layers, animated frames and equivalent variation
across the catalog remain to be developed. The earlier
[wardrobe verification](appearance-wardrobe.md) measures existing recipe variety at gameplay
scale. The same distinction threshold still applies to the new art.

## Dialogue and Events

The existing World dialogue presents the recovery and trial replies together as two explicit
paths. The Event Builder can author the replies, inspect the two paths, and rehearse each route
using the published Story NPC, draft lines and the same conversation window. Live runs use
captured reply labels only while the action is available. Rehearsal changes only the preview.
Live settlement, private state and reward authority stay on the original server paths.

NPC Design now accepts the shared cuffed sprite recipe. The application and database also
check that the requested combination is valid before returning or saving the design.
Authors can choose a portrait expression and rehearse a draft greeting in the same window
as the Event Builder. Players see the greeting and expression from the published World
identity, with the existing portrait fallback for identities without expression art.

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

The next scope is the general-purpose conversation authoring and Event branch engine,
broader Character and NPC authoring and live cast integration, followed by a major Event
and signed-in desktop and mobile acceptance. The unified matrix remains the verification ledger.

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
