# Expanded Event Builder and painted wardrobe

This follow-up starts from the merged PR #1045 source. It extends the Event Builder,
NPC Design, and the shared character builder.

## Events

World arrival phases can require a selected objective count within a deadline.
The phase starts the clock when it opens. The existing database recovery transaction
takes the success path when enough arrivals were confirmed before the cutoff,
including when recovery runs later. It opens the configured fallback phase
otherwise. Arrivals confirmed after the deadline still complete movement and
receive no event credit. The deadline applies to arrival-only phases.

The phase path opens the editor for the selected phase. Authors can explicitly
order objective branches for simultaneous completions. Editing a destination
preserves its priority. The Timed patrol starter demonstrates both outcomes and
a shared debrief.

## Player and NPC design

The expanded wardrobe has 273 entries across its controls. These include
four painted identities, six builds, thirteen skin tones, nine clothing
styles, eight carried accessories, four headwear styles, four face accessories,
and the options to leave each wearable slot empty. Each wearable slot has its
own original finish and forty-four dyes. All four painted bases share eleven
alternate hairstyles and twenty hair dyes, with the base's original style and
color also available. Feathered fringe, swept quiff, soft curls, and crown braid
add art over the head. Layered locks, low bun, wrapped ponytail, and twin braids
extend the silhouette. Hair color is independent of style, eye color, and
equipment dyes. Twelve wearable styles use newly painted four-facing cutouts.
Hair and iris dyes have their own regions in each portrait expression and on
the field sprite.

The optional feature suffix keeps earlier version 5 URLs valid and retains the five portrait
expressions and four-facing field and battle atlas. NPC Design previews its
draft portrait and applicable actors. The shared builder supports random
designs, and NPC batches can vary selected fields while keeping the others.
Creation still spends the first confirmation and Account uses the remaining
lifetime allowance. The no-op retry and existing encounter pins retain their
current authority.

Verification covers the typed Event draft and its fallback path, actual World
arrival contributions on a disposable PostgreSQL migration chain, NPC batch
selection, and raster comparisons at sprite scale. A comparison against the
PR #1045 source covered five older recipes across versions 1–4 and all seven
media assets per recipe. All 35 legacy responses matched byte for byte.

The Chromium fixture uses the real authoring components and asset routes with
local HTTP and session fixtures. It covers phase navigation, route priority,
timed draft changes, and the expanded NPC builder at desktop and phone widths.
It also covers the authoring layout at 200% zoom. The local feature follow-up
passed the Chromium fixture at 1366×768 and 390×844, 29 focused application
tests, and the disposable database save-and-lock test. The application tests
compare all hairstyle silhouettes across each of the four portraits and all
four field directions. All 32 sampled portrait and atlas responses for the
prior painted hairstyles matched the previous revision byte for byte. The
updated signed-in Browser Smoke scenario exercises
final Account save with twin braids and a lilac dye.
Hosted signed-in verification and physical handset acceptance remain open.
