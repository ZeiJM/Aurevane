from pathlib import Path
import re


def sub(path: str, pattern: str, replacement: str, flags: int = 0) -> None:
    file = Path(path)
    text = file.read_text()
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{path}: expected one replacement for {pattern!r}, got {count}')
    file.write_text(updated)


service = 'apps/web/src/server/character/character-build-service.ts'
sub(
    service,
    r"(from '@aurevane/game-core/combat/mature-skills'\n)(import \{ AurevaneError \})",
    r"\1import {\n  resonanceSnapshotReference,\n  resolveResonanceForPair,\n  type ResonanceDefinition,\n  type ResonanceSnapshotReference,\n} from '@aurevane/game-core/combat/resonance'\n\2",
)
sub(
    service,
    r"(export interface CharacterCommittedBuildSnapshotRecord \{[\s\S]*?extensions: \{\n\s*)resonance: null",
    r"\1resonance: ResonanceSnapshotReference | null",
)
sub(
    service,
    r"(export interface CharacterDisciplineSkillLoadoutView \{[\s\S]*?extensions: \{\n\s*)resonance: null",
    r"\1resonance: ResonanceDefinition | null",
)
sub(
    service,
    r"(return \{\n\s*capacity: disciplineSkillCapacity\(build\.secondaryDefinition\?\.id \?\? null\),\n\s*learnedSkills,\n\s*equippedSkills,\n\s*extensions: \{\n\s*)resonance: null,",
    r"\1resonance: resolveResonanceForPair(\n      build.primaryDefinition.id,\n      build.secondaryDefinition?.id ?? null,\n    ),",
)
sub(
    service,
    r"(if \(\n\s*snapshot\.disciplineSkills\.length >\n\s*disciplineSkillCapacity\(snapshot\.secondary\?\.disciplineId \?\? null\)\n\s*\) \{\n\s*throw persistenceUnavailable\('The committed build snapshot exceeds Skill capacity\.'\)\n\s*\}\n)(\s*return snapshot)",
    r"\1\n  const persistedResonance = snapshot.extensions.resonance\n  const latestResonance = resolveResonanceForPair(\n    snapshot.primary.disciplineId,\n    snapshot.secondary?.disciplineId ?? null,\n  )\n  if (!persistedResonance) {\n    if (latestResonance) {\n      throw persistenceUnavailable('The committed build snapshot is missing its Resonance.')\n    }\n  } else {\n    const resolved = resolveResonanceForPair(\n      snapshot.primary.disciplineId,\n      snapshot.secondary?.disciplineId ?? null,\n      persistedResonance.contentVersion,\n    )\n    if (!resolved) {\n      throw persistenceUnavailable('The committed build snapshot contains an invalid Resonance.')\n    }\n    const expected = resonanceSnapshotReference(resolved)\n    if (\n      expected.resonanceId !== persistedResonance.resonanceId ||\n      expected.contentVersion !== persistedResonance.contentVersion ||\n      expected.disciplinePair[0] !== persistedResonance.disciplinePair[0] ||\n      expected.disciplinePair[1] !== persistedResonance.disciplinePair[1]\n    ) {\n      throw persistenceUnavailable('The committed build snapshot contains an invalid Resonance.')\n    }\n  }\n\2",
)

repo = 'apps/web/src/server/character/supabase-character-build-repository.ts'
sub(
    repo,
    r"\nfunction parseCommittedSnapshot\(value: unknown\): CharacterCommittedBuildSnapshotRecord \| null \{",
    """
function parseSnapshotResonance(
  value: unknown,
): CharacterCommittedBuildSnapshotRecord['extensions']['resonance'] | undefined {
  if (value === null) return null
  if (!isRecord(value)) return undefined
  const contentVersion = integer(value.contentVersion)
  if (
    typeof value.resonanceId !== 'string' ||
    contentVersion === null ||
    !Array.isArray(value.disciplinePair) ||
    value.disciplinePair.length !== 2 ||
    typeof value.disciplinePair[0] !== 'string' ||
    typeof value.disciplinePair[1] !== 'string'
  ) {
    return undefined
  }
  return {
    resonanceId: value.resonanceId,
    contentVersion,
    disciplinePair: [value.disciplinePair[0], value.disciplinePair[1]],
  }
}

function parseCommittedSnapshot(value: unknown): CharacterCommittedBuildSnapshotRecord | null {""",
)
sub(repo, r"\n\s*value\.extensions\.resonance !== null \|\|", '')
sub(
    repo,
    r"(const disciplineSkills = value\.disciplineSkills\.map\(parseSnapshotSkill\)\n\s*if \(disciplineSkills\.some\(\(entry\) => entry === null\)\) return null)",
    r"\1\n  const resonance = parseSnapshotResonance(value.extensions.resonance)\n  if (resonance === undefined) return null",
)
sub(
    repo,
    r"(disciplineSkills: disciplineSkills as CharacterCommittedBuildSnapshotRecord\['disciplineSkills'\],\n\s*extensions: \{\n\s*)resonance: null,",
    r"\1resonance,",
)

