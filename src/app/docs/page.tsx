'use client'

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  FileText, Search, Plus, Clock, Tag, Archive, Eye, EyeOff,
  X, Check, Folder, Settings, Pencil, ListFilter, NotebookPen, Users, Globe,
  MessageSquare, Send, RotateCcw
} from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Select,
  SelectItem,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  Divider,
} from '@heroui/react'
import { createClient } from '@/lib/supabase/client'
import { useSpace } from '@/lib/space-context'
import Navbar from '@/components/Navbar'
import RichTextEditor from '@/components/RichTextEditor'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import toast from 'react-hot-toast'

interface Document {
  id: string
  title: string
  content: string
  task_id: string | null
  business_id: string | null
  space_id: string | null
  project_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  status: 'draft' | 'in_review' | 'approved' | 'needs_revision'
  version: number
  category: string
  tags: string[]
  visibility: 'normal' | 'hidden'
  archived: boolean
  doc_type: 'document' | 'note'
  tasks?: { title: string } | null
  projects?: { name: string } | null
}

interface Project {
  id: string
  name: string
  space_id: string
}

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

interface Space {
  id: string
  name: string
  color: string
  icon: string
}

interface Comment {
  id: string
  document_id: string
  content: string
  author_id: string | null
  author_name: string
  comment_type: 'comment' | 'revision_request' | 'status_change'
  created_at: string
}

const statusOptions = [
  { key: 'all', label: 'All Statuses' },
  { key: 'draft', label: 'Draft', color: 'default' },
  { key: 'in_review', label: 'In Review', color: 'warning' },
  { key: 'approved', label: 'Approved', color: 'success' },
  { key: 'needs_revision', label: 'Needs Revision', color: 'danger' },
]

const getStatusColor = (status: string) => {
  switch (status) {
    case 'draft': return 'default'
    case 'in_review': return 'warning'
    case 'approved': return 'success'
    case 'needs_revision': return 'danger'
    default: return 'default'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'draft': return 'Draft'
    case 'in_review': return 'In Review'
    case 'approved': return 'Approved'
    case 'needs_revision': return 'Needs Revision'
    default: return status
  }
}

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'research': return 'secondary'
    case 'content': return 'primary'
    case 'guides': return 'success'
    case 'business': return 'warning'
    default: return 'default'
  }
}

export default function DocsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    }>
      <DocsPageContent />
    </Suspense>
  )
}

