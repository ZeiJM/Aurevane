from pathlib import Path

ROOT = Path('apps/web/src/server/battle')
IMPORT = "import { buildBattlePrivacyJournalInput } from './battle-history-privacy'\n"


def read(name: str):
    path = ROOT / name
    return path, path.read_text(encoding='utf-8')


def write(path: Path, text: str):
    path.write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, label: str):
    count = text.count(old)
    if count < 1:
        raise SystemExit(f'{label}: seam not found')
    if count > 1 and label != 'pvp timeout commit':
        raise SystemExit(f'{label}: expected one seam, found {count}')
    return text.replace(old, new, 1)


def add_import(text: str, marker: str, label: str):
    if IMPORT in text:
        return text
    return replace_once(text, marker, IMPORT + marker, label)


# AI timeout: public command, but lifecycle overrides still protect Covert positives.
path, text = read('ai-battle-quality-service.ts')
text = add_import(
    text,
    "import { createBattleSessionService, type BattleSessionView } from './battle-session-service'\n",
    'ai timeout import',
)
text = replace_once(
    text,
    """  const resolved = timeoutAiTurn(state)\n  const nextState = preserveFrozenBuildMetadata(initialState, resolved.state)\n\n  try {\n""",
    """  const resolved = timeoutAiTurn(state)\n  const nextState = preserveFrozenBuildMetadata(initialState, resolved.state)\n  const privacyJournal = buildBattlePrivacyJournalInput({\n    before: state,\n    after: resolved.state,\n    commandKind: 'system',\n    events: resolved.events,\n  })\n\n  try {\n""",
    'ai timeout resolve',
)
text = replace_once(
    text,
    """      nextSnapshot: nextState,\n      events: resolved.events,\n    })\n""",
    """      nextSnapshot: nextState,\n      events: resolved.events,\n      privacyJournal,\n    })\n""",
    'ai timeout commit',
)
write(path, text)

# AI surrender: stale/replay probe and surrender command are explicitly public.
path, text = read('ai-battle-surrender-service.ts')
text = replace_once(
    text,
    """      nextSnapshot: current.snapshot,\n      events: [],\n    })\n""",
    """      nextSnapshot: current.snapshot,\n      events: [],\n      privacyJournal: null,\n    })\n""",
    'ai surrender replay',
)
text = replace_once(
    text,
    """    nextSnapshot: resolved.state,\n    events: translateSurrenderEvents(resolved.events),\n  })\n""",
    """    nextSnapshot: resolved.state,\n    events: translateSurrenderEvents(resolved.events),\n    privacyJournal: null,\n  })\n""",
    'ai surrender commit',
)
write(path, text)

# Practice abort is an explicit public system commit.
path, text = read('battle-abort-service.ts')
text = replace_once(
    text,
    """          nextSnapshot: current.snapshot,\n          events: [],\n        })\n""",
    """          nextSnapshot: current.snapshot,\n          events: [],\n          privacyJournal: null,\n        })\n""",
    'abort replay',
)
text = replace_once(
    text,
    """        nextSnapshot: resolved.state,\n        events: resolved.events,\n      })\n""",
    """        nextSnapshot: resolved.state,\n        events: resolved.events,\n        privacyJournal: null,\n      })\n""",
    'abort commit',
)
write(path, text)

# Final-turn can emit lifecycle facts, so preserve event-level privacy.
path, text = read('battle-final-turn-service.ts')
text = add_import(
    text,
    "import type { BattleSessionProjection, BattleSessionView } from './battle-session-service'\n",
    'final-turn import',
)
text = replace_once(
    text,
    """          nextSnapshot: current.snapshot,\n          events: [],\n        })\n""",
    """          nextSnapshot: current.snapshot,\n          events: [],\n          privacyJournal: null,\n        })\n""",
    'final-turn replay',
)
text = replace_once(
    text,
    """      const resolved = resolveFinalTurn(state, command.facing)\n      const nextState = preserveFrozenBuildMetadata(state, resolved.state)\n      const committed = await battles.commitBattleIntent({\n""",
    """      const resolved = resolveFinalTurn(state, command.facing)\n      const nextState = preserveFrozenBuildMetadata(state, resolved.state)\n      const privacyJournal = buildBattlePrivacyJournalInput({\n        before: state,\n        after: resolved.state,\n        commandKind: 'system',\n        events: resolved.events,\n      })\n      const committed = await battles.commitBattleIntent({\n""",
    'final-turn resolve',
)
text = replace_once(
    text,
    """        nextSnapshot: nextState,\n        events: resolved.events,\n      })\n""",
    """        nextSnapshot: nextState,\n        events: resolved.events,\n        privacyJournal,\n      })\n""",
    'final-turn commit',
)
write(path, text)

