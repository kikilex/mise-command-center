'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Eye, Save, X, Trash2, Users, Globe } from 'lucide-react'
import {
  Button,
  Input,
  Select,
  SelectItem,
  Spinner,
  Textarea,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
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
  space_id: string | null
  project_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  status: 'draft' | 'in_review' | 'approved' | 'needs_revision'
  version: number
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
}

const statusOptions = [
  { key: 'draft', label: 'Draft' },
  { key: 'in_review', label: 'In Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'needs_revision', label: 'Needs Revision' },
]

export default function DocumentEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [document, setDocument] = useState<Document | null>(null)
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<string>('draft')
  const [projectId, setProjectId] = useState<string>('space') // 'space' = visible to all space members
  const [projects, setProjects] = useState<Project[]>([])
  
  const supabase = createClient()
  const router = useRouter()
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure()

  useEffect(() => {
    loadUser()
    loadDocument()
    loadProjects()
  }, [id])

  // Track changes
  useEffect(() => {
    if (document) {
      const currentProjectId = document.project_id || 'space'
      const changed = 
        title !== document.title ||
        content !== document.content ||
        status !== document.status ||
        projectId !== currentProjectId
      setHasChanges(changed)
    }
  }, [title, content, status, projectId, document])

  async function loadUser() {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        setUser({
          id: authUser.id,
          email: authUser.email || '',
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
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      
      setDocument(data)
      setTitle(data.title)
      setContent(data.content)
      setStatus(data.status)
      setProjectId(data.project_id || 'space')
    } catch (error) {
      console.error('Load document error:', error)
      showErrorToast(error, 'Failed to load document')
      router.push('/docs')
    } finally {
      setLoading(false)
    }
  }

  async function loadProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, space_id')
        .eq('status', 'active')
        .order('name')
      
      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Load projects error:', error)
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      showErrorToast(null, 'Please enter a title')
      return
    }

    setSaving(true)
    try {
      // First, save current version to document_versions table
      if (document) {
        const { error: versionError } = await supabase
          .from('document_versions')
          .insert({
            document_id: id,
            version: document.version || 1,
            title: document.title,
            content: document.content,
            status: document.status,
            created_by: user?.id || document.created_by,
            change_summary: `Edited: ${document.title} → ${title.trim()}`
          })

        if (versionError) {
          console.error('Save version error:', versionError)
          // Continue anyway - don't fail the save if versioning fails
        }
      }

      const updates: Partial<Document> & { updated_at: string } = {
        title: title.trim(),
        content,
        status: status as 'draft' | 'in_review' | 'approved',
        project_id: projectId === 'space' ? null : projectId,
        updated_at: new Date().toISOString(),
        version: (document?.version || 1) + 1, // Always increment version
      }

      const { error } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', id)

      if (error) throw error

      showSuccessToast('Document saved successfully')
      setHasChanges(false)
      loadDocument() // Reload to get updated data
    } catch (error) {
      console.error('Save document error:', error)
      showErrorToast(error, 'Failed to save document')
    } finally {
      setSaving(false)
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

  function handleDiscard() {
    if (document) {
      setTitle(document.title)
      setContent(document.content)
      setStatus(document.status)
      setProjectId(document.project_id || 'space')
      setHasChanges(false)
    }
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
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link href={`/docs/${id}`}>
              <Button variant="flat" isIconOnly>
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Edit Document</h1>
            {hasChanges && (
              <Chip size="sm" color="warning" variant="flat">Unsaved changes</Chip>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="flat"
              color="danger"
              startContent={<Trash2 className="w-4 h-4" />}
              onPress={onDeleteOpen}
            >
              Delete
            </Button>
            <Button
              variant="flat"
              startContent={showPreview ? <X className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              onPress={() => setShowPreview(!showPreview)}
            >
              {showPreview ? 'Edit' : 'Preview'}
            </Button>
            <Button
              variant="flat"
              onPress={handleDiscard}
              isDisabled={!hasChanges}
            >
              Discard
            </Button>
            <Button
              color="primary"
              startContent={<Save className="w-4 h-4" />}
              onPress={handleSave}
              isLoading={saving}
              isDisabled={!hasChanges}
            >
              Save
            </Button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Edit Panel */}
          <div className={`space-y-4 ${showPreview ? 'hidden lg:block' : ''}`}>
            <Input
              label="Title"
              placeholder="Document title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              isRequired
              size="lg"
              classNames={{
                input: "text-lg font-semibold",
              }}
            />
            
            <div className="flex flex-wrap gap-4">
              <Select
                label="Status"
                selectedKeys={[status]}
                onChange={(e) => setStatus(e.target.value)}
                className="max-w-xs"
              >
                {statusOptions.map(s => (
                  <SelectItem key={s.key}>{s.label}</SelectItem>
                ))}
              </Select>

              <Select
                label="Visible to"
                selectedKeys={[projectId]}
                onChange={(e) => setProjectId(e.target.value)}
                className="max-w-xs"
                startContent={projectId === 'space' ? <Globe className="w-4 h-4 text-slate-400" /> : <Users className="w-4 h-4 text-slate-400" />}
                description={projectId === 'space' ? 'Everyone in this space can view' : 'Only project members can view'}
              >
                <SelectItem key="space" startContent={<Globe className="w-4 h-4" />}>
                  Everyone in Space
                </SelectItem>
                <>
                  {projects.map(p => (
                    <SelectItem key={p.id} startContent={<Users className="w-4 h-4" />}>
                      {p.name} (Project Only)
                    </SelectItem>
                  ))}
                </>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Content (Markdown)
              </label>
              <Textarea
                placeholder="Write your document content here... Supports Markdown formatting."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                minRows={20}
                maxRows={50}
                classNames={{
                  input: "font-mono text-sm",
                  inputWrapper: "bg-white dark:bg-slate-800",
                }}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Supports Markdown: **bold**, *italic*, # headings, - lists, [links](url), `code`, and more.
              </p>
            </div>
          </div>

          {/* Preview Panel */}
          <div className={`${!showPreview ? 'hidden lg:block' : ''}`}>
            <div className="sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Preview</h3>
                <Chip size="sm" variant="flat">{content.length} chars</Chip>
              </div>
              
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 min-h-[500px] max-h-[80vh] overflow-y-auto">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-6">
                  {title || 'Untitled Document'}
                </h1>
                
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
                    {content || '*No content yet...*'}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
        <ModalContent>
          <ModalHeader>Delete Document</ModalHeader>
          <ModalBody>
            <p className="text-slate-600 dark:text-slate-300">
              Are you sure you want to delete <strong>"{document.title}"</strong>? This action cannot be undone.
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
              Delete Document
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
