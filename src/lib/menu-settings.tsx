'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface MenuConfig {
  personal: string[]
  business: string[]
  hiddenItems?: string[]  // Admin-controlled hidden items per user
}

export const DEFAULT_MENU_CONFIG: MenuConfig = {
  personal: ['dashboard', 'spaces', 'tasks', 'docs', 'calendar', 'ai'],
  business: ['dashboard', 'spaces', 'tasks', 'content', 'docs', 'calendar', 'ai'],
  hiddenItems: [],  // Admin can set this per-user to hide specific menu items
}

export const PERSONAL_MENU_OPTIONS = [
  { key: 'dashboard', label: '', icon: 'dashboard', href: '/', iconOnly: true },
  { key: 'spaces', label: 'Spaces', icon: 'spaces', href: '/spaces' },
  { key: 'tasks', label: 'Tasks', icon: 'tasks', href: '/tasks' },
  { key: 'docs', label: 'Docs', icon: 'docs', href: '/docs' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar', href: '/calendar' },
  { key: 'ai', label: 'AI', icon: 'ai', href: '/ai' },
]

export const BUSINESS_MENU_OPTIONS = [
  { key: 'dashboard', label: '', icon: 'dashboard', href: '/', iconOnly: true },
  { key: 'spaces', label: 'Spaces', icon: 'spaces', href: '/spaces' },
  { key: 'tasks', label: 'Tasks', icon: 'tasks', href: '/tasks' },
  { key: 'content', label: 'Content', icon: 'content', href: '/content' },
  { key: 'docs', label: 'Docs', icon: 'docs', href: '/docs' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar', href: '/calendar' },
  { key: 'ai', label: 'AI', icon: 'ai', href: '/ai' },
]

interface MenuSettingsContextType {
  menuConfig: MenuConfig
  loading: boolean
  userRole: string | null
  updateMenuConfig: (config: MenuConfig) => Promise<void>
  getActiveNavItems: (isBusinessMode: boolean) => { key: string; label: string; icon: string; href: string }[]
  refreshMenuSettings: () => Promise<void>
}

const MenuSettingsContext = createContext<MenuSettingsContextType | undefined>(undefined)

// Items that require admin/ai role
const ADMIN_ONLY_ITEMS = ['ai']

export function MenuSettingsProvider({ children }: { children: ReactNode }) {
  const [menuConfig, setMenuConfig] = useState<MenuConfig>(DEFAULT_MENU_CONFIG)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  
  const supabase = createClient()

  const loadMenuSettings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('users')
        .select('settings, role')
        .eq('id', user.id)
        .single()

      if (profile) {
        setUserRole(profile.role || 'member')
        
        if (profile.settings?.menus) {
          setMenuConfig({
            personal: profile.settings.menus.personal || DEFAULT_MENU_CONFIG.personal,
            business: profile.settings.menus.business || DEFAULT_MENU_CONFIG.business,
            hiddenItems: profile.settings.menus.hiddenItems || [],
          })
        }
      }
    } catch (error) {
      console.error('Failed to load menu settings:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadMenuSettings()
  }, [loadMenuSettings])

  async function updateMenuConfig(config: MenuConfig) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Get current settings
    const { data: profile, error: fetchError } = await supabase
      .from('users')
      .select('settings')
      .eq('id', user.id)
      .single()

    if (fetchError) throw fetchError

    // Merge with existing settings
    const updatedSettings = {
      ...(profile?.settings || {}),
      menus: config,
    }

    const { error } = await supabase
      .from('users')
      .update({ settings: updatedSettings })
      .eq('id', user.id)

    if (error) throw error

    setMenuConfig(config)
  }

  function getActiveNavItems(isBusinessMode: boolean) {
    const enabledKeys = isBusinessMode ? menuConfig.business : menuConfig.personal
    const options = isBusinessMode ? BUSINESS_MENU_OPTIONS : PERSONAL_MENU_OPTIONS
    const hiddenItems = menuConfig.hiddenItems || []
    const isAdmin = userRole === 'admin' || userRole === 'ai'
    
    // Filter by enabled keys, exclude admin-hidden items, and check role for admin-only items
    return options.filter(item => 
      enabledKeys.includes(item.key) && 
      !hiddenItems.includes(item.key) &&
      (!ADMIN_ONLY_ITEMS.includes(item.key) || isAdmin)
    )
  }

  return (
    <MenuSettingsContext.Provider
      value={{
        menuConfig,
        loading,
        userRole,
        updateMenuConfig,
        getActiveNavItems,
        refreshMenuSettings: loadMenuSettings,
      }}
    >
      {children}
    </MenuSettingsContext.Provider>
  )
}

export function useMenuSettings() {
  const context = useContext(MenuSettingsContext)
  if (context === undefined) {
    throw new Error('useMenuSettings must be used within a MenuSettingsProvider')
  }
  return context
}
