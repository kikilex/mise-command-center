'use client'

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  FileText, Search, Plus, Clock, Tag, Archive, Eye, EyeOff,
  X, Check, Folder, Settings, Pencil, ListFilter, NotebookPen
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
  space_id: string | null
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
  
  const supabase = createClient()
  const router = useRouter()
  const { selectedBusinessId } = useBusiness()

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    loadDocuments()
    loadSpaces()
  }, [selectedBusinessId])

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
        .select(`*, tasks:task_id (title)`)
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
          content: '# New Document\n\nStart writing here...',
          status: 'draft',
          created_by: user.id,
          space_id: selectedBusinessId,
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
    if (!user) return showErrorToast(null, 'Please sign in');
    try {
      const { data, error } = await supabase
        .from('documents')
        .insert({
          title: 'New Note',
          content: 'Quick note content...',
          status: 'approved',
          created_by: user.id,
          space_id: selectedBusinessId,
          doc_type: 'note',
        })
        .select().single()
      if (error) throw error
      router.push(`/docs/${data.id}/edit`)
    } catch (error) {
      showErrorToast(error, 'Failed to create note')
    }
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
    const stripped = content.replace(/[#*`\[\]]/g, '').replace(/\n+/g, ' ').trim()
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
            <Button color="primary" onPress={handleCreateDocument} startContent={<Plus className="w-4 h-4" />}>
              New Doc
            </Button>
            <Button color="secondary" variant="flat" onPress={handleCreateNote} startContent={<NotebookPen className="w-4 h-4" />}>
              New Note
            </Button>
          </div>
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
            selectedKeys={[docTypeFilter]}
            onChange={(e) => setDocTypeFilter(e.target.value)}
            className="w-full sm:w-48"
          >
            <SelectItem key="all">All Types</SelectItem>
            <SelectItem key="document">Documents</SelectItem>
            <SelectItem key="note">Notes</SelectItem>
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
              <Card key={doc.id} isPressable onPress={() => router.push(`/docs/${doc.id}`)} className="border border-slate-200 dark:border-slate-700">
                <CardBody className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold line-clamp-1">{doc.title}</h3>
                    <Chip size="sm" variant="flat" color={getStatusColor(doc.status) as any}>{getStatusLabel(doc.status)}</Chip>
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-3 mb-3">{getPreview(doc.content)}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{new Date(doc.updated_at).toLocaleDateString()}</span>
                    <Chip size="sm" variant="dot" color={doc.doc_type === 'note' ? 'secondary' : 'primary'}>
                      {doc.doc_type === 'note' ? 'Note' : 'Document'}
                    </Chip>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
