'use client'

import type { TacticalHallArenaId } from '@aurevane/game-core/combat/tactical-hall-arenas'
import {
  getTacticalHallRecord,
  type TacticalHallRecordId,
} from '@aurevane/game-core/combat/tactical-hall-records'
import type {
  PvpMapBias,
  PvpMapSize,
  PvpMode,
  PvpTurnTimerSeconds,
} from '@aurevane/validation/combat/pvp'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { PvpLobbyView } from '@/server/battle/pvp-lobby-service'

import styles from './battle-launch.module.css'
import { PvpLobbyModal } from './pvp-lobby-modal'

interface BattleLaunchProps {
  characterId: string
  characterName: string
  initialJoinKey?: string | null
}

type AiDifficulty = 'easy' | 'standard' | 'high'
type HallSection = 'ai' | 'pvp' | 'spectate'

interface ApiErrorBody {
  error?: { message?: string }
}

const VISIBLE_RECORD_IDS: readonly TacticalHallRecordId[] = [
  'recruit-sparring',
  'guided-fundamentals',
]

const ARENAS: readonly { id: TacticalHallArenaId; name: string; scale: string; summary: string }[] =
  [
    {
      id: 'basic-training-floor',
      name: 'Basic Training Floor',
      scale: '5×3',
      summary: 'Compact teaching floor for the guided fundamentals exercise.',
    },
    {
      id: 'duel-yard',
      name: 'Duel Yard',
      scale: '9×7',
      summary: 'Full duel arena with difficult ground, elevation, and flanking room.',
    },
  ]

const DIFFICULTIES: readonly { id: AiDifficulty; label: string; description: string }[] = [
  { id: 'easy', label: 'Easy', description: 'Forgiving AI decisions.' },
  { id: 'standard', label: 'Standard', description: 'Balanced AI opponent.' },
  { id: 'high', label: 'High', description: 'Sharper positioning and action choices.' },
]

const DEFAULT_PVP_MODE: PvpMode = '1v1'
const PVP_LOBBY_SESSION_STORAGE_KEY = 'aurevane:pvp-lobby-id'
const PVP_MODES: readonly { id: PvpMode; label: string; detail: string }[] = [
  { id: '1v1', label: '1v1 Duel', detail: 'Two combatants · one per side' },
  { id: '2v2', label: '2v2 Clash', detail: 'Four combatants · two per side' },
  { id: '3v3', label: '3v3 Skirmish', detail: 'Six combatants · three per side' },
  { id: '1v1v1', label: 'Three-Way', detail: 'Three lone combatants · three factions' },
  { id: 'flex-teams', label: 'Flexible Teams', detail: 'Choose 1–3 combatants on each side' },
]

function recordDisplayName(recordId: TacticalHallRecordId, fallback: string): string {
  return recordId === 'recruit-sparring' ? 'AI Sparring' : fallback
}

function formatPvpLobbyKeyInput(value: string): string {
  const compact = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 11)
  if (compact.length <= 3) return compact
  if (compact.length <= 7) return `${compact.slice(0, 3)}-${compact.slice(3)}`
  return `${compact.slice(0, 3)}-${compact.slice(3, 7)}-${compact.slice(7)}`
}

function isCompletePvpLobbyKey(value: string): boolean {
  return /^AVL-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(value)
}

