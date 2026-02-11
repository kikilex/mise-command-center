'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button, Input, Tooltip, Select, SelectItem } from '@heroui/react'
import { 
  Save, ChevronLeft, ChevronRight, Scissors, 
  Bold, Italic, Heading1, Heading2, 
  BookOpen, Type
} from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Underline from '@tiptap/extension-underline'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'

interface Chapter {
  id: string
  book_id: string
  document_id: string
  chapter_number: number | null
  chapter_order: number
  chapter_type: string
  synopsis: string | null
  status: string
  target_word_count: number | null
  document: {
    id: string
    title: string
    content: string
    word_count: number
  }
}

interface BookChapterEditorProps {
  chapter: Chapter
  onChapterUpdated: (chapter: Chapter) => void
  onNavigate: (direction: 'prev' | 'next') => void
  hasPrev: boolean
  hasNext: boolean
}

const STATUS_OPTIONS = [
  { key: 'idea', label: 'Idea' },
  { key: 'outline', label: 'Outline' },
  { key: 'draft', label: 'Draft' },
  { key: 'revision', label: 'Revision' },
  { key: 'final', label: 'Final' },
]

// Count words in text (strip HTML)
function countWords(html: string): number {
  if (!html) return 0
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return 0
  return text.split(/\s+/).length
}

// Custom Page Break extension for Tiptap
import { Node, mergeAttributes, ChainedCommands } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      insertPageBreak: () => ReturnType
    }
    prayerBlock: {
      insertPrayerBlock: () => ReturnType
    }
  }
}

const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  parseHTML() {
    return [{ tag: 'div[data-page-break]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
      'data-page-break': 'true',
      class: 'page-break-visual',
      style: 'page-break-after: always;'
    })]
  },
  addCommands() {
    return {
      insertPageBreak: () => ({ chain }: { chain: () => ChainedCommands }) => {
        return chain().insertContent({ type: 'pageBreak' }).run()
      },
    }
  },
})

// Custom Prayer Block extension
const PrayerBlock = Node.create({
  name: 'prayerBlock',
  group: 'block',
  content: 'block+',
  parseHTML() {
    return [{ tag: 'div[data-prayer-block]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-prayer-block': 'true',
      class: 'prayer-block bg-violet-50 dark:bg-violet-900/20 border-l-4 border-violet-500 p-5 rounded-r-xl my-4'
    }), ['div', { class: 'text-xs font-semibold text-violet-600 mb-2' }, '🙏 PRAYER'], ['div', { class: 'prayer-content' }, 0]]
  },
  addCommands() {
    return {
      insertPrayerBlock: () => ({ chain }: { chain: () => ChainedCommands }) => {
        return chain().insertContent({
          type: 'prayerBlock',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Enter your prayer here...' }] }]
        }).run()
      },
    }
  },
})

function getPageBreakCount(editor: ReturnType<typeof useEditor>): number {
  if (!editor) return 0
  let count = 0
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'pageBreak') count += 1
  })
  return count
}

