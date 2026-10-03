import { z } from 'zod'

export const COMBAT_KEYBIND_ACTIONS = [
  'inspect',
  'move',
  'basicAttack',
  'guard',
  'recover',
  'skill1',
  'skill2',
  'skill3',
  'skill4',
  'essence',
  'supernatural',
  'endTurn',
  'confirm',
  'cancel',
  'faceNorth',
  'faceWest',
  'faceSouth',
  'faceEast',
  'nextTarget',
  'previousTarget',
  'combatLog',
] as const

export type CombatKeybindAction = (typeof COMBAT_KEYBIND_ACTIONS)[number]

const keyboardCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9]+$/)

export const combatKeybindSchema = z
  .object({
    code: keyboardCodeSchema,
    shift: z.boolean().default(false),
  })
  .strict()

const combatKeybindShape = Object.fromEntries(
  COMBAT_KEYBIND_ACTIONS.map((action) => [action, combatKeybindSchema]),
) as Record<CombatKeybindAction, typeof combatKeybindSchema>

export const combatKeybindMapSchema = z
  .object(combatKeybindShape)
  .strict()
  .superRefine((bindings, context) => {
    const seen = new Map<string, CombatKeybindAction>()
    for (const action of COMBAT_KEYBIND_ACTIONS) {
      const binding = bindings[action]
      const chord = combatKeybindChord(binding)
      const existing = seen.get(chord)
      if (existing) {
        context.addIssue({
          code: 'custom',
          path: [action],
          message: `Conflicts with ${existing}.`,
        })
      } else {
        seen.set(chord, action)
      }
    }
  })

export type CombatKeybind = z.infer<typeof combatKeybindSchema>
export type CombatKeybindMap = z.infer<typeof combatKeybindMapSchema>

export const DEFAULT_COMBAT_KEYBINDS: CombatKeybindMap = {
  inspect: { code: 'KeyI', shift: false },
  move: { code: 'Digit1', shift: false },
  basicAttack: { code: 'Digit2', shift: false },
  guard: { code: 'Digit3', shift: false },
  recover: { code: 'KeyR', shift: false },
  skill1: { code: 'Digit4', shift: false },
  skill2: { code: 'Digit5', shift: false },
  skill3: { code: 'Digit6', shift: false },
  skill4: { code: 'Digit7', shift: false },
  essence: { code: 'Digit8', shift: false },
  supernatural: { code: 'Digit9', shift: false },
  endTurn: { code: 'Space', shift: false },
  confirm: { code: 'Enter', shift: false },
  cancel: { code: 'Escape', shift: false },
  faceNorth: { code: 'KeyW', shift: false },
  faceWest: { code: 'KeyA', shift: false },
  faceSouth: { code: 'KeyS', shift: false },
  faceEast: { code: 'KeyD', shift: false },
  nextTarget: { code: 'Tab', shift: false },
  previousTarget: { code: 'Tab', shift: true },
  combatLog: { code: 'KeyL', shift: false },
}

export function combatKeybindChord(binding: CombatKeybind): string {
  return `${binding.shift ? 'Shift+' : ''}${binding.code}`
}

export function parseCombatKeybindMap(input: unknown): CombatKeybindMap | null {
  // Old accounts used numeric category slots. Upgrade only those inherited defaults;
  // intentional customized chords retain their meaning without a database rewrite.
  const legacySlotCodes: Readonly<Record<string, string>> = {
    inspect: 'Digit1',
    move: 'Digit2',
    basicAttack: 'Digit3',
    guard: 'Digit4',
    recover: 'Digit5',
  }
  const additions = ['skill1', 'skill2', 'skill3', 'skill4', 'essence', 'supernatural'] as const
  let normalized = input
  if (
    input &&
    typeof input === 'object' &&
    !Array.isArray(input) &&
    additions.every((action) => !(action in input))
  ) {
    const legacy = { ...(input as Record<string, unknown>) }
    const inherited = (['inspect', 'move', 'basicAttack', 'guard', 'recover'] as const).filter(
      (action) => {
        const parsed = combatKeybindSchema.safeParse(legacy[action])
        return parsed.success && parsed.data.code === legacySlotCodes[action] && !parsed.data.shift
      },
    )
    const used = new Set(
      Object.entries(legacy).flatMap(([action, binding]) => {
        if (inherited.some((key) => key === action)) return []
        const parsed = combatKeybindSchema.safeParse(binding)
        return parsed.success ? [combatKeybindChord(parsed.data)] : []
      }),
    )
    // Reserve deliberate custom bindings before allocating migrated defaults and new slots.
    for (const action of [...inherited, ...additions]) {
      const preferred = DEFAULT_COMBAT_KEYBINDS[action]
      const alternatives = [
        preferred,
        { ...preferred, shift: true },
        ...Array.from({ length: 12 }, (_, index) => ({ code: `F${index + 1}`, shift: false })),
      ]
      const available = alternatives.find((binding) => !used.has(combatKeybindChord(binding)))
      if (!available) return null
      legacy[action] = available
      used.add(combatKeybindChord(available))
    }
    normalized = legacy
  }
  const candidate =
    normalized && typeof normalized === 'object' && !Array.isArray(normalized)
      ? { ...DEFAULT_COMBAT_KEYBINDS, ...(normalized as Record<string, unknown>) }
      : normalized
  const result = combatKeybindMapSchema.safeParse(candidate)
  return result.success ? result.data : null
}

export function formatCombatKeybind(binding: CombatKeybind): string {
  const label = binding.code
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace('Space', 'Space')
    .replace('Escape', 'Esc')
    .replace('ArrowUp', '↑')
    .replace('ArrowDown', '↓')
    .replace('ArrowLeft', '←')
    .replace('ArrowRight', '→')
  return `${binding.shift ? 'Shift+' : ''}${label}`
}
