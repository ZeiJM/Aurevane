# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: master-players-recovery.pw.ts >> Owner corrections and whole encounter recovery reach actual PvE, both PvP participants and spectator
- Location: e2e/master-players-recovery.pw.ts:42:5

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator: getByRole('alert')
Expected: "Choose a different Primary or Secondary."
Error: strict mode violation: getByRole('alert') resolved to 2 elements:
    1) <p role="alert">Choose a different Primary or Secondary.</p> aka getByText('Choose a different Primary or')
    2) <div role="alert" aria-live="assertive" id="__next-route-announcer__"></div> aka locator('[id="__next-route-announcer__"]')

Call log:
  - Expect "toHaveText" with timeout 5000ms
  - waiting for getByRole('alert')

```

# Test source

```ts
  128 |     ).toBeFocused()
  129 |     const confirm = owner.getByRole('checkbox', {
  130 |       name: `I confirm this correction for ${identities[1]!.characterName}.`,
  131 |       exact: true,
  132 |     })
  133 |     await confirm.focus()
  134 |     await owner.keyboard.press('Space')
  135 |     await owner.getByRole('button', { name: 'Save confirmed correction', exact: true }).click()
  136 |     await expect(owner.getByRole('status')).toContainText('Correction saved')
  137 |     await test.step('Verify the first XP correction in SQL', async () => {
  138 |       expect(sql(`select xp from public.characters where id='${characterId}'`)).toBe('1')
  139 |     })
  140 |     // Exercise actual form→protected handler→SQL Discipline corrections before fresh admission.
  141 |     async function readPlayer() {
  142 |       return test.step('Read current Players facts through the protected API', async () => {
  143 |         const response = await owner.request.post('/api/master/players', {
  144 |           data: { operation: 'read', characterId },
  145 |         })
  146 |         expect(response.status()).toBe(200)
  147 |         return ((await response.json()) as { player: MasterPlayerView }).player
  148 |       })
  149 |     }
  150 |     const original = await readPlayer()
  151 |     const originalPrimary = original.facts.build.primary.disciplineId
  152 |     const secondary = original.disciplines.find(
  153 |       (row) => row.secondary && row.id !== originalPrimary,
  154 |     )!.id
  155 |     const nextPrimary = original.disciplines.find(
  156 |       (row) => row.primary && row.id !== originalPrimary && row.id !== secondary,
  157 |     )!.id
  158 |     // Wrapping label text includes every option; use the control's accessible name.
  159 |     const correctionGroup = owner.getByRole('combobox', { name: 'Correction group', exact: true })
  160 |     async function selectDisciplineGroup() {
  161 |       await test.step('Select the Discipline correction group', async () => {
  162 |         await expect(correctionGroup).toHaveCount(1)
  163 |         await correctionGroup.selectOption('disciplines')
  164 |         await expect(correctionGroup).toHaveValue('disciplines')
  165 |       })
  166 |     }
  167 |     async function correctDisciplines(
  168 |       change: { primary?: string; secondary?: string | null },
  169 |       screenshot: string,
  170 |     ) {
  171 |       const before = await readPlayer()
  172 |       await selectDisciplineGroup()
  173 |       if (change.primary !== undefined) {
  174 |         const primary = owner.getByRole('combobox', { name: 'Primary', exact: true })
  175 |         await expect(primary).toHaveCount(1)
  176 |         await primary.selectOption(change.primary)
  177 |         await expect(primary).toHaveValue(change.primary)
  178 |       }
  179 |       if (change.secondary !== undefined) {
  180 |         const secondary = owner.getByRole('combobox', { name: 'Secondary', exact: true })
  181 |         await expect(secondary).toHaveCount(1)
  182 |         await secondary.selectOption(change.secondary ?? '')
  183 |         await expect(secondary).toHaveValue(change.secondary ?? '')
  184 |       }
  185 |       await owner.getByRole('button', { name: 'Review correction', exact: true }).click()
  186 |       await expect(
  187 |         owner.getByRole('heading', { name: 'Review correction', exact: true }),
  188 |       ).toBeFocused()
  189 |       if (change.secondary === undefined && before.facts.build.secondary) {
  190 |         const label = before.facts.build.secondary.disciplineId
  191 |           .split(/[._-]/u)
  192 |           .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  193 |           .join(' ')
  194 |         await expect(owner.getByText(`${label} → ${label}`, { exact: true })).toBeVisible()
  195 |       }
  196 |       await capture(screenshot)
  197 |       await owner
  198 |         .getByRole('checkbox', {
  199 |           name: `I confirm this correction for ${identities[1]!.characterName}.`,
  200 |           exact: true,
  201 |         })
  202 |         .check()
  203 |       const saved = owner.waitForResponse(
  204 |         (response) =>
  205 |           response.url().endsWith('/api/master/players') &&
  206 |           response.request().postDataJSON()?.operation === 'edit',
  207 |       )
  208 |       await owner.getByRole('button', { name: 'Save confirmed correction', exact: true }).click()
  209 |       const response = await saved
  210 |       expect(response.request().postDataJSON().command).toEqual({ kind: 'disciplines', ...change })
  211 |       expect(response.ok()).toBe(true)
  212 |       await expect(owner.getByRole('status')).toContainText('Correction saved')
  213 |       const after = await readPlayer()
  214 |       expect(after.facts.build.primary.disciplineId).toBe(
  215 |         change.primary ?? before.facts.build.primary.disciplineId,
  216 |       )
  217 |       expect(after.facts.build.secondary?.disciplineId ?? null).toBe(
  218 |         change.secondary === undefined
  219 |           ? (before.facts.build.secondary?.disciplineId ?? null)
  220 |           : change.secondary,
  221 |       )
  222 |       expect(after.facts.build.buildVersion).toBeGreaterThan(before.facts.build.buildVersion)
  223 |       expect(after.facts.xp).toBe(1)
  224 |     }
  225 |     await expect(correctionGroup).toHaveValue('source')
  226 |     await selectDisciplineGroup()
  227 |     await owner.getByRole('button', { name: 'Review correction', exact: true }).click()
