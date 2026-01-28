'use client'

import { HeroUIProvider } from '@heroui/react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { useRouter } from 'next/navigation'
import { BusinessProvider } from '@/lib/business-context'
import { MenuSettingsProvider } from '@/lib/menu-settings'

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={true}
      storageKey="mise-theme"
    >
      <HeroUIProvider navigate={router.push}>
        <BusinessProvider>
          <MenuSettingsProvider>
            {children}
          </MenuSettingsProvider>
        </BusinessProvider>
      </HeroUIProvider>
    </NextThemesProvider>
  )
}
