'use client'

import { useState, useEffect } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
} from '@heroui/react'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { Space } from '@/lib/space-context'

interface EditSpaceModalProps {
  space: Space | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const COLOR_OPTIONS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#84cc16', // Lime
]

const ICON_OPTIONS = ['🏢', '🏠', '🚀', '📚', '🧪', '💼', '🛒', '🎨', '🧠', '🌐']

export default function EditSpaceModal({ space, isOpen, onClose, onSuccess }: EditSpaceModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLOR_OPTIONS[0])
  const [icon, setIcon] = useState(ICON_OPTIONS[0])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    if (space && isOpen) {
      setName(space.name || '')
      setDescription(space.description || '')
      setColor(space.color || COLOR_OPTIONS[0])
      setIcon(space.icon || ICON_OPTIONS[0])
    }
  }, [space, isOpen])

  async function handleSubmit() {
    if (!space || !name.trim()) {
      showErrorToast(new Error('Space name is required'), 'Validation Error')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('spaces')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          color,
          icon,
          updated_at: new Date().toISOString(),
        })
        .eq('id', space.id)

      if (error) throw error

      showSuccessToast('Space updated successfully')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Update space error:', error)
      showErrorToast(error, 'Failed to update space')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!space) return
    if (!confirm(`Are you sure you want to delete the space "${space.name}"? This action cannot be undone.`)) return

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('spaces')
        .delete()
        .eq('id', space.id)

      if (error) throw error

      showSuccessToast('Space deleted')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Delete space error:', error)
      showErrorToast(error, 'Failed to delete space')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Edit Space</h2>
          <p className="text-sm font-normal text-default-500">
            Update settings for this space
          </p>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="flex gap-2">
               <div className="w-14">
                <label className="text-xs font-medium text-default-700 mb-1 block">Icon</label>
                <div className="relative">
                  <select 
                    className="w-full h-10 rounded-xl bg-default-100 border-none appearance-none text-center cursor-pointer text-xl"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                  >
                    {ICON_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex-1">
                <Input
                  label="Space Name"
                  placeholder="e.g., AI Empire"
                  value={name}
                  onValueChange={setName}
                  isRequired
                  variant="bordered"
                />
              </div>
            </div>

            <Textarea
              label="Description"
              placeholder="What is this space for?"
              value={description}
              onValueChange={setDescription}
              variant="bordered"
              minRows={2}
            />

            <div>
              <label className="text-sm font-medium text-default-700 mb-2 block">
                Theming Color
              </label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      color === c 
                        ? 'ring-2 ring-offset-2 ring-primary scale-110' 
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {!space?.is_default && (
              <div className="pt-4 border-t border-default-100">
                <Button 
                  color="danger" 
                  variant="light" 
                  size="sm" 
                  className="px-0"
                  onPress={handleDelete}
                  isLoading={deleting}
                >
                  Delete Space
                </Button>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose} isDisabled={saving || deleting}>
            Cancel
          </Button>
          <Button 
            color="primary" 
            onPress={handleSubmit} 
            isLoading={saving}
            isDisabled={!name.trim() || deleting}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
