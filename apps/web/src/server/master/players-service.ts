import 'server-only'
import { projectPublicCombat } from '@aurevane/game-core/combat/public-combat-presentation'
import { AurevaneError } from '@aurevane/game-core/errors'
import { CHARACTER_ATTRIBUTE_IDS } from '@aurevane/game-core/character/creation'
import { calculateDerivedStats } from '@aurevane/game-core/character/derived-stats'
import { parseSupportActionId } from '@aurevane/game-core/combat/support-actions'
import type {
  MasterPlayerFacts,
  MasterPlayerSearchResult,
  MasterPlayerView,
  PlayerCorrection,
  PlayerRecoveryResult,
} from '@/master/players'
import type { MasterPanelStaffAccessService } from './staff-access'
import { resolveMasterBattleRecovery } from './player-battle-recovery'

export type PlayersRpc = (name: string, parameters: Record<string, unknown>) => Promise<unknown>
export function playerRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function invalid(): never {
  throw new AurevaneError(
    'INVALID_REQUEST',
    'Choose supported gameplay fields and confirm the reviewed change.',
  )
}
function unavailable(): never {
  throw new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Player support data is unavailable.')
}
const whole = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
export function parsePlayerCorrection(value: unknown): PlayerCorrection {
  if (!playerRecord(value)) invalid()
  const allowed =
    value.kind === 'source'
      ? ['kind', 'xp', 'attributes']
      : value.kind === 'disciplines'
        ? ['kind', 'primary', 'secondary']
        : value.kind === 'skills'
          ? ['kind', 'skills']
          : value.kind === 'support'
            ? ['kind', 'supportActionId']
            : []
  if (!allowed.length || Object.keys(value).some((key) => !allowed.includes(key))) invalid()
  if (value.kind === 'source') {
    if (
      !whole(value.xp) ||
      !playerRecord(value.attributes) ||
      Object.keys(value.attributes).length !== 6 ||
      !CHARACTER_ATTRIBUTE_IDS.every((key) =>
        whole((value.attributes as Record<string, unknown>)[key]),
      )
    )
      invalid()
  } else if (value.kind === 'disciplines') {
    if (
      (!Object.hasOwn(value, 'primary') && !Object.hasOwn(value, 'secondary')) ||
      (Object.hasOwn(value, 'primary') &&
        (typeof value.primary !== 'string' || !/^[a-z][a-z-]{0,79}$/u.test(value.primary))) ||
      (Object.hasOwn(value, 'secondary') &&
        value.secondary !== null &&
        (typeof value.secondary !== 'string' || !/^[a-z][a-z-]{0,79}$/u.test(value.secondary)))
    )
      invalid()
  } else if (value.kind === 'skills') {
    if (
      !Array.isArray(value.skills) ||
      value.skills.length > 4 ||
      value.skills.some(
        (skill) =>
          !playerRecord(skill) ||
          Object.keys(skill).some(
            (key) => !['skillId', 'contentVersion', 'sourceDisciplineId'].includes(key),
          ) ||
          typeof skill.skillId !== 'string' ||
          typeof skill.sourceDisciplineId !== 'string' ||
          !whole(skill.contentVersion) ||
          skill.contentVersion < 1,
      )
    )
      invalid()
  } else if (!parseSupportActionId(value.supportActionId)) invalid()
  return value as unknown as PlayerCorrection
}
function projectPlayer(raw: unknown): MasterPlayerView {
  if (
    !playerRecord(raw) ||
    !playerRecord(raw.facts) ||
    !playerRecord(raw.facts.attributes) ||
    !whole(raw.facts.level) ||
    !playerRecord(raw.facts.build) ||
    typeof raw.characterId !== 'string' ||
    typeof raw.fingerprint !== 'string'
  )
    unavailable()
  const facts = raw.facts as unknown as MasterPlayerFacts
  const stats = calculateDerivedStats({ level: facts.level, attributes: facts.attributes }).stats
  let battle: MasterPlayerView['battle'] = null
  if (playerRecord(raw.battle)) {
    const source = raw.battle
    if (
      !playerRecord(source.snapshot) ||
      !playerRecord(source.snapshot.tactical) ||
      !playerRecord(source.snapshot.tactical.battle) ||
      !Array.isArray(source.snapshot.tactical.battle.combatants) ||
      !Array.isArray(source.participants)
    )
      unavailable()
    const states = Array.isArray(source.snapshot.statusState) ? source.snapshot.statusState : []
    battle = {
      battleSessionId: String(source.battleSessionId),
      version: Number(source.version),
      lifecycle: String(source.lifecycle),
      participants: source.participants as { characterId: string; name: string }[],
      combatants: source.snapshot.tactical.battle.combatants.map(
        (unit: Record<string, unknown>) => {
          const resource = Array.isArray(unit.temporaryResources)
            ? unit.temporaryResources.find(
                (entry: unknown) => playerRecord(entry) && entry.key === 'pv1f.action-economy',
              )
            : null
          const statusRow = states.find(
            (row: unknown) => playerRecord(row) && row.combatantId === unit.id,
          )
          return {
            id: String(unit.id),
            hp: Number(unit.hp),
            mp: Number(unit.mp),
            ap: playerRecord(resource) && whole(resource.current) ? resource.current : null,
            statuses:
              playerRecord(statusRow) && Array.isArray(statusRow.statuses)
                ? statusRow.statuses.filter(playerRecord).map((row) => String(row.statusId))
                : [],
          }
        },
      ),
      recentActions: Array.isArray(source.recentActions)
        ? source.recentActions.filter(playerRecord).map((event) => String(event.event))
        : [],
    }
  }
  // Select fields explicitly. Raw battle state, source hashes, actor/account IDs,
  // private journals and automatic audit facts never cross the public boundary.
  return projectPublicCombat({
    characterId: raw.characterId,
    name: String(raw.name),
    portraitRef: String(raw.portraitRef),
    verifiedEmail: typeof raw.verifiedEmail === 'string' ? raw.verifiedEmail : null,
    fingerprint: raw.fingerprint,
    deletionPending: raw.deletionPending === true,
    facts: {
      level: facts.level,
      xp: facts.xp,
      cycle: facts.cycle,
      attributes: facts.attributes,
      build: facts.build,
    },
    calculated: {
      maxHp: stats.maxHp.value,
      maxMp: stats.maxMp.value,
      personalPointPool: 5 + facts.level - 1,
    },
    disciplines: Array.isArray(raw.disciplines)
      ? (raw.disciplines as MasterPlayerView['disciplines'])
      : [],
    learnedSkills: Array.isArray(raw.learnedSkills)
      ? (raw.learnedSkills as MasterPlayerView['learnedSkills'])
      : [],
    savedLoadouts: Array.isArray(raw.savedLoadouts)
      ? (raw.savedLoadouts as MasterPlayerView['savedLoadouts'])
      : [],
    world: playerRecord(raw.world)
      ? { position: raw.world.position as NonNullable<MasterPlayerView['world']>['position'] }
      : null,
    training: playerRecord(raw.training)
      ? (raw.training as unknown as MasterPlayerView['training'])
      : null,
    battle,
  }) as MasterPlayerView
}
export function createMasterPlayersService(
  access: Pick<MasterPanelStaffAccessService, 'requireCapability'>,
  rpc: PlayersRpc,
) {
  const call = async (userId: string, name: string, parameters: Record<string, unknown>) => {
    await access.requireCapability(userId, 'staff.manage')
    return rpc(name, { p_actor_user_id: userId, ...parameters })
  }
  const readRaw = (userId: string, characterId: string) =>
    call(userId, 'read_master_player_v1', { p_character_id: characterId })
  return {
    async search(userId: string, query: string): Promise<MasterPlayerSearchResult[]> {
      if (query.trim().length < 2 || query.trim().length > 48) invalid()
      const result = await call(userId, 'search_master_players_v1', { p_query: query.trim() })
      if (!Array.isArray(result) || result.length > 20) unavailable()
      return result as MasterPlayerSearchResult[]
    },
    async read(userId: string, characterId: string) {
      return projectPlayer(await readRaw(userId, characterId))
    },
    async edit(
      userId: string,
      characterId: string,
      fingerprint: string,
      requestKey: string,
      command: unknown,
    ) {
      const correction = parsePlayerCorrection(command)
      await call(userId, 'edit_master_player_v1', {
        p_character_id: characterId,
        p_expected_fingerprint: fingerprint,
        p_request_key: requestKey,
        p_command: correction,
        p_confirmed: true,
      })
      return projectPlayer(await readRaw(userId, characterId))
    },
    async recover(
      userId: string,
      input: {
        characterId: string
        battleSessionId: string
        expectedVersion: number
        participantIds: string[]
        requestKey: string
      },
    ): Promise<PlayerRecoveryResult> {
      const raw = await readRaw(userId, input.characterId)
      if (
        !playerRecord(raw) ||
        (playerRecord(raw.battle) &&
          (raw.battle.battleSessionId !== input.battleSessionId ||
            raw.battle.version !== input.expectedVersion))
      )
        throw new AurevaneError(
          'STALE_VERSION',
          'The encounter changed. Refresh and review every participant again.',
        )
      const terminal = playerRecord(raw.battle)
        ? resolveMasterBattleRecovery(raw.battle.snapshot)
        : null
      return (await call(userId, 'recover_master_player_battle_v1', {
        p_character_id: input.characterId,
        p_battle_session_id: input.battleSessionId,
        p_expected_version: input.expectedVersion,
        p_participant_ids: input.participantIds,
        p_request_key: input.requestKey,
        p_terminal_snapshot: terminal,
        p_confirmed: true,
      })) as PlayerRecoveryResult
    },
  }
}
export type MasterPlayersService = ReturnType<typeof createMasterPlayersService>
