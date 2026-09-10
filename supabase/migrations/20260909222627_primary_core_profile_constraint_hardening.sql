begin;

alter table app_private.discipline_primary_profiles
  drop constraint discipline_primary_profiles_core_base_valid,
  add constraint discipline_primary_profiles_core_base_valid check (
    jsonb_typeof(core_base_attributes) = 'object'
    and core_base_attributes ?& array['might','finesse','vitality','agility','intellect','resolve']
    and (
      core_base_attributes - array['might','finesse','vitality','agility','intellect','resolve']::text[]
    ) = '{}'::jsonb
    and jsonb_typeof(core_base_attributes -> 'might') = 'number'
    and jsonb_typeof(core_base_attributes -> 'finesse') = 'number'
    and jsonb_typeof(core_base_attributes -> 'vitality') = 'number'
    and jsonb_typeof(core_base_attributes -> 'agility') = 'number'
    and jsonb_typeof(core_base_attributes -> 'intellect') = 'number'
    and jsonb_typeof(core_base_attributes -> 'resolve') = 'number'
    and (core_base_attributes ->> 'might') ~ '^[0-9]+$'
    and (core_base_attributes ->> 'finesse') ~ '^[0-9]+$'
    and (core_base_attributes ->> 'vitality') ~ '^[0-9]+$'
    and (core_base_attributes ->> 'agility') ~ '^[0-9]+$'
    and (core_base_attributes ->> 'intellect') ~ '^[0-9]+$'
    and (core_base_attributes ->> 'resolve') ~ '^[0-9]+$'
    and least(
      (core_base_attributes ->> 'might')::integer,
      (core_base_attributes ->> 'finesse')::integer,
      (core_base_attributes ->> 'vitality')::integer,
      (core_base_attributes ->> 'agility')::integer,
      (core_base_attributes ->> 'intellect')::integer,
      (core_base_attributes ->> 'resolve')::integer
    ) >= 1
    and (
      (core_base_attributes ->> 'might')::integer +
      (core_base_attributes ->> 'finesse')::integer +
      (core_base_attributes ->> 'vitality')::integer +
      (core_base_attributes ->> 'agility')::integer +
      (core_base_attributes ->> 'intellect')::integer +
      (core_base_attributes ->> 'resolve')::integer
    ) = 31
  );

drop function public.jsonb_object_length(jsonb);

commit;
