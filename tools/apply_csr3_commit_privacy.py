from pathlib import Path

ROOT = Path('.')

FILES = [
    'apps/web/src/server/battle/ai-battle-quality-service.ts',
    'apps/web/src/server/battle/ai-battle-surrender-service.ts',
    'apps/web/src/server/battle/battle-abort-service.ts',
    'apps/web/src/server/battle/battle-final-turn-service.ts',
    'apps/web/src/server/battle/battle-recruit-ai-service.ts',
    'apps/web/src/server/battle/battle-session-service.ts',
    'apps/web/src/server/battle/guided-training-completion-service.ts',
    'apps/web/src/server/battle/pvp-battle-quality-service.ts',
]


def insert_public_privacy(text: str, path: str) -> tuple[str, int]:
    needle = 'commitBattleIntent({' 
    offset = 0
    count = 0
    while True:
        start = text.find(needle, offset)
        if start < 0:
            break
        brace = text.find('{', start)
        depth = 0
        quote = None
        escape = False
        line_comment = False
        block_comment = False
        i = brace
        end = None
        while i < len(text):
            ch = text[i]
            nxt = text[i + 1] if i + 1 < len(text) else ''
            if line_comment:
                if ch == '\n':
                    line_comment = False
                i += 1
                continue
            if block_comment:
                if ch == '*' and nxt == '/':
                    block_comment = False
                    i += 2
                    continue
                i += 1
                continue
            if quote:
                if escape:
                    escape = False
                elif ch == '\\':
                    escape = True
                elif ch == quote:
                    quote = None
                i += 1
                continue
            if ch == '/' and nxt == '/':
                line_comment = True
                i += 2
                continue
            if ch == '/' and nxt == '*':
                block_comment = True
                i += 2
                continue
            if ch in "'\"`":
                quote = ch
                i += 1
                continue
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    end = i
                    break
            i += 1
        if end is None:
            raise RuntimeError(f'Unclosed commitBattleIntent object in {path}')
        body = text[brace:end]
        if 'privacyJournal:' not in body:
            line_start = text.rfind('\n', 0, end) + 1
            closing_indent = text[line_start:end]
            property_indent = closing_indent + '  '
            text = text[:end] + f'\n{property_indent}privacyJournal: null,' + text[end:]
            end += len(f'\n{property_indent}privacyJournal: null,')
            count += 1
        offset = end + 1
    return text, count


for rel in FILES:
    path = ROOT / rel
    text = path.read_text()
    text, count = insert_public_privacy(text, rel)
    if count == 0:
        raise RuntimeError(f'Expected at least one unclassified commitBattleIntent call in {rel}')
    path.write_text(text)

# Player intent path: command-start state and exact resolved event batch are both available here.
path = ROOT / 'apps/web/src/server/battle/battle-session-service.ts'
text = path.read_text()
import_anchor = "import { battleActionResourceIssue } from './battle-action-resource-availability'\n"
privacy_import = "import {\n  buildBattlePrivacyJournalInput,\n  type BattlePrivacyCommandKind,\n} from './battle-history-privacy'\n"
if privacy_import not in text:
    if import_anchor not in text:
        raise RuntimeError('battle-session-service import anchor missing')
    text = text.replace(import_anchor, import_anchor + privacy_import, 1)
helper_anchor = "function invalidBattleIntent(\n"
helper = "function battleIntentPrivacyKind(kind: BattleIntent['kind']): BattlePrivacyCommandKind {\n  if (kind === 'action') return 'action'\n  if (kind === 'move') return 'move'\n  if (kind === 'face') return 'face'\n  return 'system'\n}\n\n"
if helper not in text:
    if helper_anchor not in text:
        raise RuntimeError('battle-session-service helper anchor missing')
    text = text.replace(helper_anchor, helper + helper_anchor, 1)
resolve_anchor = "      const resolved = resolveIntent(state, command.intent)\n      const committed = await battles.commitBattleIntent({\n"
resolve_replacement = "      const resolved = resolveIntent(state, command.intent)\n      const privacyJournal = buildBattlePrivacyJournalInput({\n        before: state,\n        after: resolved.state,\n        commandKind: battleIntentPrivacyKind(command.intent.kind),\n        events: resolved.events,\n      })\n      const committed = await battles.commitBattleIntent({\n"
if resolve_anchor not in text:
    raise RuntimeError('battle-session-service resolve anchor missing')
text = text.replace(resolve_anchor, resolve_replacement, 1)
if text.count('privacyJournal: null,') != 1:
    raise RuntimeError('Expected one player commit privacy placeholder')
text = text.replace('privacyJournal: null,', 'privacyJournal,', 1)
path.write_text(text)

# Recruit AI intent path: preserve the decision event inside the exact command batch.
path = ROOT / 'apps/web/src/server/battle/battle-recruit-ai-service.ts'
text = path.read_text()
import_anchor = "import { createHash, randomUUID } from 'node:crypto'\n\n"
privacy_import = "import {\n  buildBattlePrivacyJournalInput,\n  type BattlePrivacyCommandKind,\n} from './battle-history-privacy'\n"
if privacy_import not in text:
    if import_anchor not in text:
        raise RuntimeError('battle-recruit-ai-service import anchor missing')
    text = text.replace(import_anchor, import_anchor + privacy_import, 1)
helper_anchor = "function battleUnavailable(): AurevaneError {\n"
helper = "function recruitIntentPrivacyKind(kind: RecruitAiIntent['kind']): BattlePrivacyCommandKind {\n  if (kind === 'action') return 'action'\n  if (kind === 'move') return 'move'\n  if (kind === 'face') return 'face'\n  return 'system'\n}\n\n"
if helper not in text:
    if helper_anchor not in text:
        raise RuntimeError('battle-recruit-ai-service helper anchor missing')
    text = text.replace(helper_anchor, helper + helper_anchor, 1)
event_anchor = "        const event = decisionEvent(decision, turn.combatantId)\n        const requestFingerprint = fingerprint({\n"
event_replacement = "        const event = decisionEvent(decision, turn.combatantId)\n        const events = [event, ...resolved.events]\n        const privacyJournal = buildBattlePrivacyJournalInput({\n          before: state,\n          after: nextState,\n          commandKind: recruitIntentPrivacyKind(decision.intent.kind),\n          events,\n        })\n        const requestFingerprint = fingerprint({\n"
if event_anchor not in text:
    raise RuntimeError('battle-recruit-ai-service event anchor missing')
text = text.replace(event_anchor, event_replacement, 1)
old = "          events: [event, ...resolved.events],\n          privacyJournal: null,"
new = "          events,\n          privacyJournal,"
if old not in text:
    raise RuntimeError('battle-recruit-ai-service commit placeholder missing')
text = text.replace(old, new, 1)
path.write_text(text)

print('CSR-3 commit privacy patch applied')
