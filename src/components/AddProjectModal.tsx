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
import { FolderKanban } from 'lucide-react'

interface AddProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  spaceId: string
  userId?: string | null
}

export default function AddProjectModal({
  isOpen,
  onClose,
  onSuccess,
  spaceId,
  userId,
}: AddProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const supabase = createClient()

  async function handleSubmit() {
    if (!name.trim() || !userId) return

    setSubmitting(true)
    try {
      const { error } = await supabase.from('projects').insert({
        name: name.trim(),
        description: description.trim() || null,
        status: 'active',
        space_id: spaceId,
        created_by: userId,
        custom_fields: {},
      })

      if (error) throw error

      showSuccessToast('Project created')
      onSuccess()
      handleClose()
    } catch (error) {
      console.error('Create project error:', error)
      showErrorToast(error, 'Failed to create project')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setName('')
    setDescription('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalContent>
        <ModalHeader>
          <div className="flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-primary" />
            <span>New Project</span>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <Input
              label="Project Name"
              placeholder="e.g., Website Redesign"
              value={name}
              onValueChange={setName}
              isRequired
              autoFocus
              variant="bordered"
            />
            <Textarea
              label="Description"
              placeholder="What is this project about?"
              value={description}
              onValueChange={setDescription}
              variant="bordered"
              minRows={3}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={handleClose} isDisabled={submitting}>
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isLoading={submitting}
            isDisabled={!name.trim()}
          >
            Create Project
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
