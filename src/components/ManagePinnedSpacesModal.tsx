'use client'

import { useState, useEffect } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react'
import { X, Pin } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'

interface Space {
  id: string
  name: string
  icon: string | null
  color: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  currentPinnedSpaces: Space[]
  spaceToAdd: Space | null
  onSuccess: () => void
}

export default function ManagePinnedSpacesModal({
  isOpen,
  onClose,
  currentPinnedSpaces,
  spaceToAdd,
  onSuccess,
}: Props) {
  const [pinnedSpaces, setPinnedSpaces] = useState<Space[]>([])
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    setPinnedSpaces(currentPinnedSpaces)
  }, [currentPinnedSpaces])

  const renderIcon = (iconName: string | null, fallbackName: string, color: string | null) => {
    const bgColor = color || '#3b82f6'
    
    if (iconName) {
      const Icon = (LucideIcons as any)[iconName]
      if (Icon) {
        return (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: bgColor }}
          >
            <Icon className="w-5 h-5" />
          </div>
        )
      }
    }
    
    return (
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-sm"
        style={{ backgroundColor: bgColor }}
      >
        {fallbackName.charAt(0).toUpperCase()}
      </div>
    )
  }

  const handleRemove = (spaceId: string) => {
    setPinnedSpaces(prev => prev.filter(s => s.id !== spaceId))
  }

  const handleSaveAndAdd = async () => {
    if (!spaceToAdd) return
    
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Get current settings
      const { data: userData } = await supabase
        .from('users')
        .select('settings')
        .eq('id', user.id)
        .single()

      const currentSettings = userData?.settings || {}
      
      // Build new pinned list: remaining + new space
      const newPinnedIds = [...pinnedSpaces.map(s => s.id), spaceToAdd.id]

      // Update settings
      const { error } = await supabase
        .from('users')
        .update({
          settings: {
            ...currentSettings,
            pinned_spaces: newPinnedIds,
          },
        })
        .eq('id', user.id)

      if (error) throw error

      showSuccessToast(`Pinned "${spaceToAdd.name}" to Quick Access`)
      
      // Dispatch event to refresh SpaceSwitcher
      window.dispatchEvent(new CustomEvent('pinned-spaces-updated'))
      
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error updating pinned spaces:', error)
      showErrorToast(error, 'Failed to update pinned spaces')
    } finally {
      setSaving(false)
    }
  }

  const removedCount = currentPinnedSpaces.length - pinnedSpaces.length
  const canAdd = pinnedSpaces.length < 5

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Pin className="w-5 h-5 text-violet-500" />
            <span>Manage Pinned Spaces</span>
          </div>
          <p className="text-sm font-normal text-default-500">
            You can pin up to 5 spaces. Remove one to add "{spaceToAdd?.name}".
          </p>
        </ModalHeader>
        
        <ModalBody>
          <div className="space-y-2">
            {pinnedSpaces.map((space) => (
              <div
                key={space.id}
                className="flex items-center gap-3 p-3 bg-default-100 rounded-xl"
              >
                {renderIcon(space.icon, space.name, space.color)}
                <span className="flex-1 font-medium">{space.name}</span>
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  color="danger"
                  onPress={() => handleRemove(space.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          {spaceToAdd && (
            <div className="mt-4 pt-4 border-t border-default-200">
              <p className="text-sm text-default-500 mb-2">Space to add:</p>
              <div className="flex items-center gap-3 p-3 bg-violet-50 dark:bg-violet-900/20 rounded-xl border-2 border-violet-200 dark:border-violet-800">
                {renderIcon(spaceToAdd.icon, spaceToAdd.name, spaceToAdd.color)}
                <span className="flex-1 font-medium">{spaceToAdd.name}</span>
                <span className="text-xs text-violet-600 font-medium">NEW</span>
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={handleSaveAndAdd}
            isLoading={saving}
            isDisabled={!canAdd}
          >
            {canAdd 
              ? `Remove ${removedCount} & Add "${spaceToAdd?.name}"`
              : 'Remove a space first'
            }
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
