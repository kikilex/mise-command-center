'use client'

import { useState, useEffect, useRef } from 'react'
import Draggable from 'react-draggable'
import {
  Button,
  Input,
  Card,
  CardBody,
  CardHeader,
  Avatar,
  Spinner,
  Textarea,
  ScrollShadow,
} from '@heroui/react'
import { 
  StickyNote, X, Search, Pin, PinOff, Minimize2, Maximize2, 
  Plus, GripHorizontal, ChevronDown, Save
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'

interface Note {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
  creator?: { id: string; name: string; display_name: string; avatar_url: string } | null
}

export default function FloatingNoteWidget() {
  const supabase = createClient()
  const nodeRef = useRef(null)
  
  // Hydration check
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  
  // Widget state
  const [isOpen, setIsOpen] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Notes data
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Selected note
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  
  // New note mode
  const [isCreating, setIsCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [creatingNote, setCreatingNote] = useState(false)
  
  // User
  const [user, setUser] = useState<any>(null)
  
  // Load user on mount
  useEffect(() => {
    async function loadUser() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        setUser(profile || authUser)
      }
    }
    loadUser()
  }, [])
  
  // Load notes when widget opens
  useEffect(() => {
    if (isOpen && notes.length === 0) {
      loadNotes()
    }
  }, [isOpen])
  
  async function loadNotes() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, content, created_at, updated_at, creator:created_by (id, name, display_name, avatar_url)')
        .eq('doc_type', 'note')
        .order('updated_at', { ascending: false })
        .limit(50)
      
      if (error) throw error
      setNotes(data || [])
    } catch (error) {
      console.error('Failed to load notes:', error)
    } finally {
      setLoading(false)
    }
  }
  
  // Filter notes by search
  const filteredNotes = notes.filter(note => 
    searchQuery === '' ||
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (note.content && note.content.toLowerCase().includes(searchQuery.toLowerCase()))
  )
  
  // Select a note
  function handleSelectNote(note: Note) {
    setSelectedNote(note)
    setEditTitle(note.title)
    setEditContent(note.content || '')
    setHasChanges(false)
    setIsCreating(false)
  }
  
  // Save note changes
  async function handleSaveNote() {
    if (!selectedNote) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('documents')
        .update({ 
          title: editTitle,
          content: editContent,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedNote.id)
      
      if (error) throw error
      
      // Update local state
      setNotes(prev => prev.map(n => 
        n.id === selectedNote.id 
          ? { ...n, title: editTitle, content: editContent, updated_at: new Date().toISOString() }
          : n
      ))
      setSelectedNote(prev => prev ? { ...prev, title: editTitle, content: editContent } : null)
      setHasChanges(false)
      showSuccessToast('Note saved')
    } catch (error) {
      showErrorToast(error, 'Failed to save note')
    } finally {
      setSaving(false)
    }
  }
  
  // Create new note
  async function handleCreateNote() {
    if (!newTitle.trim()) return
    setCreatingNote(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .insert({
          title: newTitle.trim(),
          content: newContent,
          doc_type: 'note',
          status: 'draft',
          created_by: user?.id,
        })
        .select('id, title, content, created_at, updated_at')
        .single()
      
      if (error) throw error
      
      const newNote = { ...data, creator: user }
      setNotes(prev => [newNote, ...prev])
      handleSelectNote(newNote)
      setNewTitle('')
      setNewContent('')
      setIsCreating(false)
      showSuccessToast('Note created')
    } catch (error) {
      showErrorToast(error, 'Failed to create note')
    } finally {
      setCreatingNote(false)
    }
  }
  
  // Close widget
  function handleClose() {
    if (isPinned) {
      setIsMinimized(true)
    } else {
      setIsOpen(false)
      setSelectedNote(null)
      setIsCreating(false)
    }
  }
  
  // Get content preview
  function getPreview(content: string) {
    if (!content) return 'Empty note'
    const text = content.replace(/<[^>]*>/g, '').trim()
    return text.length > 60 ? text.slice(0, 60) + '...' : text
  }
  
  // Don't render until mounted (avoids hydration mismatch)
  if (!mounted) return null
  
  // FAB button (always visible) - positioned left of ChatWidget
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-24 z-50 w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
        title="Quick Notes"
      >
        <StickyNote className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>
    )
  }
  
  // Minimized state (pinned but collapsed)
  if (isMinimized && isPinned) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-24 z-50 w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
        title={selectedNote?.title || 'Quick Notes'}
      >
        <StickyNote className="w-6 h-6" />
        {selectedNote && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
        )}
      </button>
    )
  }
  
  // Main widget panel
  const panelWidth = isExpanded ? 'w-[500px]' : 'w-[360px]'
  const panelHeight = isExpanded ? 'h-[600px]' : 'h-[450px]'
  
  // Calculate position safely (only on client)
  const defaultX = typeof window !== 'undefined' ? Math.max(0, window.innerWidth - 400) : 100
  const defaultY = typeof window !== 'undefined' ? Math.max(0, window.innerHeight - 500) : 100
  
  return (
    <Draggable 
      handle=".drag-handle" 
      nodeRef={nodeRef}
      bounds="parent"
      defaultPosition={{ x: defaultX, y: defaultY }}
    >
      <div 
        ref={nodeRef}
        className={`fixed z-50 ${panelWidth} ${panelHeight} transition-all duration-200`}
        style={{ maxHeight: '90vh' }}
      >
        <Card className="h-full shadow-2xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900">
          {/* Header */}
          <CardHeader className="drag-handle cursor-move px-3 py-2 border-b border-default-200 flex items-center justify-between bg-amber-50 dark:bg-amber-900/20">
            <div className="flex items-center gap-2">
              <GripHorizontal className="w-4 h-4 text-default-400" />
              <StickyNote className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-sm">
                {selectedNote ? selectedNote.title : isCreating ? 'New Note' : 'Quick Notes'}
              </span>
              {hasChanges && (
                <span className="text-xs text-amber-600 dark:text-amber-400">• unsaved</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Shrink' : 'Expand'}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => setIsPinned(!isPinned)}
                title={isPinned ? 'Unpin' : 'Pin (keeps note visible)'}
                className={isPinned ? 'text-amber-500' : ''}
              >
                {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={handleClose}
              >
                {isPinned ? <ChevronDown className="w-4 h-4" /> : <X className="w-4 h-4" />}
              </Button>
            </div>
          </CardHeader>
          
          <CardBody className="p-0 flex flex-col h-[calc(100%-48px)]">
            {/* Note editing view */}
            {selectedNote && !isCreating ? (
              <div className="flex flex-col h-full">
                <div className="p-3 border-b border-default-100">
                  <Input
                    value={editTitle}
                    onValueChange={(v) => { setEditTitle(v); setHasChanges(true) }}
                    placeholder="Note title"
                    variant="bordered"
                    size="sm"
                    classNames={{ input: 'font-semibold' }}
                  />
                </div>
                <div className="flex-1 p-3 overflow-hidden">
                  <Textarea
                    value={editContent}
                    onValueChange={(v) => { setEditContent(v); setHasChanges(true) }}
                    placeholder="Write your note..."
                    variant="bordered"
                    minRows={10}
                    maxRows={20}
                    classNames={{ 
                      inputWrapper: 'h-full',
                      input: 'h-full resize-none'
                    }}
                    className="h-full"
                  />
                </div>
                <div className="p-3 border-t border-default-100 flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => { setSelectedNote(null); setHasChanges(false) }}
                  >
                    ← Back
                  </Button>
                  <Button
                    size="sm"
                    color="primary"
                    isLoading={saving}
                    isDisabled={!hasChanges}
                    onPress={handleSaveNote}
                    startContent={<Save className="w-4 h-4" />}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ) : isCreating ? (
              /* New note form */
              <div className="flex flex-col h-full">
                <div className="p-3 border-b border-default-100">
                  <Input
                    value={newTitle}
                    onValueChange={setNewTitle}
                    placeholder="Note title"
                    variant="bordered"
                    size="sm"
                    autoFocus
                    classNames={{ input: 'font-semibold' }}
                  />
                </div>
                <div className="flex-1 p-3 overflow-hidden">
                  <Textarea
                    value={newContent}
                    onValueChange={setNewContent}
                    placeholder="Write your note..."
                    variant="bordered"
                    minRows={10}
                    maxRows={20}
                    classNames={{ 
                      inputWrapper: 'h-full',
                      input: 'h-full resize-none'
                    }}
                    className="h-full"
                  />
                </div>
                <div className="p-3 border-t border-default-100 flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => { setIsCreating(false); setNewTitle(''); setNewContent('') }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    color="primary"
                    isLoading={creatingNote}
                    isDisabled={!newTitle.trim()}
                    onPress={handleCreateNote}
                  >
                    Create Note
                  </Button>
                </div>
              </div>
            ) : (
              /* Notes list view */
              <div className="flex flex-col h-full">
                {/* Search + New */}
                <div className="p-3 border-b border-default-100 flex gap-2">
                  <Input
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    placeholder="Search notes..."
                    variant="bordered"
                    size="sm"
                    startContent={<Search className="w-4 h-4 text-default-400" />}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    color="primary"
                    isIconOnly
                    onPress={() => setIsCreating(true)}
                    title="New Note"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Notes list */}
                <ScrollShadow className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <Spinner size="sm" />
                    </div>
                  ) : filteredNotes.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <StickyNote className="w-12 h-12 mx-auto text-default-300 mb-2" />
                      <p className="text-sm text-default-400">
                        {searchQuery ? 'No notes found' : 'No notes yet'}
                      </p>
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        className="mt-3"
                        onPress={() => setIsCreating(true)}
                      >
                        Create your first note
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-default-100">
                      {filteredNotes.map(note => (
                        <button
                          key={note.id}
                          onClick={() => handleSelectNote(note)}
                          className="w-full text-left p-3 hover:bg-default-50 transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <StickyNote className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{note.title}</p>
                              <p className="text-xs text-default-400 mt-0.5 line-clamp-2">
                                {getPreview(note.content)}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {note.creator && (
                                  <div className="flex items-center gap-1">
                                    <Avatar 
                                      src={note.creator.avatar_url} 
                                      name={(note.creator.display_name || note.creator.name || '').split(' ')[0]}
                                      size="sm"
                                      className="w-3 h-3"
                                    />
                                    <span className="text-[10px] text-default-400">
                                      {(note.creator.display_name || note.creator.name || '').split(' ')[0]}
                                    </span>
                                  </div>
                                )}
                                <span className="text-[10px] text-default-300">
                                  {new Date(note.updated_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollShadow>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </Draggable>
  )
}
