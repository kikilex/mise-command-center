'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Search, Plus, Filter } from 'lucide-react'
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
      setDocuments(data || [])
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

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === 'all' || doc.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [documents, searchQuery, statusFilter])

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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar user={user} />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-violet-600 dark:text-violet-400" />
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Documents</h1>
            <Chip size="sm" variant="flat">{documents.length}</Chip>
          </div>
          <Button
            color="primary"
            onPress={handleCreateDocument}
            startContent={<Plus className="w-4 h-4" />}
          >
            New Document
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Input
            placeholder="Search documents..."
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
            startContent={<Filter className="w-4 h-4" />}
            className="w-full sm:w-48"
          >
            {statusOptions.map(s => (
              <SelectItem key={s.key}>{s.label}</SelectItem>
            ))}
          </Select>
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
                {searchQuery || statusFilter !== 'all' ? 'No documents match your filters' : 'No documents yet'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">
                {searchQuery || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'Create your first document to get started'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
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
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 transition-colors"
              >
                <CardBody className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">
                      {doc.title}
                    </h3>
                    <Chip
                      size="sm"
                      color={getStatusColor(doc.status) as any}
                      variant="flat"
                    >
                      {getStatusLabel(doc.status)}
                    </Chip>
                  </div>
                  
                  <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3 mb-3 min-h-[3.6rem]">
                    {getPreview(doc.content)}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                    <span>Updated {formatDate(doc.updated_at)}</span>
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
    </div>
  )
}
