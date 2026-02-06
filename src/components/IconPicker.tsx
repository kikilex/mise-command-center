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
import { Search } from 'lucide-react'

interface IconPickerProps {
  value: string
  onChange: (iconName: string) => void
}

// Curated list of useful icons for spaces
const iconNames = [
  // General
  'Layout', 'Grid', 'Layers', 'Box', 'Package', 'Archive', 'Folder', 'FolderOpen',
  // Business
  'Briefcase', 'Building', 'Building2', 'Store', 'ShoppingBag', 'ShoppingCart', 'CreditCard', 'Wallet',
  'DollarSign', 'TrendingUp', 'BarChart', 'PieChart', 'LineChart', 'Target', 'Award', 'Trophy',
  // People
  'User', 'Users', 'UserCircle', 'Heart', 'Home', 'House',
  // Communication
  'Mail', 'MessageSquare', 'MessageCircle', 'Phone', 'Video', 'Mic', 'Speaker',
  // Content
  'FileText', 'File', 'Files', 'BookOpen', 'Book', 'Notebook', 'Pencil', 'PenTool',
  // Creative
  'Palette', 'Camera', 'Image', 'Film', 'Music', 'Headphones', 'Youtube', 'Instagram',
  // Tech
  'Code', 'Terminal', 'Database', 'Server', 'Cloud', 'Globe', 'Wifi', 'Smartphone',
  'Monitor', 'Laptop', 'Cpu', 'HardDrive', 'Settings', 'Wrench', 'Tool',
  // Nature
  'Sun', 'Moon', 'Star', 'Sparkles', 'Zap', 'Flame', 'Leaf', 'Trees',
  // Objects
  'Key', 'Lock', 'Unlock', 'Shield', 'Flag', 'Bookmark', 'Tag', 'Hash',
  'Calendar', 'Clock', 'Timer', 'Bell', 'AlarmClock',
  // Actions
  'Play', 'Pause', 'CirclePlay', 'Rocket', 'Send', 'Download', 'Upload', 'Share',
  // Religious / Spiritual
  'Church', 'Cross', 'Sparkle', 'Sunrise', 'Sunset',
  // Shapes
  'Circle', 'Square', 'Triangle', 'Hexagon', 'Pentagon', 'Octagon',
  // Misc
  'Coffee', 'Pizza', 'Gift', 'PartyPopper', 'Gamepad', 'Dumbbell', 'Plane', 'Car',
  'Lightbulb', 'Brain', 'Eye', 'Glasses', 'Compass', 'Map', 'Navigation',
]

export default function IconPicker({ value, onChange }: IconPickerProps) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const filteredIcons = useMemo(() => {
    if (!search) return iconNames
    return iconNames.filter(name => 
      name.toLowerCase().includes(search.toLowerCase())
    )
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
