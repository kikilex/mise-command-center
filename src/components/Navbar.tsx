'use client'

import { useState } from 'react'
import { Button, Avatar } from "@heroui/react"
import { usePathname } from 'next/navigation'
import UserMenu from './UserMenu'
import BusinessSelector from './BusinessSelector'

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

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/notes', label: 'Notes' },
  { href: '/content', label: 'Content' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/business', label: 'Business' },
  { href: '/ai', label: 'AI Workspace' },
  { href: '/family', label: 'Family' },
  { href: '/settings', label: 'Settings' },
]

export default function Navbar({ user, actions }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Left: Hamburger (mobile) + Brand + Business Selector */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button 
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            
            {/* Brand */}
            <a href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              <span className="font-semibold text-slate-800 text-lg hidden sm:block">Mise</span>
            </a>
            
            {/* Business Selector - show on desktop */}
            <div className="hidden md:block ml-2">
              <BusinessSelector />
            </div>
          </div>

          {/* Center: Desktop navigation */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/50 rounded-xl p-1">
            {navItems.map((item) => (
              <a 
                key={item.href}
                href={item.href} 
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive(item.href)
                    ? 'bg-white shadow-sm text-slate-800'
                    : 'text-slate-600 hover:bg-white/50'
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Right: Actions + Avatar */}
          <div className="flex items-center gap-2">
            {/* Page-specific actions */}
            {actions}
            
            {/* Notifications (hidden on small screens) */}
            <Button isIconOnly variant="light" className="hidden sm:flex text-slate-500">
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
        <div className="lg:hidden bg-white border-t border-slate-100 py-4 px-4 shadow-lg">
          {/* Mobile Business Selector */}
          <div className="mb-4 pb-4 border-b border-slate-100">
            <p className="text-xs text-slate-500 mb-2 px-1">Current Context</p>
            <BusinessSelector />
          </div>
          
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <a 
                key={item.href}
                href={item.href} 
                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-violet-50 text-violet-600'
                    : 'text-slate-700 hover:bg-violet-50 hover:text-violet-600'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
