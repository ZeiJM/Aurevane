import type {
  CombatContentDefinition,
  CombatContentListPage,
  CombatContentSort,
} from '@aurevane/db/combat-content'

export interface PendingContentEdit {
  revision: number
  definition: CombatContentDefinition
}
export interface WorkspaceRecovery {
  schema: 1
  category: string
  selectedKey: string | null
  tab: string
  search: string
  sort: CombatContentSort
  listScroll: number
  editorScroll: number
  edits: Record<string, PendingContentEdit>
  newDefinition: CombatContentDefinition | null
  newRequestId?: string | null
  createAttempt?: ContentCreationAttempt | null
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
export function recoveryKey(account: string): string | null {
  return account ? `aurevane.master.content.v1:${account}` : null
}
export function parseWorkspaceRecovery(raw: string | null): WorkspaceRecovery | null {
  if (!raw || raw.length > 4_000_000) return null
  try {
    const v: unknown = JSON.parse(raw)
    if (
      !object(v) ||
      v.schema !== 1 ||
      typeof v.category !== 'string' ||
      ![
        'discipline',
        'basic',
        'skill',
        'essence',
        'resonance',
        'tag',
        'status',
        'item',
        'ascension',
        'severence',
        'effect-profile',
      ].includes(v.category) ||
      !(
        v.selectedKey === null ||
        (typeof v.selectedKey === 'string' && v.selectedKey.length <= 160)
      ) ||
      typeof v.tab !== 'string' ||
      !['Parameters', 'Skills', 'Resonances', 'Usage & Balance'].includes(v.tab) ||
      (v.newRequestId !== undefined &&
        v.newRequestId !== null &&
        (typeof v.newRequestId !== 'string' || !/^[a-f0-9-]{36}$/iu.test(v.newRequestId))) ||
      typeof v.search !== 'string' ||
      v.search.length > 160 ||
      !['name-asc', 'name-desc', 'key-asc', 'key-desc'].includes(String(v.sort)) ||
      ![v.listScroll, v.editorScroll].every(
        (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0,
      ) ||
      !object(v.edits) ||
      Object.keys(v.edits).length > 200 ||
      !(v.newDefinition === null || object(v.newDefinition))
    )
      return null
    if (v.createAttempt !== undefined && v.createAttempt !== null) {
      const attempt = v.createAttempt
      if (
        !object(attempt) ||
        typeof attempt.requestId !== 'string' ||
        !/^[a-f0-9-]{36}$/iu.test(attempt.requestId) ||
        typeof attempt.contentKind !== 'string' ||
        ![
          'discipline',
          'skill',
          'essence',
          'resonance',
          'tag',
          'status',
          'item',
          'ascension',
          'severence',
          'effect-profile',
        ].includes(attempt.contentKind) ||
        !object(attempt.definition)
      )
        return null
    }
    for (const [key, edit] of Object.entries(v.edits)) {
      if (
        !/^[a-z0-9]+([._-][a-z0-9]+)*$/u.test(key) ||
        !object(edit) ||
        !Number.isSafeInteger(edit.revision) ||
        Number(edit.revision) < 1 ||
        !object(edit.definition)
      )
        return null
    }
    return v as unknown as WorkspaceRecovery
  } catch {
    return null
  }
}
export function mergeContentPages(
  a: CombatContentListPage,
  b: CombatContentListPage,
): CombatContentListPage {
  return {
    records: [
      ...new Map([...a.records, ...b.records].map((row) => [row.contentKey, row])).values(),
    ],
    nextCursor: b.nextCursor,
  }
}
/** The service bounds each request; the UI exposes one continuous list, with no pagination controls. */
export async function loadCompleteContentList(
  fetchPage: (after?: string) => Promise<CombatContentListPage>,
): Promise<CombatContentListPage> {
  let result: CombatContentListPage = { records: [], nextCursor: null }
  const cursors = new Set<string>()
  for (let count = 0; count < 1000; count++) {
    const page = await fetchPage(result.nextCursor ?? undefined)
    result = mergeContentPages(result, page)
    if (!result.nextCursor) return result
    if (cursors.has(result.nextCursor))
      throw new Error('The content list returned a repeated cursor. Refresh to retry.')
    cursors.add(result.nextCursor)
  }
  throw new Error('The content list exceeded its safety limit. Narrow the search and retry.')
}

const disciplineStages = (definition: CombatContentDefinition) =>
  (definition.skillStages as readonly { skillId: string; minimumStage: number }[] | undefined) ?? []

export function disciplineSkillIsAvailable(
  definition: CombatContentDefinition,
  skillId: string,
): boolean {
  return (
    ((definition.linkedSkills as readonly string[] | undefined) ?? []).includes(skillId) ||
    disciplineStages(definition).some((row) => row.skillId === skillId)
  )
}

/** Candidate discovery never changes a Discipline's availability or earned progression. */
export function disciplineSkillCandidates(
  definition: CombatContentDefinition,
  choices: readonly { contentKey: string; contentKind: string; sourceDisciplineId?: string }[],
  retainedLinks: readonly string[] = [],
): string[] {
  return [
    ...new Set([
      ...((definition.linkedSkills as readonly string[] | undefined) ?? []),
      ...disciplineStages(definition).map((row) => row.skillId),
      ...retainedLinks,
      ...choices
        .filter(
          (row) =>
            row.contentKind === 'skill' &&
            typeof definition.id === 'string' &&
            row.sourceDisciplineId === definition.id,
        )
        .map((row) => row.contentKey),
    ]),
  ]
}

/** Only an explicit availability/mastery control edits the selected association. */
export function withDisciplineSkill(
  definition: CombatContentDefinition,
  skillId: string,
  available: boolean,
  stage = disciplineStages(definition).find((row) => row.skillId === skillId)?.minimumStage ?? 1,
): CombatContentDefinition {
  const links = (definition.linkedSkills as readonly string[] | undefined) ?? []
  const stages = disciplineStages(definition)
  return {
    ...definition,
    linkedSkills: available
      ? [...new Set([...links, skillId])]
      : links.filter((id) => id !== skillId),
    skillStages: available
      ? stages.some((row) => row.skillId === skillId)
        ? stages.map((row) => (row.skillId === skillId ? { ...row, minimumStage: stage } : row))
        : [...stages, { skillId, minimumStage: stage }]
      : stages.filter((row) => row.skillId !== skillId),
  }
}

/** A popup publishes only its Skill's association/mastery; other parent edits stay local. */
export function disciplineMasteryCommit(
  base: CombatContentDefinition,
  local: CombatContentDefinition,
  skillId: string,
): CombatContentDefinition | null {
  const before = disciplineSkillIsAvailable(base, skillId)
  const after = disciplineSkillIsAvailable(local, skillId)
  const beforeStage =
    disciplineStages(base).find((row) => row.skillId === skillId)?.minimumStage ?? 1
  const afterStage =
    disciplineStages(local).find((row) => row.skillId === skillId)?.minimumStage ?? 1
  if (before === after && (!after || beforeStage === afterStage)) return null
  return withDisciplineSkill(base, skillId, after, afterStage)
}

export function adoptCreatedContentIdentity(
  local: CombatContentDefinition,
  contentKey: string,
  kind: string,
): CombatContentDefinition {
  return {
    ...local,
    id: contentKey,
    ...(kind === 'essence'
      ? {
          essenceId: contentKey,
          skill: {
            ...(local.skill && typeof local.skill === 'object'
              ? (local.skill as Record<string, unknown>)
              : {}),
            id: contentKey,
          },
        }
      : {}),
  }
}

export interface ContentCreationAttempt {
  requestId: string
  contentKind: string
  definition: CombatContentDefinition
}
/** A creation request key always replays the same immutable payload after an uncertain response. */
export function freezeCreationAttempt(
  previous: ContentCreationAttempt | null,
  requestId: string,
  contentKind: string,
  definition: CombatContentDefinition,
): ContentCreationAttempt {
  if (previous) {
    if (previous.requestId !== requestId || previous.contentKind !== contentKind)
      throw new Error('Recover the pending creation before starting another item.')
    return previous
  }
  return { requestId, contentKind, definition: structuredClone(definition) }
}

/** A modal and its later parent write may hold the same key concurrently. */
export function holdContentCommit(held: Map<string, number>, contentKey: string): () => void {
  held.set(contentKey, (held.get(contentKey) ?? 0) + 1)
  let active = true
  return () => {
    if (!active) return
    active = false
    const remaining = (held.get(contentKey) ?? 1) - 1
    if (remaining > 0) held.set(contentKey, remaining)
    else held.delete(contentKey)
  }
}
