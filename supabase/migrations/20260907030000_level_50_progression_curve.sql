begin;

do $$
declare
  v_thresholds bigint[];
  v_resolved_level smallint;
  v_character record;
begin
  select curve.cumulative_xp_by_level[1:50]
  into v_thresholds
  from app_private.level_progression_curves curve
  where curve.version = 1;

  if v_thresholds is null or array_length(v_thresholds, 1) <> 50 then
    raise exception using
      errcode = 'P0001',
      message = 'LEVEL_50_SOURCE_CURVE_UNAVAILABLE';
  end if;

  insert into app_private.level_progression_curves (
    version,
    label,
    max_level,
    cumulative_xp_by_level
  ) values (
    2,
    'Level 50 approved progression curve',
    50,
    v_thresholds
  );

  update app_private.progression_cycle_level_curves mapping
  set curve_version = 2
  where mapping.curve_version = 1;

  -- Preserve historical XP exactly. Characters above the new cap are represented as Level 50
  -- without deleting their accumulated XP, and the authoritative resolver remains internally consistent.
  for v_character in
    select character.id, character.xp, character.level
    from public.characters character
    where character.progression_cycle in (
      select mapping.progression_cycle
      from app_private.progression_cycle_level_curves mapping
      where mapping.curve_version = 2
    )
    for update
  loop
    v_resolved_level := app_private.resolve_level_from_curve(v_character.xp, v_thresholds, 50);
    if v_character.level <> v_resolved_level then
      update public.characters
      set level = v_resolved_level
      where id = v_character.id;
    end if;
  end loop;
end;
$$;

commit;
