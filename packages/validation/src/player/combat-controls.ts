import { z } from 'zod'

export const COMBAT_KEYBIND_ACTIONS = [
  'inspect',
  'move',
  'basicAttack',
  'guard',
  'recover',
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
  inspect: { code: 'Digit1', shift: false },
  move: { code: 'Digit2', shift: false },
  basicAttack: { code: 'Digit3', shift: false },
  guard: { code: 'Digit4', shift: false },
  recover: { code: 'Digit5', shift: false },
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
  const candidate =
    input && typeof input === 'object' && !Array.isArray(input)
      ? { ...DEFAULT_COMBAT_KEYBINDS, ...(input as Record<string, unknown>) }
      : input
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
