// Disposable local browser-fixture SQL, shared with migration-chain regression tests.
export type FixtureSql = (query: string) => string | Promise<string>
export type FixtureOwner = { userId: string }

export async function acquirePlayersFixtureOwner(
  sql: FixtureSql,
  userId: string,
): Promise<FixtureOwner> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(userId) ||
    (await sql(`select id from auth.users where id='${userId}'`)) !== userId
  )
    throw new Error('Players browser fixture requires a real auth user ID.')
  if (
    (await sql(
      "select count(*) from app_private.master_panel_role_assignments where role='game-owner' and enabled",
    )) !== '0'
  )
    throw new Error(
      'Players browser fixture requires no enabled Owner; unrelated grants are preserved.',
    )
  await sql(
    `insert into app_private.master_panel_role_assignments(user_id,role) values('${userId}','game-owner')`,
  )
  return { userId }
}

export async function releasePlayersFixtureOwner(sql: FixtureSql, owner: FixtureOwner) {
  await sql(
    `delete from app_private.master_panel_role_assignments where user_id='${owner.userId}' and role='game-owner'`,
  )
}

export async function cleanupPlayersFixture(
  sql: FixtureSql,
  owner: FixtureOwner | undefined,
  contexts: { close(): Promise<void> }[],
  primaryFailure: boolean,
) {
  const errors: unknown[] = []
  try {
    if (owner) await releasePlayersFixtureOwner(sql, owner)
  } catch (error) {
    errors.push(error)
  }
  const results = await Promise.allSettled(contexts.map(async (context) => context.close()))
  for (const result of results) if (result.status === 'rejected') errors.push(result.reason)
  if (!errors.length) return
  // Playwright may already have closed contexts when the test times out.
  // Preserve that first failure while retaining cleanup diagnostics.
  if (primaryFailure)
    console.error('Players fixture cleanup failed after the primary failure.', errors)
  else throw new AggregateError(errors, 'Players fixture cleanup failed.')
}
