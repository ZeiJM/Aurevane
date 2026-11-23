#!/usr/bin/env bash
# Native fixture preparation only. Calls the real owned committed authority;
# it never supplies grants, changes a build, or bypasses participant admission.
with_current_character_build() {
  local fixture_container="$1" fixture_user="$2" fixture_character="$3" fixture_combatant="$4" fixture_snapshot="$5"
  local fixture_build
  fixture_build="$(docker exec "$fixture_container" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "set role service_role; select public.get_character_committed_build_snapshot_v2('$fixture_user'::uuid,'$fixture_character'::uuid);")"
  jq -ce --argjson build "$fixture_build" --arg character "$fixture_character" --arg combatant "$fixture_combatant" '.buildAuthority = {combatants: [($build + {characterId:$character,combatantId:$combatant})]}' <<< "$fixture_snapshot"
}
