import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./battle-experience.tsx', import.meta.url), 'utf8')
describe('refined battle controller wiring', () => {
  it('owns the approved cockpit and local/selected summary composition', () => {
    expect(source).toContain('data-battle-layout="refined"')
    expect(source).toContain('data-battle-side="local"')
    expect(source).toContain('data-battle-side="selected"')
    expect(source).toContain('participants={Array.from(viewModel.participantByCombatant.values())}')
    expect(source).not.toContain('Confirm Action')
  })
  it('separates informational automatic aim from deliberate preview-validated execution', () => {
    expect(source).toContain('selectInitialBattleSkillPreviewIntent')
    expect(source).toContain('selectDirectionalBattleSkillPreviewIntent')
    expect(source).toContain('executeIntent')
    expect(source).toContain('event.repeat')
    expect(source).toContain('parseCombatKeybindMap')
    expect(source).toContain('previewController.current?.abort()')
    expect(source).toContain('mounted.current &&')
    expect(source).toContain('setExecutionPending(true)')
  })
})
