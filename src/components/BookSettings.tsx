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
  Select,
  SelectItem,
  Switch,
  Divider,
} from '@heroui/react'
import { Settings, Book } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'

interface Book {
  id: string
  project_id: string
  title: string
  subtitle: string | null
  author: string | null
  target_word_count: number | null
  current_word_count: number
  status: string
  include_toc: boolean
  include_title_page: boolean
  include_copyright: boolean
  trim_size: string
  font_family: string
}

interface BookSettingsProps {
  isOpen: boolean
  onClose: () => void
  book: Book
  onBookUpdated: (book: Book) => void
}

const TRIM_SIZES = [
  { key: '5x8', label: '5" × 8" (Digest)' },
  { key: '6x9', label: '6" × 9" (Trade Paperback)' },
  { key: '8.5x11', label: '8.5" × 11" (Letter)' },
]

const FONT_FAMILIES = [
  { key: 'serif', label: 'Serif (Traditional)' },
  { key: 'sans-serif', label: 'Sans Serif (Modern)' },
]

const BOOK_STATUSES = [
  { key: 'planning', label: 'Planning' },
  { key: 'drafting', label: 'Drafting' },
  { key: 'editing', label: 'Editing' },
  { key: 'final', label: 'Final' },
]

export default function BookSettings({
  isOpen,
  onClose,
  book,
  onBookUpdated,
}: BookSettingsProps) {
  const supabase = createClient()
  const [title, setTitle] = useState(book.title)
  const [subtitle, setSubtitle] = useState(book.subtitle || '')
  const [author, setAuthor] = useState(book.author || '')
  const [targetWordCount, setTargetWordCount] = useState(book.target_word_count?.toString() || '')
  const [status, setStatus] = useState(book.status)
  const [includeToc, setIncludeToc] = useState(book.include_toc)
  const [includeTitlePage, setIncludeTitlePage] = useState(book.include_title_page)
  const [includeCopyright, setIncludeCopyright] = useState(book.include_copyright)
  const [trimSize, setTrimSize] = useState(book.trim_size)
  const [fontFamily, setFontFamily] = useState(book.font_family)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTitle(book.title)
    setSubtitle(book.subtitle || '')
    setAuthor(book.author || '')
    setTargetWordCount(book.target_word_count?.toString() || '')
    setStatus(book.status)
    setIncludeToc(book.include_toc)
    setIncludeTitlePage(book.include_title_page)
    setIncludeCopyright(book.include_copyright)
    setTrimSize(book.trim_size)
    setFontFamily(book.font_family)
  }, [book])

  async function handleSave() {
    if (!title.trim()) {
      showErrorToast(new Error('Title required'), 'Please enter a book title')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('books')
        .update({
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          author: author.trim() || null,
          target_word_count: targetWordCount ? parseInt(targetWordCount) : null,
          status,
          include_toc: includeToc,
          include_title_page: includeTitlePage,
          include_copyright: includeCopyright,
          trim_size: trimSize,
          font_family: fontFamily,
          updated_at: new Date().toISOString(),
        })
        .eq('id', book.id)

      if (error) throw error

      const updatedBook = {
        ...book,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        author: author.trim() || null,
        target_word_count: targetWordCount ? parseInt(targetWordCount) : null,
        status,
        include_toc: includeToc,
        include_title_page: includeTitlePage,
        include_copyright: includeCopyright,
        trim_size: trimSize,
        font_family: fontFamily,
      }

      showSuccessToast('Book settings saved')
      onBookUpdated(updatedBook)
      onClose()
    } catch (error) {
      showErrorToast(error, 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Book Settings
        </ModalHeader>
        <ModalBody className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-default-600">Basic Information</h3>
            <Input
              label="Title"
              placeholder="Spiritual Warfare Prayers"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Input
              label="Subtitle (optional)"
              placeholder="Extended Edition with New Prayers"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
            />
            <Input
              label="Author"
              placeholder="Lesley M."
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>

          <Divider />

          {/* Progress */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-default-600">Progress</h3>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Status"
                selectedKeys={[status]}
                onSelectionChange={(keys) => setStatus(Array.from(keys)[0] as string)}
              >
                {BOOK_STATUSES.map((s) => (
                  <SelectItem key={s.key}>{s.label}</SelectItem>
                ))}
              </Select>
              <Input
                label="Target Word Count"
                placeholder="50000"
                type="number"
                value={targetWordCount}
                onChange={(e) => setTargetWordCount(e.target.value)}
              />
            </div>
          </div>

          <Divider />

          {/* Front/Back Matter */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-default-600">Front & Back Matter</h3>
            <div className="space-y-3">
              <Switch isSelected={includeTitlePage} onValueChange={setIncludeTitlePage}>
                Include Title Page
              </Switch>
              <Switch isSelected={includeCopyright} onValueChange={setIncludeCopyright}>
                Include Copyright Page
              </Switch>
              <Switch isSelected={includeToc} onValueChange={setIncludeToc}>
                Include Table of Contents
              </Switch>
            </div>
          </div>

          <Divider />

          {/* Export Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-default-600">Export Settings</h3>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Trim Size"
                selectedKeys={[trimSize]}
                onSelectionChange={(keys) => setTrimSize(Array.from(keys)[0] as string)}
              >
                {TRIM_SIZES.map((size) => (
                  <SelectItem key={size.key}>{size.label}</SelectItem>
                ))}
              </Select>
              <Select
                label="Font Family"
                selectedKeys={[fontFamily]}
                onSelectionChange={(keys) => setFontFamily(Array.from(keys)[0] as string)}
              >
                {FONT_FAMILIES.map((font) => (
                  <SelectItem key={font.key}>{font.label}</SelectItem>
                ))}
              </Select>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSave} isLoading={saving}>
            Save Settings
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
