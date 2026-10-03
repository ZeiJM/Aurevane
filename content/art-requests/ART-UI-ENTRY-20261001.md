# ART-UI-ENTRY-20261001 — Owner-approved gateway and roster art layers

TYPE: Environment backdrops and slot doorway paintings.
STATUS: Owner-approved concepts, derived review implementation. No deployment.
AUTHORIZATION: Owner explicitly approved the supplied intro/login and Character Select concepts and requested faithful deep implementation. Derived clean art layers are necessary to place genuine interactive controls over the approved scenes.
PROVIDER: OpenAI built-in image generation, precise-object-edit.

## Gateway prompt

Edit target: approved intro `exec-8ffb60c9-3b0d-4a7c-aec7-555bc6710569.png`. Remove all painted UI, header, logo, navigation, title/body, right parchment login form/frame and footer. Inpaint the same scene. Preserve the vine-covered magical ruined gateway, lanterns, moonlit mountains, castle, bridges, waterfalls, moon position and palette. Full-bleed 16:9 landscape. No text, interface, frames or people.

## Gallery prompt

Edit target: approved roster `exec-396872c2-541b-4545-86db-38ed0f8d10bc.png`. Remove all painted UI, header, title/subtitle, all three complete cards and account-delete controls. Inpaint continuation of the same arcane ruined stone gallery and reflective floor. Preserve brass armillary, ruined arches, ivy, warm lanterns/candles, enormous moon, floating spires, castle/waterfalls, blue flame and perspective. Full-bleed 16:9 painting, no text, frames, panels or people.

## Doorway prompt

Edit target: same approved roster. Extract and faithfully recreate only the scenic paintings inside middle/right cards as two adjacent square tiles, overall 2:1. Additional slot: pointed ancient stone arch, ivy, golden four-point compass star, distant mist/mountains and reflective water. Prestige: stone arch, crescent moon and concentric gold rings, night sky/towers, stairs and candles. Preserve approved materials/rendering. Remove parchment, exterior card frames, text, controls and portrait. No complete screen rendering.

Runtime backdrops 1672×941 WebP; doorway tiles 640×640 WebP. Source masters remain with the generating conversation; source references, SHA-256, deterministic transformations, runtime dimensions and byte counts are recorded in `apps/web/public/media/art/entry/provenance.json`. Application consumes stable registered IDs. Decorative frame paths and controls are code-native; character portrait is dynamic account data.
