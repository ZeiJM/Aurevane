from pathlib import Path

keyboard = Path('apps/web/src/components/battle/battle-keyboard-assist.tsx')
text = keyboard.read_text()

old = """function syncAttackRangeMarkers(playerName: string) {\n  const tiles = battleTiles()\n  if (!attackModeIsActive()) {\n    for (const tile of tiles) tile.removeAttribute('data-attack-range')\n    return\n  }\n\n  const actorTile = playerTile(playerName)\n"""
new = """function syncAttackRangeMarkers(playerName: string) {\n  const tiles = battleTiles()\n  const attack = commandButton('Basic Attack')\n  const attackName = attack?.querySelector('strong')?.textContent?.trim()\n  if (!attackModeIsActive() || attackName !== 'Basic Attack') {\n    // Mature Techniques own their targeting presentation through data-target. Do not project the\n    // legacy one-tile Basic Attack marker over a swapped Attack Technique.\n    for (const tile of tiles) tile.removeAttribute('data-attack-range')\n    return\n  }\n\n  const actorTile = playerTile(playerName)\n"""
if old not in text:
    raise SystemExit('syncAttackRangeMarkers anchor not found')
text = text.replace(old, new, 1)

old = """      const targets = legalVisibleTargetButtons(playerName).filter(\n        (button) => button.dataset.attackRange === 'legal',\n      )\n"""
new = """      const targets = legalVisibleTargetButtons(playerName).filter(\n        (button) => button.dataset.target === 'enemy' || button.dataset.attackRange === 'legal',\n      )\n"""
if old not in text:
    raise SystemExit('cycleTarget anchor not found')
text = text.replace(old, new, 1)
keyboard.write_text(text)

css = Path('apps/web/src/components/battle/pvp-battle-experience.module.css')
styles = css.read_text()
old = """.facingRow[data-open] {\n  display: flex;\n}\n"""
new = """.facingRow[data-open] {\n  /* The native final-facing controls remain mounted for keyboard/map-guide authority, but the\n     legacy inline row must not paint across the modern command cockpit. */\n  display: none;\n}\n"""
if old not in styles:
    raise SystemExit('facingRow anchor not found')
styles = styles.replace(old, new, 1)
css.write_text(styles)

spec = Path('apps/web/e2e/p3-8-representative-buildcraft.pw.ts')
test = spec.read_text()
old = """  await page.keyboard.press('Digit3')\n  await expect(attackAction).toHaveAttribute('data-battle-active', 'true')\n\n  const battleSessionId = page.url().split('/').at(-1)\n  expect(battleSessionId).toMatch(/^[0-9a-f-]{36}$/)\n  if (!battleSessionId) return\n\n  await page.route(`**/api/battles/${battleSessionId}/preview`, async (route) => {\n    await route.fulfill({\n      status: 200,\n      contentType: 'application/json',\n      body: JSON.stringify({\n        battlePreview: {\n          preview: {\n            kind: 'action',\n            legal: true,\n            issues: [],\n            actionId: 'vanguard.forceful-strike',\n            hitChanceBasisPoints: 6500,\n            mitigatedBaseDamage: 18,\n            projectedEffects: [],\n            projectedStatuses: [],\n            affectedCombatantIds: ['recruit:1'],\n          },\n        },\n      }),\n    })\n  })\n\n  await page.evaluate(async (id) => {\n    await fetch(`/api/battles/${id}/preview`, {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: '{}',\n    })\n  }, battleSessionId)\n\n  await expect(commandContext).toContainText('Forceful Strike')\n  await expect(commandContext).toContainText('Hit 65%')\n  await expect(commandContext).toContainText('On hit 18 dmg')\n"""
new = """  await page.keyboard.press('Digit3')\n  await expect(attackAction).toHaveAttribute('data-battle-active', 'true')\n\n  // Directional keyboard targeting must use the swapped Technique's live target relation rather\n  // than the old one-tile Basic Attack helper. The first legal direction previews; pressing that\n  // same direction again commits through the exact same Confirm Action path as mouse input.\n  let attackDirection: string | null = null\n  for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {\n    await page.keyboard.press(key)\n    try {\n      await expect(commandContext).toContainText('Hit ', { timeout: 1500 })\n      attackDirection = key\n      break\n    } catch {\n      // Try the next cardinal direction until the current battle layout yields a legal enemy.\n    }\n  }\n\n  expect(attackDirection).not.toBeNull()\n  await expect(commandContext).toContainText('Forceful Strike')\n  await expect(commandContext).toContainText(/Hit \\d+%/)\n  await expect(commandContext).toContainText(/On hit \\d+ dmg/)\n  await expect(page.getByRole('button', { name: /Confirm Action/ })).toBeEnabled()\n\n  await page.keyboard.press(attackDirection!)\n  await expect(page.getByRole('button', { name: /Confirm Action/ })).toHaveCount(0, {\n    timeout: 8000,\n  })\n\n  // Space still enters final-facing authority, but its retired inline control row must remain\n  // visually hidden so it cannot draw guide lines across the command cards.\n  await page.keyboard.press('Space')\n  const legacyFacingRow = page.locator('[data-unified-facing-pad="true"]')\n  await expect(legacyFacingRow).toHaveAttribute('data-open', '')\n  await expect(legacyFacingRow).toBeHidden()\n"""
if old not in test:
    raise SystemExit('representative keyboard proof anchor not found')
test = test.replace(old, new, 1)
spec.write_text(test)
