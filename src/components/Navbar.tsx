'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Button, Avatar } from "@heroui/react"
import { usePathname } from 'next/navigation'
import UserMenu from './UserMenu'
import BusinessSelector from './BusinessSelector'
import NotificationBell from './NotificationBell'
import { useBusiness } from '@/lib/business-context'
import { useMenuSettings } from '@/lib/menu-settings'
import { navIcons, Menu, X } from '@/lib/icons'

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
  onOpenTask?: (taskId: string) => void
}

export default function Navbar({ user, actions, onOpenTask }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()
  const { selectedBusiness } = useBusiness()
  const { getActiveNavItems, loading: menuLoading } = useMenuSettings()

  // Determine if we're in business mode (a business is selected)
  const isBusinessMode = selectedBusiness !== null

  // Get nav items based on current mode from user settings
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

  const renderIcon = (iconKey: string, className: string = "w-5 h-5") => {
    const IconComponent = navIcons[iconKey]
    if (IconComponent) {
      return <IconComponent className={className} />
    }
    return null
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
              {isMenuOpen ? (
                <X className="w-6 h-6 text-default-600" />
              ) : (
                <Menu className="w-6 h-6 text-default-600" />
              )}
            </button>
            
            {/* Brand */}
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              <span className="font-semibold text-foreground text-lg hidden sm:block">Mise</span>
            </Link>
            
            {/* Business Selector - show on desktop */}
            <div className="hidden md:block ml-2">
              <BusinessSelector />
            </div>
          </div>

          {/* Center: Desktop navigation */}
          <nav className="hidden lg:flex items-center gap-1 bg-default-100 rounded-xl p-1">
            {navItems.map((item) => (
              <Link 
                key={item.key}
                href={item.href} 
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap min-h-[36px] flex items-center gap-2 ${
                  isActive(item.href)
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-default-600 hover:bg-background/50'
                }`}
              >
                {renderIcon(item.icon, "w-4 h-4")}
                <span className="hidden xl:inline">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Right: Actions + Avatar */}
          <div className="flex items-center gap-2">
            {/* Page-specific actions */}
            {actions}
            
            {/* Notifications Bell */}
            <NotificationBell 
              userId={user?.id} 
              onNotificationClick={onOpenTask}
            />
            
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
              <Link 
                key={item.key}
                href={item.href} 
                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors min-h-[44px] flex items-center gap-3 ${
                  isActive(item.href)
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary'
                    : 'text-foreground hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {renderIcon(item.icon, "w-5 h-5")}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