# Recruit AI: hidden only for Covert action commands; movement/end-turn stay public.
path, text = read('battle-recruit-ai-service.ts')
text = add_import(text, 'const MAX_RECRUIT_DECISIONS_PER_REQUEST = 16\n', 'recruit import')
text = replace_once(
    text,
    """        const nextState = preserveFrozenBuildMetadata(state, resolved.state)\n        const event = decisionEvent(decision, turn.combatantId)\n        const requestFingerprint = fingerprint({\n""",
    """        const nextState = preserveFrozenBuildMetadata(state, resolved.state)\n        const event = decisionEvent(decision, turn.combatantId)\n        const committedEvents = [event, ...resolved.events]\n        const privacyJournal = buildBattlePrivacyJournalInput({\n          before: state,\n          after: resolved.state,\n          commandKind:\n            decision.intent.kind === 'action'\n              ? 'action'\n              : decision.intent.kind === 'move'\n                ? 'move'\n                : 'system',\n          events: committedEvents,\n        })\n        const requestFingerprint = fingerprint({\n""",
    'recruit resolve',
)
text = replace_once(
    text,
    """          nextSnapshot: nextState,\n          events: [event, ...resolved.events],\n        })\n""",
    """          nextSnapshot: nextState,\n          events: committedEvents,\n          privacyJournal,\n        })\n""",
    'recruit commit',
)
write(path, text)

# Normal player intent is the primary command-identity privacy authority.
path, text = read('battle-session-service.ts')
text = add_import(
    text,
    "import { battleActionResourceIssue } from './battle-action-resource-availability'\n",
    'session import',
)
text = replace_once(
    text,
    """      assertPlayerControlledTurn(state, current.controlledCombatantIds)\n      const resolved = resolveIntent(state, command.intent)\n      const committed = await battles.commitBattleIntent({\n""",
    """      assertPlayerControlledTurn(state, current.controlledCombatantIds)\n      const resolved = resolveIntent(state, command.intent)\n      const privacyJournal = buildBattlePrivacyJournalInput({\n        before: state,\n        after: resolved.state,\n        commandKind:\n          command.intent.kind === 'action'\n            ? 'action'\n            : command.intent.kind === 'move'\n              ? 'move'\n              : command.intent.kind === 'face'\n                ? 'face'\n                : 'system',\n        events: resolved.events,\n      })\n      const committed = await battles.commitBattleIntent({\n""",
    'session resolve',
)
text = replace_once(
    text,
    """        nextSnapshot: resolved.state,\n        events: resolved.events,\n      })\n""",
    """        nextSnapshot: resolved.state,\n        events: resolved.events,\n        privacyJournal,\n      })\n""",
    'session commit',
)
write(path, text)

# Guided completion is public and carries no hidden action identity.
path, text = read('guided-training-completion-service.ts')
text = replace_once(
    text,
    """        events: [\n          {\n            event: 'guided_training_completed',\n            combatantId: controlled,\n            criteria: [...GUIDED_TRAINING_CRITERIA],\n          },\n          { event: 'battle_completed', winningTeamId: 'players', completionKind: 'training' },\n        ],\n      })\n""",
    """        events: [\n          {\n            event: 'guided_training_completed',\n            combatantId: controlled,\n            criteria: [...GUIDED_TRAINING_CRITERIA],\n          },\n          { event: 'battle_completed', winningTeamId: 'players', completionKind: 'training' },\n        ],\n        privacyJournal: null,\n      })\n""",
    'guided completion',
)
write(path, text)

# PvP timeout can emit lifecycle facts; surrender remains explicitly public.
path, text = read('pvp-battle-quality-service.ts')
text = add_import(
    text,
    "import {\n  createBattleSessionService,\n  projectCommittedBattleSession,\n  type BattleSessionView,\n} from './battle-session-service'\n",
    'pvp quality import',
)
text = replace_once(
    text,
    """  const resolved = timeoutPvpTurn(state)\n  const timeoutIdentity = {\n""",
    """  const resolved = timeoutPvpTurn(state)\n  const privacyJournal = buildBattlePrivacyJournalInput({\n    before: state,\n    after: resolved.state,\n    commandKind: 'system',\n    events: resolved.events,\n  })\n  const timeoutIdentity = {\n""",
    'pvp timeout resolve',
)
text = replace_once(
    text,
    """      nextSnapshot: resolved.state,\n      events: resolved.events,\n    })\n""",
    """      nextSnapshot: resolved.state,\n      events: resolved.events,\n      privacyJournal,\n    })\n""",
    'pvp timeout commit',
)
text = replace_once(
    text,
    """      nextSnapshot: resolved.state,\n      events: resolved.events,\n    })\n    return projectCommittedBattleSession(committed, current.controlledCombatantIds)\n""",
    """      nextSnapshot: resolved.state,\n      events: resolved.events,\n      privacyJournal: null,\n    })\n    return projectCommittedBattleSession(committed, current.controlledCombatantIds)\n""",
    'pvp surrender commit',
)
write(path, text)
