# AUREVANE — Server Architecture Conventions

**Status:** F0.3 implementation convention aligned with the Game Master Plan and `docs/TECH_ARCHITECTURE.md`.

## Purpose

This document records the smallest durable server-authoritative execution pattern needed before gameplay systems are added. It does not introduce combat, progression, economy, world, or Master Panel features.

## Authoritative command flow

```text
UNTRUSTED REQUEST
  ↓
Server boundary
  ↓
Authenticate actor
  ↓
Validate request schema
  ↓
Authorize the requested capability
  ↓
Domain/service workflow
  ↓
Transactional persistence adapter
  ↓
Commit authoritative state + idempotency record atomically
  ↓
Return narrow result
  ↓
Optional realtime invalidation after commit
```

The browser requests an action. It never supplies authoritative outcomes.

## Boundary responsibilities

Route/server boundaries stay thin. They own request decoding, authentication, authorization, validation, and translation of known server errors into safe HTTP responses. They do not contain game calculations or persistence orchestration.

The current F0.3 probe requires only authentication because no privileged gameplay/staff capability exists yet. Future commands add explicit permission checks before entering their services; role names must not be hard-coded into domain behavior.

## Service responsibilities

A service owns one coherent authoritative use case. It receives a trusted actor plus validated input and calls a narrow persistence contract. The service must not depend on React, browser state, hidden UI, or client-calculated values.

## Transaction and persistence convention

Multi-step mutations that must succeed together execute through one database transaction boundary. With the current Supabase foundation, a narrow PostgreSQL function is an acceptable transaction boundary for a coherent command and is invoked once by the server adapter.

Do not implement valuable mutations as several independent Data API calls that can partially succeed.

Persistence-specific details stay outside pure/domain packages.

## Idempotency convention

Retryable valuable commands use a caller-generated idempotency key plus a server-defined scope:

```text
actor_key + command_name + idempotency_key
```

The durable record also stores a request fingerprint and the committed result. A repeated successful request with the same fingerprint returns the original result rather than executing again. Reusing the same key for a different request is a conflict.

`app_private.idempotency_records` is server-only infrastructure. It is not gameplay data and is not exposed to browser roles.

## Realtime convention

Realtime transports notifications; it never decides state. `packages/realtime` defines an invalidation-oriented contract carrying identifiers and optional authoritative versions. Clients must be able to recover after disconnect by refetching authoritative server state.

F0.3 intentionally does not open per-request serverless realtime sockets merely to prove the interface. Concrete transports arrive with systems that genuinely need them.

## Error convention

Known failures use stable `AurevaneError` codes with player-safe messages. HTTP status mapping stays at the web boundary. Raw database errors, stack traces, secrets, tokens, and internal SQL details are never returned to players.

Unexpected failures become a generic internal response and are logged once at the boundary.

## Logging convention

Server and worker logs are structured records with at least:

- timestamp;
- level;
- stable event name;
- minimal diagnostic fields needed for the event.

Do not log authentication tokens, service keys, database credentials, sensitive payloads, or unnecessary personal data. Expected validation/auth failures should not flood logs.

## Worker convention

`apps/worker` owns durable asynchronous/scheduled work that should not depend on a browser request remaining open. F0.3 provides only the runnable process lifecycle and structured startup/shutdown logging. No speculative queue or scheduler is introduced before an actual job requires it.

The `--once` mode exists only as a deterministic CI/operations boot check; continuous mode waits for process shutdown signals.

## Future extension points

This foundation deliberately leaves clear homes for:

- granular owner/staff authorization;
- gameplay services;
- transactional repositories;
- realtime transports;
- durable world/event jobs;
- audit logging and observability.

It does not prebuild those future systems.
