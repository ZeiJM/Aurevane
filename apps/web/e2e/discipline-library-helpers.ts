import { expect, type Locator } from '@playwright/test'

/** Apply a Discipline through its public slot card and wait for the authoritative commit. */
export async function selectDiscipline(
  dialog: Locator,
  slot: 'Primary' | 'Secondary',
  name: string,
): Promise<void> {
  await dialog.getByRole('button', { name: `Edit ${slot} Discipline`, exact: true }).click()
  const library = dialog.getByRole('region', { name: `${slot} Discipline library`, exact: true })
  await expect(library).toBeVisible()
  const choice = library.getByRole('button', {
    name: `Select ${name} as ${slot} Discipline`,
    exact: true,
  })
  await expect(choice).toBeEnabled()
  await choice.click()
  await expect(choice).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeEnabled()
}
