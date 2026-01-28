'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  Button, 
  Card, 
  CardBody,
  Chip,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
  Textarea,
  useDisclosure,
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast, getErrorMessage } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'

interface Note {
  id: string
  title: string
  content: string | null
  folder: string
  owner_id: string
  project_id: string | null
  tags: string[]
  is_pinned: boolean
  created_at: string
  updated_at: string
}

interface Project {
  id: string
  name: string
  color: string
}

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

const defaultFolders = [
  { key: 'general', label: '📁 General', color: 'bg-slate-100 text-slate-700' },
  { key: 'work', label: '💼 Work', color: 'bg-blue-100 text-blue-700' },
  { key: 'personal', label: '👤 Personal', color: 'bg-green-100 text-green-700' },
  { key: 'ideas', label: '💡 Ideas', color: 'bg-yellow-100 text-yellow-700' },
  { key: 'archive', label: '📦 Archive', color: 'bg-gray-100 text-gray-600' },
]

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    folder: 'general',
    project_id: '',
    tags: [] as string[],
    is_pinned: false,
  })
  
  const supabase = createClient()

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadNotes()
      loadProjects()
    }
  }, [user])

  async function loadUser() {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        console.error('Auth error:', authError)
        return
      }
      
      if (authUser) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single()
          
          if (profileError) {
            console.error('Profile fetch error:', profileError)
          }
          
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            name: profile?.name || authUser.email?.split('@')[0],
            avatar_url: profile?.avatar_url,
          })
        } catch (err) {
          console.error('Failed to fetch profile:', err)
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            name: authUser.email?.split('@')[0],
          })
        }
      }
    } catch (error) {
      console.error('Load user error:', error)
      showErrorToast(error, 'Failed to load user data')
    }
  }

  async function loadNotes() {
    if (!user) return
    
    setLoading(true)
    setLoadError(null)
    
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('owner_id', user.id)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false })
      
      if (error) {
        throw error
      }
      
      setNotes(data || [])
    } catch (error) {
      console.error('Load notes error:', error)
      setLoadError(getErrorMessage(error))
      showErrorToast(error, 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  async function loadProjects() {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, color')
        .eq('owner_id', user.id)
        .order('name')
      
      if (error) {
        throw error
      }
      
      setProjects(data || [])
    } catch (error) {
      console.error('Load projects error:', error)
    }
  }

  async function handleSubmit() {
    if (!user) {
      showErrorToast(null, 'Please sign in to manage notes')
      return
    }
    
    if (!formData.title.trim()) {
      showErrorToast(null, 'Please enter a note title')
      return
    }
    
    setSubmitting(true)
    
    try {
      if (editingNote) {
        const { error } = await supabase
          .from('notes')
          .update({
            title: formData.title,
            content: formData.content || null,
            folder: formData.folder,
            project_id: formData.project_id || null,
            tags: formData.tags,
            is_pinned: formData.is_pinned,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingNote.id)
        
        if (error) {
          throw error
        }
        
        showSuccessToast('Note updated successfully')
        loadNotes()
        handleClose()
      } else {
        const { error } = await supabase
          .from('notes')
          .insert({
            title: formData.title,
            content: formData.content || null,
            folder: formData.folder,
            project_id: formData.project_id || null,
            tags: formData.tags,
            is_pinned: formData.is_pinned,
            owner_id: user.id,
          })
        
        if (error) {
          throw error
        }
        
        showSuccessToast('Note created successfully')
        loadNotes()
        handleClose()
      }
    } catch (error) {
      console.error('Submit note error:', error)
      showErrorToast(error, editingNote ? 'Failed to update note' : 'Failed to create note')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(noteId: string) {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)
      
      if (error) {
        throw error
      }
      
      showSuccessToast('Note deleted')
      loadNotes()
    } catch (error) {
      console.error('Delete note error:', error)
      showErrorToast(error, 'Failed to delete note')
    }
  }

  async function handleTogglePin(note: Note) {
    try {
      const { error } = await supabase
        .from('notes')
        .update({ is_pinned: !note.is_pinned })
        .eq('id', note.id)
      
      if (error) {
        throw error
      }
      
      showSuccessToast(note.is_pinned ? 'Note unpinned' : 'Note pinned')
      loadNotes()
    } catch (error) {
      console.error('Toggle pin error:', error)
      showErrorToast(error, 'Failed to update note')
    }
  }

  function handleEdit(note: Note) {
    setEditingNote(note)
    setFormData({
      title: note.title,
      content: note.content || '',
      folder: note.folder,
      project_id: note.project_id || '',
      tags: note.tags || [],
      is_pinned: note.is_pinned,
    })
    setTagInput('')
    onOpen()
  }

  function handleClose() {
    setEditingNote(null)
    setFormData({
      title: '',
      content: '',
      folder: 'general',
      project_id: '',
      tags: [],
      is_pinned: false,
    })
    setTagInput('')
    onClose()
  }

  function handleNew() {
    setEditingNote(null)
    setFormData({
      title: '',
      content: '',
      folder: 'general',
      project_id: '',
      tags: [],
      is_pinned: false,
    })
    setTagInput('')
    onOpen()
  }

  function handleAddTag() {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] })
      setTagInput('')
    }
  }

  function handleRemoveTag(tagToRemove: string) {
    setFormData({ 
      ...formData, 
      tags: formData.tags.filter(t => t !== tagToRemove) 
    })
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  // Get all unique tags from notes
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    notes.forEach(note => {
      note.tags?.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [notes])

  // Get all unique folders from notes
  const usedFolders = useMemo(() => {
    const folderSet = new Set<string>()
    notes.forEach(note => folderSet.add(note.folder))
    return Array.from(folderSet)
  }, [notes])

  // All folders (default + custom)
  const allFolders = useMemo(() => {
    const defaultKeys = defaultFolders.map(f => f.key)
    const customFolders = usedFolders.filter(f => !defaultKeys.includes(f))
    return [
      ...defaultFolders,
      ...customFolders.map(f => ({ key: f, label: `📁 ${f}`, color: 'bg-purple-100 text-purple-700' }))
    ]
  }, [usedFolders])

  // Folder filter options (includes "all")
  const folderFilterOptions = useMemo(() => [
    { key: 'all', label: 'All Folders' },
    ...allFolders
  ], [allFolders])

  // Tag filter options (includes "all")
  const tagFilterOptions = useMemo(() => [
    { key: 'all', label: 'All Tags' },
    ...allTags.map(t => ({ key: t, label: `#${t}` }))
  ], [allTags])

  // Project options (includes "none")
  const projectOptions = useMemo(() => [
    { key: '', label: 'None' },
    ...projects.map(p => ({ key: p.id, label: p.name }))
  ], [projects])

  // Filter notes
  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesTitle = note.title.toLowerCase().includes(query)
        const matchesContent = note.content?.toLowerCase().includes(query)
        const matchesTags = note.tags?.some(t => t.toLowerCase().includes(query))
        if (!matchesTitle && !matchesContent && !matchesTags) return false
      }
      
      // Folder filter
      if (selectedFolder !== 'all' && note.folder !== selectedFolder) return false
      
      // Tag filter
      if (selectedTag !== 'all' && !note.tags?.includes(selectedTag)) return false
      
      return true
    })
  }, [notes, searchQuery, selectedFolder, selectedTag])

  const getFolderInfo = (folder: string) => {
    return allFolders.find(f => f.key === folder) || { key: folder, label: folder, color: 'bg-slate-100 text-slate-700' }
  }

  const getProjectInfo = (projectId: string | null) => {
    if (!projectId) return null
    return projects.find(p => p.id === projectId)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <Navbar 
        user={user} 
        actions={
          <Button 
            color="primary" 
            size="sm" 
            onPress={handleNew}
          >
            + New Note
          </Button>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Notes</h1>
          <p className="text-slate-500">{filteredNotes.length} notes</p>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="lg:w-80"
            startContent={
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            isClearable
            onClear={() => setSearchQuery('')}
          />
          
          <div className="flex gap-2 flex-wrap">
            <Select
              label="Folder"
              selectedKeys={[selectedFolder]}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="w-40"
              size="sm"
            >
              {folderFilterOptions.map(f => (
                <SelectItem key={f.key}>{f.label}</SelectItem>
              ))}
            </Select>
            
            {allTags.length > 0 && (
              <Select
                label="Tag"
                selectedKeys={[selectedTag]}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-40"
                size="sm"
              >
                {tagFilterOptions.map(t => (
                  <SelectItem key={t.key}>{t.label}</SelectItem>
                ))}
              </Select>
            )}
          </div>
        </div>

        {/* Folder Pills */}
        <div className="flex gap-2 flex-wrap mb-6">
          <Button 
            size="sm" 
            variant={selectedFolder === 'all' ? 'solid' : 'flat'}
            color="primary"
            onPress={() => setSelectedFolder('all')}
          >
            All ({notes.length})
          </Button>
          {allFolders.map(folder => {
            const count = notes.filter(n => n.folder === folder.key).length
            if (count === 0 && !defaultFolders.find(f => f.key === folder.key)) return null
            return (
              <Button
                key={folder.key}
                size="sm"
                variant={selectedFolder === folder.key ? 'solid' : 'flat'}
                onPress={() => setSelectedFolder(folder.key)}
              >
                {folder.label} ({count})
              </Button>
            )
          })}
        </div>

        {/* Error State */}
        {loadError && !loading && (
          <div className="mb-6">
            <ErrorFallback error={loadError} resetError={loadNotes} />
          </div>
        )}

        {/* Notes Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading notes...</div>
        ) : !loadError && filteredNotes.length === 0 ? (
          <Card className="bg-white">
            <CardBody className="text-center py-12">
              <div className="text-4xl mb-4">📝</div>
              <p className="text-slate-500 mb-4">
                {searchQuery || selectedFolder !== 'all' || selectedTag !== 'all' 
                  ? 'No notes match your filters' 
                  : 'No notes yet'}
              </p>
              {!searchQuery && selectedFolder === 'all' && selectedTag === 'all' && (
                <Button color="primary" onPress={handleNew}>Create your first note</Button>
              )}
            </CardBody>
          </Card>
        ) : !loadError && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNotes.map(note => {
              const folderInfo = getFolderInfo(note.folder)
              const project = getProjectInfo(note.project_id)
              
              return (
                <Card 
                  key={note.id} 
                  className="bg-white hover:shadow-md transition-shadow cursor-pointer"
                  isPressable
                  onPress={() => handleEdit(note)}
                >
                  <CardBody className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Chip size="sm" className={folderInfo.color}>
                          {folderInfo.label.split(' ')[0]}
                        </Chip>
                        {note.is_pinned && (
                          <span className="text-amber-500" title="Pinned">📌</span>
                        )}
                      </div>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={() => handleTogglePin(note)}
                        className="text-slate-400 hover:text-amber-500"
                      >
                        {note.is_pinned ? '📌' : '📍'}
                      </Button>
                    </div>
                    
                    {/* Title */}
                    <h3 className="font-semibold text-slate-800 mb-2 line-clamp-1">{note.title}</h3>
                    
                    {/* Content Preview */}
                    {note.content && (
                      <p className="text-sm text-slate-500 line-clamp-3 mb-3">
                        {note.content}
                      </p>
                    )}
                    
                    {/* Project Link */}
                    {project && (
                      <div className="mb-2">
                        <Chip 
                          size="sm" 
                          variant="flat"
                          style={{ 
                            backgroundColor: `${project.color}20`, 
                            color: project.color 
                          }}
                        >
                          🔗 {project.name}
                        </Chip>
                      </div>
                    )}
                    
                    {/* Tags */}
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap mb-3">
                        {note.tags.slice(0, 3).map(tag => (
                          <Chip 
                            key={tag} 
                            size="sm" 
                            variant="flat" 
                            className="bg-violet-100 text-violet-700 text-xs"
                          >
                            #{tag}
                          </Chip>
                        ))}
                        {note.tags.length > 3 && (
                          <Chip size="sm" variant="flat" className="text-xs">
                            +{note.tags.length - 3}
                          </Chip>
                        )}
                      </div>
                    )}
                    
                    {/* Footer */}
                    <div className="text-xs text-slate-400 mt-auto">
                      Updated {formatDate(note.updated_at)}
                    </div>
                  </CardBody>
                </Card>
              )
            })}
          </div>
        )}
      </main>

      {/* Create/Edit Modal */}
      <Modal isOpen={isOpen} onClose={handleClose} size="2xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <span>{editingNote ? 'Edit Note' : 'New Note'}</span>
              {formData.is_pinned && <span className="text-amber-500">📌</span>}
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input
                label="Title"
                placeholder="Note title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                isRequired
              />
              
              <Textarea
                label="Content"
                placeholder="Write your note here..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                minRows={8}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Folder"
                  selectedKeys={[formData.folder]}
                  onChange={(e) => setFormData({ ...formData, folder: e.target.value })}
                >
                  {allFolders.map(f => (
                    <SelectItem key={f.key}>{f.label}</SelectItem>
                  ))}
                </Select>
                
                <Select
                  label="Link to Project (optional)"
                  selectedKeys={formData.project_id ? [formData.project_id] : []}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                >
                  {projectOptions.map(p => (
                    <SelectItem key={p.key}>{p.label}</SelectItem>
                  ))}
                </Select>
              </div>
              
              {/* Tags */}
              <div>
                <label className="text-sm text-slate-600 mb-2 block">Tags</label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {formData.tags.map(tag => (
                    <Chip 
                      key={tag}
                      onClose={() => handleRemoveTag(tag)}
                      variant="flat"
                      className="bg-violet-100 text-violet-700"
                    >
                      #{tag}
                    </Chip>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    size="sm"
                    className="flex-1"
                  />
                  <Button 
                    size="sm" 
                    variant="flat" 
                    onPress={handleAddTag}
                    isDisabled={!tagInput.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
              
              {/* Pin toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_pinned}
                  onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">📌 Pin this note</span>
              </label>
            </div>
          </ModalBody>
          <ModalFooter>
            {editingNote && (
              <Button 
                color="danger" 
                variant="flat" 
                onPress={() => { handleDelete(editingNote.id); handleClose(); }}
                className="mr-auto"
              >
                Delete
              </Button>
            )}
            <Button variant="flat" onPress={handleClose}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onPress={handleSubmit}
              isDisabled={!formData.title.trim()}
              isLoading={submitting}
            >
              {editingNote ? 'Save Changes' : 'Create Note'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
