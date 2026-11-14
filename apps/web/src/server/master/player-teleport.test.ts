import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { createMasterPlayersService } from './players-service'

it('exposes a dedicated teleport operation rather than a generic player patch', () => {
  const service = createMasterPlayersService({ requireCapability: vi.fn() }, vi.fn())
  expect(service).toHaveProperty('teleport', expect.any(Function))
})

it('validates row-major destinations and refuses raw sector IDs, terrain, other realms or fractional coordinates', async () => {
  const { parseMasterTeleportDestination } = await import('./player-teleport')
  expect(
    parseMasterTeleportDestination({ map: 'mainland', sectorNumber: 8192, x: 12, y: 8 }),
  ).toEqual({ map: 'mainland', sectorNumber: 8192, x: 12, y: 8 })
  expect(
    parseMasterTeleportDestination({
      map: 'currentVoid',
      sectorNumber: 768,
      x: 0,
      y: 0,
      geometryVersion: '2026-11-14-v3',
    }).map,
  ).toBe('currentVoid')
  for (const invalid of [
    { map: 'mainland', sectorNumber: 0, x: 0, y: 0 },
    { map: 'currentVoid', sectorNumber: 3073, x: 0, y: 0 },
    { map: 'ivory-veil', sectorNumber: 1, x: 0, y: 0 },
    { map: 'mainland', sectorNumber: 1, x: 0.5, y: 0 },
    { map: 'mainland', sectorNumber: 1, x: 13, y: 0 },
    { map: 'mainland', sectorNumber: 1, x: 0, y: 9 },
    { map: 'mainland', sectorNumber: 1, x: 0, y: 0, sectorId: 'arbitrary' },
    { map: 'mainland', sectorNumber: 1, x: 0, y: 0, rows: ['s'] },
  ])
    expect(() => parseMasterTeleportDestination(invalid)).toThrow()
})

it('prepares every possible current Void sector so a forced roll selects geometry inside the commit', async () => {
  const { masterTeleportGeometry } = await import('./player-teleport')
  const sector = (id: string) => ({ id, rows: Array(9).fill('.'.repeat(13)), townId: null })
  const geometry = masterTeleportGeometry(
    { map: 'currentVoid', sectorNumber: 34, x: 2, y: 3 },
    sector as never,
  )
  expect(geometry).toHaveLength(8)
  expect(geometry.map((entry) => entry.sectorId)).toContain('void:ivory-veil:33:0')
  expect(geometry.every((entry) => entry.sectorNumber === 34)).toBe(true)
  expect(geometry[0]!.rows).toHaveLength(9)
})

