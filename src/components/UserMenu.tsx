'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Dropdown, 
  DropdownTrigger, 
  DropdownMenu, 
  DropdownItem,
  Avatar,
  User
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'

interface UserMenuProps {
  user: {
    email: string
    name?: string
    avatar_url?: string
  }
}

export default function UserMenu({ user }: UserMenuProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
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
        <DropdownItem key="profile" className="h-14 gap-2" textValue="profile">
          <p className="font-semibold">{user.name || 'User'}</p>
          <p className="text-sm text-slate-500">{user.email}</p>
        </DropdownItem>
        <DropdownItem key="settings" textValue="settings">
          Settings
        </DropdownItem>
        <DropdownItem 
          key="logout" 
          color="danger" 
          onPress={handleLogout}
          textValue="logout"
        >
          {loading ? 'Signing out...' : 'Sign Out'}
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )
}
