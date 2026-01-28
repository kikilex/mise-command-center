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
import { Business } from '@/lib/business-context'

interface EditBusinessModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  business: Business | null
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

export default function EditBusinessModal({ isOpen, onClose, onSuccess, business }: EditBusinessModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLOR_OPTIONS[0])
  const [saving, setSaving] = useState(false)
  
  const supabase = createClient()

  // Update form when business changes
  useEffect(() => {
    if (business) {
      setName(business.name)
      setDescription(business.description || '')
      setColor(business.color || COLOR_OPTIONS[0])
    }
  }, [business])

  async function handleSubmit() {
    if (!name.trim()) {
      showErrorToast(new Error('Business name is required'), 'Validation Error')
      return
    }

    if (!business) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          color,
          updated_at: new Date().toISOString(),
        })
        .eq('id', business.id)

      if (error) throw error

      showSuccessToast('Business updated successfully')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Update business error:', error)
      showErrorToast(error, 'Failed to update business')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Edit Business</h2>
          <p className="text-sm font-normal text-default-500">
            Update business details
          </p>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <Input
              label="Business Name"
              placeholder="e.g., My Company LLC"
              value={name}
              onValueChange={setName}
              isRequired
              variant="bordered"
              autoFocus
            />

            <Textarea
              label="Description"
              placeholder="Brief description of this business (optional)"
              value={description}
              onValueChange={setDescription}
              variant="bordered"
              minRows={2}
              maxRows={4}
            />

            <div>
              <label className="text-sm font-medium text-default-700 mb-2 block">
                Color
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
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose} isDisabled={saving}>
            Cancel
          </Button>
          <Button 
            color="primary" 
            onPress={handleSubmit} 
            isLoading={saving}
            isDisabled={!name.trim()}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
