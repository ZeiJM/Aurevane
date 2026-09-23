# Site Music

AUREVANE uses one persistent site-music player mounted in the root application layout. The player therefore covers public account pages, signup, character creation, the game shell, and the Master Panel. Browser autoplay rules still require the first pointer or keyboard interaction before music begins.

## Master Panel

Game Owners can open **Master Panel → Site Music** to:

- enable or disable music globally;
- replace the default track with an HTTPS audio URL or an uploaded file;
- add page-specific rules using pathname prefixes such as `/`, `/game/create`, or `/game/battle`;
- make a route silent by disabling its matching rule; and
- preview each source before publishing.

The most specific matching pathname prefix wins. Uploads accept MP3, M4A/AAC, OGG, WebM, or WAV files up to 20 MB and are stored in the public `site-music` Supabase Storage bucket. The protected Master API validates the file metadata and issues a short-lived signed upload token; the browser then sends the audio bytes directly to Supabase Storage so large tracks do not transit through the Vercel Function request body. Configuration writes require the protected `staff.manage` capability and use optimistic revision checks.

## Runtime behavior

The user’s existing Music volume setting and global mute control the soundtrack. Muting sets playback volume to zero without discarding prior volume values, so unmuting restores the previous mix. Music pauses while the document is hidden and resumes when visible. Source changes occur only when the resolved track URL changes, allowing uninterrupted playback across normal client-side navigation.