export function BattleLaunch({
  characterId,
  characterName,
  initialJoinKey = null,
}: BattleLaunchProps) {
  const router = useRouter()
  const launchLock = useRef(false)
  const joinAttempted = useRef(false)
  const restoreAttempted = useRef(false)
  const [section, setSection] = useState<HallSection>('ai')
  const [recordId, setRecordId] = useState<TacticalHallRecordId | null>(null)
  const [arenaId, setArenaId] = useState<TacticalHallArenaId>('duel-yard')
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>('standard')
  const [pvpMode, setPvpMode] = useState<PvpMode | null>(DEFAULT_PVP_MODE)
  const [teamASize, setTeamASize] = useState(1)
  const [teamBSize, setTeamBSize] = useState(1)
  const [mapSize, setMapSize] = useState<PvpMapSize>('medium')
  const [elevationBias, setElevationBias] = useState<PvpMapBias>('neutral')
  const [terrainBias, setTerrainBias] = useState<PvpMapBias>('neutral')
  const [turnTimerSeconds, setTurnTimerSeconds] = useState<PvpTurnTimerSeconds>(60)
  const [joinKey, setJoinKey] = useState(() => formatPvpLobbyKeyInput(initialJoinKey ?? ''))
  const [battleKey, setBattleKey] = useState('')
  const [pvpLobby, setPvpLobby] = useState<PvpLobbyView | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedRecord = recordId ? getTacticalHallRecord(recordId) : null
  const selectedArena = ARENAS.find((arena) => arena.id === arenaId) ?? ARENAS[1]

  function chooseSection(next: HallSection) {
    setSection(next)
    setError(null)
    if (next !== 'ai') setRecordId(null)
  }

  function chooseRecord(nextRecordId: TacticalHallRecordId) {
    const nextRecord = getTacticalHallRecord(nextRecordId)
    setRecordId(nextRecordId)
    setArenaId(nextRecord.defaultArenaId)
    setError(null)
  }

  function openPvpLobby(lobby: PvpLobbyView) {
    sessionStorage.setItem(PVP_LOBBY_SESSION_STORAGE_KEY, lobby.lobbyId)
    setSection('pvp')
    setPvpLobby(lobby)
  }

  function dismissPvpLobby() {
    sessionStorage.removeItem(PVP_LOBBY_SESSION_STORAGE_KEY)
    setPvpLobby(null)
  }

  async function launchAiBattle() {
    if (!selectedRecord || launchLock.current || pending) return
    launchLock.current = true
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/battles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId,
          arenaId,
          aiDifficulty: selectedRecord.combinedDuel ? aiDifficulty : 'easy',
          battleHallRecordId: selectedRecord.id,
          idempotencyKey: crypto.randomUUID(),
        }),
      })
      const body = (await response.json()) as {
        battle?: { battleSessionId?: string }
      } & ApiErrorBody
      if (!response.ok || !body.battle?.battleSessionId) {
        throw new Error(body.error?.message ?? 'The battle could not be started.')
      }
      sessionStorage.setItem(
        `aurevane:tactical-record:${body.battle.battleSessionId}`,
        selectedRecord.id,
      )
      router.push(`/game/battle/${body.battle.battleSessionId}`)
    } catch (launchError) {
      setError(
        launchError instanceof Error ? launchError.message : 'The battle could not be started.',
      )
      setPending(false)
      launchLock.current = false
    }
  }

  async function createLobby() {
    if (!pvpMode || pending) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/pvp/lobbies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId,
          mode: pvpMode,
          mapSize,
          elevationBias,
          terrainBias,
          turnTimerSeconds,
          ...(pvpMode === 'flex-teams' ? { teamASize, teamBSize } : {}),
        }),
      })
      const body = (await response.json()) as { lobby?: PvpLobbyView } & ApiErrorBody
      if (!response.ok || !body.lobby) {
        throw new Error(body.error?.message ?? 'The PvP lobby could not be created.')
      }
      openPvpLobby(body.lobby)
    } catch (lobbyError) {
      setError(
        lobbyError instanceof Error ? lobbyError.message : 'The PvP lobby could not be created.',
      )
    } finally {
      setPending(false)
    }
  }

  const joinLobby = useCallback(
    async (key: string) => {
      if (pending) return
      const normalized = formatPvpLobbyKeyInput(key)
      setJoinKey(normalized)
      if (!isCompletePvpLobbyKey(normalized)) {
        setError('Enter the full Lobby Key. Capitalization and dashes are formatted for you.')
        return
      }
      setPending(true)
      setError(null)
      setSection('pvp')
      try {
        const response = await fetch('/api/pvp/lobbies/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characterId, lobbyKey: normalized }),
        })
        const body = (await response.json()) as { lobby?: PvpLobbyView } & ApiErrorBody
        if (!response.ok || !body.lobby) {
          throw new Error(body.error?.message ?? 'That lobby could not be joined.')
        }
        setJoinKey(normalized)
        sessionStorage.setItem(PVP_LOBBY_SESSION_STORAGE_KEY, body.lobby.lobbyId)
        setPvpLobby(body.lobby)
      } catch (joinError) {
        setError(joinError instanceof Error ? joinError.message : 'That lobby could not be joined.')
      } finally {
        setPending(false)
      }
    },
    [characterId, pending],
  )

  useEffect(() => {
    if (initialJoinKey || restoreAttempted.current) return
    restoreAttempted.current = true
    const lobbyId = sessionStorage.getItem(PVP_LOBBY_SESSION_STORAGE_KEY)
    if (!lobbyId) return

    let cancelled = false
    async function restoreLobby() {
      try {
        const response = await fetch(`/api/pvp/lobbies/${encodeURIComponent(lobbyId)}`, {
          cache: 'no-store',
        })
        const body = (await response.json()) as { lobby?: PvpLobbyView } & ApiErrorBody
        if (cancelled) return
        if (!response.ok || !body.lobby) {
          if (response.status >= 400 && response.status < 500) {
            sessionStorage.removeItem(PVP_LOBBY_SESSION_STORAGE_KEY)
          }
          return
        }
        if (body.lobby.status !== 'waiting') {
          sessionStorage.removeItem(PVP_LOBBY_SESSION_STORAGE_KEY)
          return
        }
        setSection('pvp')
        setPvpLobby(body.lobby)
      } catch {
        // Keep the stored lobby id so a transient connection problem does not discard the lobby.
      }
    }

    void restoreLobby()
    return () => {
      cancelled = true
    }
  }, [initialJoinKey])

  useEffect(() => {
    if (!initialJoinKey || joinAttempted.current) return
    joinAttempted.current = true
    void joinLobby(initialJoinKey)
  }, [initialJoinKey, joinLobby])

  async function spectateBattle() {
    if (pending) return
    const normalized = battleKey.trim().toUpperCase()
    if (!normalized) {
      setError('Enter a Battle Key to open a spectator view.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/pvp/spectate/${encodeURIComponent(normalized)}`, {
        method: 'POST',
        cache: 'no-store',
      })
      const body = (await response.json()) as ApiErrorBody & { spectator?: unknown }
      if (!response.ok || !body.spectator) {
        throw new Error(body.error?.message ?? 'No spectatable battle uses that key.')
      }
      router.push(`/game/battle/spectate/${encodeURIComponent(normalized)}`)
    } catch (spectateError) {
      setError(
        spectateError instanceof Error ? spectateError.message : 'That battle could not be opened.',
      )
      setPending(false)
    }
  }

  return (
    <section className={styles.page} id="battle-launch" aria-labelledby="battle-launch-title">
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Battle Hall</p>
          <h1 id="battle-launch-title">Choose your arena.</h1>
        </div>
        <p>Train against the system, challenge other players, or watch a shared battle by key.</p>
      </header>

      <nav className={styles.categoryGrid} aria-label="Battle Hall sections">
        <button
          type="button"
          data-active={section === 'ai' || undefined}
          data-tone="ai"
          onClick={() => chooseSection('ai')}
        >
          <span>01</span>
          <div>
            <strong>AI Battles</strong>
            <small>Practice, learn, and test builds</small>
          </div>
          <i>›</i>
        </button>
        <button
          type="button"
          data-active={section === 'pvp' || undefined}
          data-tone="pvp"
          onClick={() => chooseSection('pvp')}
        >
          <span>02</span>
          <div>
            <strong>Player vs Player</strong>
            <small>Create or join a private battle lobby</small>
          </div>
          <i>›</i>
        </button>
        <button
          type="button"
          data-active={section === 'spectate' || undefined}
          data-tone="spectate"
          onClick={() => chooseSection('spectate')}
        >
          <span>03</span>
          <div>
            <strong>Spectate</strong>
            <small>Watch a battle using its Battle Key</small>
          </div>
          <i>›</i>
        </button>
      </nav>

      {section === 'ai' ? (
        <section className={styles.workspace} data-tone="ai" aria-labelledby="ai-battles-heading">
          <div className={styles.workspaceHeading}>
            <div>
              <span>AI Battles</span>
              <h2 id="ai-battles-heading">Train on your terms.</h2>
            </div>
            <p>
              Choose a mode first. Detailed setup appears only for the battle you intend to enter.
            </p>
          </div>
          <div className={styles.modePicker}>
            <label htmlFor="ai-mode">Battle mode</label>
            <select
              id="ai-mode"
              value={recordId ?? ''}
              onChange={(event) => {
                const value = event.target.value as TacticalHallRecordId | ''
                if (value) chooseRecord(value)
                else setRecordId(null)
              }}
              disabled={pending}
            >
              <option value="">Choose an AI battle…</option>
              {VISIBLE_RECORD_IDS.map((id) => {
                const record = getTacticalHallRecord(id)
                return (
                  <option value={id} key={id}>
                    {recordDisplayName(id, record.name)}
                  </option>
                )
              })}
            </select>
          </div>

          {selectedRecord ? (
            <div className={styles.selectedPanel}>
              <div className={styles.selectedCopy}>
                <span>Selected Battle</span>
                <h3>{recordDisplayName(selectedRecord.id, selectedRecord.name)}</h3>
                <p>{selectedRecord.purpose}</p>
                <div className={styles.arenaLine}>
                  <strong>{selectedArena.name}</strong>
                  <span>
                    {selectedArena.scale} · {selectedArena.summary}
                  </span>
                </div>
              </div>
              {selectedRecord.combinedDuel ? (
                <fieldset className={styles.difficulty}>
                  <legend>AI difficulty</legend>
                  <div className={styles.difficultyToggle}>
                    {DIFFICULTIES.map((difficulty) => (
                      <button
                        key={difficulty.id}
                        type="button"
                        aria-pressed={aiDifficulty === difficulty.id}
                        data-selected={aiDifficulty === difficulty.id || undefined}
                        onClick={() => setAiDifficulty(difficulty.id)}
                        disabled={pending}
                      >
                        {difficulty.label}
                      </button>
                    ))}
                  </div>
                  <small>
                    {DIFFICULTIES.find((difficulty) => difficulty.id === aiDifficulty)?.description}
                  </small>
                </fieldset>
              ) : (
                <div className={styles.trainingNote}>
                  <strong>Guided exercise</strong>
                  <span>Victory is earned by completing the tactical lesson criteria.</span>
                </div>
              )}
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => void launchAiBattle()}
                disabled={pending}
              >
                {pending ? 'Entering…' : 'Enter Battle'}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {section === 'pvp' ? (
        <section className={styles.workspace} data-tone="pvp" aria-labelledby="pvp-heading">
          <div className={styles.workspaceHeading}>
            <div>
              <span>Player vs Player</span>
              <h2 id="pvp-heading">Call challengers to the arena.</h2>
            </div>
            <p>
              Lobby Keys gather the combatants. Every filled seat must mark ready before the battle
              opens.
            </p>
          </div>
          <div className={styles.pvpGrid}>
            <article className={styles.setupCard} data-pvp-create-card>
              <div className={styles.cardTitle}>
                <span>Create</span>
                <strong>Open a Battle Lobby</strong>
              </div>
              <label htmlFor="pvp-mode">Battle format</label>
              <select
                id="pvp-mode"
                value={pvpMode ?? ''}
                onChange={(event) => setPvpMode((event.target.value || null) as PvpMode | null)}
                disabled={pending}
              >
                <option value="">Choose a PvP format…</option>
                {PVP_MODES.map((mode) => (
                  <option value={mode.id} key={mode.id}>
                    {mode.label} — {mode.detail}
                  </option>
                ))}
              </select>
              {pvpMode === 'flex-teams' ? (
                <div className={styles.flexSizes}>
                  <label>
                    Team 1
                    <select
                      value={teamASize}
                      onChange={(event) => setTeamASize(Number(event.target.value))}
                    >
                      {[1, 2, 3].map((size) => (
                        <option key={size} value={size}>
                          {size} player{size > 1 ? 's' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span>VS</span>
                  <label>
                    Team 2
                    <select
                      value={teamBSize}
                      onChange={(event) => setTeamBSize(Number(event.target.value))}
                    >
                      {[1, 2, 3].map((size) => (
                        <option key={size} value={size}>
                          {size} player{size > 1 ? 's' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : null}
              <div data-pvp-settings-panel aria-label="PvP battle settings">
                <div data-pvp-settings-heading>
                  <strong>Battlefield conditions</strong>
                  <small>Choose once. These settings lock when the lobby opens.</small>
                </div>
                <fieldset data-pvp-setting-group>
                  <legend>Map size</legend>
                  <div data-pvp-setting-options>
                    {(['medium', 'large'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={mapSize === value}
                        data-selected={mapSize === value || undefined}
                        onClick={() => setMapSize(value)}
                        disabled={pending}
                      >
                        {value === 'medium' ? 'Standard' : 'Expanded'}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset data-pvp-setting-group>
                  <legend>Elevation</legend>
                  <div data-pvp-setting-options>
                    {(['less', 'neutral', 'more'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={elevationBias === value}
                        data-selected={elevationBias === value || undefined}
                        onClick={() => setElevationBias(value)}
                        disabled={pending}
                      >
                        {value === 'less' ? 'Less' : value === 'more' ? 'More' : 'Neutral'}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset data-pvp-setting-group>
                  <legend>Difficult ground</legend>
                  <div data-pvp-setting-options>
                    {(['less', 'neutral', 'more'] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={terrainBias === value}
                        data-selected={terrainBias === value || undefined}
                        onClick={() => setTerrainBias(value)}
                        disabled={pending}
                      >
                        {value === 'less' ? 'Less' : value === 'more' ? 'More' : 'Neutral'}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset data-pvp-setting-group>
                  <legend>Turn timer</legend>
                  <div data-pvp-setting-options>
                    {[
                      { value: 60 as const, label: '60s' },
                      { value: 120 as const, label: '120s' },
                      { value: null, label: 'None' },
                    ].map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        aria-pressed={turnTimerSeconds === option.value}
                        data-selected={turnTimerSeconds === option.value || undefined}
                        onClick={() => setTurnTimerSeconds(option.value)}
                        disabled={pending}
                        aria-label={
                          option.value === null
                            ? 'No turn timer'
                            : `${option.value} second turn timer`
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
              {pvpMode ? (
                <p className={styles.modeSummary}>
                  {PVP_MODES.find((mode) => mode.id === pvpMode)?.detail}. {characterName} takes the
                  first seat. The battlefield and turn timer are locked for the match.
                </p>
              ) : null}
              <button
                type="button"
                className={styles.primaryAction}
                disabled={!pvpMode || pending}
                onClick={() => void createLobby()}
              >
                {pending ? 'Preparing…' : 'Create Battle Lobby'}
              </button>
            </article>

            <div className={styles.orDivider}>
              <span>OR</span>
            </div>

            <article className={styles.setupCard}>
              <div className={styles.cardTitle}>
                <span>Join</span>
                <strong>Enter a Lobby Key</strong>
              </div>
              <label htmlFor="lobby-key">Lobby Key</label>
              <input
                id="lobby-key"
                value={joinKey}
                onChange={(event) => setJoinKey(formatPvpLobbyKeyInput(event.target.value))}
                placeholder="AVL-0000-0000"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={13}
              />
              <p>
                Type the full Lobby Key normally. Letters are capitalized and dashes are inserted
                automatically. Pasting a complete Lobby Key also works.
              </p>
              <button
                type="button"
                className={styles.secondaryAction}
                disabled={pending || !isCompletePvpLobbyKey(joinKey)}
                onClick={() => void joinLobby(joinKey)}
              >
                {pending ? 'Joining…' : 'Join Battle Lobby'}
              </button>
            </article>
          </div>
        </section>
      ) : null}

      {section === 'spectate' ? (
        <section
          className={styles.workspace}
          data-tone="spectate"
          aria-labelledby="spectate-heading"
        >
          <div className={styles.workspaceHeading}>
            <div>
              <span>Spectate</span>
              <h2 id="spectate-heading">Witness a battle by key.</h2>
            </div>
            <p>
              PvP battles are not listed publicly. A player must share the battle&apos;s spectator
              key with you.
            </p>
          </div>
          <div className={styles.spectateCard}>
            <div>
              <span>Read-only arena access</span>
              <strong>Enter a Battle Key</strong>
              <p>
                You can watch the live board and combat state, but spectator routes never accept
                battle commands.
              </p>
            </div>
            <div className={styles.keyEntry}>
              <input
                value={battleKey}
                onChange={(event) => setBattleKey(event.target.value.toUpperCase())}
                placeholder="AVB-0000-0000"
                aria-label="Battle Key"
                autoComplete="off"
              />
              <button
                type="button"
                className={styles.primaryAction}
                disabled={pending || !battleKey.trim()}
                onClick={() => void spectateBattle()}
              >
                {pending ? 'Opening…' : 'Spectate Battle'}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {pvpLobby ? (
        <PvpLobbyModal
          initialLobby={pvpLobby}
          localCharacterId={characterId}
          onLeave={dismissPvpLobby}
        />
      ) : null}
    </section>
  )
}
