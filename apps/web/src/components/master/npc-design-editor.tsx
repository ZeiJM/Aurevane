'use client'

import { useState, type FormEvent } from 'react'
import { STARTER_CHARACTER_PORTRAITS } from '@aurevane/game-core/character/starter-options'
import { getTacticalHallArena } from '@aurevane/game-core/combat/tactical-hall-arenas'
import {
  NPC_ARENA_IDS,
  NPC_ARENA_LORE_LIMIT,
  NPC_GREETING_LIMIT,
  NPC_USES,
  type NpcDesignCommand,
  type NpcDesignDraft,
  type NpcDesignRecord,
  type NpcUse,
} from '@aurevane/validation/combat/npc-design'

import {
  appearanceManifestFromImageUrl,
  compileAppearanceManifest,
} from '@/appearance/appearance-manifest'
import { AppearanceBuilderDialog } from '@/components/character/appearance-builder-dialog'
import { ArenaNpcCard } from '@/components/battle/arena-npc-card'
import styles from './npc-design-editor.module.css'

const DEFAULT_ARENA = { arenaId: 'duel-yard', aiDifficulty: 'high', lore: '' } as const
const DEFAULT_WORLD = { sectorId: 'verdant-expanse', x: 5, y: 4, radius: 2, greeting: '' } as const
const USE_LABELS: Record<NpcUse, string> = {
  arena: 'Arena fighter',
  world: 'World character',
  story: 'Story character',
}
const INITIAL_DRAFT: NpcDesignDraft = {
  name: '',
  portraitRef: null,
  uses: ['arena'],
  arena: DEFAULT_ARENA,
}

