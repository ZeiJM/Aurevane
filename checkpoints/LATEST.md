# Recovery-only checkpoint

Source commit: 02628b541e3aaf3d7a1bf1d8d9508abdf2d34cd3
Source tree: 8fc9cb0fe924e392695548519b5f194640c79e6d

Restore from checkpoints/controls-02628b54.bundle after fetching prerequisite 6790f4c9ff9343dee7b39e2f87999c2f1a3d7454, then inspect ref refs/checkpoints/controls-02628b54. SHA256 b65eba074dca42c6fdf44707bd1a77f462dbad090157207a9978ba2a35436072. git bundle verify passed locally. The companion evidence archive contains the progress ledger, briefs, review and exact verification logs.

This archive branch preserves original source objects; its own commits are not implementation ancestry or a release PR. Prior checkpoints are retained. Latest bounded controls milestone passes 7009 Vitest +7 Node checks, format/lint/types/build (20261016T030942263491Z), with Important review fix and two deferred presentation minors. Ground checkpoint remains included. Task15/16, browser acceptance, complete immutable roster application, modifier UI, balance/AI, reader audit and coordinated combat release remain open. No hosted content or deployment is changed.