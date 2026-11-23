import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const source = (name: string) => readFileSync(join(here, name), 'utf8')

describe('shared playable battle boundary ownership', () => {
  it('does not mount another combat execution or keyboard controller around BattleExperience', () => {
    const boundary = source('battle-client-boundary.tsx')
    for (const controller of [
      'BattleMovementKeyboardAssist',
      'BattleSelfActionQuickCommitAssist',
      'BattleFinishTurnKeyboardAssist',
      'BattleDirectionalAttackAssist',
      'BattleFacingQuickCommitAssist',
      'PvpQuickCommitAssist',
      'BattleStickyActionAssist',
      'BattlePresentationPolish',
      'BattleFavoriteTechniqueAssist',
    ]) {
      expect(boundary, controller).not.toContain(controller)
    }
    expect(source('battle-pve-enhancements.tsx')).not.toContain('BattleKeyboardAssist')
    expect(source('battle-pvp-enhancements.tsx')).not.toContain('PvpBattleKeyboardAssist')
  })

  it('retains shared presentation, lifecycle, mobile resources and effect inspection', () => {
    const boundary = source('battle-client-boundary.tsx')
    for (const component of [
      'BattleRuntimeProvider',
      'BattleInteractionLifecycleProvider',
      'BattlefieldPresentationBundle',
      'BattleMobileTokenMeters',
      'BattleChatEmojiPolish',
      'BattleStatusEffectAssist',
      'BattleInspectTerrainContext',
    ]) {
      expect(boundary).toContain(`<${component}`)
    }
  })

  it('retains mode-specific completion, authoritative clocks, inspection, chat and recovery', () => {
    for (const [file, components] of [
      [
        'battle-pve-enhancements.tsx',
        [
          'AiBattleQualityControls',
          'BattleLessonCoach',
          'BattleLessonCoachSemantics',
          'PveBattleCompletionBridge',
          'DesktopBattleCombatantInspect',
          'MobileBattleCombatantPopup',
          'BattleRecruitRecoveryAssist',
          'BattleFeedbackAssist',
          'BattleUtilityWindows',
        ],
      ],
      [
        'battle-pvp-enhancements.tsx',
        [
          'PvpBattleChatBridge',
          'PvpBattleQualityControls',
          'PvpBattleInspectPopup',
          'PvpBattleCompletionPanel',
          'DesktopBattleCombatantInspect',
        ],
      ],
    ] as const) {
      for (const component of components) expect(source(file)).toContain(`<${component}`)
    }
    expect(source('battlefield-presentation-bundle.tsx')).toContain('<BattleCommittedAudio')
  })

  it('keeps feedback styling from resizing native portraits, boards or combatant rails', () => {
    const css = source('battle-feedback-assist.module.css')
    for (const selector of [
      'data-map-portrait-ready',
      'data-map-token-portrait',
      'data-board-auto-fit',
      "aside[aria-label$=' combat status']",
      '#battlefield > div:first-child',
    ]) {
      expect(css, selector).not.toContain(selector)
    }
    expect(css).toContain('data-target-relation')
    expect(css).toContain('prefers-reduced-motion: no-preference')
    expect(css).toContain('data-floating-chat')
    expect(css).toContain('data-battle-emoji-picker')
  })
})
