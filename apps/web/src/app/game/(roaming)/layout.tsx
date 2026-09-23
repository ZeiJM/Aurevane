import type { ReactNode } from 'react'

import { AuthenticatedShellFrame } from '@/components/shell/authenticated-game-shell'

export default function RoamingLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AuthenticatedShellFrame>{children}</AuthenticatedShellFrame>
}
