import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

const dir = resolve(process.cwd(), '../../supabase/migrations')
const file = readdirSync(dir).find((name) => name.endsWith('_world_open_ground_idle_timeout.sql'))

it('drops characters idle for ten minutes from open ground while safe settlements keep everyone', () => {
  expect(file).toBeDefined()
  const sql = readFileSync(resolve(dir, file!), 'utf8')
  // Safe settlements (the saved `safe` flag, true by default) keep every character on the map…
  expect(sql).toContain("coalesce((w.state->>'safe')::boolean,true)")
  // …while open (PvP) ground only shows characters seen within the last ten minutes.
  expect(sql).toContain("w.last_seen_at>clock_timestamp()-interval '10 minutes'")
  // Attackability still needs the original 40 second presence window.
  expect(sql).toContain("interval '40 seconds'")
  expect(sql).toContain('create or replace function public.read_world_state_v1')
})
