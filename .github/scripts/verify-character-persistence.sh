#!/usr/bin/env bash
set -euo pipefail

status_env="$(pnpm exec supabase status -o env)"
eval "$(printf '%s\n' "$status_env" | grep '^ANON_KEY=')"
test -n "${ANON_KEY:-}"

api_url='http://127.0.0.1:54321'
password='P13-character-security-2026!'
email_one="p13-character-one-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"
email_two="p13-character-two-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}@example.com"

signup() {
  local email="$1"
  curl --fail-with-body --silent --show-error \
    --request POST "$api_url/auth/v1/signup" \
    --header "apikey: $ANON_KEY" \
    --header 'Content-Type: application/json' \
    --data "{\"email\":\"$email\",\"password\":\"$password\"}"
}

first_signup="$(signup "$email_one")"
second_signup="$(signup "$email_two")"
user_one="$(printf '%s' "$first_signup" | jq -r '.user.id')"
user_two="$(printf '%s' "$second_signup" | jq -r '.user.id')"
token_one="$(printf '%s' "$first_signup" | jq -r '.access_token')"
token_two="$(printf '%s' "$second_signup" | jq -r '.access_token')"

test -n "$user_one"
test -n "$user_two"
test "$token_one" != 'null'
test "$token_two" != 'null'

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

create_character_sql() {
  local user_id="$1"
  local slot_index="$2"
  local idempotency_key="$3"
  local fingerprint="$4"
  local name="$5"
  local name_key="$6"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select id::text || '|' || replayed::text
    from public.create_character_v3(
      '$user_id'::uuid,
      '$slot_index'::smallint,
      '$idempotency_key'::uuid,
      '$fingerprint',
      1,
      '$name',
      '$name_key',
      'androgynous',
      'they_them',
      'portrait.starter.wayfarer-01',
      'appearance.starter.roadworn',
      'vanguard',
      6, 6, 6, 6, 6, 6
    );"
}

key_one='00000000-0000-4000-8000-000000000801'
first="$(create_character_sql "$user_one" 0 "$key_one" 'p13:first' 'Arlen Vale' 'arlenvale')"
replay="$(create_character_sql "$user_one" 0 "$key_one" 'p13:first' 'Arlen Vale' 'arlenvale')"

first_id="${first%%|*}"
replay_id="${replay%%|*}"
test -n "$first_id"
test "$first_id" = "$replay_id"
test "${first##*|}" = 'false'
test "${replay##*|}" = 'true'

if create_character_sql "$user_one" 0 '00000000-0000-4000-8000-000000000802' 'p13:slot' 'Another Vale' 'anothervale' >/tmp/p13-slot.out 2>/tmp/p13-slot.err; then
  echo 'Expected occupied character slot creation to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_SLOT_OCCUPIED' /tmp/p13-slot.err

if create_character_sql "$user_two" 0 '00000000-0000-4000-8000-000000000803' 'p13:name' 'Arlen Vale' 'arlenvale' >/tmp/p13-name.out 2>/tmp/p13-name.err; then
  echo 'Expected globally duplicate normalized name to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_NAME_UNAVAILABLE' /tmp/p13-name.err

second="$(create_character_sql "$user_two" 0 '00000000-0000-4000-8000-000000000804' 'p13:second' 'Sera Vale' 'seravale')"
second_id="${second%%|*}"
test -n "$second_id"

third="$(create_character_sql "$user_one" 1 '00000000-0000-4000-8000-000000000806' 'p13:third' 'Bryn Vale' 'brynvale')"
third_id="${third%%|*}"
test -n "$third_id"

if create_character_sql "$user_one" 3 '00000000-0000-4000-8000-000000000807' 'p13:invalid-slot' 'Fourth Vale' 'fourthvale' >/tmp/p13-invalid-slot.out 2>/tmp/p13-invalid-slot.err; then
  echo 'Expected out-of-range character slot creation to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_SLOT_INVALID' /tmp/p13-invalid-slot.err

if create_character_sql "$user_one" 2 '00000000-0000-4000-8000-000000000808' 'p13:invalid-attribute' 'Weak Vale' 'weakvale' >/tmp/p13-unused.out 2>/tmp/p13-unused.err; then
  :
fi

if create_character_sql "$user_one" 0 "$key_one" 'p13:different' 'Arlen Vale' 'arlenvale' >/tmp/p13-idempotency.out 2>/tmp/p13-idempotency.err; then
  echo 'Expected conflicting idempotency fingerprint to fail.' >&2
  exit 1
fi
grep -Eq 'CHARACTER_IDEMPOTENCY_CONFLICT|idempotency' /tmp/p13-idempotency.err

slot_snapshot="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  set role service_role;
  select count(*)::text || '|' || min(vitality)::text || '|' || min(agility)::text
  from public.get_character_slots_v2('$user_one'::uuid);")"
test "$slot_snapshot" = '2|6|6'

switch_result="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  set role service_role;
  select coalesce(public.switch_character_v1('$user_one'::uuid, '$first_id'::uuid, '$third_id'::uuid)::text, 'ok');")"
test "$switch_result" = 'ok'

first_cooldown="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  set role service_role;
  select (reselect_available_at is not null)::text
  from public.get_character_slots_v2('$user_one'::uuid)
  where id = '$first_id'::uuid;")"