shell = 'apps/web/src/components/character/character-profile-shell.tsx'
sub(
    shell,
    r"(import type \{ MatureSkillDefinition \} from '@aurevane/game-core/combat/mature-skills'\n)",
    r"\1import type { ResonanceDefinition } from '@aurevane/game-core/combat/resonance'\n",
)
sub(
    shell,
    r"(disciplineSkills: \{[\s\S]*?equippedSkills: readonly \{[\s\S]*?equippedAt: string\n\s*\}\[\]\n)(\s*\})",
    r"\1      extensions: {\n        resonance: ResonanceDefinition | null\n      }\n\2",
)
sub(
    shell,
    r"(initialEquippedSkills=\{disciplineBuild\.disciplineSkills\.equippedSkills\}\n\s*)/>",
    r"\1initialResonance={disciplineBuild.disciplineSkills.extensions.resonance}\n                />",
)

page = 'apps/web/src/app/game/character/page.tsx'
sub(
    page,
    r"(equippedSkills: disciplineBuild\.disciplineSkills\.equippedSkills,\n\s*)(\},)",
    r"\1extensions: disciplineBuild.disciplineSkills.extensions,\n        \2",
)

panel = 'apps/web/src/components/character/character-skill-build-panel.tsx'
sub(
    panel,
    r"(import type \{ MatureSkillDefinition \} from '@aurevane/game-core/combat/mature-skills'\n)",
    r"\1import type { ResonanceDefinition } from '@aurevane/game-core/combat/resonance'\n",
)
sub(
    panel,
    r"(initialEquippedSkills: readonly EquippedSkillView\[\]\n)(\})",
    r"\1  initialResonance: ResonanceDefinition | null\n\2",
)
sub(
    panel,
    r"(initialEquippedSkills,\n)(\}: CharacterSkillBuildPanelProps)",
    r"\1  initialResonance,\n\2",
)
sub(
    panel,
    r"<div className=\{styles\.extensions\}>\n\s*<strong>Build extensions</strong>\n\s*<span>Resonance / Essence — reserved for P3\.5–P3\.6</span>\n\s*<span>Equipment Skills — reserved</span>\n\s*<span>Supernatural — reserved for later phases</span>\n\s*<span>Prestige — reserved</span>\n\s*</div>",
    """<div className={styles.extensions}>
              <strong>Build extensions</strong>
              {initialResonance ? (
                <>
                  <span data-testid="active-resonance">
                    Resonance · {initialResonance.name} · content v{initialResonance.contentVersion}
                  </span>
                  <span>{initialResonance.description}</span>
                </>
              ) : secondaryDiscipline ? (
                <span>No authored Resonance is available for this Discipline pair yet.</span>
              ) : (
                <span>Resonance — available only to an eligible mixed build.</span>
              )}
              <span>Essence — reserved for P3.6</span>
              <span>Equipment Skills — reserved</span>
              <span>Supernatural — reserved for later phases</span>
              <span>Prestige — reserved</span>
            </div>""",
)

test = Path('apps/web/src/server/character/character-build-service.test.ts')
text = test.read_text().replace('schemaVersion: 3,', 'schemaVersion: 4,')
anchor = "  it('previews a legal proposed Primary without writing it', async () => {"
addition = """  it('resolves the current mixed-build Resonance from the authoritative Discipline pair', async () => {
    const context = await loadCharacterBuildContext(
      userId,
      character(),
      repository({ findActiveBuild: vi.fn(async () => build(vanguard, 4, lifebinder)) }),
    )

    expect(context.disciplineSkills.extensions.resonance).toMatchObject({
      id: 'resonance.lifebinder-vanguard.mercys-edge',
      contentVersion: 1,
      disciplinePair: ['lifebinder', 'vanguard'],
    })
  })

"""
if text.count(anchor) != 1:
    raise RuntimeError('character-build-service.test.ts: mixed Resonance test anchor missing')
text = text.replace(anchor, addition + anchor, 1)
old = """          extensions: {
            resonance: null,
            essence: null,
            equipmentSkills: [],
            supernatural: null,
            prestige: null,
          },"""
new = """          extensions: {
            resonance: {
              resonanceId: 'resonance.lifebinder-vanguard.mercys-edge',
              contentVersion: 1,
              disciplinePair: ['lifebinder', 'vanguard'],
            },
            essence: null,
            equipmentSkills: [],
            supernatural: null,
            prestige: null,
          },"""
if text.count(old) != 1:
    raise RuntimeError(
        f'character-build-service.test.ts: expected one mixed snapshot extension, got {text.count(old)}'
    )
text = text.replace(old, new, 1)
anchor2 = """    expect(snapshot.disciplineSkills.map((skill) => skill.skillId)).toEqual([
      'vanguard.forceful-strike',
      'lifebinder.mending-light',
    ])"""
if text.count(anchor2) != 1:
    raise RuntimeError('character-build-service.test.ts: snapshot expectation anchor missing')
text = text.replace(
    anchor2,
    anchor2
    + """
    expect(snapshot.extensions.resonance).toEqual({
      resonanceId: 'resonance.lifebinder-vanguard.mercys-edge',
      contentVersion: 1,
      disciplinePair: ['lifebinder', 'vanguard'],
    })""",
    1,
)
test.write_text(text)
