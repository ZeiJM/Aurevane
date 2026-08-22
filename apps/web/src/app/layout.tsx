import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import '@aurevane/ui/styles.css'

import { AudioProvider } from '@/components/audio/audio-provider'

import './globals.css'
import './pv1e-shell-fixes.css'
import './a3-battle-polish.css'
import './battle-quality-overrides.css'
import './mobile-ui-batch.css'
import './pvp-battle-batch-overrides.css'
import './lobby-mobile-final.css'
import './character-creation-scale.css'
import './character-select-short-height-fit.css'
import './portrait-ratio-standardization.css'
import './authenticated-header-mobile.css'

export const metadata: Metadata = {
  title: 'AUREVANE',
  description: 'A persistent online tactical fantasy RPG.',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AudioProvider>{children}</AudioProvider>
      </body>
    </html>
  )
}
