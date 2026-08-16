# Account & Security

**Audience:** Player  
**Visibility:** Public / spoiler-safe  
**System:** Account entry  
**Status:** P1.1 production-readiness foundation

## Quick answer

Your AUREVANE account proves who you are when you return to the game. It is deliberately separate from your character identity: your sign-in email is not your character name, and account metadata does not stand in for character progression.

AUREVANE only exposes account entry in an environment whose account services are intentionally ready. It will not silently substitute staging, another database, or partial game state when the intended environment is unavailable.

## Create an account

Use a valid email address and a password that meets the account form requirements. Current builds require at least eight characters.

Some environments may require you to confirm your email before the first sign-in. If confirmation is required, follow the link sent to your email and then return to AUREVANE.

## Sign in

Enter the same email and password used for the account. AUREVANE verifies the resulting session before it loads private account information.

If the session has expired, sign in again. Refreshing the browser should not create a second account profile or lose the profile already attached to your account.

## Sign out

Use **Sign out** from the authenticated account screen when you are finished, especially on a shared computer. Signing out ends the browser session; it does not delete the account or its persistent profile.

## Account profile versus character

The private player profile belongs to the account and is created automatically from verified authentication identity. Character identity is a separate game concept and is not derived from your email address.

AUREVANE does not create a placeholder character merely because an account exists. When character creation is available, the character system owns its own identity and progression state.

## Troubleshooting

### I cannot sign in

Check the email and password and try again. If you recently created the account and email confirmation is required, complete confirmation first.

### Account services are unavailable

Account entry is disabled when the current environment's complete account dependency chain has not been intentionally enabled. The public shell can remain available without silently connecting to a different environment or presenting controls that can only fail after sign-in.

### My session is verified, but the private profile cannot load

AUREVANE may show an **Account service interruption** recovery screen if authentication succeeded but the private profile required to enter the game is temporarily unavailable. No character or progression state is created to bypass the problem.

Use **Retry account load** after a short wait. If the problem continues, use **Sign out** and return later. This recovery state is designed to protect persistent data rather than guess around a backend failure.

### I refreshed and still have no character

An account and a character are intentionally different. The account profile can exist before a character has been created.

## Security notes

- AUREVANE loads private account state for the verified session rather than a user ID chosen by the browser.
- Private account rows are protected by database authorization so one account cannot read another account's profile.
- Production account entry requires explicit environment readiness; a staging-configured preview is not accepted as the Production account backend.
- Authentication data is not used as gameplay authority for future character stats, progression, inventory, or combat state.
- Never share your password.

## Documentation impact record

- **Manual article:** updated for Production readiness and authenticated profile-recovery behavior.
- **Contextual help:** account entry and authenticated account screens include concise Account & Security guidance.
- **Glossary:** no new gameplay glossary term required.
- **Screenshots/diagrams:** none required for the current minimal account flow.
- **Spoilers:** no story, Discipline, Confluence, Soulmark, boss, region, or late-game information exposed.
- **Staff/Owner operations:** infrastructure documentation records the Production readiness procedure; no Master Panel procedure is introduced by this narrow hardening checkpoint.
