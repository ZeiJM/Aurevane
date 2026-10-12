import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: [
      'src/components/battle/battle-experience-v2.tsx',
      'src/components/battle/battle-log-panel.tsx',
      'src/components/battle/pvp-battle-experience.tsx',
      'src/components/battle/pvp-lobby-modal.tsx',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])
