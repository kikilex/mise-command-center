'use client'

import { useState, useEffect } from 'react'
import {
  Button,
  Spinner,
  useDisclosure,
  Progress,
  Card,
  CardBody,
} from '@heroui/react'
import { Settings, Download, BookOpen, Plus, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import BookOutline from './BookOutline'
import BookChapterEditor from './BookChapterEditor'
import AddChapterModal from './AddChapterModal'
import BookSettings from './BookSettings'

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

interface BookBuilderProps {
  projectId: string
  spaceId: string
  userId: string
}

export default function BookBuilder({ projectId, spaceId, userId }: BookBuilderProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [book, setBook] = useState<Book | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null)
  const [enabling, setEnabling] = useState(false)

  // Modals
  const { isOpen: isAddChapterOpen, onOpen: onAddChapterOpen, onClose: onAddChapterClose } = useDisclosure()
  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onClose: onSettingsClose } = useDisclosure()

  useEffect(() => {
    loadBook()
  }, [projectId])

  async function loadBook() {
    setLoading(true)
    try {
      // Check if book exists for this project
      const { data: bookData, error: bookError } = await supabase
        .from('books')
        .select('*')
        .eq('project_id', projectId)
        .single()

      if (bookError && bookError.code !== 'PGRST116') {
        // PGRST116 = not found, which is fine
        throw bookError
      }

      if (bookData) {
        setBook(bookData)
        // Load chapters
        const { data: chaptersData, error: chaptersError } = await supabase
          .from('book_chapters')
          .select(`
            *,
            document:document_id (id, title, content, word_count)
          `)
          .eq('book_id', bookData.id)
          .order('chapter_order')

        if (chaptersError) throw chaptersError
        setChapters(chaptersData || [])
        
        // Select first chapter by default
        if (chaptersData && chaptersData.length > 0 && !selectedChapter) {
          setSelectedChapter(chaptersData[0])
        }

        // Calculate current word count
        const totalWords = (chaptersData || []).reduce(
          (sum, ch) => sum + (ch.document?.word_count || 0),
          0
        )
        if (totalWords !== bookData.current_word_count) {
          // Update book word count
          await supabase
            .from('books')
            .update({ current_word_count: totalWords })
            .eq('id', bookData.id)
          setBook({ ...bookData, current_word_count: totalWords })
        }
      }
    } catch (error) {
      showErrorToast(error, 'Failed to load book')
    } finally {
      setLoading(false)
    }
  }

  async function enableBook() {
    setEnabling(true)
    try {
      // Get project name for default book title
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single()

      const { data, error } = await supabase
        .from('books')
        .insert({
          project_id: projectId,
          title: project?.name || 'Untitled Book',
          status: 'planning',
        })
        .select()
        .single()

      if (error) throw error

      setBook(data)
      showSuccessToast('Book enabled! Start adding chapters.')
    } catch (error) {
      showErrorToast(error, 'Failed to enable book')
    } finally {
      setEnabling(false)
    }
  }

  function handleChapterAdded(chapter: Chapter) {
    const updatedChapters = [...chapters, chapter]
    setChapters(updatedChapters)
    setSelectedChapter(chapter)
    
    // Update book word count
    const totalWords = updatedChapters.reduce(
      (sum, ch) => sum + (ch.document?.word_count || 0),
      0
    )
    if (book) {
      setBook({ ...book, current_word_count: totalWords })
    }
  }

  function handleChapterUpdated(updatedChapter: Chapter) {
    const updatedChapters = chapters.map((ch) =>
      ch.id === updatedChapter.id ? updatedChapter : ch
    )
    setChapters(updatedChapters)
    setSelectedChapter(updatedChapter)
    
    // Update book word count
    const totalWords = updatedChapters.reduce(
      (sum, ch) => sum + (ch.document?.word_count || 0),
      0
    )
    if (book) {
      setBook({ ...book, current_word_count: totalWords })
      // Persist to DB
      supabase
        .from('books')
        .update({ current_word_count: totalWords })
        .eq('id', book.id)
    }
  }

  function handleChaptersReordered(reorderedChapters: Chapter[]) {
    setChapters(reorderedChapters)
  }

  function handleNavigate(direction: 'prev' | 'next') {
    if (!selectedChapter) return
    const currentIndex = chapters.findIndex((ch) => ch.id === selectedChapter.id)
    if (currentIndex === -1) return

    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1
    if (newIndex >= 0 && newIndex < chapters.length) {
      setSelectedChapter(chapters[newIndex])
    }
  }

  function handleBookUpdated(updatedBook: Book) {
    setBook(updatedBook)
  }

  async function handleExport() {
    showSuccessToast('Export feature coming soon!')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    )
  }

  // No book yet - show enable button
  if (!book) {
    return (
      <Card className="max-w-lg mx-auto my-12">
        <CardBody className="text-center py-12">
          <BookOpen className="w-16 h-16 mx-auto text-default-300 mb-4" />
          <h2 className="text-xl font-bold mb-2">Enable Book Mode</h2>
          <p className="text-default-500 mb-6">
            Turn this project into a book with chapters, outlines, and manuscript export.
          </p>
          <Button
            color="primary"
            size="lg"
            startContent={<BookOpen className="w-5 h-5" />}
            onPress={enableBook}
            isLoading={enabling}
          >
            Enable Book
          </Button>
        </CardBody>
      </Card>
    )
  }

  // Book exists - show builder
  const currentIndex = selectedChapter
    ? chapters.findIndex((ch) => ch.id === selectedChapter.id)
    : -1

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-default-100 border-b border-default-200">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-violet-500" />
          <div>
            <h2 className="font-bold text-default-800">{book.title}</h2>
            {book.subtitle && (
              <p className="text-sm text-default-500">{book.subtitle}</p>
            )}
          </div>
          {book.target_word_count && book.target_word_count > 0 && (
            <div className="flex items-center gap-2 ml-4">
              <Progress
                size="sm"
                value={Math.min((book.current_word_count / book.target_word_count) * 100, 100)}
                color="secondary"
                className="w-24"
              />
              <span className="text-xs text-default-500">
                {Math.round((book.current_word_count / book.target_word_count) * 100)}%
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="flat"
            size="sm"
            startContent={<Settings className="w-4 h-4" />}
            onPress={onSettingsOpen}
          >
            Settings
          </Button>
          <Button
            color="primary"
            size="sm"
            startContent={<Download className="w-4 h-4" />}
            onPress={handleExport}
          >
            Export Book
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Chapter list */}
        <BookOutline
          chapters={chapters}
          selectedChapterId={selectedChapter?.id || null}
          currentWordCount={book.current_word_count}
          targetWordCount={book.target_word_count}
          onSelectChapter={setSelectedChapter}
          onAddChapter={onAddChapterOpen}
          onChaptersReordered={handleChaptersReordered}
        />

        {/* Main editor area */}
        {selectedChapter ? (
          <BookChapterEditor
            chapter={selectedChapter}
            onChapterUpdated={handleChapterUpdated}
            onNavigate={handleNavigate}
            hasPrev={currentIndex > 0}
            hasNext={currentIndex < chapters.length - 1}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-default-100">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto text-default-300 mb-4" />
              <h3 className="text-lg font-medium text-default-600 mb-2">
                {chapters.length === 0 ? 'No chapters yet' : 'Select a chapter'}
              </h3>
              <p className="text-default-400 mb-4">
                {chapters.length === 0
                  ? 'Create your first chapter to get started'
                  : 'Click on a chapter in the sidebar to edit it'}
              </p>
              {chapters.length === 0 && (
                <Button
                  color="primary"
                  startContent={<Plus className="w-4 h-4" />}
                  onPress={onAddChapterOpen}
                >
                  Add First Chapter
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddChapterModal
        isOpen={isAddChapterOpen}
        onClose={onAddChapterClose}
        bookId={book.id}
        projectId={projectId}
        spaceId={spaceId}
        userId={userId}
        chapterCount={chapters.length}
        onChapterAdded={handleChapterAdded}
      />

      <BookSettings
        isOpen={isSettingsOpen}
        onClose={onSettingsClose}
        book={book}
        onBookUpdated={handleBookUpdated}
      />
    </div>
  )
}
