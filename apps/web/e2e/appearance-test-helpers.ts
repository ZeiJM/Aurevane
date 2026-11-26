import { expect, type Locator, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import {
  compileAppearanceManifest,
  type AppearanceBlueprint,
} from '../src/appearance/appearance-manifest'

export async function grantAppearanceToken(userId: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !secretKey) throw new Error('Local Supabase credentials are required.')

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: character, error: characterError } = await supabase
    .rpc('get_character_slots_v2', { p_user_id: userId })
    .single<{ id: string }>()
  if (characterError) throw characterError

  const owner = { p_user_id: userId, p_character_id: character.id }
  const { data: inventory, error: inventoryError } = await supabase.rpc(
    'read_character_item_inventory_v1',
    owner,
  )
  if (inventoryError) throw inventoryError

  const { error: grantError } = await supabase.rpc('grant_character_items_v1', {
    ...owner,
    p_expected_revision: inventory.revision,
    p_grant_key: 'appearance-browser-test',
    p_items: [{ itemId: 'item.appearance-token', quantity: 1 }],
  })
  if (grantError) throw grantError
  return character.id
}

export async function saveFixtureAppearance(
  page: Page,
  userId: string,
  blueprint: AppearanceBlueprint,
): Promise<string> {
  const characterId = await grantAppearanceToken(userId)
  const before = await page.request.get('/api/account/appearance')
  expect(before.ok()).toBe(true)
  const current = (await before.json()).appearance
  const response = await page.request.post('/api/account/appearance', {
    data: { characterId, expectedRevision: current.revision, blueprint },
  })
  expect(response.ok()).toBe(true)
  const { appearance } = await response.json()
  const manifest = compileAppearanceManifest(blueprint)
  expect(appearance).toMatchObject({ imageUrl: manifest.neutralUrl, appearanceTokens: 0 })
  return manifest.portraits.neutral
}

/** Sample inside one old 300ms atlas interval without depending on browser scheduling. */
export async function expectSmoothReadyStance(actor: Locator) {
  await expect(actor).toBeVisible()
  const poses = await actor.evaluate((element) => {
    const animation = element.getAnimations()[0]
    if (!animation) return []
    const originalTime = animation.currentTime
    animation.pause()
    try {
      return Array.from({ length: 9 }, (_, index) => {
        animation.currentTime = 350 + index * 16
        return getComputedStyle(element).transform
      })
    } finally {
      animation.currentTime = originalTime
      animation.play()
    }
  })
  expect(new Set(poses).size).toBe(9)
}
