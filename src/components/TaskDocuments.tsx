'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Plus, ExternalLink } from 'lucide-react'
import {
  Button,
  Chip,
  Spinner,
} from '@heroui/react'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'

interface Document {
  id: string
  title: string
  status: 'draft' | 'in_review' | 'approved'
  updated_at: string
  version: number
}

interface TaskDocumentsProps {
  taskId: string
  taskTitle: string
  businessId: string | null
  userId: string | null
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'draft': return 'default'
    case 'in_review': return 'warning'
    case 'approved': return 'success'
    default: return 'default'
  }
}

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'draft': return 'Draft'
    case 'in_review': return 'In Review'
    case 'approved': return 'Approved'
    default: return status
  }
}

export default function TaskDocuments({ taskId, taskTitle, businessId, userId }: TaskDocumentsProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadDocuments()
  }, [taskId])

  async function loadDocuments() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, status, updated_at, version')
        .eq('task_id', taskId)
        .order('updated_at', { ascending: false })

      if (error) throw error
      setDocuments(data || [])
    } catch (error) {
      console.error('Load documents error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateDocument() {
    if (!userId) {
      showErrorToast(null, 'Please sign in to create documents')
      return
    }

    setCreating(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .insert({
          title: `Document: ${taskTitle}`,
          content: `# ${taskTitle}\n\n## Overview\n\nDescribe the deliverable here...\n\n## Details\n\n- Point 1\n- Point 2\n- Point 3\n`,
          status: 'draft',
          task_id: taskId,
          business_id: businessId,
          created_by: userId,
        })
        .select()
        .single()

      if (error) throw error

      showSuccessToast('Document created')
      router.push(`/docs/${data.id}/edit`)
    } catch (error) {
      console.error('Create document error:', error)
      showErrorToast(error, 'Failed to create document')
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Spinner size="sm" />
        <span className="ml-2 text-sm text-slate-500">Loading documents...</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Documents
          {documents.length > 0 && (
            <Chip size="sm" variant="flat">{documents.length}</Chip>
          )}
        </h3>
        <Button
          size="sm"
          color="primary"
          variant="flat"
          startContent={<Plus className="w-3 h-3" />}
          onPress={handleCreateDocument}
          isLoading={creating}
        >
          New Doc
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            No documents linked to this task
          </p>
          <Button
            size="sm"
            color="primary"
            startContent={<Plus className="w-4 h-4" />}
            onPress={handleCreateDocument}
            isLoading={creating}
          >
            Create Document
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 transition-colors cursor-pointer group"
              onClick={() => router.push(`/docs/${doc.id}`)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-violet-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-slate-700 dark:text-slate-200 truncate text-sm">
                    {doc.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(doc.updated_at)}
                    {doc.version > 1 && ` • v${doc.version}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Chip
                  size="sm"
                  color={getStatusColor(doc.status) as any}
                  variant="flat"
                >
                  {getStatusLabel(doc.status)}
                </Chip>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-violet-500 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
