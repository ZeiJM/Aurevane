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

  TEST_AUTH_URL="$TEST_AUTH_API_URL" \
  TEST_AUTH_KEY="$TEST_AUTH_ADMIN_KEY" \
  TEST_AUTH_USER_ID="$user_id" \
    pnpm --filter @aurevane/web exec node --input-type=module <<'NODE'
import { createClient } from '@supabase/supabase-js'

const client = createClient(process.env.TEST_AUTH_URL, process.env.TEST_AUTH_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const { error } = await client.auth.admin.updateUserById(process.env.TEST_AUTH_USER_ID, {
  email_confirm: true,
})

if (error) {
  console.error(`Could not confirm browser-test user: ${error.message}`)
  process.exit(1)
}
NODE
}

sign_in_test_user() {
  local email="$1"
  local password="$2"

  TEST_AUTH_URL="$TEST_AUTH_API_URL" \
  TEST_AUTH_KEY="$ANON_KEY" \
  TEST_AUTH_EMAIL="$email" \
  TEST_AUTH_PASSWORD="$password" \
    pnpm --filter @aurevane/web exec node --input-type=module <<'NODE'
import { createClient } from '@supabase/supabase-js'

const client = createClient(process.env.TEST_AUTH_URL, process.env.TEST_AUTH_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const { data, error } = await client.auth.signInWithPassword({
  email: process.env.TEST_AUTH_EMAIL,
  password: process.env.TEST_AUTH_PASSWORD,
})

if (error || !data.session?.access_token) {
  console.error(`Could not sign in confirmed browser-test user: ${error?.message ?? 'missing session'}`)
  process.exit(1)
}

process.stdout.write(JSON.stringify({ access_token: data.session.access_token }))
NODE
}
