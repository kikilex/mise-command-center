'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Chip,
  Divider,
  Spinner,
} from '@heroui/react'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  assignee_id: string | null
  due_date: string | null
  tags: string[]
  ai_flag: boolean
  ai_agent: string | null
  feedback: string | null
  created_at: string
  updated_at?: string
}

interface TaskFile {
  id: string
  task_id: string
  file_name: string
  file_path: string
  file_type: string | null
  file_size: number | null
  uploaded_at: string
  uploaded_by: string | null
}

interface FeedbackMessage {
  id: string
  task_id: string
  author: string
  message: string
  created_at: string
}

interface TaskDetailModalProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
  onTaskUpdated: () => void
  userId?: string | null
}

const statusOptions = [
  { key: 'backlog', label: 'Backlog', color: 'default' },
  { key: 'todo', label: 'To Do', color: 'primary' },
  { key: 'in_progress', label: 'In Progress', color: 'warning' },
  { key: 'review', label: 'Review', color: 'secondary' },
  { key: 'done', label: 'Done', color: 'success' },
  { key: 'blocked', label: 'Blocked', color: 'danger' },
]

const priorityOptions = [
  { key: 'critical', label: 'Critical', color: 'bg-red-500' },
  { key: 'high', label: 'High', color: 'bg-orange-500' },
  { key: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { key: 'low', label: 'Low', color: 'bg-slate-400' },
]

const ALLOWED_FILE_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export default function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onTaskUpdated,
  userId,
}: TaskDetailModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    due_date: '',
    ai_flag: false,
  })
  const [files, setFiles] = useState<TaskFile[]>([])
  const [feedbackMessages, setFeedbackMessages] = useState<FeedbackMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  
  const supabase = createClient()

  // Scroll to bottom of chat
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load task data when modal opens
  useEffect(() => {
    if (task && isOpen) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        due_date: task.due_date ? task.due_date.split('T')[0] : '',
        ai_flag: task.ai_flag || false,
      })
      loadFiles(task.id)
      loadFeedbackMessages(task.id)
    }
  }, [task, isOpen])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [feedbackMessages, scrollToBottom])

  async function loadFeedbackMessages(taskId: string) {
    setLoadingFeedback(true)
    try {
      const { data, error } = await supabase
        .from('task_feedback')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setFeedbackMessages(data || [])
    } catch (error) {
      console.error('Load feedback error:', error)
      showErrorToast(error, 'Failed to load feedback')
    } finally {
      setLoadingFeedback(false)
    }
  }

  async function loadFiles(taskId: string) {
    setLoadingFiles(true)
    try {
      const { data, error } = await supabase
        .from('task_files')
        .select('*')
        .eq('task_id', taskId)
        .order('uploaded_at', { ascending: false })

      if (error) throw error
      setFiles(data || [])
    } catch (error) {
      console.error('Load files error:', error)
      showErrorToast(error, 'Failed to load attachments')
    } finally {
      setLoadingFiles(false)
    }
  }

  async function handleSendMessage() {
    if (!task || !newMessage.trim()) return
    
    setSendingMessage(true)
    try {
      const { data, error } = await supabase
        .from('task_feedback')
        .insert({
          task_id: task.id,
          author: userId || 'unknown',
          message: newMessage.trim(),
        })
        .select()
        .single()

      if (error) throw error
      
      setFeedbackMessages(prev => [...prev, data])
      setNewMessage('')
    } catch (error) {
      console.error('Send message error:', error)
      showErrorToast(error, 'Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  async function handleSave() {
    if (!task) return
    setSaving(true)
    
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: formData.title,
          description: formData.description || null,
          status: formData.status,
          priority: formData.priority,
          due_date: formData.due_date || null,
          ai_flag: formData.ai_flag,
        })
        .eq('id', task.id)

      if (error) throw error
      
      showSuccessToast('Task updated successfully')
      onTaskUpdated()
    } catch (error) {
      console.error('Save task error:', error)
      showErrorToast(error, 'Failed to update task')
    } finally {
      setSaving(false)
    }
  }

  async function handleSendBackToAx() {
    if (!task) return
    
    // Check if there's any feedback in the chat
    if (feedbackMessages.length === 0 && !newMessage.trim()) {
      showErrorToast(null, 'Please add feedback before sending back for revision')
      return
    }
    
    setSaving(true)
    
    try {
      // If there's a pending message, send it first
      if (newMessage.trim()) {
        await supabase
          .from('task_feedback')
          .insert({
            task_id: task.id,
            author: userId || 'unknown',
            message: newMessage.trim(),
          })
        setNewMessage('')
      }
      
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'in_progress',
          ai_agent: 'ax',
        })
        .eq('id', task.id)

      if (error) throw error
      
      showSuccessToast('Task sent back to Ax for revision')
      onTaskUpdated()
    } catch (error) {
      console.error('Send back error:', error)
      showErrorToast(error, 'Failed to send back for revision')
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || !task) return
    
    const filesToUpload = Array.from(fileList)
    
    // Validate files
    for (const file of filesToUpload) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        showErrorToast(null, `File type not supported: ${file.name}`)
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        showErrorToast(null, `File too large (max 50MB): ${file.name}`)
        return
      }
    }
    
    setUploading(true)
    
    try {
      for (const file of filesToUpload) {
        // Upload to storage
        const filePath = `${task.id}/${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('task-files')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        // Create database record
        const { error: dbError } = await supabase
          .from('task_files')
          .insert({
            task_id: task.id,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: userId,
          })

        if (dbError) throw dbError
      }
      
      showSuccessToast(`${filesToUpload.length} file(s) uploaded`)
      loadFiles(task.id)
    } catch (error) {
      console.error('Upload error:', error)
      showErrorToast(error, 'Failed to upload file')
    } finally {
      setUploading(false)
    }
  }, [task, userId, supabase])

  async function handleDeleteFile(file: TaskFile) {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('task-files')
        .remove([file.file_path])

      if (storageError) throw storageError

      // Delete database record
      const { error: dbError } = await supabase
        .from('task_files')
        .delete()
        .eq('id', file.id)

      if (dbError) throw dbError

      showSuccessToast('File deleted')
      setFiles(files.filter(f => f.id !== file.id))
    } catch (error) {
      console.error('Delete file error:', error)
      showErrorToast(error, 'Failed to delete file')
    }
  }

  async function getDownloadUrl(file: TaskFile) {
    try {
      const { data, error } = await supabase.storage
        .from('task-files')
        .createSignedUrl(file.file_path, 3600) // 1 hour expiry

      if (error) throw error
      return data.signedUrl
    } catch (error) {
      console.error('Get download URL error:', error)
      showErrorToast(error, 'Failed to get download link')
      return null
    }
  }

  async function handleDownload(file: TaskFile) {
    const url = await getDownloadUrl(file)
    if (url) {
      window.open(url, '_blank')
    }
  }

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileUpload(e.dataTransfer.files)
  }, [handleFileUpload])

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return '📄'
    if (fileType.startsWith('image/')) return '🖼️'
    if (fileType === 'application/pdf') return '📕'
    if (fileType === 'text/markdown') return '📝'
    return '📄'
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const isAxMessage = (author: string) => author === 'ax'

  if (!task) return null

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size="3xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <span>Task Details</span>
            {task.ai_flag && (
              <Chip size="sm" className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300">
                🤖 AI Task
              </Chip>
            )}
            {task.ai_agent && (
              <Chip size="sm" variant="flat" className="capitalize">
                Agent: {task.ai_agent}
              </Chip>
            )}
          </div>
        </ModalHeader>
        
        <ModalBody>
          <div className="flex flex-col gap-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <Input
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                isRequired
              />
              
              <Textarea
                label="Description"
                placeholder="Task description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                minRows={3}
              />
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Select
                  label="Status"
                  selectedKeys={[formData.status]}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  {statusOptions.map(s => (
                    <SelectItem key={s.key}>{s.label}</SelectItem>
                  ))}
                </Select>
                
                <Select
                  label="Priority"
                  selectedKeys={[formData.priority]}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  {priorityOptions.map(p => (
                    <SelectItem key={p.key}>{p.label}</SelectItem>
                  ))}
                </Select>
                
                <Input
                  label="Due Date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.ai_flag}
                  onChange={(e) => setFormData({ ...formData, ai_flag: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">🤖 Allow AI to work on this task</span>
              </label>
            </div>

            <Divider />

            {/* Chat-Style Feedback Section */}
            <div className="space-y-3">
              <h3 className="text-md font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                💬 Feedback Thread
                {feedbackMessages.length > 0 && (
                  <Chip size="sm" variant="flat">{feedbackMessages.length}</Chip>
                )}
              </h3>
              
              {/* Chat Window */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                {/* Messages Container */}
                <div className="h-64 overflow-y-auto p-4 space-y-3">
                  {loadingFeedback ? (
                    <div className="flex items-center justify-center h-full">
                      <Spinner size="sm" />
                      <span className="ml-2 text-slate-500">Loading messages...</span>
                    </div>
                  ) : feedbackMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-400">
                      <p>No feedback yet. Start the conversation!</p>
                    </div>
                  ) : (
                    feedbackMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isAxMessage(msg.author) ? 'items-start' : 'items-end'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                            isAxMessage(msg.author)
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-md'
                              : 'bg-blue-500 text-white rounded-br-md'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        </div>
                        <div className={`flex items-center gap-1 mt-1 ${isAxMessage(msg.author) ? '' : 'flex-row-reverse'}`}>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {isAxMessage(msg.author) ? '🤖 Ax' : '👤 Alex'}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            • {formatTimestamp(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>
                
                {/* Message Input */}
                <div className="border-t border-slate-200 dark:border-slate-700 p-3 flex gap-2">
                  <Input
                    placeholder="Type your feedback..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    isDisabled={sendingMessage}
                    classNames={{
                      input: "text-sm",
                    }}
                  />
                  <Button
                    color="primary"
                    isIconOnly
                    onPress={handleSendMessage}
                    isDisabled={!newMessage.trim() || sendingMessage}
                    isLoading={sendingMessage}
                  >
                    {!sendingMessage && '↑'}
                  </Button>
                </div>
              </div>
              
              {/* Send Back Button */}
              <Button
                color="warning"
                variant="flat"
                onPress={handleSendBackToAx}
                isDisabled={saving}
                className="w-full"
              >
                🔄 Send back to Ax for revision
              </Button>
            </div>

            <Divider />

            {/* File Attachments */}
            <div className="space-y-3">
              <h3 className="text-md font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                📎 Attachments
                {files.length > 0 && (
                  <Chip size="sm" variant="flat">{files.length}</Chip>
                )}
              </h3>
              
              {/* Upload Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  isDragging 
                    ? 'border-primary bg-primary/10' 
                    : 'border-slate-300 dark:border-slate-600 hover:border-primary/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.md,.pdf,.png,.jpg,.jpeg,.gif,.webp"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files)}
                />
                
                {uploading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Spinner size="sm" />
                    <span className="text-slate-500">Uploading...</span>
                  </div>
                ) : (
                  <>
                    <div className="text-3xl mb-2">📤</div>
                    <p className="text-slate-600 dark:text-slate-300">
                      Drag & drop files here, or click to browse
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      Supports: txt, md, pdf, png, jpg, gif, webp (max 50MB)
                    </p>
                  </>
                )}
              </div>

              {/* File List */}
              {loadingFiles ? (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="sm" />
                  <span className="ml-2 text-slate-500">Loading attachments...</span>
                </div>
              ) : files.length > 0 ? (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl">{getFileIcon(file.file_type)}</span>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-700 dark:text-slate-200 truncate">
                            {file.file_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatFileSize(file.file_size)} • {new Date(file.uploaded_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          onPress={() => handleDownload(file)}
                        >
                          Download
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          color="danger"
                          onPress={() => handleDeleteFile(file)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-400 py-4">No attachments yet</p>
              )}
            </div>

            {/* Metadata */}
            <div className="text-xs text-slate-400 space-y-1">
              <p>Created: {new Date(task.created_at).toLocaleString()}</p>
              {task.updated_at && (
                <p>Last updated: {new Date(task.updated_at).toLocaleString()}</p>
              )}
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Close
          </Button>
          <Button
            color="primary"
            onPress={handleSave}
            isLoading={saving}
            isDisabled={!formData.title.trim()}
          >
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
