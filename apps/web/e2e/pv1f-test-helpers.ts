import { expect, type Page } from '@playwright/test'

export async function createAccountAndEnterCharacter(input: {
  page: Page
  email: string
  password: string
  characterName: string
}): Promise<void> {
  const { page, email, password, characterName } = input

  await page.goto('/')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click()

  await expect(page).toHaveURL(/\/game$/)
  await expect(page.getByRole('heading', { name: 'Choose your character.' })).toBeVisible()
  await page.getByRole('link', { name: 'Create Character' }).first().click()
  await expect(page).toHaveURL(/\/game\/create\/0$/)
  await expect(page.getByTestId('character-creation')).toBeVisible()

  await page.getByLabel('Character name').fill(characterName)
  await page.getByRole('button', { name: 'Choose your discipline' }).click()

  for (const attribute of ['might', 'finesse', 'vitality', 'agility', 'intellect', 'resolve']) {
    await page.getByRole('button', { name: `Increase ${attribute} bonus` }).click()
  }
  await expect(page.getByTestId('attribute-points')).toContainText('0 bonus points remaining')

  await page.getByRole('button', { name: 'Review character' }).click()
  await page.getByRole('button', { name: 'Create character' }).click()

  await expect(page).toHaveURL(/\/game\/character$/)
  await expect(page.getByTestId('character-profile')).toContainText(characterName)
}

export async function signOutFromAccountMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Account' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/$/)
}

export async function openOfflineTraining(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Navigation' }).click()
  await page.getByRole('link', { name: /Passive Training/ }).click()
  await expect(page).toHaveURL(/\/game\/training$/)
  await expect(page.getByRole('heading', { name: 'Passive Training' })).toBeVisible()
}
