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

import { AurevaneImage } from '@/components/media/aurevane-image'

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
  'mastery-trial',
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
    {
      id: 'crossroads-court',
      name: 'Crossroads Court',
      scale: '7×7',
      summary: 'Close engagement: cross the difficult center or take an open flank.',
    },
    {
      id: 'terraced-yard',
      name: 'Terraced Yard',
      scale: '11×7',
      summary: 'Long approach with raised side platforms and a ground-level route.',
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

export function BattleLaunch({ characterId, initialJoinKey = null }: BattleLaunchProps) {
  const router = useRouter()
  const launchLock = useRef(false)
  const joinAttempted = useRef(false)
  const restoreAttempted = useRef(false)
  const [section, setSection] = useState<HallSection>('ai')
  const [pvpEntry, setPvpEntry] = useState<'create' | 'join'>(initialJoinKey ? 'join' : 'create')
  const [recordId, setRecordId] = useState<TacticalHallRecordId | null>('recruit-sparring')
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
  }

  function chooseRecord(nextRecordId: TacticalHallRecordId) {
    const nextRecord = getTacticalHallRecord(nextRecordId)
    setSection('ai')
    setRecordId(nextRecordId)
    setArenaId(nextRecord.defaultArenaId)
    if (nextRecordId === 'mastery-trial' && aiDifficulty === 'easy') setAiDifficulty('standard')
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
          aiDifficulty:
            selectedRecord.id === 'mastery-trial' && aiDifficulty === 'easy'
              ? 'standard'
              : selectedRecord.combinedDuel
                ? aiDifficulty
                : 'easy',
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
    setSection('pvp')
    setPvpEntry('create')
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
      setPvpEntry('join')
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
    if (restoreAttempted.current) return
    restoreAttempted.current = true

    function joinFromInitialKey() {
      if (!initialJoinKey || joinAttempted.current) return
      joinAttempted.current = true
      void joinLobby(initialJoinKey)
    }

    const lobbyId = sessionStorage.getItem(PVP_LOBBY_SESSION_STORAGE_KEY)
    if (!lobbyId) {
      joinFromInitialKey()
      return
    }

    let cancelled = false
    async function restoreLobby(restoredLobbyId: string) {
      try {
        const response = await fetch(`/api/pvp/lobbies/${encodeURIComponent(restoredLobbyId)}`, {
          cache: 'no-store',
        })
        const body = (await response.json()) as { lobby?: PvpLobbyView } & ApiErrorBody
        if (cancelled) return
        if (!response.ok || !body.lobby) {
          if (response.status >= 400 && response.status < 500) {
            sessionStorage.removeItem(PVP_LOBBY_SESSION_STORAGE_KEY)
            joinFromInitialKey()
          }
          return
        }
        if (body.lobby.status !== 'waiting') {
          sessionStorage.removeItem(PVP_LOBBY_SESSION_STORAGE_KEY)
          joinFromInitialKey()
          return
        }
        setSection('pvp')
        setPvpLobby(body.lobby)
      } catch {
        // Keep the stored lobby id so a transient connection problem does not discard the lobby.
      }
    }

    void restoreLobby(lobbyId)
    return () => {
      cancelled = true
    }
  }, [initialJoinKey, joinLobby])

  async function spectateBattle() {
    if (pending) return
    setSection('spectate')
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
    <section
      data-hall-concept="true"
      className={styles.page}
      id="battle-launch"
      aria-labelledby="battle-launch-title"
      data-av-surface="moonstone"
    >
      <header className={styles.heading} data-hall-scene="true">
        <AurevaneImage
          assetId="environment.battle-hall.courtyard"
          className={styles.heroMedia}
          sizes="(max-width: 760px) 100vw, 72vw"
        />
        <span className={styles.heroWash} aria-hidden="true" />
        <div className={styles.headingCopy}>
          <span className={styles.pageIcon} aria-hidden="true">
            ⚔
          </span>
          <div>
            <p className={styles.eyebrow}>Test your skill. Find your next challenge.</p>
            <h1 id="battle-launch-title">Battle Hall</h1>
            <small>Practice, compete, and witness the art of battle.</small>
          </div>
        </div>
        <blockquote>
          “Discipline in combat
          <br />
          reveals the truest self.”
          <cite>— An Aurevane Proverb</cite>
        </blockquote>
      </header>

      <nav
        className={styles.categoryGrid}
        data-hall-mode-rail="true"
        aria-label="Battle Hall sections"
      >
        <button
          type="button"
          data-active={section === 'ai' || undefined}
          data-tone="ai"
          aria-pressed={section === 'ai'}
          onClick={() => chooseSection('ai')}
        >
          <span aria-hidden="true">⚔</span>
          <strong>AI Battles</strong>
        </button>
        <button
          type="button"
          data-active={section === 'pvp' || undefined}
          data-tone="pvp"
          aria-pressed={section === 'pvp'}
          onClick={() => chooseSection('pvp')}
        >
          <span aria-hidden="true">♟</span>
          <strong>Player vs Player</strong>
        </button>
        <button
          type="button"
          data-active={section === 'spectate' || undefined}
          data-tone="spectate"
          aria-pressed={section === 'spectate'}
          onClick={() => chooseSection('spectate')}
        >
          <span aria-hidden="true">◉</span>
          <strong>Spectate</strong>
        </button>
      </nav>

      <div className={styles.workspaceGrid}>
        <section
          className={styles.workspace}
          data-tone="ai"
          data-hall-workspace="ai"
          data-has-selection={selectedRecord !== null || undefined}
          data-selected={section === 'ai' || undefined}
          data-hall-active-workspace="true"
          aria-labelledby="ai-battles-heading"
          hidden={section !== 'ai'}
        >
          <div className={styles.workspaceHeading}>
            <div>
              <h2 id="ai-battles-heading">Choose your arena.</h2>
            </div>
            <blockquote>
              A safer tomorrow
              <br />
              is built through practice.
            </blockquote>
          </div>

          <div className={styles.workspaceBody} data-hall-scroll-body="true">
            <figure className={styles.arenaVista}>
              <AurevaneImage
                assetId="environment.battle-hall.courtyard"
                sizes="(max-width: 900px) 100vw, 64vw"
              />
              <figcaption>
                <div>
                  <strong>{selectedArena.name}</strong>
                  <span>{selectedArena.scale}</span>
                </div>
                <em>A classic proving ground for focused combat.</em>
              </figcaption>
            </figure>

            <div className={styles.arenaControlRow}>
              <label>
                <span>Arena</span>
                <select
                  aria-label="AI sparring arena"
                  value={arenaId}
                  onChange={(event) => setArenaId(event.target.value as TacticalHallArenaId)}
                  disabled={pending || recordId === 'guided-fundamentals'}
                >
                  {(recordId === 'guided-fundamentals'
                    ? ARENAS.filter((arena) => arena.id === 'basic-training-floor')
                    : ARENAS.filter((arena) => arena.id !== 'basic-training-floor')
                  ).map((arena) => (
                    <option key={arena.id} value={arena.id}>
                      {arena.name} · {arena.scale}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <nav className={styles.modePicker} aria-label="AI arenas">
              <label className={styles.visuallyHiddenSelect}>
                <span>Battle mode</span>
                <select
                  id="ai-mode"
                  aria-label="Battle mode"
                  aria-describedby={selectedRecord ? 'ai-record-purpose' : undefined}
                  value={recordId ?? ''}
                  onChange={(event) => {
                    const next = event.target.value as TacticalHallRecordId | ''
                    if (next) chooseRecord(next)
                  }}
                  disabled={pending}
                >
                  <option value="">Choose a battle mode…</option>
                  {VISIBLE_RECORD_IDS.map((id) => {
                    const record = getTacticalHallRecord(id)
                    return (
                      <option key={id} value={id}>
                        {recordDisplayName(id, record.name)}
                      </option>
                    )
                  })}
                </select>
              </label>

              {VISIBLE_RECORD_IDS.map((id) => {
                const record = getTacticalHallRecord(id)
                const recommendation =
                  id === 'recruit-sparring'
                    ? ['Recommended for', 'all players']
                    : id === 'guided-fundamentals'
                      ? ['Ideal for', 'new players']
                      : ['For experienced', 'players']
                return (
                  <button
                    type="button"
                    key={id}
                    aria-pressed={recordId === id}
                    data-selected={recordId === id || undefined}
                    onClick={() => chooseRecord(id)}
                    disabled={pending}
                  >
                    <span className={styles.modeIcon} aria-hidden="true">
                      {id === 'recruit-sparring' ? '⚔' : id === 'guided-fundamentals' ? '▣' : '★'}
                    </span>
                    <span className={styles.modeCopy}>
                      <strong>{recordDisplayName(id, record.name)}</strong>
                      <small>{record.purpose}</small>
                    </span>
                    <span className={styles.modeArrow} aria-hidden="true">
                      ›
                    </span>
                    <span className={styles.modeRecommendation}>
                      <small>{recommendation[0]}</small>
                      <b>{recommendation[1]}</b>
                    </span>
                  </button>
                )
              })}
            </nav>

            {selectedRecord ? (
              <div className={styles.selectedPanel}>
                {selectedRecord.combinedDuel ? (
                  <fieldset className={styles.difficulty}>
                    <legend>AI difficulty</legend>
                    <div className={styles.difficultyToggle}>
                      {DIFFICULTIES.filter(
                        (difficulty) => recordId !== 'mastery-trial' || difficulty.id !== 'easy',
                      ).map((difficulty) => (
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
                      {
                        DIFFICULTIES.find((difficulty) => difficulty.id === aiDifficulty)
                          ?.description
                      }
                    </small>
                  </fieldset>
                ) : (
                  <div className={styles.trainingNote}>
                    <strong>Guided exercise</strong>
                    <span>Victory is earned by completing the tactical lesson criteria.</span>
                  </div>
                )}
                <p className={styles.recordPurpose} id="ai-record-purpose">
                  {selectedRecord.purpose}
                </p>
              </div>
            ) : null}
          </div>

          {selectedRecord ? (
            <footer className={styles.panelActions} data-hall-action-row="true">
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => void launchAiBattle()}
                disabled={pending}
              >
                {pending ? 'Entering…' : 'Enter Battle'}
              </button>
            </footer>
          ) : null}
        </section>

        <section
          className={styles.workspace}
          data-tone="pvp"
          data-hall-workspace="pvp"
          data-selected={section === 'pvp' || undefined}
          data-hall-active-workspace="true"
          aria-labelledby="pvp-heading"
          hidden={section !== 'pvp'}
        >
          <div className={styles.pvpStage}>
            <aside className={styles.pvpVista} aria-hidden="true">
              <AurevaneImage
                assetId="environment.battle-hall.courtyard"
                sizes="(max-width: 900px) 100vw, 18vw"
              />
              <blockquote>
                Strategy reveals character.
                <br />
                Combat reveals truth.
              </blockquote>
            </aside>

            <div className={styles.pvpContent}>
              <div className={styles.workspaceHeading}>
                <div>
                  <h2 id="pvp-heading">Player vs Player</h2>
                  <p>Create a private battle or join with a key to fight another player.</p>
                </div>
                <blockquote>“Greater minds make a greater tomorrow.”</blockquote>
              </div>

              <nav className={styles.entryModes} aria-label="PvP lobby actions">
                <button
                  type="button"
                  aria-pressed={pvpEntry === 'create'}
                  disabled={pending}
                  onClick={() => setPvpEntry('create')}
                >
                  Create Lobby
                </button>
                <button
                  type="button"
                  aria-pressed={pvpEntry === 'join'}
                  disabled={pending}
                  onClick={() => setPvpEntry('join')}
                >
                  Join by Key
                </button>
              </nav>

              <div className={styles.workspaceBody} data-hall-scroll-body="true">
                <div className={styles.pvpGrid}>
                  <article
                    className={styles.joinCard}
                    data-pvp-entry="join"
                    hidden={pvpEntry !== 'join'}
                  >
                    <p>
                      Join a private battle using a Lobby Key shared by its host. Battles are
                      private, not publicly listed.
                    </p>
                    <label htmlFor="lobby-key">Lobby Key</label>
                    <input
                      id="lobby-key"
                      value={joinKey}
                      onChange={(event) => setJoinKey(formatPvpLobbyKeyInput(event.target.value))}
                      placeholder="AVL-0000-0000"
                      title="Paste or type a Lobby Key. Capitals and dashes are added automatically."
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      maxLength={13}
                    />
                  </article>

                  <article
                    className={styles.setupCard}
                    data-pvp-create-card
                    data-pvp-entry="create"
                    hidden={pvpEntry !== 'create'}
                  >
                    <div className={styles.formatRow}>
                      <label htmlFor="pvp-mode">Battle format</label>
                      <select
                        id="pvp-mode"
                        aria-describedby="pvp-format-description"
                        value={pvpMode ?? ''}
                        onChange={(event) =>
                          setPvpMode((event.target.value || null) as PvpMode | null)
                        }
                        disabled={pending}
                      >
                        <option value="">Choose a PvP format…</option>
                        {PVP_MODES.map((mode) => (
                          <option value={mode.id} key={mode.id}>
                            {mode.label} — {mode.detail}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p id="pvp-format-description" className={styles.formatDescription}>
                      {PVP_MODES.find((mode) => mode.id === pvpMode)?.detail ??
                        'Choose a battle format to see its team arrangement.'}
                    </p>

                    {pvpMode === 'flex-teams' ? (
                      <div className={styles.flexSizes} data-pvp-team-sizes>
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
                  </article>
                </div>

                <p className={styles.note}>
                  <span aria-hidden="true">i</span>
                  Settings lock when the lobby opens. Every seat must be filled and ready to begin.
                </p>
              </div>

              <footer className={styles.panelActions} data-hall-action-row="true">
                <button
                  type="button"
                  className={styles.primaryAction}
                  hidden={pvpEntry !== 'create'}
                  disabled={!pvpMode || pending}
                  onClick={() => void createLobby()}
                >
                  {pending ? 'Preparing…' : 'Create Battle Lobby'}
                </button>
                <button
                  type="button"
                  hidden={pvpEntry !== 'join'}
                  className={styles.primaryAction}
                  disabled={pending || !isCompletePvpLobbyKey(joinKey)}
                  onClick={() => void joinLobby(joinKey)}
                >
                  {pending ? 'Joining…' : 'Join Battle Lobby'}
                </button>
              </footer>
            </div>
          </div>
        </section>

        <section
          className={styles.workspace}
          data-tone="spectate"
          data-hall-workspace="spectate"
          data-selected={section === 'spectate' || undefined}
          data-hall-active-workspace="true"
          aria-labelledby="spectate-heading"
          hidden={section !== 'spectate'}
        >
          <div className={styles.workspaceBody} data-hall-scroll-body="true">
            <figure className={styles.spectateVista}>
              <AurevaneImage
                assetId="environment.battle-hall.courtyard"
                sizes="(max-width: 900px) 100vw, 64vw"
              />
              <figcaption>
                <strong>Real strategy lives in every battle.</strong>
                <span>Observe. Learn. Improve.</span>
              </figcaption>
            </figure>

            <div className={styles.spectateIntro}>
              <h2 id="spectate-heading">Witness a battle by key.</h2>
              <p>Watch a shared battle. Learn from every turn.</p>
            </div>

            <footer className={styles.spectateActions} data-hall-action-row="true">
              <div className={styles.keyEntry}>
                <input
                  value={battleKey}
                  onChange={(event) => setBattleKey(event.target.value.toUpperCase())}
                  placeholder="Enter a Battle Key (e.g. AVB-0000-0000)"
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
            </footer>

            <aside className={styles.readOnlyNote}>
              <span aria-hidden="true">◉</span>
              <div>
                <strong>Read-Only Arena Access</strong>
                <p>
                  Spectate battles in real time, watching the live board and combat state without
                  submitting any commands. Battles are private and accessed only by key.
                </p>
              </div>
              <blockquote>
                “Great tacticians learn twice —
                <br />
                once by playing, and once by watching.”
              </blockquote>
            </aside>
          </div>
        </section>
      </div>

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
