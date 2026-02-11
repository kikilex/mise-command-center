'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageCircle, Eye, Download, Trash2, FileText, ClipboardList, Bot, Paperclip, User, File, Check, Calendar, Flag, Folder, Layout } from 'lucide-react'
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
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from '@heroui/react'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import FileViewerModal, { isViewableFile } from './FileViewerModal'
import TaskDocuments from './TaskDocuments'
import TaskThread from './TaskThread'
import RichTextEditor from './RichTextEditor'

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
  notes?: string | null
  creator?: { name: string; display_name?: string } | null
  requester?: { name: string; display_name?: string } | null
  focus_queue_order?: number | null
  phase_item_id?: string | null
}

interface AIAgent {
  id: string
  name: string
  slug: string
  role: string
  is_active?: boolean
}

interface Project {
  id: string
  name: string
  space_id?: string | null
}

interface Space {
  id: string
  name: string
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
  { key: 'critical', label: 'Critical', color: 'danger' },
  { key: 'high', label: 'High', color: 'warning' },
  { key: 'medium', label: 'Medium', color: 'primary' },
  { key: 'low', label: 'Low', color: 'default' },
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

const MAX_FILE_SIZE = 50 * 1024 * 1024

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
    notes: '',
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const notesAutoSaveRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedNotesRef = useRef<string>('')
  
  const supabase = createClient()

  const [subItems, setSubItems] = useState<{text: string, completed: boolean}[]>([])

  useEffect(() => {
    if (task && isOpen) {
      const loadFreshTask = async () => {
        const { data: freshTask } = await supabase
          .from('tasks')
          .select('*, phase_item:phase_item_id(notes, sub_items)')
          .eq('id', task.id)
          .single()
        
        const taskData = freshTask || task
        
        setFormData({
          title: taskData.title || '',
          description: taskData.description || '',
          notes: taskData.notes || '',
          status: taskData.status || 'todo',
          priority: taskData.priority || 'medium',
          due_date: taskData.due_date ? taskData.due_date.split('T')[0] : '',
          assignee_id: taskData.assignee_id || '',
          ai_agent: taskData.ai_agent || '',
          project_id: taskData.project_id || '',
          space_id: taskData.space_id || '',
        })
        
        if (taskData.phase_item?.sub_items) {
          const parsedSubItems = taskData.phase_item.sub_items.map((item: string) => {
            try {
              return JSON.parse(item)
            } catch {
              return { text: item, completed: false }
            }
          })
          setSubItems(parsedSubItems)
        } else {
          setSubItems([])
        }
        
        // Track last saved notes for auto-save comparison
        lastSavedNotesRef.current = taskData.notes || ''
      }
      loadFreshTask()
      setIsEditing(false)
      loadFiles(task.id)
      loadDropdownData(task.space_id)
    }
  }, [task, isOpen])