it('checks staff access before preparing geometry and sends only typed destination coordinates to the commit', async () => {
  const prepare = vi.fn(async () => {})
  const access = {
    requireCapability: vi.fn(async () => ({
      userId: 'owner',
      accessVersion: 1,
      roles: ['game-owner'] as const,
      specialCapabilities: [],
      effectiveCapabilities: ['players.manage'] as const,
    })),
  }
  const raw = {
    characterId: 'target',
    fingerprint: 'f'.repeat(64),
    facts: {
      level: 1,
      xp: 0,
      cycle: 1,
      attributes: { might: 12, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 6 },
      build: {},
    },
    world: { version: 7, position: { sectorId: 'atlas:62:28', x: 6, y: 4 } },
  }
  const rpc = vi.fn(async (name: string) => (name === 'read_master_player_v1' ? raw : {}))
  const service = createMasterPlayersService(access, rpc, undefined, prepare)
  const input = {
    characterId: 'target',
    expectedVersion: 6,
    requestKey: 'request',
    reason: ' Reviewed player recovery ',
    destination: { map: 'mainland', sectorNumber: 3647, x: 6, y: 4 },
  }
  const result = await service.teleport('owner', input)
  expect(result.world).toEqual(raw.world)
  expect(rpc).toHaveBeenCalledWith('teleport_master_player_v3', {
    p_actor_user_id: 'owner',
    p_character_id: 'target',
    p_expected_version: 6,
    p_request_key: 'request',
    p_map: 'mainland',
    p_sector_number: 3647,
    p_x: 6,
    p_y: 4,
    p_reason: 'Reviewed player recovery',
    p_confirmed: true,
  })
  expect(prepare).toHaveBeenCalledWith('owner', input.destination)
  await expect(
    service.teleport('owner', { ...input, destination: { ...input.destination, rows: [] } }),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  expect(prepare).toHaveBeenCalledTimes(1)
  access.requireCapability.mockRejectedValueOnce(new Error('denied'))
  await expect(service.teleport('owner', input)).rejects.toThrow('denied')
  expect(prepare).toHaveBeenCalledTimes(1)
})

it('requires a trimmed staff reason of 3 to 240 characters', async () => {
  const { parseMasterTeleportReason } = await import('./player-teleport')
  expect(parseMasterTeleportReason('  Reviewed recovery  ')).toBe('Reviewed recovery')
  for (const value of [undefined, null, '', '  ', 'ab', 'x'.repeat(241)])
    expect(() => parseMasterTeleportReason(value)).toThrow()
})

it('uses a new immutable geometry release and covers the expanded private continent', async () => {
  const {
    MASTER_TELEPORT_GEOMETRY_VERSION,
    masterTeleportGeometry,
    parseMasterTeleportDestination,
  } = await import('./player-teleport')
  expect(MASTER_TELEPORT_GEOMETRY_VERSION).toBe('2026-11-14-v3')
  expect(
    parseMasterTeleportDestination({
      map: 'currentVoid',
      sectorNumber: 3072,
      x: 12,
      y: 8,
      geometryVersion: '2026-11-14-v3',
    }).sectorNumber,
  ).toBe(3072)
  const geometry = masterTeleportGeometry(
    { map: 'currentVoid', sectorNumber: 3072, x: 12, y: 8 },
    ((id: string) => ({ id, rows: Array(9).fill('.............') })) as never,
  )
  expect(geometry.map((s) => s.sectorId)).toContain('void:ivory-veil:63:47')
})

it.each([undefined, '2026-11-12-v1', '2026-11-12-v2', 'unrecognized'])(
  'refuses stale Void coordinate version %s before preparation or commit',
  async (geometryVersion) => {
    const prepare = vi.fn(async () => {}),
      rpc = vi.fn(),
      access = { requireCapability: vi.fn() }
    const service = createMasterPlayersService(access, rpc, undefined, prepare)
    const destination = {
      map: 'currentVoid',
      sectorNumber: 34,
      x: 6,
      y: 4,
      ...(geometryVersion === undefined ? {} : { geometryVersion }),
    }
    await expect(
      service.teleport('owner', {
        characterId: 'target',
        expectedVersion: 1,
        requestKey: 'request',
        reason: 'Reviewed recovery',
        destination,
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
      message: expect.stringMatching(/refresh.*review/i),
    })
    expect(prepare).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  },
)
it('binds accepted Void numbering to the shared browser geometry version and still rejects unknown fields', async () => {
  const {
    parseMasterTeleportDestination,
    masterTeleportGeometry,
    MASTER_TELEPORT_GEOMETRY_VERSION,
  } = await import('./player-teleport')
  const shared = await import('@/master/players')
  expect(shared.MASTER_TELEPORT_GEOMETRY_VERSION).toBe(MASTER_TELEPORT_GEOMETRY_VERSION)
  const input = {
    map: 'currentVoid',
    sectorNumber: 34,
    x: 6,
    y: 4,
    geometryVersion: '2026-11-14-v3',
  }
  const destination = parseMasterTeleportDestination(input)
  expect(destination).toEqual(input)
  const rows = masterTeleportGeometry(destination, ((id: string) => ({
    id,
    rows: Array(9).fill('.............'),
  })) as never)
  expect(rows.some((row) => row.sectorId === 'void:ivory-veil:33:0')).toBe(true)
  expect(() => parseMasterTeleportDestination({ ...input, rows: [] })).toThrow()
  expect(() => parseMasterTeleportDestination({ ...input, realmId: 'ivory-veil' })).toThrow()
})
