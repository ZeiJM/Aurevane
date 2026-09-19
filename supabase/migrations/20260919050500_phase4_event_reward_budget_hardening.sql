begin;

-- Event participation and claim history is durable provenance. It must survive
-- later character/account deletion so Chronicle/support history remains trustworthy.
alter table app_private.event_participants
  drop constraint if exists event_participants_character_id_fkey;
alter table app_private.event_participants
  drop constraint if exists event_participants_user_id_fkey;
alter table app_private.event_contributions
  drop constraint if exists event_contributions_user_id_fkey;
alter table app_private.event_reward_claim_reservations
  drop constraint if exists event_reward_claim_reservations_user_id_fkey;

create table app_private.event_reward_budget_policies (
  budget_ref text primary key check (
    budget_ref ~ '^[a-z0-9][a-z0-9._:-]{1,159}$'
  ),
  reward_kind text not null check (reward_kind = 'character-xp'),
  max_per_claim bigint not null check (max_per_claim > 0),
  approved_by uuid not null,
  approved_at timestamptz not null default clock_timestamp()
);

comment on table app_private.event_reward_budget_policies is
  'Immutable Owner-approved Event reward budget policies. P4.12 v1 supports Character XP only.';

alter table app_private.event_reward_packages
  add column budget_ref text not null,
  add constraint event_reward_packages_budget_ref_fkey
    foreign key (budget_ref)
    references app_private.event_reward_budget_policies(budget_ref)
    on update restrict
    on delete restrict,
  drop constraint if exists event_reward_packages_published_by_fkey;

comment on column app_private.event_reward_packages.budget_ref is
  'Immutable approved budget identity that caps this Event Reward Package.';

create or replace function app_private.validate_event_reward_package_budget_v1()
returns trigger
language plpgsql
set search_path = pg_catalog, public, app_private
as $$
declare
  v_budget app_private.event_reward_budget_policies%rowtype;
begin
  select *
  into v_budget
  from app_private.event_reward_budget_policies as policy
  where policy.budget_ref = new.budget_ref;

  if not found or v_budget.reward_kind <> new.reward_kind then
    raise exception using
      errcode = '22023',
      message = 'EVENT_REWARD_BUDGET_UNAVAILABLE';
  end if;

  if new.amount > v_budget.max_per_claim then
    raise exception using
      errcode = '22023',
      message = 'EVENT_REWARD_BUDGET_EXCEEDED';
  end if;

  return new;
end;
$$;

create trigger validate_event_reward_package_budget_v1
before insert on app_private.event_reward_packages
for each row execute function app_private.validate_event_reward_package_budget_v1();

create or replace function app_private.prevent_event_reward_budget_mutation_v1()
returns trigger
language plpgsql
set search_path = pg_catalog, public, app_private
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'EVENT_REWARD_BUDGET_IMMUTABLE';
end;
$$;

create trigger prevent_event_reward_budget_mutation_v1
before update or delete on app_private.event_reward_budget_policies
for each row execute function app_private.prevent_event_reward_budget_mutation_v1();

alter table app_private.event_reward_budget_policies enable row level security;

revoke all on table app_private.event_reward_budget_policies
  from public, anon, authenticated, service_role;
grant select on table app_private.event_reward_budget_policies to service_role;

comment on table app_private.event_reward_packages is
  'Immutable Event Reward Package catalog. P4.12 v1 supports only budget-approved Character XP and delegates application/idempotency to the normal XP grant service.';

commit;
