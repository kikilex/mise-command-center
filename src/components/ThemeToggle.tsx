'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
} from "@heroui/react"
import { Sun, Moon, Monitor } from 'lucide-react'

export type ThemeValue = 'light' | 'dark' | 'system'

interface ThemeToggleProps {
  onThemeChange?: (theme: ThemeValue) => void
}

export default function ThemeToggle({ onThemeChange }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeChange = (newTheme: ThemeValue) => {
    setTheme(newTheme)
    onThemeChange?.(newTheme)
  }

  if (!mounted) {
    return (
      <Button isIconOnly variant="light" size="sm" isDisabled>
        <div className="w-5 h-5" />
      </Button>
    )
  }

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="w-5 h-5" />
      case 'dark':
        return <Moon className="w-5 h-5" />
      default:
        return <Monitor className="w-5 h-5" />
    }
  }

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button isIconOnly variant="light" size="sm" aria-label="Toggle theme">
          {getIcon()}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Theme selection"
        selectionMode="single"
        selectedKeys={new Set([theme || 'system'])}
        onSelectionChange={(keys) => {
          const selected = Array.from(keys)[0] as ThemeValue
          handleThemeChange(selected)
        }}
      >
        <DropdownItem
          key="light"
          startContent={<Sun className="w-4 h-4" />}
        >
          Light
        </DropdownItem>
        <DropdownItem
          key="dark"
          startContent={<Moon className="w-4 h-4" />}
        >
          Dark
        </DropdownItem>
        <DropdownItem
          key="system"
          startContent={<Monitor className="w-4 h-4" />}
        >
          System
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  )
}

// Hook for using theme with Supabase sync
export function useThemeWithSync() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return {
    theme: mounted ? (theme as ThemeValue) : undefined,
    resolvedTheme: mounted ? resolvedTheme : undefined,
    setTheme: (newTheme: ThemeValue) => setTheme(newTheme),
    mounted,
  }
}
