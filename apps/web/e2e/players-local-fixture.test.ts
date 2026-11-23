import { expect, it, vi } from 'vitest'
import { cleanupPlayersFixture } from './players-local-fixture'

it('preserves the primary failure when an already-closed context rejects cleanup', async () => {
  const primary = new Error('Correction group selection timed out')
  const secondary = new Error('Target page, context or browser has been closed')
  const closed: number[] = []
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await expect(
      (async () => {
        try {
          throw primary
        } finally {
          await cleanupPlayersFixture(
            () => '',
            undefined,
            [
              {
                close: async () => {
                  closed.push(0)
                  throw secondary
                },
              },
              {
                close: async () => {
                  await Promise.resolve()
                  closed.push(1)
                },
              },
            ],
            true,
          )
        }
      })(),
    ).rejects.toBe(primary)
    expect(closed).toEqual([0, 1])
    expect(log).toHaveBeenCalledWith('Players fixture cleanup failed after the primary failure.', [
      secondary,
    ])
  } finally {
    log.mockRestore()
  }
})

it('reports every cleanup failure and closes every context after Owner release fails', async () => {
  const release = new Error('Owner grant cleanup failed')
  const close = new Error('Context cleanup failed')
  const closed: number[] = []
  await expect(
    cleanupPlayersFixture(
      () => {
        throw release
      },
      { userId: 'fixture-owner' },
      [
        {
          close: async () => {
            closed.push(0)
            throw close
          },
        },
        {
          close: async () => {
            await Promise.resolve()
            closed.push(1)
          },
        },
      ],
      false,
    ),
  ).rejects.toMatchObject({ name: 'AggregateError', errors: [release, close] })
  expect(closed).toEqual([0, 1])
})

it('releases only the acquired Owner grant and closes owned contexts on success', async () => {
  const queries: string[] = []
  const closed: number[] = []
  await cleanupPlayersFixture(
    (query) => {
      queries.push(query)
      return ''
    },
    { userId: 'fixture-owner' },
    [
      {
        close: async () => {
          closed.push(0)
        },
      },
    ],
    false,
  )
  expect(queries).toEqual([
    "delete from app_private.master_panel_role_assignments where user_id='fixture-owner' and role='game-owner'",
  ])
  expect(closed).toEqual([0])
})

it('does not mutate grants when setup never acquired one', async () => {
  const queries: string[] = []
  await cleanupPlayersFixture(
    (query) => {
      queries.push(query)
      return ''
    },
    undefined,
    [],
    false,
  )
  expect(queries).toEqual([])
})
