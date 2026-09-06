from pathlib import Path


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new)

cockpit_path = Path('apps/web/src/components/battle/battle-command-cockpit-polish.tsx')
cockpit = cockpit_path.read_text()
cockpit = replace_exact(
    cockpit,
    """  if (instruction.description.title !== presentation.description) {
    instruction.description.title = presentation.description
  }
""",
    """  if (instruction.description.title !== description) {
    instruction.description.title = description
  }
""",
    'Technique context tooltip',
)
cockpit_path.write_text(cockpit)

test_path = Path('apps/web/e2e/p3-8-representative-buildcraft.pw.ts')
test = test_path.read_text()
needle = """  await expect(skillRow(page, 'Mending Light').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Barrier').getByRole('checkbox')).toBeChecked()
})
"""
replacement = """  await expect(skillRow(page, 'Mending Light').getByRole('checkbox')).toBeChecked()
  await expect(skillRow(page, 'Barrier').getByRole('checkbox')).toBeChecked()

  // Tagged Techniques must keep the cockpit slot's keyboard contract and receive the same
  // authoritative preview chips as the original basic actions after a skill swap.
  const techniquesDialog = page.getByRole('dialog', { name: 'Techniques' })
  await techniquesDialog.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Navigation' }).click()
  await page.getByRole('link', { name: /Battle Hall/ }).click()
  await expect(page).toHaveURL(/\\/game\\/battle$/)
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\\/game\\/battle\\/[0-9a-f-]{36}$/)

  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const commandContext = commandDeck.locator(':scope > div').first()
  const attackCard = commandDeck.locator('[data-command-card=\"attack\"]')
  const attackAction = attackCard.locator('button[data-command-slot=\"attack\"]')
  const attackArtwork = attackCard.getByRole('button', { name: /Choose Attack skill/i })

  await attackArtwork.click()
  const attackSelector = page.getByRole('listbox', { name: 'Attack skills' })
  await expect(attackSelector.getByRole('option', { name: /Forceful Strike/ })).toBeVisible()
  await attackSelector.getByRole('option', { name: /Forceful Strike/ }).click()
  await expect(attackAction).toContainText('Forceful Strike')

  await page.keyboard.press('Digit3')
  await expect(attackAction).toHaveAttribute('data-battle-active', 'true')
  await expect
    .poll(() => page.locator('#battlefield button[data-attack-range]').count())
    .toBeGreaterThan(0)

  const battleSessionId = page.url().split('/').at(-1)
  expect(battleSessionId).toMatch(/^[0-9a-f-]{36}$/)
  if (!battleSessionId) return

  await page.route(`**/api/battles/${battleSessionId}/preview`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        battlePreview: {
          preview: {
            kind: 'action',
            legal: true,
            issues: [],
            actionId: 'vanguard.forceful-strike',
            hitChanceBasisPoints: 6500,
            mitigatedBaseDamage: 18,
            projectedEffects: [],
            projectedStatuses: [],
            affectedCombatantIds: ['recruit:1'],
          },
        },
      }),
    })
  })

  await page.evaluate(async (id) => {
    await fetch(`/api/battles/${id}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
  }, battleSessionId)

  await expect(commandContext).toContainText('Forceful Strike')
  await expect(commandContext).toContainText('Hit 65%')
  await expect(commandContext).toContainText('On hit 18 dmg')
})
"""
test = replace_exact(test, needle, replacement, 'P3.8 cockpit regression proof')
test_path.write_text(test)