> 228 |     await expect(owner.getByRole('alert')).toHaveText('Choose a different Primary or Secondary.')
      |                                            ^ Error: expect(locator).toHaveText(expected) failed
  229 |     await correctDisciplines({ secondary }, 'discipline-secondary-only-add')
  230 |     await correctDisciplines({ primary: nextPrimary }, 'discipline-primary-retains-secondary')
  231 |     // Model elapsed time between independent cases on this disposable character;
  232 |     // keep the actual attunement policy and all command validation unchanged.
  233 |     sql(
  234 |       `update app_private.character_active_builds set secondary_attunement_locked_until=now()-interval '1 day' where character_id='${characterId}'`,
  235 |     )
  236 |     await correctDisciplines({ secondary: null }, 'discipline-secondary-only-remove')
  237 |     sql(
  238 |       `update app_private.character_active_builds set primary_attunement_locked_until=now()-interval '1 day' where character_id='${characterId}'`,
  239 |     )
  240 |     await correctDisciplines({ primary: originalPrimary }, 'discipline-primary-with-none')
  241 |     expect(
  242 |       (
  243 |         await host.request.post('/api/master/players', { data: { operation: 'read', characterId } })
  244 |       ).status(),
  245 |     ).toBe(403)
  246 |     expect(
  247 |       (
  248 |         await owner.request.post('/api/master/players', {
  249 |           data: { operation: 'read', characterId, actorUserId: ownerId },
  250 |         })
  251 |       ).status(),
  252 |     ).toBe(400)
  253 |     await host.goto('/game/battle')
  254 |     await host.getByRole('button', { name: 'Enter Battle', exact: true }).click()
  255 |     await expect(host).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  256 |     const pveId = host.url().split('/').pop()!
  257 |     const pve = await host.request.get(`/api/battles/${pveId}`)
  258 |     expect(pve.ok()).toBe(true)
  259 |     expect(JSON.stringify(await pve.json())).not.toContain('sourceHash')
  260 |     await owner.getByRole('button', { name: 'Refresh player', exact: true }).click()
  261 |     await owner.getByRole('button', { name: 'Review encounter recovery', exact: true }).click()
  262 |     await owner
  263 |       .getByRole('checkbox', {
  264 |         name: 'I confirm ending the encounter for every participant listed above.',
  265 |         exact: true,
  266 |       })
  267 |       .check()
  268 |     await capture('pve-confirmation')
  269 |     await owner.getByRole('button', { name: 'End encounter without rewards', exact: true }).click()
  270 |     await expect(host).toHaveURL(/\/game\/battle$/, { timeout: 10000 })
  271 |     expect(sql(`select xp from public.characters where id='${characterId}'`)).toBe('1')
  272 |     expect((await host.request.post(`/api/battles/${pveId}/mastery`)).ok()).toBe(false)
  273 |     await host.getByRole('button', { name: 'PVP', exact: true }).click()
  274 |     const created = host.waitForResponse(
  275 |       (response) =>
  276 |         response.request().method() === 'POST' &&
  277 |         new URL(response.url()).pathname === '/api/pvp/lobbies',
  278 |     )
  279 |     await host.getByRole('button', { name: 'Create Lobby', exact: true }).click()
  280 |     await host.getByRole('button', { name: 'Create Battle Lobby', exact: true }).click()
  281 |     const { lobby } = await (await created).json()
  282 |     await guest.goto(`/game/battle?join=${encodeURIComponent(lobby.lobbyKey)}`)
  283 |     await guest
  284 |       .getByRole('dialog', { name: 'The arena is waiting.' })
  285 |       .getByRole('button', { name: 'Mark Ready' })
  286 |       .click()
  287 |     await host
  288 |       .getByRole('dialog', { name: 'The arena is waiting.' })
  289 |       .getByRole('button', { name: 'Mark Ready' })
  290 |       .click()
  291 |     await expect(host).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/, { timeout: 20000 })
  292 |     await expect(guest).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/, { timeout: 20000 })
  293 |     const pvpId = host.url().split('/').pop()!
  294 |     const key = (await host.locator('[data-pvp-spectator-key] strong').textContent())!.trim()
  295 |     await watcher.goto(`/game/battle/spectate/${key}`)
  296 |     await expect(watcher.locator('[data-battle-versus]')).toBeVisible()
  297 |     let transient = true
  298 |     await watcher.route(`**/api/pvp/spectate/${key}`, async (route) => {
  299 |       if (transient) {
  300 |         transient = false
  301 |         await route.fulfill({
  302 |           status: 503,
  303 |           json: { error: { message: 'Transient test interruption' } },
  304 |         })
  305 |       } else await route.continue()
  306 |     })
  307 |     await expect(watcher.getByText('Transient test interruption')).toBeVisible()
  308 |     expect(watcher.url()).toContain('/spectate/')
  309 |     await watcher.unroute(`**/api/pvp/spectate/${key}`)
  310 |     await owner.getByRole('button', { name: 'Refresh player', exact: true }).click()
  311 |     await owner.getByRole('button', { name: 'Review encounter recovery', exact: true }).click()
  312 |     await expect(
  313 |       owner.getByRole('heading', { name: 'Confirm all participants', exact: true }),
  314 |     ).toBeFocused()
  315 |     const review = owner
  316 |       .getByRole('heading', { name: 'Confirm all participants', exact: true })
  317 |       .locator('..')
  318 |     await expect(review.getByText(identities[1]!.characterName, { exact: true })).toBeVisible()
  319 |     await expect(review.getByText(identities[2]!.characterName, { exact: true })).toBeVisible()
  320 |     await capture('pvp-all-participants')
  321 |     await owner
  322 |       .getByRole('checkbox', {
  323 |         name: 'I confirm ending the encounter for every participant listed above.',
  324 |         exact: true,
  325 |       })
  326 |       .check()
  327 |     await owner.getByRole('button', { name: 'End encounter without rewards', exact: true }).click()
  328 |     for (const participant of [host, guest, watcher])
```