'use client'

import { Provider } from 'jotai'
import { SessionProvider } from 'next-auth/react'
import type { ReactNode } from 'react'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <Provider>{children}</Provider>
    </SessionProvider>
  )
}
