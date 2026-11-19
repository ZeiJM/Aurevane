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
paths. The Event Builder can rehearse each route using the draft's published Story NPC, draft
lines and the same conversation window. Rehearsal changes only the preview. Live settlement,
private state and reward authority stay on the original server paths.

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
