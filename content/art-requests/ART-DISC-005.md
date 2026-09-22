# ART-DISC-005 — Discipline Essence Skill action art

Status: Owner-approved for implementation on 2026-09-22 after direct visual review in ChatGPT. Production deployment remains separately Owner-controlled.

Scope: one standalone 1:1 performed-action illustration for each of the 17 current Discipline Essences: Unbroken Strike, Deadeye Barrage, Perfect Opening, Verdant Rupture, Hundredfold Rush, Last Bastion, Dawn’s Oath, Red Tempest, Sevenfold Cut, Apex Hunt, Aether Nova, Runic Overdrive, Borrowed Hour, Phoenix Wake, Absolute Winter, Skybreak and Tidal Crown.

Visual direction: high-quality anime dark fantasy; dramatic performed actions rather than crests; distinct composition and identity per Essence; no collages, grids, panels, embedded text, or procedural/repetitive template art. Each piece reflects the canonical Essence name and combat identity while retaining a consistent suite finish.

Source method: generated in the Owner’s 2026-09-22 ChatGPT art-review session with OpenAI image generation. The Owner reviewed the generated sets in-chat and then explicitly instructed implementation. The original generated PNG candidates were 1254×1254. Runtime derivatives are deterministic 512×512 WebP encodes at quality 82 under `apps/web/public/media/art/essence-skills/`; the generation provider is not required at runtime.

Stable integration: canonical Essence IDs and their existing `media.iconKey` hooks remain the source identifiers. `apps/web/src/media/essence-skill-art.ts` maps the 17 canonical Essence IDs to approved runtime files. The regular 136 Discipline Skills and 136 Resonances remain unchanged by this request.

Replacement policy: future approved art can replace/version these runtime paths without changing gameplay authority. Generated output remains presentation-only and has no effect on combat rules, targeting, AP/MP, AI, snapshots, or persistence.
