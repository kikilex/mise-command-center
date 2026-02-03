'use client'

import { useState, useMemo } from 'react'
import * as LucideIcons from 'lucide-react'
import { 
  Input, 
  Button, 
  ScrollShadow,
  Popover,
  PopoverTrigger,
  PopoverContent
} from '@heroui/react'
import { Search, X } from 'lucide-react'

interface IconPickerProps {
  value: string
  onChange: (iconName: string) => void
}

// Filter out non-icon exports
const iconNames = Object.keys(LucideIcons).filter(
  key => typeof (LucideIcons as any)[key] === 'function' && 
  key !== 'createLucideIcon' && 
  /^[A-Z]/.test(key) // Starts with uppercase
)

export default function IconPicker({ value, onChange }: IconPickerProps) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const filteredIcons = useMemo(() => {
    if (!search) return iconNames.slice(0, 100) // Show first 100 by default
    return iconNames.filter(name => 
      name.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 100)
  }, [search])

  const SelectedIcon = (LucideIcons as any)[value] || LucideIcons.HelpCircle

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen} placement="bottom">
      <PopoverTrigger>
        <Button 
          variant="flat" 
          className="w-14 h-14 min-w-[56px] rounded-2xl bg-slate-100 dark:bg-slate-800"
          isIconOnly
        >
          <SelectedIcon className="w-6 h-6 text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-80">
        <div className="flex flex-col h-96">
          <div className="p-3 border-b border-divider bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
            <Input
              size="sm"
              placeholder="Search icons..."
              value={search}
              onValueChange={setSearch}
              startContent={<Search className="w-4 h-4 text-slate-400" />}
              isClearable
              onClear={() => setSearch('')}
              autoFocus
            />
          </div>
          <ScrollShadow className="flex-1 p-2">
            <div className="grid grid-cols-5 gap-1">
              {filteredIcons.map((name) => {
                const Icon = (LucideIcons as any)[name]
                return (
                  <Button
                    key={name}
                    isIconOnly
                    variant={value === name ? 'solid' : 'light'}
                    color={value === name ? 'primary' : 'default'}
                    className="w-full h-12 rounded-xl"
                    onPress={() => {
                      onChange(name)
                      setIsOpen(false)
                    }}
                    title={name}
                  >
                    <Icon className="w-5 h-5" />
                  </Button>
                )
              })}
              {filteredIcons.length === 0 && (
                <div className="col-span-5 py-8 text-center text-xs text-slate-500">
                  No icons found.
                </div>
              )}
            </div>
          </ScrollShadow>
        </div>
      </PopoverContent>
    </Popover>
  )
}