function DocsPageContent() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [spaces, setSpaces] = useState<Space[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [spaceFilter, setSpaceFilter] = useState<string>('all')
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<Document | null>(null)
  const [editTags, setEditTags] = useState('')
  const [editVisibility, setEditVisibility] = useState<'normal' | 'hidden'>('normal')
  const [editArchived, setEditArchived] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Quick note modal state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [creatingNote, setCreatingNote] = useState(false)
  
  // Note view modal state (for viewing/editing existing notes)
  const [isNoteViewOpen, setIsNoteViewOpen] = useState(false)
  const [viewingNote, setViewingNote] = useState<Document | null>(null)
  const [editNoteTitle, setEditNoteTitle] = useState('')
  const [editNoteContent, setEditNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [noteHasChanges, setNoteHasChanges] = useState(false)
  
  // Comments state for note modal
  const [noteComments, setNoteComments] = useState<Comment[]>([])
  const [loadingNoteComments, setLoadingNoteComments] = useState(false)
  const [newNoteComment, setNewNoteComment] = useState('')
  const [sendingNoteComment, setSendingNoteComment] = useState(false)
  
  // @mention suggestions state
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const MENTION_USERS = ['Alex', 'Mom', 'Ax', 'Tony', 'Neo']
  
  const supabase = createClient()
  const router = useRouter()
  const { selectedSpaceId } = useSpace()

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    loadDocuments()
    loadSpaces()
  }, [selectedSpaceId])

  async function loadUser() {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: profile?.name || authUser.email?.split('@')[0],
          avatar_url: profile?.avatar_url,
        })
      }
    } catch (error) {
      console.error('Load user error:', error)
    }
  }

  async function loadSpaces() {
    try {
      const { data, error } = await supabase
        .from('spaces')
        .select('id, name, color, icon')
        .is('archived_at', null)
        .order('name')
      
      if (error) throw error
      setSpaces(data || [])
    } catch (error) {
      console.error('Load spaces error:', error)
    }
  }

  async function loadDocuments() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`*, tasks:task_id (title), projects:project_id (name)`)
        .order('updated_at', { ascending: false })

      if (error) throw error
      const docs = (data || []).map(doc => ({
        ...doc,
        tags: doc.tags || [],
        category: doc.category || 'all',
        visibility: doc.visibility || 'normal',
        archived: doc.archived || false,
        doc_type: doc.doc_type || 'document',
      }))
      setDocuments(docs)
    } catch (error) {
      console.error('Load documents error:', error)
      showErrorToast(error, 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateDocument() {
    if (!user) return showErrorToast(null, 'Please sign in');
    try {
      const { data, error } = await supabase
        .from('documents')
        .insert({
          title: 'Untitled Document',
          content: '',
          status: 'draft',
          created_by: user.id,
          space_id: selectedSpaceId,
          doc_type: 'document',
        })
        .select().single()
      if (error) throw error
      router.push(`/docs/${data.id}/edit`)
    } catch (error) {
      showErrorToast(error, 'Failed to create document')
    }
  }

  async function handleCreateNote() {
    setIsNoteModalOpen(true)
  }

  async function handleSaveQuickNote() {
    if (!user) return showErrorToast(null, 'Please sign in');
    if (!noteTitle.trim()) return showErrorToast(null, 'Please enter a title');
    if (!noteContent.trim()) return showErrorToast(null, 'Please enter content');

    setCreatingNote(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .insert({
          title: noteTitle.trim(),
          content: noteContent.trim(),
          status: 'approved',
          created_by: user.id,
          space_id: selectedSpaceId,
          doc_type: 'note',
        })
        .select().single()
      if (error) throw error
      
      showSuccessToast('Note created successfully')
      setIsNoteModalOpen(false)
      setNoteTitle('')
      setNoteContent('')
      loadDocuments() // Refresh the list
    } catch (error) {
      showErrorToast(error, 'Failed to create note')
    } finally {
      setCreatingNote(false)
    }
  }

  // Open a note in the view modal
  function handleOpenNote(doc: Document) {
    setViewingNote(doc)
    setEditNoteTitle(doc.title)
    setEditNoteContent(doc.content)
    setNoteHasChanges(false)
    setIsNoteViewOpen(true)
    loadNoteComments(doc.id)
  }

  // Load comments for a note
  async function loadNoteComments(docId: string) {
    setLoadingNoteComments(true)
    try {
      const { data, error } = await supabase
        .from('document_comments')
        .select('*')
        .eq('document_id', docId)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      setNoteComments(data || [])
    } catch (error) {
      console.error('Load comments error:', error)
    } finally {
      setLoadingNoteComments(false)
    }
  }

  // Save note edits
  async function handleSaveNoteEdit() {
    if (!viewingNote || !user) return
    
    setSavingNote(true)
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          title: editNoteTitle.trim(),
          content: editNoteContent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', viewingNote.id)
      
      if (error) throw error
      
      showSuccessToast('Note saved')
      setNoteHasChanges(false)
      
      // Update local documents list
      setDocuments(prev => prev.map(d => 
        d.id === viewingNote.id 
          ? { ...d, title: editNoteTitle.trim(), content: editNoteContent, updated_at: new Date().toISOString() }
          : d
      ))
      setViewingNote(prev => prev ? { ...prev, title: editNoteTitle.trim(), content: editNoteContent } : null)
    } catch (error) {
      showErrorToast(error, 'Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  // Add comment to note with @mention support
  async function handleAddNoteComment() {
    if (!newNoteComment.trim() || !user || !viewingNote) return
    
    setSendingNoteComment(true)
    try {
      const { data, error } = await supabase
        .from('document_comments')
        .insert({
          document_id: viewingNote.id,
          content: newNoteComment.trim(),
          author_id: user.id,
          author_name: user.name || user.email,
          comment_type: 'comment',
        })
        .select()
        .single()
      
      if (error) throw error
      
      setNoteComments(prev => [...prev, data])
      setNewNoteComment('')
      setShowMentions(false)
    } catch (error) {
      showErrorToast(error, 'Failed to add comment')
    } finally {
      setSendingNoteComment(false)
    }
  }

  // Handle @mention input
  function handleCommentChange(value: string) {
    setNewNoteComment(value)
    
    // Check for @mention trigger
    const lastAtIndex = value.lastIndexOf('@')
    if (lastAtIndex !== -1) {
      const textAfterAt = value.slice(lastAtIndex + 1)
      // Show mentions if @ is the last char or if there's text after it that matches a user
      if (textAfterAt === '' || !textAfterAt.includes(' ')) {
        setMentionFilter(textAfterAt.toLowerCase())
        setShowMentions(true)
      } else {
        setShowMentions(false)
      }
    } else {
      setShowMentions(false)
    }
  }

  // Insert @mention into comment
  function insertMention(username: string) {
    const lastAtIndex = newNoteComment.lastIndexOf('@')
    const beforeAt = newNoteComment.slice(0, lastAtIndex)
    setNewNoteComment(`${beforeAt}@${username} `)
    setShowMentions(false)
  }

  // Track changes in note edit
  useEffect(() => {
    if (viewingNote) {
      const changed = editNoteTitle !== viewingNote.title || editNoteContent !== viewingNote.content
      setNoteHasChanges(changed)
    }
  }, [editNoteTitle, editNoteContent, viewingNote])

  // Format comment date
  const formatCommentDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    documents.forEach(doc => (doc.tags || []).forEach(tag => tagSet.add(tag)))
    return Array.from(tagSet).sort()
  }, [documents])

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      if (docTypeFilter !== 'all' && doc.doc_type !== docTypeFilter) return false
      if (!showArchived && doc.archived) return false
      if (!showHidden && doc.visibility === 'hidden') return false
      if (spaceFilter !== 'all' && doc.space_id !== spaceFilter) return false
      if (statusFilter !== 'all' && doc.status !== statusFilter) return false
      if (selectedTags.length > 0 && !selectedTags.some(tag => (doc.tags || []).includes(tag))) return false
      
      if (searchQuery) {
        const s = searchQuery.toLowerCase()
        return doc.title.toLowerCase().includes(s) || doc.content.toLowerCase().includes(s)
      }
      return true
    })
  }, [documents, searchQuery, statusFilter, spaceFilter, docTypeFilter, selectedTags, showArchived, showHidden])

  const getPreview = (content: string) => {
    // Strip HTML tags and markdown symbols
    const stripped = content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/[#*`\[\]]/g, '') // Remove markdown symbols
      .replace(/&nbsp;/g, ' ') // Replace HTML entities
      .replace(/\n+/g, ' ')
      .trim()
    return stripped.length > 150 ? stripped.slice(0, 150) + '...' : stripped
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar user={user} />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-violet-600 dark:text-violet-400" />
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Docs</h1>
          </div>
          <div className="flex gap-2">
            <Button color="primary" size="sm" onPress={handleCreateDocument} startContent={<Plus className="w-4 h-4" />}>
              + Doc
            </Button>
            <Button color="secondary" size="sm" variant="flat" onPress={handleCreateNote} startContent={<NotebookPen className="w-4 h-4" />}>
              + Note
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-4">
          <Button
            size="sm"
            variant={docTypeFilter === 'all' ? 'solid' : 'flat'}
            color={docTypeFilter === 'all' ? 'primary' : 'default'}
            onPress={() => setDocTypeFilter('all')}
            className="rounded-full"
          >
            All
          </Button>
          <Button
            size="sm"
            variant={docTypeFilter === 'document' ? 'solid' : 'flat'}
            color={docTypeFilter === 'document' ? 'primary' : 'default'}
            onPress={() => setDocTypeFilter('document')}
            className="rounded-full"
          >
            Documents
          </Button>
          <Button
            size="sm"
            variant={docTypeFilter === 'note' ? 'solid' : 'flat'}
            color={docTypeFilter === 'note' ? 'primary' : 'default'}
            onPress={() => setDocTypeFilter('note')}
            className="rounded-full"
          >
            Notes
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Input
            placeholder="Search docs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startContent={<Search className="w-4 h-4 text-slate-400" />}
            className="flex-1"
          />
          <Select
            selectedKeys={[spaceFilter]}
            onChange={(e) => setSpaceFilter(e.target.value)}
            className="w-full sm:w-48"
          >
            <SelectItem key="all">All Spaces</SelectItem>
            <>
              {spaces.map(space => (
                <SelectItem key={space.id}>{space.name}</SelectItem>
              ))}
            </>
          </Select>
          <Select
            selectedKeys={[statusFilter]}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-48"
          >
            <>
              {statusOptions.map(s => <SelectItem key={s.key}>{s.label}</SelectItem>)}
            </>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
        ) : filteredDocuments.length === 0 ? (
          <Card><CardBody className="text-center py-16 opacity-50"><FileText className="w-12 h-12 mx-auto mb-2" /><p>No docs found.</p></CardBody></Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((doc) => (
              <Card key={doc.id} isPressable onPress={() => {
                if (doc.doc_type === 'note') {
                  handleOpenNote(doc)
                } else {
                  router.push(`/docs/${doc.id}`)
                }
              }} className="border border-slate-200 dark:border-slate-700">
                <CardBody className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold line-clamp-1">{doc.title}</h3>
                    <Chip size="sm" variant="flat" color={getStatusColor(doc.status) as any}>{getStatusLabel(doc.status)}</Chip>
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-3 mb-3">{getPreview(doc.content)}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <div className="flex items-center gap-2">
                      <span>{new Date(doc.updated_at).toLocaleDateString()}</span>
                      {doc.project_id && doc.projects && (
                        <span className="flex items-center gap-1 text-violet-500">
                          <Users className="w-3 h-3" />
                          {doc.projects.name}
                        </span>
                      )}
                    </div>
                    <Chip size="sm" variant="dot" color={doc.doc_type === 'note' ? 'secondary' : 'primary'}>
                      {doc.doc_type === 'note' ? 'Note' : 'Document'}
                    </Chip>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        {/* Quick Note Modal */}
        <Modal isOpen={isNoteModalOpen} onClose={() => setIsNoteModalOpen(false)} size="2xl">
          <ModalContent>
            <ModalHeader className="flex items-center gap-2">
              <NotebookPen className="w-5 h-5" />
              Quick Note
            </ModalHeader>
            <ModalBody>
              <Input
                label="Title"
                placeholder="Note title..."
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="mb-4"
                isRequired
              />
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Content</label>
                <RichTextEditor
                  content={noteContent}
                  onChange={setNoteContent}
                  placeholder="Write your note here..."
                  minHeight="200px"
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={() => setIsNoteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={handleSaveQuickNote}
                isLoading={creatingNote}
                isDisabled={!noteTitle.trim() || !noteContent.trim()}
              >
                Save Note
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Note View/Edit Modal */}
        <Modal 
          isOpen={isNoteViewOpen} 
          onClose={() => {
            if (noteHasChanges) {
              if (confirm('You have unsaved changes. Discard them?')) {
                setIsNoteViewOpen(false)
                setViewingNote(null)
              }
            } else {
              setIsNoteViewOpen(false)
              setViewingNote(null)
            }
          }} 
          size="3xl"
          scrollBehavior="inside"
        >
          <ModalContent>
            <ModalHeader className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <NotebookPen className="w-5 h-5 text-violet-600" />
                <span>Note</span>
                {noteHasChanges && (
                  <Chip size="sm" color="warning" variant="flat">Unsaved</Chip>
                )}
              </div>
              <Button
                color="primary"
                size="sm"
                onPress={handleSaveNoteEdit}
                isLoading={savingNote}
                isDisabled={!noteHasChanges}
              >
                Save
              </Button>
            </ModalHeader>
            <ModalBody>
              {viewingNote && (
                <>
                  {/* Title */}
                  <Input
                    value={editNoteTitle}
                    onChange={(e) => setEditNoteTitle(e.target.value)}
                    placeholder="Note title..."
                    className="mb-4"
                    classNames={{
                      input: 'text-xl font-semibold',
                    }}
                    variant="underlined"
                  />
                  
                  {/* Content with WYSIWYG */}
                  <div className="mb-6">
                    <RichTextEditor
                      content={editNoteContent}
                      onChange={setEditNoteContent}
                      placeholder="Write your note..."
                      minHeight="250px"
                    />
                  </div>

                  <Divider className="my-4" />

                  {/* Comments Section */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Comments
                      {noteComments.length > 0 && (
                        <Chip size="sm" variant="flat">{noteComments.length}</Chip>
                      )}
                    </h4>

                    {/* Comments List */}
                    <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                      {loadingNoteComments ? (
                        <div className="flex items-center justify-center py-4">
                          <Spinner size="sm" />
                          <span className="ml-2 text-sm text-slate-500">Loading comments...</span>
                        </div>
                      ) : noteComments.length === 0 ? (
                        <div className="text-center py-4 text-sm text-slate-400">
                          No comments yet
                        </div>
                      ) : (
                        noteComments.map((comment) => (
                          <div
                            key={comment.id}
                            className={`p-3 rounded-lg text-sm ${
                              comment.comment_type === 'revision_request'
                                ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
                                : 'bg-slate-100 dark:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {comment.author_name}
                              </span>
                              {comment.comment_type === 'revision_request' && (
                                <Chip size="sm" color="warning" variant="flat" className="h-4 text-[10px]">
                                  <RotateCcw className="w-2 h-2 mr-0.5" />
                                  Revision
                                </Chip>
                              )}
                              <span className="text-xs text-slate-400">
                                {formatCommentDate(comment.created_at)}
                              </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                              {comment.content}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Comment */}
                    {user && (
                      <div className="relative">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Add a comment... (use @ to mention)"
                            value={newNoteComment}
                            onChange={(e) => handleCommentChange(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleAddNoteComment()
                              }
                              if (e.key === 'Escape') {
                                setShowMentions(false)
                              }
                            }}
                            isDisabled={sendingNoteComment}
                            size="sm"
                            className="flex-1"
                          />
                          <Button
                            color="primary"
                            isIconOnly
                            size="sm"
                            onPress={handleAddNoteComment}
                            isDisabled={!newNoteComment.trim() || sendingNoteComment}
                            isLoading={sendingNoteComment}
                          >
                            {!sendingNoteComment && <Send className="w-3 h-3" />}
                          </Button>
                        </div>
                        
                        {/* @mention dropdown */}
                        {showMentions && (
                          <div className="absolute bottom-full left-0 mb-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 overflow-hidden">
                            {MENTION_USERS
                              .filter(u => u.toLowerCase().includes(mentionFilter))
                              .map(username => (
                                <button
                                  key={username}
                                  onClick={() => insertMention(username)}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                  @{username}
                                </button>
                              ))
                            }
                            {MENTION_USERS.filter(u => u.toLowerCase().includes(mentionFilter)).length === 0 && (
                              <div className="px-3 py-2 text-sm text-slate-400">No matches</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </ModalBody>
            <ModalFooter>
              <Button 
                variant="flat" 
                onPress={() => {
                  if (noteHasChanges) {
                    if (confirm('You have unsaved changes. Discard them?')) {
                      setIsNoteViewOpen(false)
                      setViewingNote(null)
                    }
                  } else {
                    setIsNoteViewOpen(false)
                    setViewingNote(null)
                  }
                }}
              >
                Close
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </main>
    </div>
  )
}
