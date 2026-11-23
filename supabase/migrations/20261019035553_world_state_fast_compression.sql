-- A long-lived traveller can carry hundreds of surveyed sectors. Recompressing
-- that JSON with PGLZ on every movement commit causes avoidable approval stalls.
-- LZ4 preserves the exact JSON and TOAST storage while reducing repeated work.
-- Existing compressed values remain readable and convert on the next newly
-- constructed state write; do not bulk-rewrite histories or alter authority.
begin;
set local lock_timeout = '5s';
alter table app_private.character_world_state
  alter column state set compression lz4;
commit;
