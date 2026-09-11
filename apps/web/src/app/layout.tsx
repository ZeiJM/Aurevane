import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import '@aurevane/ui/styles.css'

import { AudioProvider } from '@/components/audio/audio-provider'

import './globals.css'
import './pv1e-shell-fixes.css'
import './mobile-ui-batch.css'
import './character-creation-scale.css'
import './character-select-short-height-fit.css'
import './portrait-ratio-standardization.css'
import './authenticated-header-mobile.css'
import './desktop-readability.css'
import './desktop-page-fit.css'
import './mobile-readability.css'

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
