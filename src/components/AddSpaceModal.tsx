'use client'

import { useState } from 'react'
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

interface AddSpaceModalProps {
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

export default function AddSpaceModal({ isOpen, onClose, onSuccess }: AddSpaceModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLOR_OPTIONS[0])
  const [icon, setIcon] = useState(ICON_OPTIONS[0])
  const [saving, setSaving] = useState(false)
  
  const supabase = createClient()

  async function handleSubmit() {
    if (!name.trim()) {
      showErrorToast(new Error('Space name is required'), 'Validation Error')
      return
    }

    setSaving(true)
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('You must be logged in to create a space')
      }

      // Create the space
      const { data: space, error: createError } = await supabase
        .from('spaces')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          color,
          icon,
          created_by: user.id,
        })
        .select()
        .single()

      if (createError) throw createError

      // Add current user as owner in space_members
      const { error: memberError } = await supabase
        .from('space_members')
        .insert({
          space_id: space.id,
          user_id: user.id,
          role: 'owner',
        })

      if (memberError) {
        console.error('Failed to add owner to space_members:', memberError)
      }

      showSuccessToast('Space created successfully')
      resetForm()
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Create space error:', error)
      showErrorToast(error, 'Failed to create space')
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setName('')
    setDescription('')
    setColor(COLOR_OPTIONS[0])
    setIcon(ICON_OPTIONS[0])
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Add New Space</h2>
          <p className="text-sm font-normal text-default-500">
            Create a new space to organize your work
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
                  autoFocus
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
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={handleClose} isDisabled={saving}>
            Cancel
          </Button>
          <Button 
            color="primary" 
            onPress={handleSubmit} 
            isLoading={saving}
            isDisabled={!name.trim()}
          >
            Create Space
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
