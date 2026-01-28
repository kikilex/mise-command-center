'use client'

import { useState, useMemo } from 'react'
import { Button, Avatar } from "@heroui/react"
import { usePathname } from 'next/navigation'
import UserMenu from './UserMenu'
import BusinessSelector from './BusinessSelector'
import { useBusiness } from '@/lib/business-context'
import { useMenuSettings } from '@/lib/menu-settings'

interface UserData {
  id?: string
  email: string
  name?: string
  avatar_url?: string
  role?: string
}

interface NavbarProps {
  user: UserData | null
  actions?: React.ReactNode
}

export default function Navbar({ user, actions }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()
  const { selectedBusiness } = useBusiness()
  const { getActiveNavItems, loading: menuLoading } = useMenuSettings()

  // Determine if we're in business mode (a business is selected)
  const isBusinessMode = selectedBusiness !== null

  // Get nav items based on current mode from user settings (no settings in nav)
  const navItems = useMemo(() => {
    return getActiveNavItems(isBusinessMode).map(item => ({
      key: item.key,
      href: item.href,
      label: item.label,
      icon: item.icon,
    }))
  }, [getActiveNavItems, isBusinessMode])

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  return (
    <header className="bg-background/80 backdrop-blur-sm border-b border-divider sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Left: Hamburger (mobile) + Brand + Business Selector */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button 
              className="lg:hidden p-2 rounded-lg hover:bg-default-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6 text-default-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            
            {/* Brand */}
            <a href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              <span className="font-semibold text-foreground text-lg hidden sm:block">Mise</span>
            </a>
            
            {/* Business Selector - show on desktop */}
            <div className="hidden md:block ml-2">
              <BusinessSelector />
            </div>
          </div>

          {/* Center: Desktop navigation */}
          <nav className="hidden lg:flex items-center gap-1 bg-default-100 rounded-xl p-1">
            {navItems.map((item) => (
              <a 
                key={item.key}
                href={item.href} 
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap min-h-[36px] flex items-center gap-1.5 ${
                  isActive(item.href)
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-default-600 hover:bg-background/50'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span className="hidden xl:inline">{item.label}</span>
              </a>
            ))}
          </nav>

          {/* Right: Actions + Avatar */}
          <div className="flex items-center gap-2">
            {/* Page-specific actions */}
            {actions}
            
            {/* Notifications (hidden on small screens) */}
            <Button isIconOnly variant="light" className="hidden sm:flex text-default-500 min-w-[44px] min-h-[44px]">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </Button>
            
            {user ? (
              <UserMenu user={user} />
            ) : (
              <Avatar 
                size="sm"
                className="ring-2 ring-white shadow-md"
              />
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {isMenuOpen && (
        <div className="lg:hidden bg-background border-t border-divider py-4 px-4 shadow-lg">
          {/* Mobile Business Selector */}
          <div className="mb-4 pb-4 border-b border-divider">
            <p className="text-xs text-default-500 mb-2 px-1">Current Context</p>
            <BusinessSelector />
          </div>
          
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <a 
                key={item.key}
                href={item.href} 
                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors min-h-[44px] flex items-center gap-3 ${
                  isActive(item.href)
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary'
                    : 'text-foreground hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
