# Social chat follow-ups — 2026-10-17

## Design and boundaries
- Reaction allowlist: ❤️ 🔥 ⚔️ 😮 😂 👏; table key is message/character/emoji, and the RPC toggles on subsequent clicks.
- Existing `chat_list_v1` and `chat_send_v1` return the expanded `chat_message_json_v1` including reactions. A four-poll refresh propagates remote reactions to existing messages.
- Typing state is one ephemeral row per player/channel. Server updates are throttled, readers only show entries with a five-second expiry in the future, and offline/block preferences suppress visibility.
- Only the server service role can call `chat_post_system_v1`; the database observes authoritative level increases and posts into `feed:<character_id>`. The feed is read-only and private to its character.
- All new RPCs remain service-role-only; RLS is enabled on each new private table.
- The existing scheduled prune also removes seven-day-old Game feed messages and stale typing records.

## Required verification before production release
- Local Supabase: `pnpm exec supabase test db --local supabase/tests/social_chat.sql` using a disposable migrated database.
- Focused Vitest: `chat-channel.test.ts` and `chat-message.test.tsx`.
- Phone Playwright: `chat-followups-phone.pw.ts` at 412×915, including two signed-in players and privacy toggling.
- No CI/pgTAP/Playwright run is claimed here. The code must not be released before migration and tests are confirmed.

## Release handling
- Keep PR #915 and its navigation label/Techniques spec untouched.
- Do not push to branches with active CI runs; merge only after completion.
- Git auto-deploy is disabled. Create a Vercel Git deployment from the merged main SHA and confirm READY.
