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
  Select,
  SelectItem,
} from '@heroui/react'
import { FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'

interface AddChapterModalProps {
  isOpen: boolean
  onClose: () => void
  bookId: string
  projectId: string
  spaceId: string
  userId: string
  chapterCount: number
  onChapterAdded: (chapter: any) => void
}

const CHAPTER_TYPES = [
  { key: 'chapter', label: 'Chapter' },
  { key: 'prologue', label: 'Prologue' },
  { key: 'epilogue', label: 'Epilogue' },
  { key: 'introduction', label: 'Introduction' },
  { key: 'appendix', label: 'Appendix' },
]

export default function AddChapterModal({
  isOpen,
  onClose,
  bookId,
  projectId,
  spaceId,
  userId,
  chapterCount,
  onChapterAdded,
}: AddChapterModalProps) {
  const supabase = createClient()
  const [title, setTitle] = useState('')
  const [chapterType, setChapterType] = useState('chapter')
  const [synopsis, setSynopsis] = useState('')
  const [targetWordCount, setTargetWordCount] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!title.trim()) {
      showErrorToast(new Error('Title required'), 'Please enter a chapter title')
      return
    }

    setSaving(true)
    try {
      // First create the document
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          title: title.trim(),
          content: '',
          space_id: spaceId,
          project_id: projectId,
          created_by: userId,
          word_count: 0,
        })
        .select()
        .single()

      if (docError) throw docError

      // Then create the book chapter linking to the document
      const { data: chapter, error: chapterError } = await supabase
        .from('book_chapters')
        .insert({
          book_id: bookId,
          document_id: doc.id,
          chapter_number: chapterType === 'chapter' ? chapterCount + 1 : null,
          chapter_order: chapterCount,
          chapter_type: chapterType,
          synopsis: synopsis.trim() || null,
          target_word_count: targetWordCount ? parseInt(targetWordCount) : null,
          status: 'idea',
        })
        .select(`
          *,
          document:document_id (id, title, content, word_count)
        `)
        .single()

      if (chapterError) throw chapterError

      showSuccessToast('Chapter created')
      onChapterAdded(chapter)
      handleClose()
    } catch (error) {
      showErrorToast(error, 'Failed to create chapter')
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    setTitle('')
    setChapterType('chapter')
    setSynopsis('')
    setTargetWordCount('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Add Chapter
        </ModalHeader>
        <ModalBody className="space-y-4">
          <Input
            label="Title"
            placeholder="Chapter 1: The Beginning"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />

          <Select
            label="Type"
            selectedKeys={[chapterType]}
            onSelectionChange={(keys) => setChapterType(Array.from(keys)[0] as string)}
          >
            {CHAPTER_TYPES.map((type) => (
              <SelectItem key={type.key}>{type.label}</SelectItem>
            ))}
          </Select>

          <Textarea
            label="Synopsis (optional)"
            placeholder="Brief summary for outline view..."
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            minRows={2}
          />

          <Input
            label="Target Word Count (optional)"
            placeholder="3000"
            type="number"
            value={targetWordCount}
            onChange={(e) => setTargetWordCount(e.target.value)}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={handleClose}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleCreate} isLoading={saving}>
            Create Chapter
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
