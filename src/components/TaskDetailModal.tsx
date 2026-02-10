'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageCircle, Eye, Download, Trash2, FileText, ClipboardList, Bot, RotateCcw, Paperclip, User, File, Pencil, ChevronDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
import FileViewerModal, { isViewableFile } from './FileViewerModal'
import TaskDocuments from './TaskDocuments'
import TaskThread from './TaskThread'

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  assignee_id: string | null
  project_id: string | null
  business_id: string | null
  space_id: string | null
  due_date: string | null
  tags: string[]
  ai_agent: string | null
  feedback: string | null
  created_at: string
  updated_at?: string
  created_by?: string | null
  requested_by?: string | null
  creator?: { name: string; display_name?: string } | null
  requester?: { name: string; display_name?: string } | null
  focus_queue_order?: number | null
}

interface AIAgent {
  id: string
  name: string
  slug: string
  role: string
  is_active?: boolean
  model?: string
  system_prompt?: string
  capabilities?: string[]
  settings?: {
    personality?: string
  }
  avatar_url?: string
  last_action?: string
  last_action_at?: string
}

interface Project {
  id: string
  name: string
  business_id?: string | null
  space_id?: string | null
  description?: string | null
  status?: string
  created_at?: string
  updated_at?: string
}

interface Space {
  id: string
  name: string
  description?: string | null
  created_at?: string
  updated_at?: string
}

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
  user_type?: string
  is_agent?: boolean
  display_name?: string
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
    assignee_id: '',
    ai_agent: '',
    project_id: '',
    space_id: '',
  })
  const [files, setFiles] = useState<TaskFile[]>([])
  const [users, setUsers] = useState<UserData[]>([])
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [spaces, setSpaces] = useState<Space[]>([])
  const [saving, setSaving] = useState(false)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [viewingFile, setViewingFile] = useState<TaskFile | null>(null)
  const [viewFileUrl, setViewFileUrl] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [assignToUserId, setAssignToUserId] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const supabase = createClient()

  // Load task data and dropdown options when modal opens
  useEffect(() => {
    if (task && isOpen) {
      // Fetch fresh task data to ensure we have latest notes/description
      const loadFreshTask = async () => {
        const { data: freshTask } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', task.id)
          .single()
        
        const taskData = freshTask || task
        setFormData({
          title: taskData.title || '',
          description: taskData.description || '',
          status: taskData.status || 'todo',
          priority: taskData.priority || 'medium',
          due_date: taskData.due_date ? taskData.due_date.split('T')[0] : '',
          assignee_id: taskData.assignee_id || '',
          ai_agent: taskData.ai_agent || '',
          project_id: taskData.project_id || '',
          space_id: taskData.space_id || '',
        })
      }
      loadFreshTask()
      setIsEditing(false) // Reset to read-only mode when modal opens
      loadFiles(task.id)
      loadDropdownData(task.space_id)
    }
  }, [task, isOpen])

  async function loadDropdownData(spaceId: string | null) {
    setLoadingData(true)
    try {
      // Fetch all users (humans + AI agents) for the "Assign to..." dropdown
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, name, avatar_url, user_type, is_agent, display_name')
        .order('is_agent', { ascending: true }) // Humans first, then agents
      
      // Fetch Active Agents (for the AI Agent dropdown in edit mode)
      const { data: agentsData } = await supabase
        .from('ai_agents')
        .select('id, name, slug, role')
        .eq('is_active', true)
      
      // Fetch Projects
      let projectQuery = supabase
        .from('projects')
        .select('id, name, space_id')
      
      if (spaceId) {
        projectQuery = projectQuery.eq('space_id', spaceId)
      }
      
      const { data: projectsData } = await projectQuery

      // Fetch Spaces
      const { data: spacesData } = await supabase
        .from('spaces')
        .select('id, name')

      setUsers(usersData || [])
      setAgents(agentsData || [])
      setProjects(projectsData || [])
      setSpaces(spacesData || [])
    } catch (error) {
      console.error('Error loading dropdown data:', error)
    } finally {
      setLoadingData(false)
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
          assignee_id: formData.assignee_id || null,
          ai_agent: formData.ai_agent || null,
          project_id: formData.project_id || null,
          space_id: formData.space_id || null,
        })
        .eq('id', task.id)

      if (error) throw error
      
      showSuccessToast('Task updated successfully')
      setIsEditing(false) // Switch back to read-only mode after saving
      onTaskUpdated()
    } catch (error) {
      console.error('Save task error:', error)
      showErrorToast(error, 'Failed to update task')
    } finally {
      setSaving(false)
    }
  }

  async function handleAssignTo() {
    if (!task || !assignToUserId) return
    
    setSaving(true)
    
    try {
      // Find the user being assigned to
      const userToAssign = users.find(u => u.id === assignToUserId)
      if (!userToAssign) throw new Error('User not found')
      
      // Determine if this is an AI agent or human
      const isAgent = userToAssign.is_agent || userToAssign.user_type === 'ai_agent'
      
      const updateData: any = {
        status: isAgent ? 'in_progress' : 'todo',
      }
      
      if (isAgent) {
        // For AI agents, we need to find the corresponding ai_agent slug
        const agent = agents.find(a => a.name.toLowerCase() === userToAssign.name?.toLowerCase() || 
                                      a.slug === userToAssign.name?.toLowerCase())
        updateData.ai_agent = agent?.slug || userToAssign.name?.toLowerCase()
        updateData.assignee_id = null // Clear human assignee
      } else {
        // For humans
        updateData.assignee_id = assignToUserId
        updateData.ai_agent = null // Clear AI agent
      }
      
      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', task.id)

      if (error) throw error
      
      showSuccessToast(`Task assigned to ${userToAssign.name || userToAssign.email}`)
      setAssignToUserId('') // Reset dropdown
      onTaskUpdated()
      onClose() // Close modal after assignment
    } catch (error) {
      console.error('Assign error:', error)
      showErrorToast(error, 'Failed to assign task')
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

  async function handleViewFile(file: TaskFile) {
    const url = await getDownloadUrl(file)
    if (url) {
      setViewFileUrl(url)
      setViewingFile(file)
    }
  }

  function closeFileViewer() {
    setViewingFile(null)
    setViewFileUrl(null)
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
    return <File className="w-5 h-5 text-slate-500" />
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

  // Helper function to get user display name
  const getUserDisplayName = (user: UserData) => {
    if (user.display_name) return user.display_name
    if (user.name) return user.name
    return user.email
  }

  // Helper function to get user type label
  const getUserTypeLabel = (user: UserData) => {
    if (user.is_agent || user.user_type === 'ai_agent') return 'AI Agent'
    return 'Human'
  }

  // Helper function to get status chip color
  const getStatusChipColor = (status: string) => {
    const statusOption = statusOptions.find(s => s.key === status)
    return statusOption?.color || 'default'
  }

  // Helper function to get priority chip color
  const getPriorityChipColor = (priority: string) => {
    const priorityOption = priorityOptions.find(p => p.key === priority)
    return priorityOption?.color || 'bg-slate-400'
  }

  // Helper function to get status label
  const getStatusLabel = (status: string) => {
    const statusOption = statusOptions.find(s => s.key === status)
    return statusOption?.label || status
  }

  // Helper function to get priority label
  const getPriorityLabel = (priority: string) => {
    const priorityOption = priorityOptions.find(p => p.key === priority)
    return priorityOption?.label || priority
  }

  // Helper function to get assigned user name
  const getAssignedUserName = () => {
    if (formData.assignee_id) {
      const user = users.find(u => u.id === formData.assignee_id)
      return user ? getUserDisplayName(user) : 'Unknown user'
    }
    if (formData.ai_agent) {
      const agent = agents.find(a => a.slug === formData.ai_agent)
      return agent ? agent.name : formData.ai_agent
    }
    return 'Unassigned'
  }

  // Helper function to get project name
  const getProjectName = () => {
    if (formData.project_id) {
      const project = projects.find(p => p.id === formData.project_id)
      return project ? project.name : 'Unknown project'
    }
    return 'No project'
  }

  // Helper function to get space name
  const getSpaceName = () => {
    if (formData.space_id) {
      const space = spaces.find(s => s.id === formData.space_id)
      return space ? space.name : 'Unknown space'
    }
    return 'No space'
  }

  if (!task) return null

  return (
    <>
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size="3xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <span>Task Details</span>
              {task.ai_agent && (
                <Chip size="sm" variant="flat" className="capitalize">
                  Agent: {task.ai_agent}
                </Chip>
              )}
            </div>
            {!isEditing && (
              <Button
                size="sm"
                variant="flat"
                isIconOnly
                onPress={() => setIsEditing(true)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
            )}
          </div>
        </ModalHeader>
        
        <ModalBody>
          <div className="flex flex-col gap-6">
            {/* Basic Info */}
            <div className="space-y-4">
              {isEditing ? (
                <>
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Select
                      label="Assignee"
                      placeholder="Select human"
                      selectedKeys={formData.assignee_id ? [formData.assignee_id] : []}
                      onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}
                      startContent={<User className="w-4 h-4 text-slate-400" />}
                    >
                      {users.filter(u => !u.is_agent && u.user_type !== 'ai_agent').map(u => (
                        <SelectItem key={u.id} textValue={u.name || u.email}>
                          <div className="flex items-center gap-2">
                            <span>{u.name || u.email}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </Select>

                    <Select
                      label="AI Agent"
                      placeholder="Select agent"
                      selectedKeys={formData.ai_agent ? [formData.ai_agent] : []}
                      onChange={(e) => setFormData({ ...formData, ai_agent: e.target.value })}
                      startContent={<Bot className="w-4 h-4 text-slate-400" />}
                    >
                      {agents.map(a => (
                        <SelectItem key={a.slug} textValue={a.name}>
                          <div className="flex flex-col">
                            <span className="font-medium">{a.name}</span>
                            <span className="text-xs text-slate-400">{a.role}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </Select>

                    <Select
                      label="Project"
                      placeholder="Select project"
                      selectedKeys={formData.project_id ? [formData.project_id] : []}
                      onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                      startContent={<FileText className="w-4 h-4 text-slate-400" />}
                    >
                      {projects.map(p => (
                        <SelectItem key={p.id} textValue={p.name}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  {/* Read-only view */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-slate-500 dark:text-slate-400">Title</label>
                      <p className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-1">{formData.title}</p>
                    </div>
                    
                    {formData.description && (
                      <div>
                        <label className="text-sm font-medium text-slate-500 dark:text-slate-400">Description</label>
                        <div className="text-slate-700 dark:text-slate-300 mt-1 prose prose-slate dark:prose-invert max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{formData.description || ''}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-500 dark:text-slate-400">Status</label>
                        <div className="mt-1">
                          <Select
                            size="sm"
                            selectedKeys={[formData.status]}
                            onChange={(e) => {
                              setFormData({ ...formData, status: e.target.value })
                              // Auto-save status change
                              if (task) {
                                supabase
                                  .from('tasks')
                                  .update({ status: e.target.value })
                                  .eq('id', task.id)
                                  .then(() => {
                                    showSuccessToast('Status updated')
                                    onTaskUpdated()
                                  })
                                  .catch(error => {
                                    console.error('Update status error:', error)
                                    showErrorToast(error, 'Failed to update status')
                                  })
                              }
                            }}
                            className="w-full"
                          >
                            {statusOptions.map(s => (
                              <SelectItem key={s.key}>{s.label}</SelectItem>
                            ))}
                          </Select>
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-slate-500 dark:text-slate-400">Priority</label>
                        <div className="mt-1">
                          <Select
                            size="sm"
                            selectedKeys={[formData.priority]}
                            onChange={(e) => {
                              setFormData({ ...formData, priority: e.target.value })
                              // Auto-save priority change
                              if (task) {
                                supabase
                                  .from('tasks')
                                  .update({ priority: e.target.value })
                                  .eq('id', task.id)
                                  .then(() => {
                                    showSuccessToast('Priority updated')
                                    onTaskUpdated()
                                  })
                                  .catch(error => {
                                    console.error('Update priority error:', error)
                                    showErrorToast(error, 'Failed to update priority')
                                  })
                              }
                            }}
                            className="w-full"
                          >
                            {priorityOptions.map(p => (
                              <SelectItem key={p.key}>{p.label}</SelectItem>
                            ))}
                          </Select>
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-slate-500 dark:text-slate-400">Due Date</label>
                        <div className="mt-1">
                          <Input
                            type="date"
                            size="sm"
                            value={formData.due_date}
                            onChange={(e) => {
                              setFormData({ ...formData, due_date: e.target.value })
                              // Auto-save due date change
                              if (task) {
                                supabase
                                  .from('tasks')
                                  .update({ due_date: e.target.value || null })
                                  .eq('id', task.id)
                                  .then(() => {
                                    showSuccessToast('Due date updated')
                                    onTaskUpdated()
                                  })
                                  .catch(error => {
                                    console.error('Update due date error:', error)
                                    showErrorToast(error, 'Failed to update due date')
                                  })
                              }
                            }}
                            className="w-full"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-500 dark:text-slate-400">Assigned To</label>
                        <p className="text-slate-700 dark:text-slate-300 mt-1">{getAssignedUserName()}</p>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-slate-500 dark:text-slate-400">Project</label>
                        <p className="text-slate-700 dark:text-slate-300 mt-1">{getProjectName()}</p>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-slate-500 dark:text-slate-400">Space</label>
                        <p className="text-slate-700 dark:text-slate-300 mt-1">
                          {getSpaceName()}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Quick Assign (only in read-only mode) */}
            {!isEditing && (
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <span className="text-sm text-slate-500 whitespace-nowrap">Assign to:</span>
                <Select
                  placeholder="Select user or agent"
                  size="sm"
                  selectedKeys={assignToUserId ? [assignToUserId] : []}
                  onChange={(e) => setAssignToUserId(e.target.value)}
                  className="flex-1"
                >
                  {users.map(u => (
                    <SelectItem 
                      key={u.id} 
                      textValue={getUserDisplayName(u)}
                      startContent={
                        u.is_agent || u.user_type === 'ai_agent' ? (
                          <Bot className="w-4 h-4 text-purple-500" />
                        ) : (
                          <User className="w-4 h-4 text-blue-500" />
                        )
                      }
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{getUserDisplayName(u)}</span>
                        <span className="text-xs text-slate-400">{getUserTypeLabel(u)}</span>
                      </div>
                    </SelectItem>
                  ))}
                </Select>
                <Button
                  color="primary"
                  size="sm"
                  onPress={handleAssignTo}
                  isDisabled={!assignToUserId || saving}
                  isLoading={saving}
                >
                  Assign
                </Button>
              </div>
            )}

            {/* Quick Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Notes</label>
              <Textarea
                placeholder="Add notes... (auto-saves)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                onBlur={async () => {
                  if (task && formData.description !== task.description) {
                    await supabase
                      .from('tasks')
                      .update({ description: formData.description || null })
                      .eq('id', task.id)
                    showSuccessToast('Notes saved')
                  }
                }}
                minRows={2}
                maxRows={6}
                classNames={{
                  inputWrapper: "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                }}
              />
            </div>

            <Divider />

            {/* Documents Section */}
            {task && (
              <TaskDocuments
                taskId={task.id}
                taskTitle={task.title}
                spaceId={task.space_id}
                userId={userId || null}
              />
            )}

            <Divider />

            {/* Task Thread Section - Collapsible */}
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer text-md font-semibold text-slate-700 dark:text-slate-200 hover:text-violet-600 transition-colors">
                <MessageCircle className="w-4 h-4" /> 
                <span>Conversation</span>
                <ChevronDown className="w-4 h-4 ml-auto transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3 h-[200px]">
                {task && (
                  <TaskThread taskId={task.id} className="h-full" />
                )}
              </div>
            </details>

            <Divider />

            {/* File Attachments */}
            <div className="space-y-3">
              <h3 className="text-md font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Paperclip className="w-4 h-4" /> Attachments
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
                    <div className="mb-2 text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    </div>
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
                  {files.map((file) => {
                    const canView = isViewableFile(file.file_name, file.file_type)
                    return (
                      <div
                        key={file.id}
                        className={`flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800 rounded-lg ${canView ? 'cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors' : ''}`}
                        onClick={() => canView && handleViewFile(file)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {getFileIcon(file.file_type)}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-slate-700 dark:text-slate-200 truncate">
                                {file.file_name}
                              </p>
                              {canView && (
                                <Chip size="sm" variant="flat" className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs">
                                  <Eye className="w-3 h-3 mr-1 inline" />
                                  Viewable
                                </Chip>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {formatFileSize(file.file_size)} • {new Date(file.uploaded_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1 sm:gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          {canView && (
                            <Button
                              size="sm"
                              variant="flat"
                              color="primary"
                              onPress={() => handleViewFile(file)}
                              className="hidden sm:flex"
                              startContent={<Eye className="w-4 h-4" />}
                            >
                              View
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="flat"
                            onPress={() => handleDownload(file)}
                            className="hidden sm:flex"
                            startContent={<Download className="w-4 h-4" />}
                          >
                            Download
                          </Button>
                          <Button
                            size="sm"
                            variant="flat"
                            color="danger"
                            onPress={() => handleDeleteFile(file)}
                            className="hidden sm:flex"
                            startContent={<Trash2 className="w-4 h-4" />}
                          >
                            Delete
                          </Button>
                          {/* Mobile icon-only buttons */}
                          {canView && (
                            <Button
                              size="sm"
                              variant="flat"
                              color="primary"
                              isIconOnly
                              onPress={() => handleViewFile(file)}
                              className="sm:hidden min-w-[36px]"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="flat"
                            isIconOnly
                            onPress={() => handleDownload(file)}
                            className="sm:hidden min-w-[36px]"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="flat"
                            color="danger"
                            isIconOnly
                            onPress={() => handleDeleteFile(file)}
                            className="sm:hidden min-w-[36px]"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-center text-slate-400 py-4">No attachments yet</p>
              )}
            </div>

            {/* Metadata */}
            <div className="text-xs text-slate-400 space-y-1">
              <p>Created: {new Date(task.created_at).toLocaleString()}</p>
              {task.creator && (
                <p>Created by: {task.creator.display_name || task.creator.name}</p>
              )}
              {task.requester && (
                <p>Requested by: {task.requester.display_name || task.requester.name}</p>
              )}
              {task.updated_at && (
                <p>Last updated: {new Date(task.updated_at).toLocaleString()}</p>
              )}
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          {isEditing ? (
            <>
              <Button variant="flat" onPress={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={handleSave}
                isLoading={saving}
                isDisabled={!formData.title.trim()}
              >
                Save Changes
              </Button>
            </>
          ) : (
            <div className="flex gap-2 w-full justify-between">
              <div>
                {task && task.status !== 'done' && !task.focus_queue_order && (
                  <Button 
                    variant="flat" 
                    color="secondary"
                    onPress={async () => {
                      const { data: maxTask } = await supabase
                        .from('tasks')
                        .select('focus_queue_order')
                        .gte('focus_queue_order', 0)
                        .order('focus_queue_order', { ascending: false })
                        .limit(1)
                        .single()
                      const nextOrder = (maxTask?.focus_queue_order || 0) + 1
                      await supabase.from('tasks').update({ focus_queue_order: nextOrder }).eq('id', task.id)
                      showSuccessToast("Added to Today's Queue!")
                      onUpdate?.()
                    }}
                  >
                    ☀️ Add to Today
                  </Button>
                )}
                {task && task.focus_queue_order && (
                  <Chip color="secondary" variant="flat">In Today's Queue</Chip>
                )}
              </div>
              <Button variant="flat" onPress={onClose}>
                Close
              </Button>
            </div>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
    
    {/* File Viewer Modal */}
    <FileViewerModal
      isOpen={!!viewingFile}
      onClose={closeFileViewer}
      fileName={viewingFile?.file_name || ''}
      fileUrl={viewFileUrl}
      fileType={viewingFile?.file_type || null}
    />
    </>
  )
}
