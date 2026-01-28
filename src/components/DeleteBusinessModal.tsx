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
} from '@heroui/react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { Business } from '@/lib/business-context'

interface DeleteBusinessModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  business: Business | null
}

export default function DeleteBusinessModal({ isOpen, onClose, onSuccess, business }: DeleteBusinessModalProps) {
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  
  const supabase = createClient()

  const confirmationText = business?.name || ''
  const isConfirmed = confirmation === confirmationText

  async function handleDelete() {
    if (!business || !isConfirmed) return

    setDeleting(true)
    try {
      // Delete business (cascades to business_members, etc.)
      const { error } = await supabase
        .from('businesses')
        .delete()
        .eq('id', business.id)

      if (error) throw error

      showSuccessToast('Business deleted successfully')
      setConfirmation('')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Delete business error:', error)
      showErrorToast(error, 'Failed to delete business')
    } finally {
      setDeleting(false)
    }
  }

  function handleClose() {
    setConfirmation('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 text-danger">
          <ExclamationTriangleIcon className="w-6 h-6" />
          <span>Delete Business</span>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="bg-danger/10 border border-danger/20 rounded-lg p-4">
              <p className="text-sm text-danger font-medium mb-2">
                This action cannot be undone!
              </p>
              <p className="text-sm text-default-600">
                Deleting <strong>{business?.name}</strong> will permanently remove all associated data including:
              </p>
              <ul className="list-disc list-inside text-sm text-default-600 mt-2 space-y-1">
                <li>All projects under this business</li>
                <li>All tasks and their history</li>
                <li>Team member associations</li>
              </ul>
            </div>

            <Input
              label={`Type "${confirmationText}" to confirm`}
              placeholder="Enter business name"
              value={confirmation}
              onValueChange={setConfirmation}
              variant="bordered"
              description="This helps prevent accidental deletions"
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={handleClose} isDisabled={deleting}>
            Cancel
          </Button>
          <Button 
            color="danger" 
            onPress={handleDelete} 
            isLoading={deleting}
            isDisabled={!isConfirmed}
          >
            Delete Business
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
