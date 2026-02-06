'use client'

import { useState, useEffect, useMemo, use, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useTheme } from 'next-themes'
import { ArrowLeft, Edit, FileText, List, ExternalLink, Share2, Check, RotateCcw, MessageSquare, Send, AlertCircle, Trash2, CheckCircle2, Clock, ChevronDown, ChevronRight, ArrowUp, ArrowDown, ChevronsDownUp, ChevronsUpDown, Folder, Tag as TagIcon, X, Plus, Settings, History, Pencil } from 'lucide-react'
import {
  Button,
  Chip,
  Spinner,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  Input,
  Select,
  SelectItem,
  useDisclosure,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@heroui/react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast } from '@/lib/errors'

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
  tasks?: { id: string; title: string } | null
}

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

interface TOCItem {
  id: string
  text: string
  level: number
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

const categoryOptions = [
  { key: 'all', label: 'Uncategorized' },
  { key: 'research', label: 'Research' },
  { key: 'scripts', label: 'Scripts' },
  { key: 'notes', label: 'Notes' },
  { key: 'reference', label: 'Reference' },
]

export default function DocumentReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const [document, setDocument] = useState<Document | null>(null)
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showTOC, setShowTOC] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // Comments state
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  
  // Revision modal state
  const { isOpen: isRevisionOpen, onOpen: onRevisionOpen, onClose: onRevisionClose } = useDisclosure()
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure()
  const [deleting, setDeleting] = useState(false)
  const [revisionFeedback, setRevisionFeedback] = useState('')
  const [submittingRevision, setSubmittingRevision] = useState(false)
  
  // Approval state
  const [approving, setApproving] = useState(false)
  
  // TOC collapsible sections state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  
  // Floating scroll button state
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [isAtBottom, setIsAtBottom] = useState(false)
  
  // Category and tag editing state
  const [editCategory, setEditCategory] = useState('all')
  const [editTags, setEditTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)
  
  // Document properties popover state
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  
  // Document history state
  const { isOpen: isHistoryOpen, onOpen: onHistoryOpen, onClose: onHistoryClose } = useDisclosure()
  const [versions, setVersions] = useState<any[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<any>(null)
  const { isOpen: isVersionViewOpen, onOpen: onVersionViewOpen, onClose: onVersionViewClose } = useDisclosure()
  
  // Theme for syntax highlighting
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadUser()
    loadDocument()
  }, [id])

  // Scroll listener for floating button
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const scrollHeight = document ? window.document.documentElement.scrollHeight : 0
      const clientHeight = window.innerHeight
      
      // Show button after scrolling down 300px
      setShowScrollButton(scrollTop > 300)
      
      // Check if at bottom (within 100px)
      setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 100)
    }
    
    window.addEventListener('scroll', handleScroll)
    handleScroll() // Initial check
    
    return () => window.removeEventListener('scroll', handleScroll)
  }, [document])

  // Toggle section collapse
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }, [])

  // Scroll to top or bottom
  const handleScrollButton = useCallback(() => {
    if (isAtBottom) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: window.document.documentElement.scrollHeight, behavior: 'smooth' })
    }
  }, [isAtBottom])

  useEffect(() => {
    if (document) {
      loadComments()
    }
  }, [document?.id])

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

  async function loadDocument() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          tasks:task_id (id, title)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      setDocument(data)
      // Initialize edit state with document data
      setEditCategory(data.category || 'all')
      setEditTags(data.tags || [])
    } catch (error) {
      console.error('Load document error:', error)
      showErrorToast(error, 'Failed to load document')
      router.push('/docs')
    } finally {
      setLoading(false)
    }
  }

  async function loadComments() {
    setLoadingComments(true)
    try {
      const { data, error } = await supabase
        .from('document_comments')
        .select('*')
        .eq('document_id', id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error('Load comments error:', error)
    } finally {
      setLoadingComments(false)
    }
  }

  async function loadVersions() {
    setLoadingVersions(true)
    try {
      const { data, error } = await supabase
        .from('document_versions')
        .select(`
          *,
          users:created_by (id, email, name)
        `)
        .eq('document_id', id)
        .order('version', { ascending: false })

      if (error) throw error
      setVersions(data || [])
    } catch (error) {
      console.error('Load versions error:', error)
      showErrorToast(error, 'Failed to load version history')
    } finally {
      setLoadingVersions(false)
    }
  }

  function handleViewVersion(version: any) {
    setSelectedVersion(version)
    onVersionViewOpen()
  }

  function handleOpenHistory() {
    onHistoryOpen()
    loadVersions()
  }

  async function saveDocumentMeta() {
    if (!document) return
    setSavingMeta(true)
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          category: editCategory,
          tags: editTags,
        })
        .eq('id', document.id)
      
      if (error) throw error
      
      // Update local document state
      setDocument(prev => prev ? {
        ...prev,
        category: editCategory,
        tags: editTags,
      } : null)
      
      showSuccessToast('Document updated')
    } catch (error) {
      console.error('Save document error:', error)
      showErrorToast(error, 'Failed to save document')
    } finally {
      setSavingMeta(false)
    }
  }

  const addTag = () => {
    const trimmedTag = newTag.trim().toLowerCase()
    if (trimmedTag && !editTags.includes(trimmedTag)) {
      setEditTags(prev => [...prev, trimmedTag])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setEditTags(prev => prev.filter(tag => tag !== tagToRemove))
  }

  async function handleAddComment() {
    if (!newComment.trim() || !user) return
    
    setSendingComment(true)
    try {
      const { data, error } = await supabase
        .from('document_comments')
        .insert({
          document_id: id,
          content: newComment.trim(),
          author_id: user.id,
          author_name: user.name || user.email,
          comment_type: 'comment',
        })
        .select()
        .single()

      if (error) throw error
      
      setComments(prev => [...prev, data])
      setNewComment('')
    } catch (error) {
      console.error('Add comment error:', error)
      showErrorToast(error, 'Failed to add comment')
    } finally {
      setSendingComment(false)
    }
  }

  async function handleRequestRevision() {
    if (!revisionFeedback.trim() || !user || !document) return
    
    setSubmittingRevision(true)
    try {
      // 1. Update document status to needs_revision
      const { error: docError } = await supabase
        .from('documents')
        .update({ status: 'needs_revision' })
        .eq('id', id)

      if (docError) throw docError

      // 2. Add revision request comment
      const { data: commentData, error: commentError } = await supabase
        .from('document_comments')
        .insert({
          document_id: id,
          content: revisionFeedback.trim(),
          author_id: user.id,
          author_name: user.name || user.email,
          comment_type: 'revision_request',
        })
        .select()
        .single()

      if (commentError) throw commentError

      // 3. Create task for AI agent to revise
      const { error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: `Revise: ${document.title}`,
          description: `Revision requested for document "${document.title}":\n\n${revisionFeedback.trim()}\n\nDocument link: /docs/${id}`,
          status: 'todo',
          priority: 'high',
          ai_flag: true,
          ai_agent: 'ax',
          created_by: user.id,
          business_id: document.business_id,
          metadata: {
            document_id: id,
            revision_request: true,
          },
        })

      if (taskError) throw taskError

      // Update local state
      setComments(prev => [...prev, commentData])
      setDocument(prev => prev ? { ...prev, status: 'needs_revision' } : null)
      setRevisionFeedback('')
      onRevisionClose()
      
      showSuccessToast('Revision requested! A task has been created for Ax.')
    } catch (error) {
      console.error('Request revision error:', error)
      showErrorToast(error, 'Failed to request revision')
    } finally {
      setSubmittingRevision(false)
    }
  }

  async function handleApprove() {
    if (!user || !document) return
    
    setApproving(true)
    try {
      // Update document status to approved and increment version
      const { error: docError } = await supabase
        .from('documents')
        .update({ 
          status: 'approved',
          version: (document.version || 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (docError) throw docError

      // Add approval comment for audit trail
      await supabase
        .from('document_comments')
        .insert({
          document_id: id,
          content: 'Document approved',
          author_id: user.id,
          author_name: user.name || user.email,
          comment_type: 'status_change',
        })

      // Update local state
      setDocument(prev => prev ? { ...prev, status: 'approved', version: (prev.version || 1) + 1 } : null)
      loadComments() // Reload to show the approval comment
      
      showSuccessToast('Document approved')
    } catch (error) {
      console.error('Approve document error:', error)
      showErrorToast(error, 'Failed to approve document')
    } finally {
      setApproving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)

      if (error) throw error

      showSuccessToast('Document deleted')
      router.push('/docs')
    } catch (error) {
      console.error('Delete document error:', error)
      showErrorToast(error, 'Failed to delete document')
    } finally {
      setDeleting(false)
      onDeleteClose()
    }
  }

  // Extract TOC from markdown headings with hierarchical structure
  const tableOfContents = useMemo((): TOCItem[] => {
    if (!document?.content) return []
    
    const headings: TOCItem[] = []
    const lines = document.content.split('\n')
    
    lines.forEach(line => {
      const match = line.match(/^(#{1,3})\s+(.+)$/)
      if (match) {
        const level = match[1].length
        const text = match[2].trim()
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        headings.push({ id, text, level })
      }
    })
    
    return headings
  }, [document?.content])

  // Group TOC items by parent headings for collapsible sections
  // h1 = document title (displayed at top, not collapsible)
  // h2 = main sections (collapsible parents)
  // h3 = sub-sections (children that collapse under their parent h2)
  const groupedTOC = useMemo(() => {
    const result: { title: TOCItem | null; sections: { parent: TOCItem; children: TOCItem[] }[] } = {
      title: null,
      sections: []
    }
    
    let currentH2: TOCItem | null = null
    let currentH3s: TOCItem[] = []

    tableOfContents.forEach((item) => {
      if (item.level === 1) {
        // h1 is just the document title
        result.title = item
      } else if (item.level === 2) {
        // Save previous h2 group if exists
        if (currentH2) {
          result.sections.push({ parent: currentH2, children: currentH3s })
        }
        currentH2 = item
        currentH3s = []
      } else if (item.level === 3) {
        // h3 are children of the current h2
        if (currentH2) {
          currentH3s.push(item)
        }
      }
    })

    // Don't forget the last h2 group
    if (currentH2) {
      result.sections.push({ parent: currentH2, children: currentH3s })
    }

    return result
  }, [tableOfContents])

  // Get all collapsible section IDs (sections with children)
  const collapsibleSectionIds = useMemo(() => {
    return groupedTOC.sections
      .filter(section => section.children.length > 0)
      .map(section => section.parent.id)
  }, [groupedTOC])

  // Collapse all sections by default when content loads
  useEffect(() => {
    if (collapsibleSectionIds.length > 0) {
      setCollapsedSections(new Set(collapsibleSectionIds))
    }
  }, [collapsibleSectionIds])

  // Check if all collapsible sections are collapsed
  const allCollapsed = useMemo(() => {
    if (collapsibleSectionIds.length === 0) return false
    return collapsibleSectionIds.every(id => collapsedSections.has(id))
  }, [collapsibleSectionIds, collapsedSections])

  // Toggle all sections collapsed/expanded
  const toggleAllSections = useCallback(() => {
    if (allCollapsed) {
      // Expand all
      setCollapsedSections(new Set())
    } else {
      // Collapse all
      setCollapsedSections(new Set(collapsibleSectionIds))
    }
  }, [allCollapsed, collapsibleSectionIds])

  const handleShare = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      showSuccessToast('Link copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showErrorToast(null, 'Failed to copy link')
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!document) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar user={user} />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Back to Task Banner - Prominent when linked to task */}
        {document.tasks && (
          <Link 
            href={`/tasks?openTask=${document.tasks.id}`}
            className="block mb-6"
          >
            <div className="bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 rounded-lg p-4 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors">
              <div className="flex items-center gap-3">
                <ArrowLeft className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                <div className="flex-1">
                  <p className="text-sm text-violet-600 dark:text-violet-400 font-medium">Back to Task</p>
                  <p className="text-violet-800 dark:text-violet-200 font-semibold">{document.tasks.title}</p>
                </div>
                <ExternalLink className="w-4 h-4 text-violet-500" />
              </div>
            </div>
          </Link>
        )}

        {/* Top Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <Button 
            variant="flat" 
            isIconOnly 
            title={searchParams.get('from') === 'space' ? 'Back to space' : 'Back to all documents'}
            onPress={() => {
              if (searchParams.get('from') === 'space') {
                const spaceId = searchParams.get('spaceId')
                const tab = searchParams.get('tab') || 'docs'
                router.push(`/spaces/${spaceId}?tab=${tab}`)
              } else {
                router.push('/docs')
              }
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {tableOfContents.length > 2 && (
              <Button
                variant="flat"
                isIconOnly
                size="sm"
                title="Table of Contents"
                onPress={() => setShowTOC(!showTOC)}
                className="sm:hidden"
              >
                <List className="w-4 h-4" />
              </Button>
            )}
            
            {/* Approve Button - Only visible for draft/in_review status */}
            {(document.status === 'draft' || document.status === 'in_review') && (
              <Button
                color="success"
                isIconOnly
                size="sm"
                title="Approve document"
                onPress={handleApprove}
                isLoading={approving}
              >
                <CheckCircle2 className="w-4 h-4" />
              </Button>
            )}
            
            {/* Request Revision Button */}
            {document.status !== 'needs_revision' && (
              <Button
                variant="flat"
                color="warning"
                isIconOnly
                size="sm"
                title="Request revision"
                onPress={onRevisionOpen}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
            
            <Button
              variant="flat"
              isIconOnly
              size="sm"
              title={copied ? "Link copied!" : "Share document"}
              onPress={handleShare}
            >
              {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            </Button>
            
            <Popover isOpen={propertiesOpen} onOpenChange={setPropertiesOpen} placement="bottom-end">
              <PopoverTrigger>
                <Button
                  variant="flat"
                  isIconOnly
                  size="sm"
                  title="Document properties"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                    <Folder className="w-4 h-4" />
                    Document Properties
                  </h4>
                  
                  {/* Category */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Category
                    </label>
                    <Select
                      size="sm"
                      selectedKeys={[editCategory]}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full max-w-[240px]"
                    >
                      {categoryOptions.map(cat => (
                        <SelectItem key={cat.key}>{cat.label}</SelectItem>
                      ))}
                    </Select>
                  </div>
                  
                  {/* Tags */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                        Tags
                      </label>
                      <span className="text-xs text-slate-400">{editTags.length}/10</span>
                    </div>
                    
                    {/* Current Tags */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {editTags.map(tag => (
                        <Chip
                          key={tag}
                          size="sm"
                          variant="flat"
                          onClose={() => removeTag(tag)}
                          className="text-xs"
                        >
                          {tag}
                        </Chip>
                      ))}
                      {editTags.length === 0 && (
                        <span className="text-xs text-slate-400 italic">No tags yet</span>
                      )}
                    </div>
                    
                    {/* Add Tag Input */}
                    <div className="flex gap-1">
                      <Input
                        size="sm"
                        placeholder="Add tag..."
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addTag()
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        isIconOnly
                        variant="flat"
                        onPress={addTag}
                        isDisabled={!newTag.trim()}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Save Button */}
                  <Button
                    color="primary"
                    size="sm"
                    className="w-full"
                    onPress={() => {
                      saveDocumentMeta()
                      setPropertiesOpen(false)
                    }}
                    isLoading={savingMeta}
                    isDisabled={savingMeta || (
                      editCategory === (document?.category || 'all') &&
                      JSON.stringify(editTags.sort()) === JSON.stringify((document?.tags || []).sort())
                    )}
                  >
                    {savingMeta ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            
            <Button
              variant="flat"
              isIconOnly
              size="sm"
              title="Version History"
              onPress={handleOpenHistory}
            >
              <History className="w-4 h-4" />
            </Button>
            
            <Link href={`/docs/${id}/edit`}>
              <Button color="primary" isIconOnly size="sm" title="Edit document">
                <Pencil className="w-4 h-4" />
              </Button>
            </Link>
            
            <Button
              variant="flat"
              color="danger"
              isIconOnly
              size="sm"
              title="Delete document"
              onPress={onDeleteOpen}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Awaiting Approval Alert */}
        {document.status === 'in_review' && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <p className="font-medium text-blue-800 dark:text-blue-200 flex-1">Awaiting Approval</p>
            </div>
          </div>
        )}

        {/* Needs Revision Alert */}
        {document.status === 'needs_revision' && (
          <div className="mb-6 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">Revision Requested</p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  This document has been flagged for revision. Check the comments below for feedback.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Document Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            {document.status !== 'in_review' && (
              <Chip
                color={getStatusColor(document.status) as any}
                variant="flat"
                size="sm"
              >
                {getStatusLabel(document.status)}
              </Chip>
            )}
            {document.version > 1 && (
              <Chip variant="dot" size="sm">v{document.version}</Chip>
            )}
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50 mb-4 leading-tight">
            {document.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            <span>Updated {formatDate(document.updated_at)}</span>
          </div>
        </div>

        <Divider className="mb-8" />

        {/* Layout with optional TOC sidebar */}
        <div className="flex gap-8">
          {/* Table of Contents - Desktop Sidebar */}
          {tableOfContents.length > 2 && (
            <aside className="hidden lg:block w-56 flex-shrink-0">
              <div className="sticky top-8 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <List className="w-4 h-4" />
                    Contents
                  </h4>
                  {collapsibleSectionIds.length > 0 && (
                    <button
                      onClick={toggleAllSections}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      aria-label={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
                      title={allCollapsed ? 'Expand all' : 'Collapse all'}
                    >
                      {allCollapsed ? (
                        <ChevronsUpDown className="w-4 h-4" />
                      ) : (
                        <ChevronsDownUp className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
                <nav className="space-y-1">
                  {/* Document title (h1) - not collapsible */}
                  {groupedTOC.title && (
                    <a
                      href={`#${groupedTOC.title.id}`}
                      className="block text-sm py-1 text-slate-800 dark:text-slate-100 font-semibold hover:text-violet-600 dark:hover:text-violet-400 transition-colors mb-2"
                    >
                      {groupedTOC.title.text}
                    </a>
                  )}
                  
                  {/* Main sections (h2) with collapsible children (h3) */}
                  {groupedTOC.sections.map((section) => (
                    <div key={section.parent.id}>
                      {/* h2 heading - collapsible parent */}
                      <div className="flex items-center">
                        {section.children.length > 0 && (
                          <button
                            onClick={() => toggleSection(section.parent.id)}
                            className="p-0.5 -ml-1 mr-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            aria-label={collapsedSections.has(section.parent.id) ? 'Expand section' : 'Collapse section'}
                          >
                            {collapsedSections.has(section.parent.id) ? (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                        )}
                        <a
                          href={`#${section.parent.id}`}
                          className={`flex-1 text-sm py-1 text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors font-medium ${
                            section.children.length === 0 ? 'ml-4' : ''
                          }`}
                        >
                          {section.parent.text}
                        </a>
                      </div>
                      
                      {/* h3 children (collapsible) */}
                      {section.children.length > 0 && !collapsedSections.has(section.parent.id) && (
                        <div className="ml-4 border-l border-slate-200 dark:border-slate-700 pl-2 mt-1 space-y-0.5">
                          {section.children.map((child) => (
                            <a
                              key={child.id}
                              href={`#${child.id}`}
                              className="block text-xs py-0.5 text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                            >
                              {child.text}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </nav>
              </div>
            </aside>
          )}

          {/* Mobile TOC */}
          {showTOC && tableOfContents.length > 2 && (
            <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setShowTOC(false)}>
              <div 
                className="absolute right-0 top-0 h-full w-64 bg-white dark:bg-slate-800 p-6 shadow-xl overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <List className="w-4 h-4" />
                    Contents
                  </h4>
                  {collapsibleSectionIds.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleAllSections()
                      }}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      aria-label={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
                      title={allCollapsed ? 'Expand all' : 'Collapse all'}
                    >
                      {allCollapsed ? (
                        <ChevronsUpDown className="w-4 h-4" />
                      ) : (
                        <ChevronsDownUp className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
                <nav className="space-y-2">
                  {/* Document title (h1) - not collapsible */}
                  {groupedTOC.title && (
                    <a
                      href={`#${groupedTOC.title.id}`}
                      onClick={() => setShowTOC(false)}
                      className="block text-sm py-1 text-slate-800 dark:text-slate-100 font-semibold hover:text-violet-600 dark:hover:text-violet-400 transition-colors mb-2"
                    >
                      {groupedTOC.title.text}
                    </a>
                  )}
                  
                  {/* Main sections (h2) with collapsible children (h3) */}
                  {groupedTOC.sections.map((section) => (
                    <div key={section.parent.id}>
                      {/* h2 heading - collapsible parent */}
                      <div className="flex items-center">
                        {section.children.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleSection(section.parent.id)
                            }}
                            className="p-0.5 -ml-1 mr-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            {collapsedSections.has(section.parent.id) ? (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                        )}
                        <a
                          href={`#${section.parent.id}`}
                          onClick={() => setShowTOC(false)}
                          className={`flex-1 text-sm py-1 text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 font-medium ${
                            section.children.length === 0 ? 'ml-4' : ''
                          }`}
                        >
                          {section.parent.text}
                        </a>
                      </div>
                      
                      {/* h3 children (collapsible) */}
                      {section.children.length > 0 && !collapsedSections.has(section.parent.id) && (
                        <div className="ml-4 border-l border-slate-200 dark:border-slate-700 pl-2 mt-1 space-y-1">
                          {section.children.map((child) => (
                            <a
                              key={child.id}
                              href={`#${child.id}`}
                              onClick={() => setShowTOC(false)}
                              className="block text-xs py-0.5 text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                            >
                              {child.text}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </nav>
              </div>
            </div>
          )}

          {/* Main Content */}
          <article className="flex-1 min-w-0">
            <div className="prose prose-slate dark:prose-invert max-w-none
              prose-headings:scroll-mt-8
              prose-h1:text-2xl prose-h1:font-bold prose-h1:mb-4 prose-h1:mt-8
              prose-h2:text-xl prose-h2:font-semibold prose-h2:mb-3 prose-h2:mt-6
              prose-h3:text-lg prose-h3:font-medium prose-h3:mb-2 prose-h3:mt-4
              prose-p:text-base prose-p:leading-relaxed prose-p:mb-4
              prose-ul:my-4 prose-ol:my-4
              prose-li:my-1
              prose-a:text-violet-600 dark:prose-a:text-violet-400 prose-a:no-underline hover:prose-a:underline
              prose-code:bg-slate-200 prose-code:text-slate-800 dark:prose-code:bg-slate-800 dark:prose-code:text-slate-200 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
              prose-pre:p-0 prose-pre:bg-transparent prose-pre:rounded-lg prose-pre:overflow-hidden
              prose-blockquote:border-l-violet-500 prose-blockquote:bg-violet-50 dark:prose-blockquote:bg-violet-900/20 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r
              prose-table:border prose-table:border-slate-200 dark:prose-table:border-slate-700
              prose-th:bg-slate-100 dark:prose-th:bg-slate-800 prose-th:p-2 prose-th:border prose-th:border-slate-200 dark:prose-th:border-slate-700
              prose-td:p-2 prose-td:border prose-td:border-slate-200 dark:prose-td:border-slate-700
              prose-img:rounded-lg prose-img:shadow-md
            ">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => {
                    const text = String(children)
                    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                    return <h1 id={id}>{children}</h1>
                  },
                  h2: ({ children }) => {
                    const text = String(children)
                    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                    return <h2 id={id}>{children}</h2>
                  },
                  h3: ({ children }) => {
                    const text = String(children)
                    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                    return <h3 id={id}>{children}</h3>
                  },
                  code: ({ className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '')
                    const codeString = String(children).replace(/\n$/, '')
                    
                    // Check if this is an inline code or block code
                    const isInline = !match && !codeString.includes('\n')
                    
                    if (isInline) {
                      return (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      )
                    }
                    
                    return (
                      <SyntaxHighlighter
                        style={isDark ? oneDark : oneLight}
                        language={match ? match[1] : 'text'}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          padding: '1rem',
                          fontSize: '0.875rem',
                          lineHeight: '1.5',
                          borderRadius: '0.5rem',
                        }}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    )
                  },
                }}
              >
                {document.content}
              </ReactMarkdown>
            </div>
          </article>
        </div>

        {/* Floating Scroll Button */}
        {showScrollButton && (
          <button
            onClick={handleScrollButton}
            className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            aria-label={isAtBottom ? 'Scroll to top' : 'Scroll to bottom'}
          >
            {isAtBottom ? (
              <ArrowUp className="w-5 h-5" />
            ) : (
              <ArrowDown className="w-5 h-5" />
            )}
          </button>
        )}

        <Divider className="my-8" />

        {/* Comments Section */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Comments
            {comments.length > 0 && (
              <Chip size="sm" variant="flat">{comments.length}</Chip>
            )}
          </h3>

          {/* Comments List */}
          <div className="space-y-4 mb-6">
            {loadingComments ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="sm" />
                <span className="ml-2 text-slate-500">Loading comments...</span>
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p className="text-slate-500 dark:text-slate-400">No comments yet</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`p-4 rounded-lg border ${
                    comment.comment_type === 'revision_request'
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
                      : comment.comment_type === 'status_change'
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {comment.comment_type === 'revision_request' && (
                      <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {comment.author_name}
                        </span>
                        {comment.comment_type === 'revision_request' && (
                          <Chip size="sm" color="warning" variant="flat">Revision Request</Chip>
                        )}
                        {comment.comment_type === 'status_change' && (
                          <Chip size="sm" color="primary" variant="flat">Status Change</Chip>
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatCommentDate(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Comment Input */}
          {user && (
            <div className="flex gap-3">
              <Input
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleAddComment()
                  }
                }}
                isDisabled={sendingComment}
                className="flex-1"
              />
              <Button
                color="primary"
                isIconOnly
                onPress={handleAddComment}
                isDisabled={!newComment.trim() || sendingComment}
                isLoading={sendingComment}
              >
                {!sendingComment && <Send className="w-4 h-4" />}
              </Button>
            </div>
          )}
        </section>

        {/* Footer */}
        <Divider className="my-8" />
        
        <footer className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
          <div>
            <p>Created {formatDate(document.created_at)}</p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                if (searchParams.get('from') === 'space') {
                  const spaceId = searchParams.get('spaceId')
                  const tab = searchParams.get('tab') || 'docs'
                  router.push(`/spaces/${spaceId}?tab=${tab}`)
                } else {
                  router.push('/docs')
                }
              }}
              className="hover:text-violet-600 dark:hover:text-violet-400"
            >
              ← {searchParams.get('from') === 'space' ? 'Back to Space' : 'Back to Documents'}
            </button>
            <Link href={`/docs/${id}/edit`} className="hover:text-violet-600 dark:hover:text-violet-400">
              Edit Document →
            </Link>
          </div>
        </footer>
      </main>

      {/* Request Revision Modal */}
      <Modal isOpen={isRevisionOpen} onClose={onRevisionClose} size="lg">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-600" />
            Request Revision
          </ModalHeader>
          <ModalBody>
            <p className="text-slate-600 dark:text-slate-300 mb-4">
              What changes need to be made to this document? Your feedback will be saved as a comment and a task will be created for Ax to make the revisions.
            </p>
            <Textarea
              label="Revision Feedback"
              placeholder="Describe what needs to be changed..."
              value={revisionFeedback}
              onChange={(e) => setRevisionFeedback(e.target.value)}
              minRows={4}
              isRequired
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onRevisionClose}>
              Cancel
            </Button>
            <Button
              color="warning"
              onPress={handleRequestRevision}
              isDisabled={!revisionFeedback.trim()}
              isLoading={submittingRevision}
            >
              Request Revision
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose} size="sm">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            Delete Document
          </ModalHeader>
          <ModalBody>
            <p className="text-slate-600 dark:text-slate-300">
              Are you sure you want to delete <strong>{document?.title}</strong>? This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDeleteClose}>
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={handleDelete}
              isLoading={deleting}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Version History Modal */}
      <Modal isOpen={isHistoryOpen} onClose={onHistoryClose} size="2xl">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Version History
          </ModalHeader>
          <ModalBody>
            {loadingVersions ? (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No version history yet</p>
                <p>Previous versions will appear here after you edit the document.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                  Showing {versions.length} previous version{versions.length !== 1 ? 's' : ''}
                </div>
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                    onClick={() => handleViewVersion(version)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Chip size="sm" variant="flat">v{version.version}</Chip>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {version.title}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(version.created_at)}
                      </div>
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                      {version.change_summary || 'No change summary'}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        <span>Status:</span>
                        <Chip
                          size="sm"
                          color={getStatusColor(version.status) as any}
                          variant="flat"
                        >
                          {getStatusLabel(version.status)}
                        </Chip>
                      </div>
                      <div>
                        {version.users?.name || version.users?.email || 'Unknown user'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onHistoryClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Version View Modal */}
      <Modal isOpen={isVersionViewOpen} onClose={onVersionViewClose} size="4xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5" />
              <span>Version v{selectedVersion?.version}: {selectedVersion?.title}</span>
            </div>
            <Chip
              size="sm"
              color={selectedVersion ? getStatusColor(selectedVersion.status) as any : 'default'}
              variant="flat"
            >
              {selectedVersion ? getStatusLabel(selectedVersion.status) : ''}
            </Chip>
          </ModalHeader>
          <ModalBody>
            {selectedVersion && (
              <div className="space-y-4">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="font-medium">Created</div>
                      <div>{formatDate(selectedVersion.created_at)}</div>
                    </div>
                    <div>
                      <div className="font-medium">By</div>
                      <div>{selectedVersion.users?.name || selectedVersion.users?.email || 'Unknown user'}</div>
                    </div>
                    <div>
                      <div className="font-medium">Change Summary</div>
                      <div>{selectedVersion.change_summary || 'No change summary'}</div>
                    </div>
                  </div>
                </div>
                
                <Divider />
                
                <div className="prose prose-slate dark:prose-invert max-w-none
                  prose-headings:scroll-mt-8
                  prose-h1:text-xl prose-h1:font-bold prose-h1:mb-4 prose-h1:mt-6
                  prose-h2:text-lg prose-h2:font-semibold prose-h2:mb-3 prose-h2:mt-5
                  prose-h3:text-base prose-h3:font-medium prose-h3:mb-2 prose-h3:mt-4
                  prose-p:text-sm prose-p:leading-relaxed prose-p:mb-3
                  prose-ul:my-3 prose-ol:my-3
                  prose-li:my-0.5
                  prose-a:text-violet-600 dark:prose-a:text-violet-400
                  prose-code:bg-slate-100 dark:prose-code:bg-slate-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
                  prose-pre:bg-slate-900 prose-pre:rounded-lg prose-pre:p-3 prose-pre:text-xs
                  prose-blockquote:border-l-violet-500 prose-blockquote:bg-violet-50 dark:prose-blockquote:bg-violet-900/20 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:rounded-r prose-blockquote:text-sm
                ">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedVersion.content || '*No content*'}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onVersionViewClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
