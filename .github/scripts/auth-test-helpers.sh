#!/usr/bin/env bash

load_test_auth() {
  local status_env
  status_env="$(pnpm exec supabase status -o env)"
  eval "$(printf '%s\n' "$status_env" | grep -E '^(ANON_KEY|SERVICE_ROLE_KEY|SECRET_KEY)=')"

  test -n "${ANON_KEY:-}"
  TEST_AUTH_ADMIN_KEY="${SECRET_KEY:-${SERVICE_ROLE_KEY:-}}"
  test -n "$TEST_AUTH_ADMIN_KEY"
  TEST_AUTH_API_URL='http://127.0.0.1:54321'
}

signup_test_user() {
  local email="$1"
  local password="$2"

  curl --fail-with-body --silent --show-error \
    --request POST "$TEST_AUTH_API_URL/auth/v1/signup" \
    --header "apikey: $ANON_KEY" \
    --header 'Content-Type: application/json' \
    --data "{\"email\":\"$email\",\"password\":\"$password\"}"
}

confirm_test_user() {
  local user_id="$1"

  curl --fail-with-body --silent --show-error \
    --request PUT "$TEST_AUTH_API_URL/auth/v1/admin/users/$user_id" \
    --header "apikey: $TEST_AUTH_ADMIN_KEY" \
    --header "Authorization: Bearer $TEST_AUTH_ADMIN_KEY" \
    --header 'Content-Type: application/json' \
    --data '{"email_confirm":true}' \
    >/dev/null
}

sign_in_test_user() {
  local email="$1"
  local password="$2"

  curl --fail-with-body --silent --show-error \
    --request POST "$TEST_AUTH_API_URL/auth/v1/token?grant_type=password" \
    --header "apikey: $ANON_KEY" \
    --header 'Content-Type: application/json' \
    --data "{\"email\":\"$email\",\"password\":\"$password\"}"
}
