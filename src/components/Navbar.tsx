'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { Button, Avatar, Spinner } from "@heroui/react"
import { usePathname } from 'next/navigation'
import UserMenu from './UserMenu'
import NotificationBell from './NotificationBell'
import { useMenuSettings } from '@/lib/menu-settings'
import { navIcons, Menu, X } from '@/lib/icons'
import { createClient } from '@/lib/supabase/client'

interface UserData {
  id?: string
  email: string
  name?: string
  avatar_url?: string
  role?: string
}

interface NavbarProps {
  user?: UserData | null
  actions?: React.ReactNode
  onOpenTask?: (taskId: string) => void
}

export default function Navbar({ user: propUser, actions, onOpenTask }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [user, setUser] = useState<UserData | null>(propUser || null)
  const [loading, setLoading] = useState(!propUser)
  const pathname = usePathname()
  const { getActiveNavItems, loading: menuLoading } = useMenuSettings()
  const supabase = createClient()

  // Fetch user data if not provided
  useEffect(() => {
    async function fetchUser() {
      if (propUser !== undefined) {
        // User prop was provided (could be null or user object)
        setUser(propUser)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !authUser) {
          setUser(null)
          setLoading(false)
          return
        }

        // Fetch user profile
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()

        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: profile?.name || authUser.email?.split('@')[0],
          avatar_url: profile?.avatar_url,
          role: profile?.role || 'member'
        })
      } catch (error) {
        console.error('Failed to fetch user for navbar:', error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [propUser, supabase])

  // Get nav items based on current mode from user settings
  const navItems = useMemo(() => {
    return getActiveNavItems(false).map(item => ({
      key: item.key,
      href: item.href,
      label: item.label,
      icon: item.icon,
      iconOnly: (item as any).iconOnly || false,
    }))
  }, [getActiveNavItems])

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
          {/* Left: Hamburger (mobile) + Brand */}
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
          </div>

          {/* Center: Desktop navigation */}
          <nav className="hidden lg:flex items-center gap-1 bg-default-100 rounded-xl p-1">
            {navItems.map((item) => (
              <Link 
                key={item.key}
                href={item.href} 
                className={`${item.iconOnly ? 'px-2' : 'px-3'} py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap min-h-[36px] flex items-center gap-2 ${
                  isActive(item.href)
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-default-600 hover:bg-background/50'
                }`}
                title={item.iconOnly ? 'Home' : item.label}
              >
                {renderIcon(item.icon, "w-4 h-4")}
                {!item.iconOnly && <span className="hidden xl:inline">{item.label}</span>}
              </Link>
            ))}
          </nav>

          {/* Right: Actions + Avatar */}
          <div className="flex items-center gap-2">
            {/* Page-specific actions */}
            {actions}
            
            {/* Notifications Bell - Always clickable */}
            <NotificationBell 
              userId={user?.id} 
              onNotificationClick={onOpenTask}
            />
            
            {loading ? (
              <Spinner size="sm" />
            ) : user ? (
              <UserMenu user={user} />
            ) : (
              <Link href="/login">
                <Avatar 
                  size="sm"
                  className="ring-2 ring-white shadow-md cursor-pointer"
                  as="button"
                />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {isMenuOpen && (
        <div className="lg:hidden bg-background border-t border-divider py-4 px-4 shadow-lg">
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
