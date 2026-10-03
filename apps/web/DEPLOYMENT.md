# Web deployment note

This file intentionally lives inside the web app project root so documentation-only production redeploys are not skipped by Vercel's monorepo unaffected-project optimization.

Runtime behavior is unchanged.

Battle Chronicle and effect timing released from `96b468dc01e717e34f493849a18b49a4bcc3f453` as READY deployment `dpl_AFvAEsDpi49ovcvaS6XdnJmPZ1t9`. The closeout restores the full automatic deployment lock after source/alias, public response and bounded runtime checks.
