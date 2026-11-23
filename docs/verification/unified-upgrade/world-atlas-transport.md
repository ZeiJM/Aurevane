# World atlas transport evidence

The prior authenticated eight-session run measured decoded full snapshots of about 604 KB dispersed and 619 KB in the hotspot at p95. Its Playwright API reader decompresses HTTP bodies before measuring them. [Eight-session evidence](README.md)

A local projection of the same sixteen post-walk positions on source `4042f4a` produced 581–611 KB of decoded JSON before peer enrichment. Every sample contained the same 274,886-byte atlas. About 272 KB was charted metadata, 2.7 KB described visible uncharted entries, 302–332 KB held the authorized local sector projection, and 2–3 KB held the separate public scenery buffer. Adding one legitimate wild-sector discovery changed the atlas and its digest while leaving the charted rows unchanged.

The World workspace opts in on full scene hydration. The authenticated server still derives the current owned scene, visibility, and peers. It omits only the atlas when the supplied character and token match the exact current ordered atlas. Cold reads and changed atlas content get the full atlas and a new token. The browser retries once without the opt-in header if it no longer holds the matching atlas, the selected character changed, the compact reply is stale, or the reply omits required scene fields. Default GETs, compact movement and presence use their existing response shapes.

The table measures actual HTTP entity bodies served on loopback using the real projection, new receipt function, `Response.json`, and the installed Next compression middleware. It uses two fixture positions without authentication, database time or live peers. This measures serialization and transport overhead in isolation.

| Fixture | Default decoded | Warm decoded | Default gzip | Warm gzip |
| --- | ---: | ---: | ---: | ---: |
| Dispersed, Aureth Crown | 590,426 B | 315,626 B | 34,176 B | 15,148 B |
| Hotspot, atlas 58:28 | 610,409 B | 335,609 B | 34,855 B | 15,852 B |

The cold opt-in added 80 decoded bytes and 55–57 gzip bytes. Across all sixteen fixture positions, a separate offline model using Node gzip and Brotli quality 5 estimated warm gzip at 15.1–16.1 KB and warm Brotli at 7.5–8.7 KB, down from 34.1–35.1 KB and 17.3–18.6 KB respectively. The loopback middleware served identity encoding when requested with Brotli alone, so Brotli figures are modeled. Actual authenticated transfer sizes, hit rates, server CPU effects, and latency remain to be measured in the disposable Living Atlas run.
