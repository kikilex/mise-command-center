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

interface AddBusinessModalProps {
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

export default function AddBusinessModal({ isOpen, onClose, onSuccess }: AddBusinessModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLOR_OPTIONS[0])
  const [saving, setSaving] = useState(false)
  
  const supabase = createClient()

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)
  }

  async function handleSubmit() {
    if (!name.trim()) {
      showErrorToast(new Error('Business name is required'), 'Validation Error')
      return
    }

    setSaving(true)
    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error('You must be logged in to create a business')
      }

      // Create slug from name
      const slug = generateSlug(name) + '-' + Date.now().toString(36)

      // Create the business
      const { data: business, error: createError } = await supabase
        .from('businesses')
        .insert({
          name: name.trim(),
          slug,
          description: description.trim() || null,
          color,
          owner_id: user.id,
        })
        .select()
        .single()

      if (createError) throw createError

      // Add current user as owner in business_members
      const { error: memberError } = await supabase
        .from('business_members')
        .insert({
          business_id: business.id,
          user_id: user.id,
          role: 'owner',
        })

      if (memberError) {
        console.error('Failed to add owner to business_members:', memberError)
        // Don't throw, business was created successfully
      }

      showSuccessToast('Business created successfully')
      resetForm()
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Create business error:', error)
      showErrorToast(error, 'Failed to create business')
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setName('')
    setDescription('')
    setColor(COLOR_OPTIONS[0])
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Add New Business</h2>
          <p className="text-sm font-normal text-default-500">
            Create a new business to organize your work
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
          <Button variant="flat" onPress={handleClose} isDisabled={saving}>
            Cancel
          </Button>
          <Button 
            color="primary" 
            onPress={handleSubmit} 
            isLoading={saving}
            isDisabled={!name.trim()}
          >
            Create Business
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