export default function BookChapterEditor({
  chapter,
  onChapterUpdated,
  onNavigate,
  hasPrev,
  hasNext,
}: BookChapterEditorProps) {
  const supabase = createClient()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [title, setTitle] = useState(chapter.document?.title || '')
  const [status, setStatus] = useState(chapter.status)
  const [saving, setSaving] = useState(false)
  const [wordCount, setWordCount] = useState(chapter.document?.word_count || 0)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [pageCount, setPageCount] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: 'Start writing your chapter...',
      }),
      Highlight,
      Underline,
      PageBreak,
      PrayerBlock,
    ],
    content: chapter.document?.content || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const count = countWords(html)
      setWordCount(count)
      setHasUnsavedChanges(true)
      setPageCount(getPageBreakCount(editor) + 1)
    },
  })

  // Update editor content when chapter changes
  useEffect(() => {
    if (editor && chapter.document?.content !== undefined) {
      const currentContent = editor.getHTML()
      if (currentContent !== chapter.document.content) {
        editor.commands.setContent(chapter.document.content || '')
        setWordCount(chapter.document?.word_count || countWords(chapter.document?.content || ''))
        setHasUnsavedChanges(false)
        setPageCount(getPageBreakCount(editor) + 1)
        setCurrentPage(1)
      }
    }
    setTitle(chapter.document?.title || '')
    setStatus(chapter.status)
  }, [chapter.id, chapter.document?.content, editor])

  useEffect(() => {
    if (!editor || !scrollRef.current) return

    const handleScroll = () => {
      if (!editor || !scrollRef.current) return
      const breaks = Array.from(editor.view.dom.querySelectorAll('[data-page-break]')) as HTMLElement[]
      if (breaks.length === 0) {
        setCurrentPage(1)
        return
      }
      const container = scrollRef.current
      const containerTop = container.getBoundingClientRect().top
      const scrollTop = container.scrollTop
      const positions = breaks.map((el) => el.getBoundingClientRect().top - containerTop + scrollTop)
      const pageIndex = positions.filter((pos) => pos <= scrollTop + 8).length + 1
      setCurrentPage(Math.min(Math.max(pageIndex, 1), pageCount))
    }

    const container = scrollRef.current
    container.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => container.removeEventListener('scroll', handleScroll)
  }, [editor, pageCount])

  const handleSave = useCallback(async () => {
    if (!editor) return

    setSaving(true)
    try {
      const content = editor.getHTML()
      const currentWordCount = countWords(content)

      // Update document
      const { error: docError } = await supabase
        .from('documents')
        .update({
          title: title.trim(),
          content,
          word_count: currentWordCount,
        })
        .eq('id', chapter.document_id)

      if (docError) throw docError

      // Update chapter status if changed
      if (status !== chapter.status) {
        const { error: chapterError } = await supabase
          .from('book_chapters')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', chapter.id)

        if (chapterError) throw chapterError
      }

      // Update local state
      onChapterUpdated({
        ...chapter,
        status,
        document: {
          ...chapter.document,
          title: title.trim(),
          content,
          word_count: currentWordCount,
        },
      })

      setHasUnsavedChanges(false)
      showSuccessToast('Chapter saved')
    } catch (error) {
      showErrorToast(error, 'Failed to save chapter')
    } finally {
      setSaving(false)
    }
  }, [editor, title, status, chapter, supabase, onChapterUpdated])

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  const insertPageBreak = () => {
    if (editor) {
      editor.commands.insertPageBreak()
    }
  }

  const insertPrayerBlock = () => {
    if (editor) {
      editor.commands.insertPrayerBlock()
    }
  }

  const scrollToPage = (page: number) => {
    if (!editor || !scrollRef.current) return
    const clamped = Math.min(Math.max(page, 1), pageCount)
    const breaks = Array.from(editor.view.dom.querySelectorAll('[data-page-break]')) as HTMLElement[]

    if (clamped === 1) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      const target = breaks[clamped - 2]
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }

    setCurrentPage(clamped)
  }

  // Chapter type label
  const typeLabel = chapter.chapter_type === 'chapter' && chapter.chapter_number
    ? `Chapter ${chapter.chapter_number}`
    : chapter.chapter_type.charAt(0).toUpperCase() + chapter.chapter_type.slice(1)

  const pages = Array.from({ length: Math.max(pageCount, 1) }, (_, idx) => idx + 1)

  return (
    <div ref={scrollRef} className="flex-1 bg-default-100 dark:bg-default-50 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-8">
        {/* Chapter Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm text-default-500 mb-1">
              <span>{typeLabel}</span>
              <span>•</span>
              <Select
                size="sm"
                variant="flat"
                selectedKeys={[status]}
                onSelectionChange={(keys) => {
                  const newStatus = Array.from(keys)[0] as string
                  setStatus(newStatus)
                  setHasUnsavedChanges(true)
                }}
                classNames={{
                  trigger: 'min-h-0 h-6 px-2',
                  value: 'text-xs',
                }}
                className="w-28"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key}>{opt.label}</SelectItem>
                ))}
              </Select>
            </div>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setHasUnsavedChanges(true)
              }}
              classNames={{
                input: 'text-2xl font-bold bg-transparent',
                inputWrapper: 'bg-transparent shadow-none px-0',
              }}
              placeholder="Chapter Title"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              variant="flat"
              size="sm"
              isDisabled={!hasPrev}
              onPress={() => onNavigate('prev')}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              isIconOnly
              variant="flat"
              size="sm"
              isDisabled={!hasNext}
              onPress={() => onNavigate('next')}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              color={hasUnsavedChanges ? 'primary' : 'default'}
              variant={hasUnsavedChanges ? 'solid' : 'flat'}
              size="sm"
              startContent={<Save className="w-4 h-4" />}
              onPress={handleSave}
              isLoading={saving}
            >
              Save
            </Button>
          </div>
        </div>

        {/* Page Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-default-100 rounded-xl px-4 py-2 mb-4 border border-default-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-default-500">Pages:</span>
            <div className="flex items-center gap-1 flex-wrap">
              {pages.map((page) => (
                <Button
                  key={page}
                  size="sm"
                  variant={page === currentPage ? 'flat' : 'light'}
                  color={page === currentPage ? 'secondary' : 'default'}
                  className={page === currentPage ? 'font-semibold' : ''}
                  onPress={() => scrollToPage(page)}
                >
                  {page}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              variant="light"
              size="sm"
              isDisabled={currentPage <= 1}
              onPress={() => scrollToPage(currentPage - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-default-600 font-medium">
              Page {currentPage} of {pageCount}
            </span>
            <Button
              isIconOnly
              variant="light"
              size="sm"
              isDisabled={currentPage >= pageCount}
              onPress={() => scrollToPage(currentPage + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Editor Toolbar */}
        <div className="flex items-center gap-1 p-2 bg-white dark:bg-default-100 rounded-t-xl border border-default-200 border-b-0">
          <Tooltip content="Bold">
            <Button
              isIconOnly
              size="sm"
              variant={editor?.isActive('bold') ? 'flat' : 'light'}
              onPress={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Italic">
            <Button
              isIconOnly
              size="sm"
              variant={editor?.isActive('italic') ? 'flat' : 'light'}
              onPress={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic className="w-4 h-4" />
            </Button>
          </Tooltip>
          
          <div className="w-px h-5 bg-default-200 mx-1" />
          
          <Tooltip content="Heading 1">
            <Button
              isIconOnly
              size="sm"
              variant={editor?.isActive('heading', { level: 1 }) ? 'flat' : 'light'}
              onPress={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              <Heading1 className="w-4 h-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Heading 2">
            <Button
              isIconOnly
              size="sm"
              variant={editor?.isActive('heading', { level: 2 }) ? 'flat' : 'light'}
              onPress={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 className="w-4 h-4" />
            </Button>
          </Tooltip>
          
          <div className="w-px h-5 bg-default-200 mx-1" />
          
          <Tooltip content="Insert Prayer Block">
            <Button
              size="sm"
              variant="light"
              className="text-violet-600"
              onPress={insertPrayerBlock}
            >
              🙏 Prayer
            </Button>
          </Tooltip>
          
          <Tooltip content="Insert Page Break">
            <Button
              size="sm"
              variant="flat"
              className="bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200"
              startContent={<Scissors className="w-4 h-4" />}
              onPress={insertPageBreak}
            >
              Page Break
            </Button>
          </Tooltip>
          
          <div className="ml-auto flex items-center gap-2 text-xs text-default-400">
            <Type className="w-3.5 h-3.5" />
            <span>{wordCount.toLocaleString()} words</span>
            {chapter.target_word_count && chapter.target_word_count > 0 && (
              <>
                <span>/</span>
                <span>{chapter.target_word_count.toLocaleString()}</span>
                <span>({Math.round((wordCount / chapter.target_word_count) * 100)}%)</span>
              </>
            )}
          </div>
        </div>

        {/* Editor Content */}
        <div className="bg-white dark:bg-default-100 border border-default-200 rounded-b-xl overflow-hidden">
          <EditorContent
            editor={editor}
            className="book-editor prose prose-lg dark:prose-invert max-w-none p-8 min-h-[500px] focus:outline-none"
          />
        </div>

        {/* Page Layout Info */}
        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Page Layout
          </h3>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Use &quot;Page Break&quot; to control where content splits when exported to PDF. 
            Each page break creates a new page in the final book.
          </p>
          <div className="mt-3 flex items-center gap-4 text-xs text-amber-600 dark:text-amber-400">
            <span>📐 Format: 6&quot; × 9&quot; (Trade Paperback)</span>
            <span>📊 Est. 250 words/page</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .book-editor {
          counter-reset: page 1;
        }
        .book-editor .page-break-visual {
          position: relative;
          border-top: 2px dashed #cbd5e1;
          margin: 2rem 0;
          counter-increment: page;
        }
        .book-editor .page-break-visual::before {
          content: 'PAGE ' counter(page);
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          padding: 0 0.75rem;
          font-size: 0.7rem;
          color: #64748b;
          font-weight: 600;
          letter-spacing: 0.08em;
        }
        .dark .book-editor .page-break-visual::before {
          background: #0f172a;
          color: #94a3b8;
        }
      `}</style>
    </div>
  )
}
