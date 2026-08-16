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
  local idempotency_key="$2"
  local fingerprint="$3"
  local name="$4"
  local name_key="$5"

  docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
    set role service_role;
    select id::text || '|' || replayed::text
    from public.create_base_character_v1(
      '$user_id'::uuid,
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
      6, 6, 6, 6
    );"
}

key_one='00000000-0000-4000-8000-000000000801'
first="$(create_character_sql "$user_one" "$key_one" 'p13:first' 'Arlen Vale' 'arlenvale')"
replay="$(create_character_sql "$user_one" "$key_one" 'p13:first' 'Arlen Vale' 'arlenvale')"

first_id="${first%%|*}"
replay_id="${replay%%|*}"
test -n "$first_id"
test "$first_id" = "$replay_id"
test "${first##*|}" = 'false'
test "${replay##*|}" = 'true'

if create_character_sql "$user_one" '00000000-0000-4000-8000-000000000802' 'p13:slot' 'Another Vale' 'anothervale' >/tmp/p13-slot.out 2>/tmp/p13-slot.err; then
  echo 'Expected occupied base slot creation to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_SLOT_OCCUPIED' /tmp/p13-slot.err

if create_character_sql "$user_two" '00000000-0000-4000-8000-000000000803' 'p13:name' 'Arlen Vale' 'arlenvale' >/tmp/p13-name.out 2>/tmp/p13-name.err; then
  echo 'Expected globally duplicate normalized name to fail.' >&2
  exit 1
fi
grep -Fq 'CHARACTER_NAME_UNAVAILABLE' /tmp/p13-name.err

second="$(create_character_sql "$user_two" '00000000-0000-4000-8000-000000000804' 'p13:second' 'Sera Vale' 'seravale')"
second_id="${second%%|*}"
test -n "$second_id"

if create_character_sql "$user_one" "$key_one" 'p13:different' 'Arlen Vale' 'arlenvale' >/tmp/p13-idempotency.out 2>/tmp/p13-idempotency.err; then
  echo 'Expected conflicting idempotency fingerprint to fail.' >&2
  exit 1
fi
grep -Fq 'idempotency key reused' /tmp/p13-idempotency.err

own_one="$(curl --fail-with-body --silent --show-error \
  "$api_url/rest/v1/characters?select=id,user_id,name,level,xp,slot_index&user_id=eq.$user_one" \
  --header "apikey: $ANON_KEY" \
  --header "Authorization: Bearer $token_one")"
printf '%s' "$own_one" | jq -e --arg id "$first_id" --arg user "$user_one" \
  'length == 1 and .[0].id == $id and .[0].user_id == $user and .[0].level == 1 and .[0].xp == 0 and .[0].slot_index == 0' >/dev/null

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
  --data "{\"user_id\":\"$user_one\",\"slot_index\":1,\"name\":\"Forged\"}")"
case "$mutation_status" in
  2*)
    echo 'Authenticated browser unexpectedly inserted a character directly.' >&2
    exit 1
    ;;
esac

if docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -c "
  set role authenticated;
  select * from public.create_base_character_v1(
    '$user_one'::uuid,
    '00000000-0000-4000-8000-000000000805'::uuid,
    'p13:browser', 1, 'Forged Vale', 'forgedvale', 'androgynous', 'they_them',
    'portrait.starter.wayfarer-01', 'appearance.starter.roadworn', 'vanguard', 6, 6, 6, 6
  );"; then
  echo 'Authenticated browser role unexpectedly executed character creation RPC.' >&2
  exit 1
fi

character_count="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc \
  "select count(*) from public.characters where user_id in ('$user_one'::uuid, '$user_two'::uuid);")"
test "$character_count" = '2'
