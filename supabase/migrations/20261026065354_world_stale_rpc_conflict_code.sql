begin;

-- A stale caller version is a domain conflict, not a retryable serialization
-- failure. PostgREST 14 retries SQLSTATE 40001 indefinitely with identical input.
-- PT409 returns the existing conflict message to the caller for a fresh read.
-- https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions
do $migration$
declare
  d text;
  old text := 'raise exception ''WORLD_STALE_VERSION'' using errcode=''40001'';';
  replacement text := 'raise exception ''WORLD_STALE_VERSION'' using errcode=''PT409'';';
begin
  d := pg_get_functiondef('public.commit_world_state_v1(uuid,uuid,bigint,uuid,text,jsonb,text)'::regprocedure);
  if length(d) - length(replace(d,old,'')) <> length(old) then
    raise exception 'WORLD_STALE_RPC_CODE_PREDECESSOR_CONFLICT';
  end if;
  execute replace(d,old,replacement);
end;
$migration$;

commit;
