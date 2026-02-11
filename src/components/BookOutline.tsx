'use client'

import { useState } from 'react'
import { Button, Chip, Progress, Tooltip } from '@heroui/react'
import { Plus, GripVertical, FileText, BookOpen } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast } from '@/lib/errors'

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

interface BookOutlineProps {
  chapters: Chapter[]
  selectedChapterId: string | null
  currentWordCount: number
  targetWordCount: number | null
  onSelectChapter: (chapter: Chapter) => void
  onAddChapter: () => void
  onChaptersReordered: (chapters: Chapter[]) => void
}

const STATUS_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'> = {
  idea: 'default',
  outline: 'primary',
  draft: 'warning',
  revision: 'secondary',
  final: 'success',
}

function SortableChapterItem({
  chapter,
  isSelected,
  onSelect,
}: {
  chapter: Chapter
  isSelected: boolean
  onSelect: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chapter.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const wordCount = chapter.document?.word_count || 0
  const targetCount = chapter.target_word_count || 0
  const progress = targetCount > 0 ? Math.min((wordCount / targetCount) * 100, 100) : 0

  // Determine chapter label
  let chapterLabel = ''
  if (chapter.chapter_type === 'chapter' && chapter.chapter_number) {
    chapterLabel = `${chapter.chapter_number}`
  } else if (chapter.chapter_type !== 'chapter') {
    chapterLabel = chapter.chapter_type.charAt(0).toUpperCase()
  }

  // Status color based on chapter status
  const statusBgColor = {
    idea: 'bg-default-200 text-default-600',
    outline: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    draft: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
    revision: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    final: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  }[chapter.status] || 'bg-default-200 text-default-600'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors
        ${isSelected 
          ? 'bg-violet-50 dark:bg-violet-900/20 border-l-4 border-violet-500' 
          : 'hover:bg-default-100 border-l-4 border-transparent'
        }
      `}
      onClick={onSelect}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-default-400 hover:text-default-600"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Chapter number badge */}
      <div className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 ${statusBgColor}`}>
        {chapterLabel || <FileText className="w-3.5 h-3.5" />}
      </div>

      {/* Chapter info */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate ${isSelected ? 'text-default-800' : 'text-default-700'}`}>
          {chapter.document?.title || 'Untitled'}
        </div>
        <div className="text-xs text-default-400 flex items-center gap-2">
          <span>{wordCount.toLocaleString()} words</span>
          {targetCount > 0 && (
            <>
              <span>•</span>
              <span>{Math.round(progress)}%</span>
            </>
          )}
          {chapter.status !== 'idea' && (
            <>
              <span>•</span>
              <span className="capitalize">{chapter.status}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BookOutline({
  chapters,
  selectedChapterId,
  currentWordCount,
  targetWordCount,
  onSelectChapter,
  onAddChapter,
  onChaptersReordered,
}: BookOutlineProps) {
  const supabase = createClient()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const overallProgress = targetWordCount && targetWordCount > 0 
    ? Math.min((currentWordCount / targetWordCount) * 100, 100) 
    : 0

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = chapters.findIndex((c) => c.id === active.id)
    const newIndex = chapters.findIndex((c) => c.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(chapters, oldIndex, newIndex).map((c, idx) => ({
      ...c,
      chapter_order: idx,
    }))

    // Optimistic update
    onChaptersReordered(reordered)

    // Persist to DB
    try {
      await Promise.all(
        reordered.map((c) =>
          supabase.from('book_chapters').update({ chapter_order: c.chapter_order }).eq('id', c.id)
        )
      )
    } catch (error) {
      showErrorToast(error, 'Failed to reorder chapters')
    }
  }

  return (
    <div className="w-80 bg-white dark:bg-default-50 border-r border-default-200 flex flex-col h-full">
      {/* Header with progress */}
      <div className="p-4 border-b border-default-200 bg-default-50 dark:bg-default-100">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-4 h-4 text-violet-500" />
          <h2 className="font-bold text-default-800">Chapters</h2>
        </div>
        {targetWordCount && targetWordCount > 0 && (
          <div className="flex items-center gap-2">
            <Progress
              size="sm"
              value={overallProgress}
              color="secondary"
              className="flex-1"
            />
            <span className="text-xs text-default-500">{Math.round(overallProgress)}%</span>
          </div>
        )}
        <div className="text-xs text-default-400 mt-1">
          {currentWordCount.toLocaleString()} {targetWordCount ? `/ ${targetWordCount.toLocaleString()}` : ''} words
        </div>
      </div>

      {/* Chapter list */}
      <div className="flex-1 overflow-y-auto divide-y divide-default-100">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {chapters.map((chapter) => (
              <SortableChapterItem
                key={chapter.id}
                chapter={chapter}
                isSelected={chapter.id === selectedChapterId}
                onSelect={() => onSelectChapter(chapter)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {chapters.length === 0 && (
          <div className="p-8 text-center text-default-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No chapters yet</p>
          </div>
        )}
      </div>

      {/* Add chapter button */}
      <div className="p-4 border-t border-default-200">
        <Button
          fullWidth
          variant="flat"
          startContent={<Plus className="w-4 h-4" />}
          onPress={onAddChapter}
        >
          Add Chapter
        </Button>
      </div>
    </div>
  )
}
