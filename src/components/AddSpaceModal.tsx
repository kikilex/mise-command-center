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

export default function AddSpaceModal({ isOpen, onClose, onSuccess }: AddSpaceModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(COLOR_OPTIONS[0])
  const [icon, setIcon] = useState('Layout')
  const [invitedUsers, setInvitedUsers] = useState<string[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      loadUsers()
    }
  }, [isOpen])

  async function loadUsers() {
    const { data } = await supabase.from('users').select('id, name, email')
    setAllUsers(data || [])
  }

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

      // 1. Create the space
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

      // 2. Add creator as owner
      const membersToInsert = [
        { space_id: space.id, user_id: user.id, role: 'owner' }
      ]

      // 3. Add invited users as editors
      invitedUsers.forEach(userId => {
        if (userId !== user.id) {
          membersToInsert.push({ space_id: space.id, user_id: userId, role: 'editor' })
        }
      })

      const { error: memberError } = await supabase
        .from('space_members')
        .insert(membersToInsert)

      if (memberError) throw memberError

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
    setIcon('Layout')
    setInvitedUsers([])
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
            <div className="flex items-end gap-3">
               <div className="flex-shrink-0">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block px-1">Icon</label>
                <IconPicker value={icon} onChange={setIcon} />
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

            <Select
              label="Invite Members"
              placeholder="Select users to add"
              selectionMode="multiple"
              selectedKeys={new Set(invitedUsers)}
              onSelectionChange={(keys) => setInvitedUsers(Array.from(keys) as string[])}
              variant="bordered"
            >
              {allUsers.map(u => (
                <SelectItem key={u.id} textValue={u.name || u.email}>
                  {u.name || u.email}
                </SelectItem>
              ))}
            </Select>

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
