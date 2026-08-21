import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import '@aurevane/ui/styles.css'

import { AudioProvider } from '@/components/audio/audio-provider'

import './globals.css'
import './pv1e-shell-fixes.css'
import './a3-battle-polish.css'
import './battle-quality-overrides.css'
import './mobile-ui-batch.css'
import './character-creation-scale.css'

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