  // Auto-save notes with debounce
  useEffect(() => {
    if (!task || !isOpen) return
    
    // Only auto-save if notes changed from last saved value
    if (formData.notes === lastSavedNotesRef.current) return
    
    // Clear existing timer
    if (notesAutoSaveRef.current) {
      clearTimeout(notesAutoSaveRef.current)
    }
    
    // Set new timer for 1.5 seconds after typing stops
    notesAutoSaveRef.current = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('tasks')
          .update({ notes: formData.notes || null })
          .eq('id', task.id)
        if (!error) {
          lastSavedNotesRef.current = formData.notes
          // Subtle feedback - no toast, just silent save
        }
      } catch (e) {
        console.error('Auto-save notes failed:', e)
      }
    }, 1500)
    
    return () => {
      if (notesAutoSaveRef.current) {
        clearTimeout(notesAutoSaveRef.current)
      }
    }
  }, [formData.notes, task?.id, isOpen])

  async function loadDropdownData(spaceId: string | null) {
    setLoadingData(true)
    try {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, name, avatar_url, user_type, is_agent, display_name')
        .order('is_agent', { ascending: true })
      
      const { data: agentsData } = await supabase
        .from('ai_agents')
        .select('id, name, slug, role')
        .eq('is_active', true)
      
      let projectQuery = supabase.from('projects').select('id, name, space_id')
      if (spaceId) projectQuery = projectQuery.eq('space_id', spaceId)
      const { data: projectsData } = await projectQuery

      const { data: spacesData } = await supabase.from('spaces').select('id, name')

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
    } finally {
      setLoadingFiles(false)
    }
  }

  // Quick update helper - updates single field immediately
  async function quickUpdate(field: string, value: any) {
    if (!task) return
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ [field]: value })
        .eq('id', task.id)
      if (error) throw error
      onTaskUpdated()
    } catch (error) {
      console.error('Update error:', error)
      showErrorToast(error, 'Failed to update')
    }
  }

  async function handleSaveNotes() {
    if (!task) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ notes: formData.notes || null })
        .eq('id', task.id)
      if (error) throw error
      showSuccessToast('Notes saved')
      onTaskUpdated()
    } catch (error) {
      showErrorToast(error, 'Failed to save notes')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAll() {
    if (!task) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: formData.title,
          description: formData.description || null,
          notes: formData.notes || null,
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
      showSuccessToast('Task updated')
      setIsEditing(false)
      onTaskUpdated()
    } catch (error) {
      showErrorToast(error, 'Failed to update task')
    } finally {
      setSaving(false)
    }
  }

  async function handleAssign(userId: string) {
    if (!task) return
    const user = users.find(u => u.id === userId)
    if (!user) return

    const isAgent = user.is_agent || user.user_type === 'ai_agent'
    const updateData: any = { status: isAgent ? 'in_progress' : 'todo' }

    if (isAgent) {
      const agent = agents.find(a => a.name.toLowerCase() === user.name?.toLowerCase())
      updateData.ai_agent = agent?.slug || user.name?.toLowerCase()
      updateData.assignee_id = null
    } else {
      updateData.assignee_id = userId
      updateData.ai_agent = null
    }

    try {
      const { error } = await supabase.from('tasks').update(updateData).eq('id', task.id)
      if (error) throw error
      showSuccessToast(`Assigned to ${user.name || user.email}`)
      setFormData({ ...formData, assignee_id: updateData.assignee_id || '', ai_agent: updateData.ai_agent || '' })
      onTaskUpdated()
    } catch (error) {
      showErrorToast(error, 'Failed to assign')
    }
  }

  const handleFileUpload = useCallback(async (fileList: FileList | null) => {
    if (!fileList || !task) return
    const filesToUpload = Array.from(fileList)
    
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
        const filePath = `${task.id}/${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage.from('task-files').upload(filePath, file)
        if (uploadError) throw uploadError

        const { error: dbError } = await supabase.from('task_files').insert({
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
      showErrorToast(error, 'Failed to upload file')
    } finally {
      setUploading(false)
    }
  }, [task, userId])

  async function handleDeleteFile(file: TaskFile) {
    try {
      await supabase.storage.from('task-files').remove([file.file_path])
      await supabase.from('task_files').delete().eq('id', file.id)
      showSuccessToast('File deleted')
      setFiles(files.filter(f => f.id !== file.id))
    } catch (error) {
      showErrorToast(error, 'Failed to delete file')
    }
  }

  async function getDownloadUrl(file: TaskFile) {
    try {
      const { data, error } = await supabase.storage.from('task-files').createSignedUrl(file.file_path, 3600)
      if (error) throw error
      return data.signedUrl
    } catch (error) {
      showErrorToast(error, 'Failed to get download link')
      return null
    }
  }

  async function handleViewFile(file: TaskFile) {
    const url = await getDownloadUrl(file)
    if (url) {
      setViewFileUrl(url)
      setViewingFile(file)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }, [])
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }, [])
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files) }, [handleFileUpload])

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getUserDisplayName = (user: UserData) => user.display_name || user.name || user.email
  const getAssignedName = () => {
    if (formData.assignee_id) {
      const user = users.find(u => u.id === formData.assignee_id)
      return user ? getUserDisplayName(user) : 'Unknown'
    }
    if (formData.ai_agent) {
      const agent = agents.find(a => a.slug === formData.ai_agent)
      return agent ? agent.name : formData.ai_agent
    }
    return null
  }
  const getProjectName = () => projects.find(p => p.id === formData.project_id)?.name || null
  const getSpaceName = () => spaces.find(s => s.id === formData.space_id)?.name || null

  if (!task) return null

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="pb-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-violet-500" />
            <span className="text-sm text-slate-500">Task</span>
          </div>
        </ModalHeader>
        
        <ModalBody className="pt-0">
          {isEditing ? (
            /* ===== EDIT MODE ===== */
            <div className="space-y-4">
              <Input
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                size="lg"
              />
              
              <Textarea
                label="Description"
                placeholder="What needs to be done?"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                minRows={2}
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Select label="Status" size="sm" selectedKeys={[formData.status]} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                  {statusOptions.map(s => <SelectItem key={s.key}>{s.label}</SelectItem>)}
                </Select>
                <Select label="Priority" size="sm" selectedKeys={[formData.priority]} onChange={(e) => setFormData({ ...formData, priority: e.target.value })}>
                  {priorityOptions.map(p => <SelectItem key={p.key}>{p.label}</SelectItem>)}
                </Select>
                <Input label="Due" type="date" size="sm" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} />
                <Select label="Assignee" size="sm" placeholder="Select" selectedKeys={formData.assignee_id ? [formData.assignee_id] : []} onChange={(e) => setFormData({ ...formData, assignee_id: e.target.value })}>
                  {users.filter(u => !u.is_agent).map(u => <SelectItem key={u.id}>{u.name || u.email}</SelectItem>)}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select label="AI Agent" size="sm" placeholder="None" selectedKeys={formData.ai_agent ? [formData.ai_agent] : []} onChange={(e) => setFormData({ ...formData, ai_agent: e.target.value })}>
                  {agents.map(a => <SelectItem key={a.slug}>{a.name}</SelectItem>)}
                </Select>
                <Select label="Project" size="sm" placeholder="None" selectedKeys={formData.project_id ? [formData.project_id] : []} onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}>
                  {projects.map(p => <SelectItem key={p.id}>{p.name}</SelectItem>)}
                </Select>
              </div>
            </div>
          ) : (
            /* ===== VIEW MODE ===== */
            <div className="space-y-4">
              {/* Title */}
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{formData.title}</h2>
              
              {/* Compact Metadata Row */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Dropdown */}
                <Dropdown>
                  <DropdownTrigger>
                    <Chip 
                      size="sm" 
                      color={statusOptions.find(s => s.key === formData.status)?.color as any || 'default'}
                      className="cursor-pointer hover:opacity-80"
                    >
                      {statusOptions.find(s => s.key === formData.status)?.label}
                    </Chip>
                  </DropdownTrigger>
                  <DropdownMenu onAction={(key) => { setFormData({ ...formData, status: key as string }); quickUpdate('status', key) }}>
                    {statusOptions.map(s => <DropdownItem key={s.key}>{s.label}</DropdownItem>)}
                  </DropdownMenu>
                </Dropdown>

                {/* Priority Dropdown */}
                <Dropdown>
                  <DropdownTrigger>
                    <Chip 
                      size="sm" 
                      color={priorityOptions.find(p => p.key === formData.priority)?.color as any || 'default'}
                      variant="flat"
                      className="cursor-pointer hover:opacity-80"
                      startContent={<Flag className="w-3 h-3" />}
                    >
                      {priorityOptions.find(p => p.key === formData.priority)?.label}
                    </Chip>
                  </DropdownTrigger>
                  <DropdownMenu onAction={(key) => { setFormData({ ...formData, priority: key as string }); quickUpdate('priority', key) }}>
                    {priorityOptions.map(p => <DropdownItem key={p.key}>{p.label}</DropdownItem>)}
                  </DropdownMenu>
                </Dropdown>

                {/* Due Date */}
                <div className="flex items-center gap-1 text-sm text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <input 
                    type="date" 
                    value={formData.due_date} 
                    onChange={(e) => { setFormData({ ...formData, due_date: e.target.value }); quickUpdate('due_date', e.target.value || null) }}
                    className="bg-transparent border-none p-0 text-sm text-slate-600 dark:text-slate-400 cursor-pointer hover:text-violet-600"
                  />
                </div>

                {/* Assignee Dropdown */}
                <Dropdown>
                  <DropdownTrigger>
                    <Chip 
                      size="sm" 
                      variant="flat"
                      className="cursor-pointer hover:opacity-80"
                      startContent={getAssignedName() && (formData.ai_agent ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />)}
                    >
                      {getAssignedName() || 'Unassigned'}
                    </Chip>
                  </DropdownTrigger>
                  <DropdownMenu onAction={(key) => handleAssign(key as string)}>
                    {users.map(u => (
                      <DropdownItem 
                        key={u.id}
                        startContent={u.is_agent || u.user_type === 'ai_agent' ? <Bot className="w-4 h-4 text-purple-500" /> : <User className="w-4 h-4 text-blue-500" />}
                      >
                        {getUserDisplayName(u)}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>

                {/* Project */}
                {getProjectName() && (
                  <Chip size="sm" variant="flat" startContent={<Folder className="w-3 h-3" />}>
                    {getProjectName()}
                  </Chip>
                )}

                {/* Space */}
                {getSpaceName() && (
                  <Chip size="sm" variant="flat" color="secondary" startContent={<Layout className="w-3 h-3" />}>
                    {getSpaceName()}
                  </Chip>
                )}
              </div>

              {/* Description (if exists) */}
              {formData.description && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div 
                    className="prose prose-sm prose-slate dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: formData.description }}
                  />
                </div>
              )}

              {/* Sub-items */}
              {subItems.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-500 uppercase">Checklist</label>
                  <div className="space-y-1">
                    {subItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded">
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          item.completed ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300'
                        }`}>
                          {item.completed && <Check className="w-3 h-3" />}
                        </div>
                        <span className={`text-sm ${item.completed ? 'line-through text-slate-400' : ''}`}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Divider />

              {/* Notes Section - Always visible, easy to edit */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-500 uppercase">Notes</label>
                  <Button size="sm" variant="flat" color="primary" onPress={handleSaveNotes} isLoading={saving}>
                    Save Notes
                  </Button>
                </div>
                <RichTextEditor
                  content={formData.notes}
                  onChange={(val) => setFormData({ ...formData, notes: val })}
                  placeholder="Add notes, thoughts, updates..."
                  minHeight="100px"
                />
              </div>

              <Divider />

              {/* Conversation - Always visible */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 uppercase flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" /> Conversation
                </label>
                <div className="h-[180px] border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <TaskThread taskId={task.id} className="h-full" />
                </div>
              </div>

              <Divider />

              {/* Documents */}
              <TaskDocuments
                taskId={task.id}
                taskTitle={task.title}
                spaceId={task.space_id}
                userId={userId || null}
              />

              <Divider />

              {/* Attachments - Bottom */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 uppercase flex items-center gap-1">
                  <Paperclip className="w-3.5 h-3.5" /> Attachments {files.length > 0 && `(${files.length})`}
                </label>
                
                <div
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                    isDragging ? 'border-primary bg-primary/10' : 'border-slate-300 dark:border-slate-600 hover:border-primary/50'
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
                    <Spinner size="sm" />
                  ) : (
                    <p className="text-sm text-slate-500">Drop files or click to upload</p>
                  )}
                </div>

                {files.length > 0 && (
                  <div className="space-y-1">
                    {files.map((file) => (
                      <div key={file.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <File className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="truncate">{file.file_name}</span>
                          <span className="text-xs text-slate-400">{formatFileSize(file.file_size)}</span>
                        </div>
                        <div className="flex gap-1">
                          {isViewableFile(file.file_name, file.file_type) && (
                            <Button size="sm" variant="light" isIconOnly onPress={() => handleViewFile(file)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="light" isIconOnly onPress={async () => { const url = await getDownloadUrl(file); if (url) window.open(url, '_blank') }}>
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="light" color="danger" isIconOnly onPress={() => handleDeleteFile(file)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Metadata footer */}
              <div className="text-xs text-slate-400 pt-2">
                Created {new Date(task.created_at).toLocaleDateString()}
                {task.creator && ` by ${task.creator.display_name || task.creator.name}`}
                {task.updated_at && ` • Updated ${new Date(task.updated_at).toLocaleDateString()}`}
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter className="border-t border-slate-200 dark:border-slate-700">
          {isEditing ? (
            <>
              <Button variant="flat" onPress={() => setIsEditing(false)}>Cancel</Button>
              <Button color="primary" onPress={handleSaveAll} isLoading={saving}>Save Changes</Button>
            </>
          ) : (
            <div className="flex gap-2 w-full justify-between">
              <div className="flex gap-2">
                <Button variant="flat" size="sm" onPress={() => setIsEditing(true)}>Edit Task</Button>
                {task.status !== 'done' && !task.focus_queue_order && (
                  <Button 
                    variant="flat" 
                    color="secondary"
                    size="sm"
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
                      onTaskUpdated()
                    }}
                  >
                    ☀️ Add to Today
                  </Button>
                )}
                {task.focus_queue_order !== null && task.focus_queue_order !== undefined && (
                  <Chip size="sm" color="secondary" variant="flat">In Queue</Chip>
                )}
              </div>
              <Button variant="flat" onPress={onClose}>Close</Button>
            </div>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
    
    <FileViewerModal
      isOpen={!!viewingFile}
      onClose={() => { setViewingFile(null); setViewFileUrl(null) }}
      fileName={viewingFile?.file_name || ''}
      fileUrl={viewFileUrl}
      fileType={viewingFile?.file_type || null}
    />
    </>
  )
}
