'use client'

import { HeroUIProvider } from '@heroui/react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { useRouter } from 'next/navigation'
import { BusinessProvider } from '@/lib/business-context'

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
    >
      <HeroUIProvider navigate={router.push}>
        <BusinessProvider>
          {children}
        </BusinessProvider>
      </HeroUIProvider>
    </NextThemesProvider>
  )
}
