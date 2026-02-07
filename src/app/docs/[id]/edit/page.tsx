'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Trash2, Users, Globe } from 'lucide-react'
import {
  Button,
  Input,
  Select,
  SelectItem,
  Spinner,
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
import RichTextEditor from '@/components/RichTextEditor'
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
  const [hasChanges, setHasChanges] = useState(false)
  
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<string>('draft')
  const [projectId, setProjectId] = useState<string>('space')
  const [projects, setProjects] = useState<Project[]>([])
  
  const supabase = createClient()
  const router = useRouter()
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure()

  useEffect(() => {
    loadUser()
    loadDocument()
    loadProjects()
  }, [id])

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
        setUser({ id: authUser.id, email: authUser.email || '' })
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
      if (document) {
        await supabase
          .from('document_versions')
          .insert({
            document_id: id,
            version: document.version || 1,
            title: document.title,
            content: document.content,
            status: document.status,
            created_by: user?.id || document.created_by,
            change_summary: `Edited: ${document.title}`
          })
      }

      const updates = {
        title: title.trim(),
        content,
        status,
        project_id: projectId === 'space' ? null : projectId,
        updated_at: new Date().toISOString(),
        version: (document?.version || 1) + 1,
      }

      const { error } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', id)

      if (error) throw error

      showSuccessToast('Document saved')
      setHasChanges(false)
      loadDocument()
    } catch (error) {
      console.error('Save error:', error)
      showErrorToast(error, 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const { error } = await supabase.from('documents').delete().eq('id', id)
      if (error) throw error
      showSuccessToast('Document deleted')
      router.push('/docs')
    } catch (error) {
      showErrorToast(error, 'Failed to delete')
    } finally {
      setDeleting(false)
      onDeleteClose()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!document) return null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar user={user} />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link href={`/docs/${id}`}>
              <Button variant="flat" isIconOnly size="sm">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            {hasChanges && (
              <Chip size="sm" color="warning" variant="flat">Unsaved</Chip>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="flat"
              color="danger"
              size="sm"
              isIconOnly
              onPress={onDeleteOpen}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              color="primary"
              size="sm"
              startContent={<Save className="w-4 h-4" />}
              onPress={handleSave}
              isLoading={saving}
              isDisabled={!hasChanges}
            >
              Save
            </Button>
          </div>
        </div>

        {/* Document Editor - Google Docs Style */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Title */}
          <div className="border-b border-slate-200 dark:border-slate-700 p-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled Document"
              className="w-full text-2xl font-bold bg-transparent border-none outline-none text-slate-900 dark:text-slate-50 placeholder:text-slate-400"
            />
            
            {/* Meta row */}
            <div className="flex flex-wrap gap-3 mt-3">
              <Select
                size="sm"
                selectedKeys={[status]}
                onChange={(e) => setStatus(e.target.value)}
                className="w-36"
                aria-label="Status"
              >
                {statusOptions.map(s => (
                  <SelectItem key={s.key}>{s.label}</SelectItem>
                ))}
              </Select>

              <Select
                size="sm"
                selectedKeys={[projectId]}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-48"
                aria-label="Visibility"
                startContent={projectId === 'space' ? <Globe className="w-3 h-3" /> : <Users className="w-3 h-3" />}
              >
                <SelectItem key="space" startContent={<Globe className="w-3 h-3" />}>
                  Everyone in Space
                </SelectItem>
                <>
                  {projects.map(p => (
                    <SelectItem key={p.id} startContent={<Users className="w-3 h-3" />}>
                      {p.name}
                    </SelectItem>
                  ))}
                </>
              </Select>
            </div>
          </div>

          {/* WYSIWYG Editor */}
          <div className="p-4">
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Start writing..."
              minHeight="500px"
            />
          </div>
        </div>
      </main>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
        <ModalContent>
          <ModalHeader>Delete Document</ModalHeader>
          <ModalBody>
            <p>Are you sure you want to delete <strong>"{document.title}"</strong>?</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDeleteClose}>Cancel</Button>
            <Button color="danger" onPress={handleDelete} isLoading={deleting}>Delete</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
