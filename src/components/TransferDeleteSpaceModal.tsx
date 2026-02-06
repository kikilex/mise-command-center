'use client'

import { useState, useEffect } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Select,
  SelectItem,
} from '@heroui/react'
import { AlertTriangle, FileText, CheckSquare, FolderKanban } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { Space } from '@/lib/space-context'

interface ContentCounts {
  documents: number
  tasks: number
  projects: number
}

interface TransferDeleteSpaceModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  space: Space | null
  otherSpaces: Space[]
  contentCounts: ContentCounts
}

export default function TransferDeleteSpaceModal({
  isOpen,
  onClose,
  onSuccess,
  space,
  otherSpaces,
  contentCounts,
}: TransferDeleteSpaceModalProps) {
  const [targetSpaceId, setTargetSpaceId] = useState<string>('')
  const [transferring, setTransferring] = useState(false)

  const supabase = createClient()

  const totalItems = contentCounts.documents + contentCounts.tasks + contentCounts.projects

  // Reset target when modal opens
  useEffect(() => {
    if (isOpen && otherSpaces.length > 0) {
      setTargetSpaceId(otherSpaces[0].id)
    }
  }, [isOpen, otherSpaces])

  async function handleTransferAndDelete() {
    if (!space || !targetSpaceId) return

    setTransferring(true)
    try {
      // Transfer documents
      if (contentCounts.documents > 0) {
        const { error: docError } = await supabase
          .from('documents')
          .update({ space_id: targetSpaceId })
          .eq('space_id', space.id)
        
        if (docError) throw docError
      }

      // Transfer tasks
      if (contentCounts.tasks > 0) {
        const { error: taskError } = await supabase
          .from('tasks')
          .update({ space_id: targetSpaceId })
          .eq('space_id', space.id)
        
        if (taskError) throw taskError
      }

      // Transfer projects
      if (contentCounts.projects > 0) {
        const { error: projectError } = await supabase
          .from('projects')
          .update({ space_id: targetSpaceId })
          .eq('space_id', space.id)
        
        if (projectError) throw projectError
      }

      // Now delete the space
      const { error: deleteError } = await supabase
        .from('spaces')
        .delete()
        .eq('id', space.id)

      if (deleteError) throw deleteError

      const targetSpace = otherSpaces.find(s => s.id === targetSpaceId)
      showSuccessToast(`Content transferred to "${targetSpace?.name}" and space deleted`)
      setTargetSpaceId('')
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Transfer and delete error:', error)
      showErrorToast(error, 'Failed to transfer content and delete space')
    } finally {
      setTransferring(false)
    }
  }

  function handleClose() {
    setTargetSpaceId('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2 text-warning">
          <AlertTriangle className="w-6 h-6" />
          <span>Transfer & Delete Space</span>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-default-600">
              <strong>&quot;{space?.name}&quot;</strong> contains content that must be transferred before deletion.
            </p>

            {/* Content counts */}
            <div className="bg-default-100 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-default-700 mb-3">This space has:</p>
              
              {contentCounts.documents > 0 && (
                <div className="flex items-center gap-2 text-sm text-default-600">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span>{contentCounts.documents} document{contentCounts.documents !== 1 ? 's' : ''}</span>
                </div>
              )}
              
              {contentCounts.tasks > 0 && (
                <div className="flex items-center gap-2 text-sm text-default-600">
                  <CheckSquare className="w-4 h-4 text-green-500" />
                  <span>{contentCounts.tasks} task{contentCounts.tasks !== 1 ? 's' : ''}</span>
                </div>
              )}
              
              {contentCounts.projects > 0 && (
                <div className="flex items-center gap-2 text-sm text-default-600">
                  <FolderKanban className="w-4 h-4 text-purple-500" />
                  <span>{contentCounts.projects} project{contentCounts.projects !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {otherSpaces.length > 0 ? (
              <Select
                label="Transfer content to"
                placeholder="Select a space"
                selectedKeys={targetSpaceId ? new Set([targetSpaceId]) : new Set()}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string
                  if (selected) setTargetSpaceId(selected)
                }}
                variant="bordered"
                isRequired
              >
                {otherSpaces.map((s) => (
                  <SelectItem key={s.id} textValue={s.name}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: s.color || '#3b82f6' }}
                      />
                      <span>{s.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </Select>
            ) : (
              <div className="bg-danger/10 border border-danger/20 rounded-lg p-4">
                <p className="text-sm text-danger">
                  You don&apos;t have any other spaces to transfer content to. Please create another space first.
                </p>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={handleClose} isDisabled={transferring}>
            Cancel
          </Button>
          <Button
            color="danger"
            onPress={handleTransferAndDelete}
            isLoading={transferring}
            isDisabled={!targetSpaceId || otherSpaces.length === 0}
          >
            Transfer & Delete
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
