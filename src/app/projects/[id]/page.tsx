'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { 
  ArrowLeft, Edit, Folder, FileText, CheckSquare, Paperclip,
  Plus, Trash2, Save, X, Upload, Download, Eye
} from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  Select,
  SelectItem,
  useDisclosure,
  Tabs,
  Tab,
  Progress,
} from '@heroui/react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { useBusiness } from '@/lib/business-context'

interface Project {
  id: string
  name: string
  description: string | null
  notes: string | null
  template_id: string | null
  business_id: string | null
  status: 'active' | 'completed' | 'archived' | 'on_hold'
  custom_fields: Record<string, any>
  created_by: string
  created_at: string
  updated_at: string
  template?: {
    id: string
    name: string
    fields: any[]
  }
}

interface LinkedDocument {
  id: string
  title: string
  status: string
  category: string
  updated_at: string
}

interface LinkedTask {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
}

interface ProjectFile {
  id: string
  name: string
  file_path: string
  file_type: string | null
  file_size: number | null
  created_at: string
}

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

const statusOptions = [
  { key: 'active', label: 'Active', color: 'success' },
  { key: 'on_hold', label: 'On Hold', color: 'warning' },
  { key: 'completed', label: 'Completed', color: 'primary' },
  { key: 'archived', label: 'Archived', color: 'default' },
]

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const { selectedBusinessId } = useBusiness()
  
  const [project, setProject] = useState<Project | null>(null)
  const [documents, setDocuments] = useState<LinkedDocument[]>([])
  const [tasks, setTasks] = useState<LinkedTask[]>([])
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Edit mode
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editStatus, setEditStatus] = useState('active')
  
  // Modals
  const { isOpen: isDocModalOpen, onOpen: onDocModalOpen, onClose: onDocModalClose } = useDisclosure()
  const { isOpen: isTaskModalOpen, onOpen: onTaskModalOpen, onClose: onTaskModalClose } = useDisclosure()
  const [availableDocs, setAvailableDocs] = useState<LinkedDocument[]>([])
  const [availableTasks, setAvailableTasks] = useState<LinkedTask[]>([])
  
  // New doc/task forms
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')

  useEffect(() => {
    loadUser()
    loadProject()
  }, [id])

  async function loadUser() {
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
  }

  async function loadProject() {
    setLoading(true)
    try {
      // Load project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*, template:project_templates(*)')
        .eq('id', id)
        .single()
      
      if (projectError) throw projectError
      setProject(projectData)
      setEditName(projectData.name)
      setEditDescription(projectData.description || '')
      setEditNotes(projectData.notes || '')
      setEditStatus(projectData.status)
      
      // Load linked documents
      const { data: docsData } = await supabase
        .from('documents')
        .select('id, title, status, category, updated_at')
        .eq('project_id', id)
        .order('updated_at', { ascending: false })
      
      setDocuments(docsData || [])
      
      // Load linked tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, title, status, priority, due_date')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
      
      setTasks(tasksData || [])
      
      // Load files
      const { data: filesData } = await supabase
        .from('project_files')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
      
      setFiles(filesData || [])
      
    } catch (error) {
      console.error('Load project error:', error)
      showErrorToast(error, 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!project) return
    setSaving(true)
    
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: editName,
          description: editDescription || null,
          notes: editNotes || null,
          status: editStatus,
        })
        .eq('id', project.id)
      
      if (error) throw error
      
      setProject({
        ...project,
        name: editName,
        description: editDescription || null,
        notes: editNotes || null,
        status: editStatus as any,
      })
      setIsEditing(false)
      showSuccessToast('Project saved')
    } catch (error) {
      showErrorToast(error, 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function loadAvailableDocs() {
    const { data } = await supabase
      .from('documents')
      .select('id, title, status, category, updated_at')
      .is('project_id', null)
      .eq('business_id', project?.business_id || null)
      .order('updated_at', { ascending: false })
      .limit(50)
    
    setAvailableDocs(data || [])
  }

  async function loadAvailableTasks() {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, status, priority, due_date')
      .is('project_id', null)
      .eq('business_id', project?.business_id || null)
      .order('created_at', { ascending: false })
      .limit(50)
    
    setAvailableTasks(data || [])
  }

  async function linkDocument(docId: string) {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ project_id: id })
        .eq('id', docId)
      
      if (error) throw error
      loadProject()
      onDocModalClose()
      showSuccessToast('Document linked')
    } catch (error) {
      showErrorToast(error, 'Failed to link document')
    }
  }

  async function unlinkDocument(docId: string) {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ project_id: null })
        .eq('id', docId)
      
      if (error) throw error
      setDocuments(documents.filter(d => d.id !== docId))
      showSuccessToast('Document unlinked')
    } catch (error) {
      showErrorToast(error, 'Failed to unlink document')
    }
  }

  async function createAndLinkDocument() {
    if (!newDocTitle.trim() || !user) return
    
    try {
      const { data, error } = await supabase
        .from('documents')
        .insert({
          title: newDocTitle,
          content: '# ' + newDocTitle + '\n\nStart writing here...',
          status: 'draft',
          project_id: id,
          business_id: project?.business_id || null,
          created_by: user.id,
        })
        .select()
        .single()
      
      if (error) throw error
      
      setNewDocTitle('')
      loadProject()
      onDocModalClose()
      showSuccessToast('Document created')
      
      // Navigate to edit the new doc
      router.push(`/docs/${data.id}/edit`)
    } catch (error) {
      showErrorToast(error, 'Failed to create document')
    }
  }

  async function linkTask(taskId: string) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ project_id: id })
        .eq('id', taskId)
      
      if (error) throw error
      loadProject()
      onTaskModalClose()
      showSuccessToast('Task linked')
    } catch (error) {
      showErrorToast(error, 'Failed to link task')
    }
  }

  async function unlinkTask(taskId: string) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ project_id: null })
        .eq('id', taskId)
      
      if (error) throw error
      setTasks(tasks.filter(t => t.id !== taskId))
      showSuccessToast('Task unlinked')
    } catch (error) {
      showErrorToast(error, 'Failed to unlink task')
    }
  }

  async function createAndLinkTask() {
    if (!newTaskTitle.trim() || !user) return
    
    try {
      const { error } = await supabase
        .from('tasks')
        .insert({
          title: newTaskTitle,
          status: 'todo',
          priority: 'medium',
          project_id: id,
          business_id: project?.business_id || null,
          created_by: user.id,
        })
      
      if (error) throw error
      
      setNewTaskTitle('')
      loadProject()
      onTaskModalClose()
      showSuccessToast('Task created')
    } catch (error) {
      showErrorToast(error, 'Failed to create task')
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    
    try {
      // Upload to Supabase Storage
      const fileName = `${id}/${Date.now()}-${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(fileName, file)
      
      if (uploadError) throw uploadError
      
      // Save file record
      const { error: dbError } = await supabase
        .from('project_files')
        .insert({
          project_id: id,
          name: file.name,
          file_path: uploadData.path,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user.id,
        })
      
      if (dbError) throw dbError
      
      loadProject()
      showSuccessToast('File uploaded')
    } catch (error) {
      showErrorToast(error, 'Failed to upload file')
    }
    
    // Reset input
    e.target.value = ''
  }

  async function deleteFile(fileId: string, filePath: string) {
    try {
      // Delete from storage
      await supabase.storage.from('project-files').remove([filePath])
      
      // Delete record
      const { error } = await supabase
        .from('project_files')
        .delete()
        .eq('id', fileId)
      
      if (error) throw error
      
      setFiles(files.filter(f => f.id !== fileId))
      showSuccessToast('File deleted')
    } catch (error) {
      showErrorToast(error, 'Failed to delete file')
    }
  }

  async function downloadFile(filePath: string, fileName: string) {
    try {
      const { data, error } = await supabase.storage
        .from('project-files')
        .download(filePath)
      
      if (error) throw error
      
      // Create download link
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      showErrorToast(error, 'Failed to download file')
    }
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getStatusColor = (status: string) => {
    return statusOptions.find(s => s.key === status)?.color || 'default'
  }

  const getStatusLabel = (status: string) => {
    return statusOptions.find(s => s.key === status)?.label || status
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navbar user={user} />
        <div className="flex justify-center items-center py-20">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navbar user={user} />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardBody className="text-center py-12">
              <Folder className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h2 className="text-xl font-semibold mb-2">Project not found</h2>
              <Button as={Link} href="/projects" variant="flat">
                Back to Projects
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar user={user} />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Back button */}
        <Button
          as={Link}
          href="/projects"
          variant="light"
          size="sm"
          startContent={<ArrowLeft className="w-4 h-4" />}
          className="mb-4"
        >
          Back to Projects
        </Button>

        {/* Header */}
        <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mb-6">
          <CardBody className="p-6">
            {isEditing ? (
              <div className="space-y-4">
                <Input
                  label="Project Name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  size="lg"
                />
                <Textarea
                  label="Description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  minRows={2}
                />
                <Select
                  label="Status"
                  selectedKeys={[editStatus]}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  {statusOptions.map(s => (
                    <SelectItem key={s.key}>{s.label}</SelectItem>
                  ))}
                </Select>
                <div className="flex gap-2">
                  <Button color="primary" onPress={handleSave} isLoading={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                  <Button variant="flat" onPress={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Folder className="w-8 h-8 text-primary-500" />
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                      {project.name}
                    </h1>
                    <Chip color={getStatusColor(project.status) as any} variant="flat">
                      {getStatusLabel(project.status)}
                    </Chip>
                  </div>
                  {project.description && (
                    <p className="text-slate-600 dark:text-slate-400 mb-2">{project.description}</p>
                  )}
                  {project.template && (
                    <Chip size="sm" variant="flat" className="mt-2">
                      {project.template.name}
                    </Chip>
                  )}
                </div>
                <Button
                  color="primary"
                  variant="flat"
                  onPress={() => setIsEditing(true)}
                  startContent={<Edit className="w-4 h-4" />}
                >
                  Edit
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Tabs for content sections */}
        <Tabs 
          color="primary" 
          variant="underlined"
          classNames={{
            tabList: "gap-6",
            tab: "px-0 h-12",
          }}
        >
          {/* Notes Tab */}
          <Tab 
            key="notes" 
            title={
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Notes</span>
              </div>
            }
          >
            <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mt-4">
              <CardBody className="p-6">
                {isEditing ? (
                  <Textarea
                    label="Project Notes (Markdown supported)"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    minRows={10}
                    placeholder="Add notes, plans, or documentation for this project..."
                  />
                ) : project.notes ? (
                  <div className="prose dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {project.notes}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No notes yet</p>
                    <Button 
                      variant="flat" 
                      size="sm" 
                      className="mt-2"
                      onPress={() => setIsEditing(true)}
                    >
                      Add Notes
                    </Button>
                  </div>
                )}
              </CardBody>
            </Card>
          </Tab>

          {/* Documents Tab */}
          <Tab 
            key="documents" 
            title={
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Documents</span>
                {documents.length > 0 && (
                  <Chip size="sm" variant="flat">{documents.length}</Chip>
                )}
              </div>
            }
          >
            <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mt-4">
              <CardHeader className="flex justify-between items-center px-6 py-4">
                <h3 className="font-semibold">Linked Documents</h3>
                <Button 
                  size="sm" 
                  color="primary"
                  onPress={() => { loadAvailableDocs(); onDocModalOpen(); }}
                  startContent={<Plus className="w-4 h-4" />}
                >
                  Add Document
                </Button>
              </CardHeader>
              <CardBody className="px-6 pb-6 pt-0">
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No documents linked yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map(doc => (
                      <div 
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <Link 
                          href={`/docs/${doc.id}`}
                          className="flex items-center gap-3 flex-1 min-w-0"
                        >
                          <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                          <span className="font-medium truncate">{doc.title}</span>
                          <Chip size="sm" variant="flat">{doc.category}</Chip>
                        </Link>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="light"
                            isIconOnly
                            as={Link}
                            href={`/docs/${doc.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="light"
                            color="danger"
                            isIconOnly
                            onPress={() => unlinkDocument(doc.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </Tab>

          {/* Tasks Tab */}
          <Tab 
            key="tasks" 
            title={
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4" />
                <span>Tasks</span>
                {tasks.length > 0 && (
                  <Chip size="sm" variant="flat">{tasks.length}</Chip>
                )}
              </div>
            }
          >
            <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mt-4">
              <CardHeader className="flex justify-between items-center px-6 py-4">
                <h3 className="font-semibold">Linked Tasks</h3>
                <Button 
                  size="sm" 
                  color="primary"
                  onPress={() => { loadAvailableTasks(); onTaskModalOpen(); }}
                  startContent={<Plus className="w-4 h-4" />}
                >
                  Add Task
                </Button>
              </CardHeader>
              <CardBody className="px-6 pb-6 pt-0">
                {tasks.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No tasks linked yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tasks.map(task => (
                      <div 
                        key={task.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <CheckSquare className="w-5 h-5 text-slate-400 flex-shrink-0" />
                          <span className="font-medium truncate">{task.title}</span>
                          <Chip 
                            size="sm" 
                            color={task.status === 'done' ? 'success' : task.status === 'in_progress' ? 'warning' : 'default'}
                            variant="flat"
                          >
                            {task.status}
                          </Chip>
                          <Chip 
                            size="sm" 
                            color={task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'default'}
                            variant="flat"
                          >
                            {task.priority}
                          </Chip>
                        </div>
                        <Button
                          size="sm"
                          variant="light"
                          color="danger"
                          isIconOnly
                          onPress={() => unlinkTask(task.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </Tab>

          {/* Files Tab */}
          <Tab 
            key="files" 
            title={
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                <span>Files</span>
                {files.length > 0 && (
                  <Chip size="sm" variant="flat">{files.length}</Chip>
                )}
              </div>
            }
          >
            <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mt-4">
              <CardHeader className="flex justify-between items-center px-6 py-4">
                <h3 className="font-semibold">Project Files</h3>
                <label>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button 
                    size="sm" 
                    color="primary"
                    as="span"
                    className="cursor-pointer"
                    startContent={<Upload className="w-4 h-4" />}
                  >
                    Upload File
                  </Button>
                </label>
              </CardHeader>
              <CardBody className="px-6 pb-6 pt-0">
                {files.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Paperclip className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No files uploaded yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {files.map(file => (
                      <div 
                        key={file.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Paperclip className="w-5 h-5 text-slate-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{file.name}</p>
                            <p className="text-xs text-slate-400">
                              {formatFileSize(file.file_size)} • {new Date(file.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="light"
                            isIconOnly
                            onPress={() => downloadFile(file.file_path, file.name)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="light"
                            color="danger"
                            isIconOnly
                            onPress={() => deleteFile(file.id, file.file_path)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </Tab>
        </Tabs>
      </main>

      {/* Add Document Modal */}
      <Modal isOpen={isDocModalOpen} onClose={onDocModalClose} size="lg">
        <ModalContent>
          <ModalHeader>Add Document</ModalHeader>
          <ModalBody>
            {/* Create new */}
            <div className="mb-6">
              <h4 className="font-medium mb-2">Create New Document</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="Document title"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  color="primary" 
                  onPress={createAndLinkDocument}
                  isDisabled={!newDocTitle.trim()}
                >
                  Create
                </Button>
              </div>
            </div>
            
            {/* Link existing */}
            <div>
              <h4 className="font-medium mb-2">Or Link Existing Document</h4>
              {availableDocs.length === 0 ? (
                <p className="text-slate-400 text-sm">No unlinked documents available</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {availableDocs.map(doc => (
                    <div 
                      key={doc.id}
                      className="flex items-center justify-between p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                      onClick={() => linkDocument(doc.id)}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span>{doc.title}</span>
                      </div>
                      <Plus className="w-4 h-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDocModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Task Modal */}
      <Modal isOpen={isTaskModalOpen} onClose={onTaskModalClose} size="lg">
        <ModalContent>
          <ModalHeader>Add Task</ModalHeader>
          <ModalBody>
            {/* Create new */}
            <div className="mb-6">
              <h4 className="font-medium mb-2">Create New Task</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="Task title"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  color="primary" 
                  onPress={createAndLinkTask}
                  isDisabled={!newTaskTitle.trim()}
                >
                  Create
                </Button>
              </div>
            </div>
            
            {/* Link existing */}
            <div>
              <h4 className="font-medium mb-2">Or Link Existing Task</h4>
              {availableTasks.length === 0 ? (
                <p className="text-slate-400 text-sm">No unlinked tasks available</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {availableTasks.map(task => (
                    <div 
                      key={task.id}
                      className="flex items-center justify-between p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                      onClick={() => linkTask(task.id)}
                    >
                      <div className="flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-slate-400" />
                        <span>{task.title}</span>
                      </div>
                      <Plus className="w-4 h-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onTaskModalClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