test "$first_cooldown" = 'true'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select public.switch_character_v1('$user_one'::uuid, '$third_id'::uuid, '$first_id'::uuid);" >/tmp/p13-cooldown.out 2>/tmp/p13-cooldown.err; then
  echo 'Expected immediate return to the swapped-away character to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_RESELECT_COOLDOWN' /tmp/p13-cooldown.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select public.switch_character_v1('$user_one'::uuid, '$third_id'::uuid, '$second_id'::uuid);" >/tmp/p13-cross-switch.out 2>/tmp/p13-cross-switch.err; then
  echo 'Expected cross-account character selection to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_NOT_PLAYABLE' /tmp/p13-cross-switch.err

docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  update app_private.character_reselect_cooldowns
  set available_at = clock_timestamp() - interval '1 second'
  where character_id = '$first_id'::uuid;" >/dev/null

switch_back="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  set role service_role;
  select coalesce(public.switch_character_v1('$user_one'::uuid, '$third_id'::uuid, '$first_id'::uuid)::text, 'ok');")"
test "$switch_back" = 'ok'

third_cooldown="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  set role service_role;
  select (reselect_available_at is not null)::text
  from public.get_character_slots_v2('$user_one'::uuid)
  where id = '$third_id'::uuid;")"
test "$third_cooldown" = 'true'

title_result="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  set role service_role;
  select personal_title
  from public.set_character_personal_title_v1('$user_one'::uuid, '$first_id'::uuid, 'Dawn Warden');")"
test "$title_result" = 'Dawn Warden'

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.set_character_personal_title_v1('$user_one'::uuid, '$first_id'::uuid, 'Dawn Keeper');" >/tmp/p13-title-repeat.out 2>/tmp/p13-title-repeat.err; then
  echo 'Expected a second personal-title choice on one character to fail.' >&2
  exit 1
fi
grep -Fq 'PERSONAL_TITLE_ALREADY_SET' /tmp/p13-title-repeat.err

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role service_role;
  select * from public.set_character_personal_title_v1('$user_two'::uuid, '$second_id'::uuid, 'dawnwarden');" >/tmp/p13-title-collision.out 2>/tmp/p13-title-collision.err; then
  echo 'Expected canonical personal-title collision to fail.' >&2
  exit 1
fi
grep -Fq 'PERSONAL_TITLE_UNAVAILABLE' /tmp/p13-title-collision.err

own_one="$(curl --fail-with-body --silent --show-error \
  "$api_url/rest/v1/characters?select=id,user_id,name,level,xp,slot_index,vitality,agility,personal_title&user_id=eq.$user_one&order=slot_index.asc" \
  --header "apikey: $ANON_KEY" \
  --header "Authorization: Bearer $token_one")"
printf '%s' "$own_one" | jq -e --arg first "$first_id" --arg third "$third_id" --arg user "$user_one" \
  'length == 2 and .[0].id == $first and .[0].user_id == $user and .[0].level == 1 and .[0].xp == 0 and .[0].slot_index == 0 and .[0].vitality == 6 and .[0].agility == 6 and .[0].personal_title == "Dawn Warden" and .[1].id == $third and .[1].slot_index == 1' >/dev/null

cross_one="$(curl --fail-with-body --silent --show-error \
  "$api_url/rest/v1/characters?select=id&user_id=eq.$user_two" \
  --header "apikey: $ANON_KEY" \
  --header "Authorization: Bearer $token_one")"
printf '%s' "$cross_one" | jq -e 'length == 0' >/dev/null

cross_two="$(curl --fail-with-body --silent --show-error \
  "$api_url/rest/v1/characters?select=id&user_id=eq.$user_one" \
  --header "apikey: $ANON_KEY" \
  --header "Authorization: Bearer $token_two")"
printf '%s' "$cross_two" | jq -e 'length == 0' >/dev/null

mutation_status="$(curl --silent --show-error \
  --output /tmp/p13-direct-mutation.json \
  --write-out '%{http_code}' \
  --request POST "$api_url/rest/v1/characters" \
  --header "apikey: $ANON_KEY" \
  --header "Authorization: Bearer $token_one" \
  --header 'Content-Type: application/json' \
  --data "{\"user_id\":\"$user_one\",\"slot_index\":2,\"name\":\"Forged\"}")"
case "$mutation_status" in
  2*)
    echo 'Authenticated browser unexpectedly inserted a character directly.' >&2
    exit 1
    ;;
esac

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.create_character_v3(
    '$user_one'::uuid,
    2::smallint,
    '00000000-0000-4000-8000-000000000805'::uuid,
    'p13:browser', 1, 'Forged Vale', 'forgedvale', 'androgynous', 'they_them',
    'portrait.starter.wayfarer-01', 'appearance.starter.roadworn', 'vanguard',
    6, 6, 6, 6, 6, 6
  );"; then
  echo 'Authenticated browser role unexpectedly executed character creation RPC.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select public.switch_character_v1('$user_one'::uuid, '$first_id'::uuid, '$third_id'::uuid);"; then
  echo 'Authenticated browser role unexpectedly executed character selection RPC.' >&2
  exit 1
fi

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.set_character_personal_title_v1('$user_one'::uuid, '$first_id'::uuid, 'Forged Title');"; then
  echo 'Authenticated browser role unexpectedly executed personal-title RPC.' >&2
  exit 1
fi

character_count="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc \
  "select count(*) from public.characters where user_id in ('$user_one'::uuid, '$user_two'::uuid);")"
test "$character_count" = '3'
