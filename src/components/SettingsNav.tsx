'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Settings, Bell, Palette, Building } from 'lucide-react'

const settingsLinks = [
  {
    href: '/settings',
    label: 'General',
    icon: Settings,
  },
  {
    href: '/settings/team',
    label: 'Team',
    icon: Users,
  },
  {
    href: '/settings/notifications',
    label: 'Notifications',
    icon: Bell,
  },
  {
    href: '/settings/appearance',
    label: 'Appearance',
    icon: Palette,
  },
  {
    href: '/settings/spaces',
    label: 'Spaces',
    icon: Building,
  },
]

export default function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="space-y-1">
      {settingsLinks.map((link) => {
        const Icon = link.icon
        const isActive = pathname === link.href || 
          (link.href === '/settings' && pathname === '/settings') ||
          (link.href !== '/settings' && pathname?.startsWith(link.href))

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActive
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary font-medium'
                : 'text-default-600 hover:bg-default-100 dark:hover:bg-default-800 hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{link.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}