export function NpcDesignEditor({
  initialRecords,
  initialNpcId,
  sectors,
}: {
  initialRecords: NpcDesignRecord[]
  initialNpcId?: string
  sectors: { id: string; name: string }[]
}) {
  const initialRecord = initialRecords.find((record) => record.id === initialNpcId)
  const [records, setRecords] = useState(initialRecords)
  const [selectedId, setSelectedId] = useState<string | null>(initialRecord?.id ?? null)
  const [draft, setDraft] = useState(initialRecord?.draft ?? INITIAL_DRAFT)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [retirePrompt, setRetirePrompt] = useState<NpcUse | null>(null)
  const current = records.find((record) => record.id === selectedId)
  const dirty = JSON.stringify(draft) !== JSON.stringify(current?.draft ?? INITIAL_DRAFT)
  const arena = draft.uses.includes('arena') ? draft.arena : null
  const world = draft.uses.includes('world') ? draft.world : null
  const story = draft.uses.includes('story')
  const ready = {
    arena: Boolean(arena && draft.name.trim()),
    world: Boolean(world?.greeting.trim() && draft.name.trim()),
    story: Boolean(story && draft.name.trim()),
  }
  const cleanQuery = query.trim().toLocaleLowerCase()
  const matching = records.filter((record) =>
    record.draft.name.toLocaleLowerCase().includes(cleanQuery),
  )

  function select(record?: NpcDesignRecord) {
    setSelectedId(record?.id ?? null)
    setDraft(record?.draft ?? INITIAL_DRAFT)
    setNotice('')
    setError('')
    setRetirePrompt(null)
  }

  function toggleUse(use: NpcUse) {
    const enabled = draft.uses.includes(use)
    const uses = enabled ? draft.uses.filter((item) => item !== use) : [...draft.uses, use]
    if (!uses.length) return
    setDraft({
      ...draft,
      uses,
      arena: uses.includes('arena') ? (draft.arena ?? DEFAULT_ARENA) : draft.arena,
      world: uses.includes('world') ? (draft.world ?? DEFAULT_WORLD) : draft.world,
    })
  }

  async function submit(command: NpcDesignCommand) {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/master/npc-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
      })
      const result = (await response.json()) as {
        record?: NpcDesignRecord
        error?: { message?: string }
      }
      if (!response.ok || !result.record)
        throw new Error(result.error?.message ?? 'Unable to save the NPC.')
      const record = result.record
      setRecords((previous) =>
        [...previous.filter((item) => item.id !== record.id), record].sort((a, b) =>
          a.draft.name.localeCompare(b.draft.name),
        ),
      )
      select(record)
      window.history.replaceState(window.history.state, '', `?npc=${record.id}`)
      setNotice(
        command.kind === 'save'
          ? 'Draft saved.'
          : `${USE_LABELS[command.kind.split('-')[1] as NpcUse]} ${command.kind.startsWith('commit-') ? 'committed.' : 'retired.'}`,
      )
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to save the NPC.')
    } finally {
      setBusy(false)
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit({
      kind: 'save',
      id: current?.id ?? crypto.randomUUID(),
      revision: current?.revision ?? 0,
      draft,
    })
  }

  return (
    <div className={styles.workspace}>
      <aside className={styles.roster} aria-label="Reusable NPCs">
        <label>
          Search NPCs
          <input value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button
          type="button"
          disabled={dirty || busy}
          onClick={() => {
            select()
            window.history.replaceState(window.history.state, '', window.location.pathname)
          }}
        >
          New NPC
        </button>
        <ul>
          {matching.map((record) => (
            <li key={record.id}>
              <button
                type="button"
                aria-pressed={record.id === selectedId}
                disabled={dirty || busy}
                onClick={() => {
                  select(record)
                  window.history.replaceState(window.history.state, '', `?npc=${record.id}`)
                }}
              >
                {record.draft.name || 'Unnamed NPC'}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <form className={styles.editor} onSubmit={save}>
        <fieldset disabled={busy}>
          <legend>Identity and intended uses</legend>
          <div className={styles.uses}>
            {NPC_USES.map((use) => (
              <label key={use}>
                <input
                  type="checkbox"
                  checked={draft.uses.includes(use)}
                  onChange={() => toggleUse(use)}
                />{' '}
                {USE_LABELS[use]}
              </label>
            ))}
          </div>
          <label>
            Name
            <input
              value={draft.name}
              maxLength={60}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </label>
          <label>
            Portrait
            <select
              value={draft.portraitRef ?? ''}
              onChange={(event) => setDraft({ ...draft, portraitRef: event.target.value || null })}
            >
              <option value="">Standard portrait</option>
              {STARTER_CHARACTER_PORTRAITS.map(({ ref, label }) => (
                <option key={ref} value={ref}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.actions}>
            <AppearanceBuilderDialog
              label="Build appearance"
              confirmLabel="Use this appearance"
              value={appearanceManifestFromImageUrl(draft.imageUrl)?.blueprint}
              onConfirm={(blueprint) =>
                setDraft({
                  ...draft,
                  imageUrl: compileAppearanceManifest(blueprint).portraits.neutral,
                })
              }
            />
            {draft.imageUrl ? (
              <button type="button" onClick={() => setDraft({ ...draft, imageUrl: null })}>
                Use portrait only
              </button>
            ) : null}
          </div>
          {draft.imageUrl ? (
            <p className={styles.hint}>
              Generated look applies to the card, dialogue and compatible world and battle actors.
              The selected portrait is its fallback.
            </p>
          ) : null}
        </fieldset>
        {arena ? (
          <fieldset disabled={busy}>
            <legend>Arena setup</legend>
            <label>
              Assigned field
              <select
                value={arena.arenaId}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    arena: { ...arena, arenaId: event.target.value as typeof arena.arenaId },
                  })
                }
              >
                {NPC_ARENA_IDS.map((id) => (
                  <option key={id} value={id}>
                    {getTacticalHallArena(id).name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Behavior
              <select
                value={arena.aiDifficulty}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    arena: {
                      ...arena,
                      aiDifficulty: event.target.value as typeof arena.aiDifficulty,
                    },
                  })
                }
              >
                <option value="easy">Training</option>
                <option value="standard">Balanced</option>
                <option value="high">Advanced</option>
              </select>
            </label>
            <p className={styles.hint}>
              Uses the Battle Hall Recruit build with the chosen decision profile.
            </p>
            <label>
              Arena card lore
              <textarea
                maxLength={NPC_ARENA_LORE_LIMIT}
                rows={4}
                value={arena.lore}
                aria-describedby="npc-lore-help"
                onChange={(event) =>
                  setDraft({ ...draft, arena: { ...arena, lore: event.target.value } })
                }
              />
            </label>
            <p className={styles.hint} id="npc-lore-help">
              Optional public paragraph. Aim for 250–450 characters. {arena.lore.length} /{' '}
              {NPC_ARENA_LORE_LIMIT}
            </p>
            <ArenaNpcCard
              name={draft.name.trim() || 'Unnamed NPC'}
              lore={arena.lore.trim()}
              portraitRef={draft.portraitRef}
              imageUrl={draft.imageUrl}
            />
          </fieldset>
        ) : null}
        {world ? (
          <fieldset disabled={busy}>
            <legend>World placement and greeting</legend>
            <label>
              World sector
              <select
                value={world.sectorId}
                onChange={(event) =>
                  setDraft({ ...draft, world: { ...world, sectorId: event.target.value } })
                }
              >
                {sectors.map((sector) => (
                  <option key={sector.id} value={sector.id}>
                    {sector.name}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.uses}>
              {(['x', 'y', 'radius'] as const).map((field) => (
                <label key={field}>
                  {field === 'radius' ? 'Talk range' : `Tile ${field.toUpperCase()}`}
                  <input
                    type="number"
                    min={field === 'radius' ? 1 : 0}
                    max={field === 'x' ? 12 : field === 'y' ? 8 : 3}
                    value={world[field]}
                    required
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        world: { ...world, [field]: Number(event.target.value) },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <label>
              Greeting
              <textarea
                rows={4}
                value={world.greeting}
                maxLength={NPC_GREETING_LIMIT}
                onChange={(event) =>
                  setDraft({ ...draft, world: { ...world, greeting: event.target.value } })
                }
              />
            </label>
            <p className={styles.hint}>
              Players can speak to this NPC from the selected distance on charted ground.
            </p>
          </fieldset>
        ) : null}
        {story ? (
          <fieldset>
            <legend>Story appearance</legend>
            <p className={styles.hint}>
              Publish this identity for event authors. Scene dialogue and quests are authored
              separately.
            </p>
          </fieldset>
        ) : null}
        <div className={styles.actions}>
          <button type="submit" disabled={busy || (current !== undefined && !dirty)}>
            Save draft
          </button>
          {dirty ? (
            <button type="button" disabled={busy} onClick={() => select(current)}>
              Discard unsaved edits
            </button>
          ) : null}
        </div>
        {current
          ? NPC_USES.filter((use) => draft.uses.includes(use) || current[use]).map((use) => (
              <section key={use} aria-label={USE_LABELS[use]}>
                <div className={styles.actions}>
                  {draft.uses.includes(use) ? (
                    <button
                      type="button"
                      disabled={busy || dirty || !ready[use]}
                      onClick={() =>
                        void submit({
                          kind: `commit-${use}`,
                          id: current.id,
                          revision: current.revision,
                        })
                      }
                    >
                      {draft.uses.length === 1 ? 'Commit now' : `Commit ${USE_LABELS[use]}`}
                    </button>
                  ) : null}
                  {current[use] ? (
                    <button
                      type="button"
                      disabled={busy || dirty}
                      onClick={() => setRetirePrompt(retirePrompt === use ? null : use)}
                    >
                      Retire {USE_LABELS[use]}
                    </button>
                  ) : null}
                </div>
                {current[use] ? (
                  <p className={styles.hint}>Published as {current[use]?.name}.</p>
                ) : null}
              </section>
            ))
          : null}
        {retirePrompt && current ? (
          <p className={styles.hint}>
            Retirement removes this published use. Active battles keep their captured opponent.{' '}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void submit({
                  kind: `retire-${retirePrompt}`,
                  id: current.id,
                  revision: current.revision,
                })
              }
            >
              Confirm retirement
            </button>
          </p>
        ) : null}
        {notice ? <p role="status">{notice}</p> : null}
        {error ? <p role="alert">{error}</p> : null}
      </form>
    </div>
  )
}
