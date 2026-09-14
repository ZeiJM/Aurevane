"""Apply only the exact locally tested combat batch on its isolated feature branch."""
import base64
import hashlib
from pathlib import Path
import subprocess
import zlib

BASE = '57b683cb6c60a800f2938badc9d7e7c38ff0f640'
PATCH_SHA256 = 'ea01363551d553d9ba75f39fad97baf53b851c592fc509885dde7dda28bff3c0'
EXPECTED = {
    'TASKS.md': '50ef2ae18b9601e918e60665ec7ebe6dded38ede1c8899908784f5ad183bbb46',
    'apps/web/src/components/battle/battle-action-preview.test.tsx': 'd445f02848eab8a5c2e0a3e6ebdfde590970536b5184791ce6a9d68a95096d56',
    'apps/web/src/components/battle/battle-effect-summary.test.ts': 'a55878a6533de7be25c05b7757c03ad0a575248b213e68a2a8de7aa2abf5bec9',
    'apps/web/src/components/battle/battle-effect-summary.ts': '3c5a9339c97c1ebf412c574190f02c23a2f96e7106c3b9b8a06d4d7ac10312fe',
    'apps/web/src/components/battle/battle-geometry.test.ts': '9ca95f4e0a105c9dc68fe4c496275db36b3a0608fa6eb0e3c518f6c800699975',
    'apps/web/src/components/battle/battle-geometry.ts': '53af5069d7d122ec375691729415b7bc40c7b6bda533df1825bd65a1033d8848',
    'apps/web/src/components/character/skill-detail-presentation.test.ts': '9c2bf30429404bfbf29f0f65de0b805cc2d02d4a517bb5db775e2d158b7c7336',
    'apps/web/src/components/character/skill-detail-presentation.ts': '387d2a8c09c9010249a0f74220b11b12722061ebba1c1c31b30a6d59ed23078f',
    'apps/web/src/lib/battle/combat-interaction-presentation.test.ts': 'eb3adf63582d7dabe119843fde17315f721d8b9f723cc52ae58cb25c26c6880f',
    'apps/web/src/lib/battle/combat-interaction-presentation.ts': '763f783c263c1b6428bb6496fc52ff1d7d1011b269e4968c1b42d0db1a083394',
    'docs/COMBAT.md': 'f510d44f81443b9819b8f3d8d8d61a8b2cff5ba0fcc94ac52e0d75fae13cc8de',
    'docs/superpowers/plans/2026-09-13-combat-runtime-effects-discipline-rebalance.md': '407c1a75bf4aee4d971c0e4876c2cb8da96c84c3665e37c00140d012ea0b0301',
    'packages/game-core/src/combat/actions.ts': 'e33dca44b2f4b4462ed3c7d8589f35480fb62cb03bb72ea6a095ae9fd61bd09d',
    'packages/game-core/src/combat/board.ts': '294687f64a1d50d1eb20780b51ac38fa7af0f55e169db59370f937402317c8f6',
    'packages/game-core/src/combat/combat-authoring-validation.ts': '4dd125c1de15243b65ebfa777b58b46327a89ba991f492ea4bca88e5805ec31d',
    'packages/game-core/src/combat/combat-displacement-tempo-rework.test.ts': '5db4ec66d9b3ec13146da0a78c890a9e884fa0995b1256bd6099497be370e036',
    'packages/game-core/src/combat/combat-recovery-rework.test.ts': '90404fb50521ed9bc9526ae29a3196345fe939902ca2c1cb526e6a663025695e',
    'packages/game-core/src/combat/combat-recovery.ts': 'acac51154f82d0543df6fb6c6fe7f0a1969cc33fbfe5d52056474527c1cfd528',
    'packages/game-core/src/combat/gameplay-tags.test.ts': '9f4fd2258d5e14978de858b5e9280158d55c0341168d099a883513298e1a80fa',
    'packages/game-core/src/combat/gameplay-tags.ts': 'ff2df3b61540bd7ea481fcdc31787276d97829c4d03d261ef504dde20e95052d',
    'packages/game-core/src/combat/pv1f-action-economy.ts': '417ee80ad2001f56691e2b87a5366a99e85e274b416a9c08e0e2a0cc5155b5de',
    'packages/game-core/src/combat/pv1f-skills.ts': '7939266dae7f3a9f7a5f26297b400252c5bc180c74b8a1bcb903efda7d93d907',
}

subprocess.run(['git', 'diff', '--exit-code', BASE, 'HEAD', '--', *EXPECTED], check=True)
encoded = ''.join(Path(f'.github/combat-batch.part{i}').read_text().strip() for i in range(1, 4))
patch = zlib.decompress(base64.b64decode(encoded, validate=True))
if hashlib.sha256(patch).hexdigest() != PATCH_SHA256:
    raise RuntimeError('Combat patch digest mismatch; refusing to apply.')
paths = {line.split(' b/', 1)[1] for line in patch.decode().splitlines() if line.startswith('diff --git a/')}
if paths != set(EXPECTED):
    raise RuntimeError(f'Unexpected patch paths: {paths ^ set(EXPECTED)}')
subprocess.run(['git', 'apply', '--check', '--index', '-'], input=patch, check=True)
subprocess.run(['git', 'apply', '--index', '-'], input=patch, check=True)
for path, digest in EXPECTED.items():
    if hashlib.sha256(Path(path).read_bytes()).hexdigest() != digest:
        raise RuntimeError(f'Applied file differs from tested file: {path}')
print(f'Applied {len(EXPECTED)} exact verified combat files. Full repository checks must pass before commit.')
