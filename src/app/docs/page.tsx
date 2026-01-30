'use client'

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  FileText, Search, Plus, Clock, Tag, Archive, Eye, EyeOff,
  X, Check, Folder, Settings, Pencil, ListFilter
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
  Tabs,
  Tab,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Checkbox,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Switch,
} from '@heroui/react'
import { createClient } from '@/lib/supabase/client'
import { useBusiness } from '@/lib/business-context'
import Navbar from '@/components/Navbar'
import { showErrorToast } from '@/lib/errors'
import toast from 'react-hot-toast'

interface Document {
  id: string
  title: string
  content: string
  task_id: string | null
  business_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  status: 'draft' | 'in_review' | 'approved' | 'needs_revision'
  version: number
  category: string
  tags: string[]
  visibility: 'normal' | 'hidden'
  archived: boolean
  tasks?: { title: string } | null
}

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

const statusOptions = [
  { key: 'all', label: 'All Statuses' },
  { key: 'draft', label: 'Draft', color: 'default' },
  { key: 'in_review', label: 'In Review', color: 'warning' },
  { key: 'approved', label: 'Approved', color: 'success' },
  { key: 'needs_revision', label: 'Needs Revision', color: 'danger' },
]

const categoryOptions = [
  { key: 'all', label: 'All', icon: Folder },
  { key: 'research', label: 'Research', icon: Search },
  { key: 'content', label: 'Content', icon: FileText },
  { key: 'guides', label: 'Guides', icon: FileText },
  { key: 'business', label: 'Business', icon: Folder },
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
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryTab, setCategoryTab] = useState('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  
  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<Document | null>(null)
  const [editCategory, setEditCategory] = useState('all')
  const [editTags, setEditTags] = useState('')
  const [editVisibility, setEditVisibility] = useState<'normal' | 'hidden'>('normal')
  const [editArchived, setEditArchived] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const supabase = createClient()
  const router = useRouter()
  const { selectedBusinessId } = useBusiness()

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    loadDocuments()
  }, [selectedBusinessId])

  async function loadUser() {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        
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

  async function loadDocuments() {
    setLoading(true)
    try {
      let query = supabase
        .from('documents')
        .select(`
          *,
          tasks:task_id (title)
        `)
        .order('updated_at', { ascending: false })
      
      if (selectedBusinessId) {
        query = query.eq('business_id', selectedBusinessId)
      } else {
        query = query.is('business_id', null)
      }
      
      const { data, error } = await query

      if (error) throw error
      // Ensure tags is always an array
      const docs = (data || []).map(doc => ({
        ...doc,
        tags: doc.tags || [],
        category: doc.category || 'all',
        visibility: doc.visibility || 'normal',
        archived: doc.archived || false,
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
    if (!user) {
      showErrorToast(null, 'Please sign in to create documents')
      return
    }

    try {
      const { data, error } = await supabase
        .from('documents')
        .insert({
          title: 'Untitled Document',
          content: '# New Document\n\nStart writing here...',
          status: 'draft',
          created_by: user.id,
          business_id: selectedBusinessId,
          category: categoryTab !== 'all' ? categoryTab : 'all',
          tags: [],
          visibility: 'normal',
          archived: false,
        })
        .select()
        .single()

      if (error) throw error
      router.push(`/docs/${data.id}/edit`)
    } catch (error) {
      console.error('Create document error:', error)
      showErrorToast(error, 'Failed to create document')
    }
  }

  // Get all unique tags from documents
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    documents.forEach(doc => {
      (doc.tags || []).forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [documents])

  // Check if search query contains special filters
  const parseSearchQuery = useCallback((query: string) => {
    const isArchived = query.includes('is:archived')
    const isHidden = query.includes('is:hidden')
    const cleanQuery = query
      .replace(/is:archived/g, '')
      .replace(/is:hidden/g, '')
      .trim()
    return { cleanQuery, isArchived, isHidden }
  }, [])

  const filteredDocuments = useMemo(() => {
    const { cleanQuery, isArchived, isHidden } = parseSearchQuery(searchQuery)
    
    return documents.filter(doc => {
      // Handle archived filter
      if (isArchived) {
        if (!doc.archived) return false
      } else if (!showArchived && doc.archived) {
        return false
      }
      
      // Handle visibility filter
      if (isHidden) {
        if (doc.visibility !== 'hidden') return false
      } else if (!showHidden && !cleanQuery && !isArchived) {
        // Only hide hidden docs when not searching and showHidden is off
        if (doc.visibility === 'hidden') return false
      }
      
      // Category filter (tab)
      if (categoryTab !== 'all') {
        if (doc.category !== categoryTab) return false
      }
      
      // Status filter
      if (statusFilter !== 'all' && doc.status !== statusFilter) return false
      
      // Tag filter
      if (selectedTags.length > 0) {
        const docTags = doc.tags || []
        if (!selectedTags.some(tag => docTags.includes(tag))) return false
      }
      
      // Search filter (title, content, tags)
      if (cleanQuery) {
        const searchLower = cleanQuery.toLowerCase()
        const titleMatch = doc.title.toLowerCase().includes(searchLower)
        const contentMatch = doc.content.toLowerCase().includes(searchLower)
        const tagMatch = (doc.tags || []).some(tag => 
          tag.toLowerCase().includes(searchLower)
        )
        if (!titleMatch && !contentMatch && !tagMatch) return false
      }
      
      return true
    })
  }, [documents, searchQuery, statusFilter, categoryTab, selectedTags, showArchived, showHidden, parseSearchQuery])

  // Get content preview (first 150 chars, strip markdown)
  const getPreview = (content: string) => {
    const stripped = content
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/\n+/g, ' ')
      .trim()
    return stripped.length > 150 ? stripped.slice(0, 150) + '...' : stripped
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Edit modal handlers
  const openEditModal = (doc: Document, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingDoc(doc)
    setEditCategory(doc.category || 'all')
    setEditTags((doc.tags || []).join(', '))
    setEditVisibility(doc.visibility || 'normal')
    setEditArchived(doc.archived || false)
    setEditModalOpen(true)
  }

  const saveDocumentMeta = async () => {
    if (!editingDoc) return
    setSaving(true)
    try {
      const tagsArray = editTags
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0)
      
      const { error } = await supabase
        .from('documents')
        .update({
          category: editCategory,
          tags: tagsArray,
          visibility: editVisibility,
          archived: editArchived,
        })
        .eq('id', editingDoc.id)
      
      if (error) throw error
      
      toast.success('Document updated')
      setEditModalOpen(false)
      loadDocuments()
    } catch (error) {
      console.error('Save document error:', error)
      showErrorToast(error, 'Failed to save document')
    } finally {
      setSaving(false)
    }
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar user={user} />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-violet-600 dark:text-violet-400" />
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Documents</h1>
          </div>
          <Button
            color="primary"
            onPress={handleCreateDocument}
            startContent={<Plus className="w-4 h-4" />}
          >
            New Document
          </Button>
        </div>

        {/* Category Tabs */}
        <div className="mb-4 overflow-x-auto">
          <div className="flex items-center gap-2">
            <Tabs 
              selectedKey={categoryTab} 
              onSelectionChange={(key) => setCategoryTab(key as string)}
              color="primary"
              variant="underlined"
              classNames={{
                tabList: "gap-4",
                tab: "px-0 h-10",
              }}
            >
              {categoryOptions.map(cat => (
                <Tab 
                  key={cat.key} 
                  title={cat.label}
                />
              ))}
            </Tabs>
            <Popover placement="bottom-end">
              <PopoverTrigger>
                <Button
                  size="sm"
                  variant="light"
                  isIconOnly
                  className="ml-2"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-3">
                <div className="space-y-3">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Display Settings
                  </div>
                  <Switch
                    size="sm"
                    isSelected={showArchived}
                    onValueChange={setShowArchived}
                  >
                    <span className="text-sm flex items-center gap-2">
                      <Archive className="w-4 h-4" />
                      Show archived documents
                    </span>
                  </Switch>
                  <Switch
                    size="sm"
                    isSelected={showHidden}
                    onValueChange={setShowHidden}
                  >
                    <span className="text-sm flex items-center gap-2">
                      <EyeOff className="w-4 h-4" />
                      Show hidden documents
                    </span>
                  </Switch>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Search documents... (use is:archived or is:hidden)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              startContent={<Search className="w-4 h-4 text-slate-400" />}
              className="flex-1"
              isClearable
              onClear={() => setSearchQuery('')}
            />
            <Select
              selectedKeys={[statusFilter]}
              onChange={(e) => setStatusFilter(e.target.value)}
              startContent={<ListFilter className="w-4 h-4" />}
              className="w-full sm:w-48"
            >
              {statusOptions.map(s => (
                <SelectItem key={s.key}>{s.label}</SelectItem>
              ))}
            </Select>
          </div>
          
          {/* Tag Filters */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-4 h-4 text-slate-400" />
              {allTags.map(tag => (
                <Chip
                  key={tag}
                  size="sm"
                  variant={selectedTags.includes(tag) ? 'solid' : 'flat'}
                  color={selectedTags.includes(tag) ? 'primary' : 'default'}
                  className="cursor-pointer"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Chip>
              ))}
              {selectedTags.length > 0 && (
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => setSelectedTags([])}
                  startContent={<X className="w-3 h-3" />}
                >
                  Clear
                </Button>
              )}
            </div>
          )}
          
        </div>

        {/* Document Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : filteredDocuments.length === 0 ? (
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardBody className="text-center py-16">
              <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
                {searchQuery || statusFilter !== 'all' || selectedTags.length > 0 
                  ? 'No documents match your filters' 
                  : 'No documents yet'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                {searchQuery || statusFilter !== 'all' || selectedTags.length > 0
                  ? 'Try adjusting your search or filters'
                  : 'Create your first document to get started'}
              </p>
              {!searchQuery && statusFilter === 'all' && selectedTags.length === 0 && (
                <Button color="primary" onPress={handleCreateDocument}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Document
                </Button>
              )}
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((doc) => (
              <Card
                key={doc.id}
                isPressable
                onPress={() => router.push(`/docs/${doc.id}`)}
                className={`bg-white dark:bg-slate-800 border transition-colors ${
                  doc.status === 'in_review' 
                    ? 'border-blue-300 dark:border-blue-600 ring-2 ring-blue-100 dark:ring-blue-900/50 hover:border-blue-400 dark:hover:border-blue-500' 
                    : doc.archived
                    ? 'border-slate-300 dark:border-slate-600 opacity-60'
                    : doc.visibility === 'hidden'
                    ? 'border-dashed border-slate-300 dark:border-slate-600'
                    : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600'
                }`}
              >
                <CardBody className="p-4">
                  {/* Top indicators row */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      {/* Needs Approval Indicator */}
                      {doc.status === 'in_review' && (
                        <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Needs Approval</span>
                        </div>
                      )}
                      {/* Hidden Indicator */}
                      {doc.visibility === 'hidden' && (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Hidden</span>
                        </div>
                      )}
                      {/* Archived Indicator */}
                      {doc.archived && (
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Archive className="w-3.5 h-3.5" />
                          <span>Archived</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">
                      {doc.title}
                    </h3>
                    <Chip
                      size="sm"
                      color={getStatusColor(doc.status) as any}
                      variant={doc.status === 'in_review' ? 'solid' : 'flat'}
                    >
                      {getStatusLabel(doc.status)}
                    </Chip>
                  </div>
                  
                  <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-3 min-h-[3.6rem]">
                    {getPreview(doc.content)}
                  </p>
                  
                  {/* Tags */}
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {doc.tags.slice(0, 3).map(tag => (
                        <Chip key={tag} size="sm" variant="flat" className="text-xs">
                          {tag}
                        </Chip>
                      ))}
                      {doc.tags.length > 3 && (
                        <Chip size="sm" variant="flat" className="text-xs">
                          +{doc.tags.length - 3}
                        </Chip>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                    <div className="flex items-center gap-2">
                      <span>Updated {formatDate(doc.updated_at)}</span>
                      {doc.category && doc.category !== 'all' && (
                        <Chip 
                          size="sm" 
                          variant="dot" 
                          color={getCategoryColor(doc.category) as any}
                          className="text-xs"
                        >
                          {doc.category}
                        </Chip>
                      )}
                    </div>
                    {doc.tasks && (
                      <Chip size="sm" variant="flat" className="text-xs">
                        📋 {doc.tasks.title}
                      </Chip>
                    )}
                  </div>
                  
                  {doc.version > 1 && (
                    <div className="mt-2">
                      <Chip size="sm" variant="dot" className="text-xs">
                        v{doc.version}
                      </Chip>
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Edit Modal */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} size="md">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Edit Document Properties
          </ModalHeader>
          <ModalBody>
            {editingDoc && (
              <div className="space-y-4">
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                  {editingDoc.title}
                </div>
                
                {/* Category */}
                <Select
                  label="Category"
                  selectedKeys={[editCategory]}
                  onChange={(e) => setEditCategory(e.target.value)}
                  startContent={<Folder className="w-4 h-4" />}
                >
                  {categoryOptions.map(cat => (
                    <SelectItem key={cat.key}>{cat.label}</SelectItem>
                  ))}
                </Select>
                
                {/* Tags */}
                <Input
                  label="Tags"
                  placeholder="research, competitor, urgent"
                  description="Comma-separated tags"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  startContent={<Tag className="w-4 h-4 text-slate-400" />}
                />
                
                {/* Visibility */}
                <Select
                  label="Visibility"
                  selectedKeys={[editVisibility]}
                  onChange={(e) => setEditVisibility(e.target.value as 'normal' | 'hidden')}
                  startContent={editVisibility === 'hidden' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                >
                  <SelectItem key="normal" startContent={<Eye className="w-4 h-4" />}>
                    Normal
                  </SelectItem>
                  <SelectItem key="hidden" startContent={<EyeOff className="w-4 h-4" />}>
                    Hidden
                  </SelectItem>
                </Select>
                
                {/* Archived */}
                <Checkbox
                  isSelected={editArchived}
                  onValueChange={setEditArchived}
                >
                  <span className="flex items-center gap-2">
                    <Archive className="w-4 h-4" />
                    Archive this document
                  </span>
                </Checkbox>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onPress={saveDocumentMeta}
              isLoading={saving}
              startContent={!saving && <Check className="w-4 h-4" />}
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
