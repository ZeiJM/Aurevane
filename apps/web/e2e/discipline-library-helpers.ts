import { expect, type Locator } from '@playwright/test'

/** Preview through the public slot card and library; callers still explicitly confirm commits. */
export async function previewDiscipline(
  dialog: Locator,
  slot: 'Primary' | 'Secondary',
  name: string,
): Promise<void> {
  await dialog.getByRole('button', { name: `Edit ${slot} Discipline`, exact: true }).click()
  const library = dialog.getByRole('region', { name: `${slot} Discipline library`, exact: true })
  await expect(library).toBeVisible()
  const choice = library.getByRole('button', {
    name: `Preview ${name} as ${slot} Discipline`,
    exact: true,
  })
  await expect(choice).toBeEnabled()
  await choice.click()
  await expect(choice).toHaveAttribute('aria-pressed', 'true')
}
