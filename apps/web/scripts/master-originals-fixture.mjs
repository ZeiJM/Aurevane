// Read actual executable originals for the disposable native SQL proof. No
// independently authored fixture definitions or historical publication rows.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const ts = require('typescript')
require.extensions['.ts'] = (module, filename) =>
  module._compile(
    ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  )
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const { defaultBasicSkills } = require(
  resolve(root, 'packages/game-core/src/combat/combat-basic-actions.ts'),
)
process.stdout.write(JSON.stringify(defaultBasicSkills()))
