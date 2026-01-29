'use client'

import { useState, useEffect, useMemo, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Edit, FileText, List, ExternalLink, Share2, Check, RotateCcw, MessageSquare, Send, AlertCircle } from 'lucide-react'
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
  useDisclosure,
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

export default function DocumentReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
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
  const [revisionFeedback, setRevisionFeedback] = useState('')
  const [submittingRevision, setSubmittingRevision] = useState(false)
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadUser()
    loadDocument()
  }, [id])

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

  // Extract TOC from markdown headings
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
          <Link href="/docs">
            <Button variant="flat" startContent={<ArrowLeft className="w-4 h-4" />}>
              All Documents
            </Button>
          </Link>
          
          <div className="flex items-center gap-2 flex-wrap">
            {tableOfContents.length > 2 && (
              <Button
                variant="flat"
                startContent={<List className="w-4 h-4" />}
                onPress={() => setShowTOC(!showTOC)}
                className="sm:hidden"
              >
                TOC
              </Button>
            )}
            
            {/* Request Revision Button */}
            {document.status !== 'needs_revision' && (
              <Button
                variant="flat"
                color="warning"
                startContent={<RotateCcw className="w-4 h-4" />}
                onPress={onRevisionOpen}
              >
                Request Revision
              </Button>
            )}
            
            <Button
              variant="flat"
              startContent={copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              onPress={handleShare}
            >
              {copied ? 'Copied!' : 'Share'}
            </Button>
            <Link href={`/docs/${id}/edit`}>
              <Button color="primary" startContent={<Edit className="w-4 h-4" />}>
                Edit
              </Button>
            </Link>
          </div>
        </div>

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
            <Chip
              color={getStatusColor(document.status) as any}
              variant="flat"
              size="sm"
            >
              {getStatusLabel(document.status)}
            </Chip>
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
              <div className="sticky top-8">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <List className="w-4 h-4" />
                  Contents
                </h4>
                <nav className="space-y-1">
                  {tableOfContents.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={`block text-sm py-1 text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors ${
                        item.level === 2 ? 'pl-4' : item.level === 3 ? 'pl-8' : ''
                      }`}
                    >
                      {item.text}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          )}

          {/* Mobile TOC */}
          {showTOC && tableOfContents.length > 2 && (
            <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setShowTOC(false)}>
              <div 
                className="absolute right-0 top-0 h-full w-64 bg-white dark:bg-slate-800 p-6 shadow-xl"
                onClick={e => e.stopPropagation()}
              >
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                  <List className="w-4 h-4" />
                  Contents
                </h4>
                <nav className="space-y-2">
                  {tableOfContents.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      onClick={() => setShowTOC(false)}
                      className={`block text-sm py-1 text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 ${
                        item.level === 2 ? 'pl-4' : item.level === 3 ? 'pl-8' : ''
                      }`}
                    >
                      {item.text}
                    </a>
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
              prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-slate-900 dark:prose-pre:bg-slate-950 prose-pre:rounded-lg prose-pre:p-4
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
                }}
              >
                {document.content}
              </ReactMarkdown>
            </div>
          </article>
        </div>

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
            <Link href="/docs" className="hover:text-violet-600 dark:hover:text-violet-400">
              ← Back to Documents
            </Link>
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
    </div>
  )
}
