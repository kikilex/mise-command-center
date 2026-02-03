'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { 
  Dropdown, 
  DropdownTrigger, 
  DropdownMenu, 
  DropdownItem,
  DropdownSection,
  Avatar,
} from "@heroui/react"
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast } from '@/lib/errors'

interface UserMenuProps {
  user: {
    id?: string
    email: string
    name?: string
    avatar_url?: string
  }
}

type ThemeValue = 'light' | 'dark' | 'system'

export default function UserMenu({ user }: UserMenuProps) {
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogout = async () => {
    if (loading) return
    
    setLoading(true)
    
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        throw error
      }
      
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
      showErrorToast(error, 'Failed to sign out. Please try again.')
      setLoading(false)
    }
  }

  const handleThemeChange = async (newTheme: ThemeValue) => {
    setTheme(newTheme)
    
    // Save to Supabase if user is logged in
    if (user.id) {
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('settings')
          .eq('id', user.id)
          .single()

        const updatedSettings = {
          ...(profile?.settings || {}),
          theme: newTheme,
        }

        await supabase
          .from('users')
          .update({ settings: updatedSettings })
          .eq('id', user.id)
      } catch (error) {
        console.error('Failed to save theme preference:', error)
      }
    }
  }

  const getThemeIcon = () => {
    if (!mounted) return null
    switch (theme) {
      case 'light':
        return <SunIcon className="w-4 h-4" />
      case 'dark':
        return <MoonIcon className="w-4 h-4" />
      default:
        return <ComputerDesktopIcon className="w-4 h-4" />
    }
  }

  const getThemeLabel = () => {
    if (!mounted) return 'Theme'
    switch (theme) {
      case 'light':
        return 'Light'
      case 'dark':
        return 'Dark'
      default:
        return 'System'
    }
  }

  return (
    <Dropdown placement="bottom-end">
      <DropdownTrigger>
        <Avatar
          as="button"
          className="transition-transform"
          color="primary"
          name={user.name || user.email}
          size="sm"
          src={user.avatar_url}
        />
      </DropdownTrigger>
      <DropdownMenu aria-label="User menu">
        <DropdownSection showDivider>
          <DropdownItem key="profile" className="h-14 gap-2" textValue="profile" href="/profile">
            <p className="font-semibold">{user.name || 'User'}</p>
            <p className="text-sm text-default-500">{user.email}</p>
          </DropdownItem>
        </DropdownSection>
        
        <DropdownSection title="Theme" showDivider>
          <DropdownItem
            key="theme-light"
            startContent={<SunIcon className="w-4 h-4" />}
            onPress={() => handleThemeChange('light')}
            className={theme === 'light' ? 'text-primary' : ''}
          >
            Light
          </DropdownItem>
          <DropdownItem
            key="theme-dark"
            startContent={<MoonIcon className="w-4 h-4" />}
            onPress={() => handleThemeChange('dark')}
            className={theme === 'dark' ? 'text-primary' : ''}
          >
            Dark
          </DropdownItem>
          <DropdownItem
            key="theme-system"
            startContent={<ComputerDesktopIcon className="w-4 h-4" />}
            onPress={() => handleThemeChange('system')}
            className={theme === 'system' ? 'text-primary' : ''}
          >
            System
          </DropdownItem>
        </DropdownSection>

        <DropdownSection>
          <DropdownItem key="settings" textValue="settings" href="/settings">
            Settings
          </DropdownItem>
          <DropdownItem 
            key="logout" 
            color="danger" 
            onPress={handleLogout}
            textValue="logout"
            isDisabled={loading}
          >
            {loading ? 'Signing out...' : 'Sign Out'}
          </DropdownItem>
        </DropdownSection>
      </DropdownMenu>
    </Dropdown>
  )
}
