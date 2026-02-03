'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { 
  Target, 
  Settings, 
  Plus, 
  Bot, 
  Check,
  ChevronDown,
  ChevronUp,
  Calendar,
  LayoutGrid,
  List,
  User,
} from 'lucide-react'
import { 
  Button, 
  Card, 
  CardBody,
  Chip,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
  Textarea,
  useDisclosure,
  Spinner,
  Checkbox,
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast, getErrorMessage } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'
import TaskDetailModal from '@/components/TaskDetailModal'
import AddTaskModal from '@/components/AddTaskModal'

// Main export with Suspense wrapper
export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    }>
      <TasksPageContent />
    </Suspense>
  )
}

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
  ai_flag: boolean
  ai_agent: string | null
  feedback: string | null
  created_at: string
  updated_at?: string
}

interface AIAgent {
  id: string
  name: string
  slug: string
  role: string
  is_active: boolean
}

interface Project {
  id: string
  name: string
  business_id: string | null
}

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
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

const priorityOrder: Record<string, number> = {
  'critical': 1,
  'high': 2,
  'medium': 3,
  'low': 4,
}

const MAX_FOCUS_TASKS = 7

function TasksPageContent() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<UserData[]>([])
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [spaces, setSpaces] = useState<any[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [localSpaceId, setLocalSpaceId] = useState<string>('all')
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure()
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    ai_flag: false,
    due_date: '',
    assignee_id: '',
    ai_agent: '',
    project_id: '',
    space_id: '',
  })
  
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Handle opening task from URL query param
  useEffect(() => {
    const openTaskId = searchParams.get('openTask')
    if (openTaskId && !loading) {
      router.replace('/tasks', { scroll: false })
      handleOpenTaskById(openTaskId)
    }
  }, [searchParams, loading])

  useEffect(() => {
    loadUser()
  }, [])

  useEffect(() => {
    loadTasks()
    loadDropdownData()
  }, [localSpaceId])

  async function loadDropdownData() {
    try {
      const [usersRes, agentsRes, spacesRes] = await Promise.all([
        supabase.from('users').select('id, name, email, avatar_url'),
        supabase.from('ai_agents').select('id, name, slug, role').eq('is_active', true),
        supabase.from('spaces').select('id, name, color, icon').is('archived_at', null).order('name')
      ])
      
      let projectQuery = supabase
        .from('projects')
        .select('id, name, space_id')
      
      if (localSpaceId && localSpaceId !== 'all') {
        projectQuery = projectQuery.eq('space_id', localSpaceId)
      }
      
      const { data: projectsData } = await projectQuery

      setUsers(usersRes.data || [])
      setAgents(agentsRes.data || [])
      setSpaces(spacesRes.data || [])
      setProjects(projectsData || [])
    } catch (error) {
      console.error('Error loading dropdown data:', error)
    }
  }

  async function loadUser() {
    // ... (rest of the code)
  }

  async function loadTasks() {
    setLoading(true)
    setLoadError(null)
    
    try {
      let query = supabase
        .from('tasks')
        .select('*')
      
      if (localSpaceId && localSpaceId !== 'all') {
        query = query.eq('space_id', localSpaceId)
      }
      
      const { data, error } = await query.order('created_at', { ascending: false })
      
      if (error) throw error
      
      setTasks(data || [])
    } catch (error) {
      console.error('Load tasks error:', error)
      setLoadError(getErrorMessage(error))
      showErrorToast(error, 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!user) {
      showErrorToast(null, 'Please sign in to manage tasks')
      return
    }
    
    if (!formData.title.trim()) {
      showErrorToast(null, 'Please enter a task title')
      return
    }
    
    setSubmitting(true)
    
    const targetSpaceId = formData.space_id || (localSpaceId !== 'all' ? localSpaceId : null)

    try {
      if (editingTask) {
        const { error } = await supabase
          .from('tasks')
          .update({
            title: formData.title,
            description: formData.description || null,
            status: formData.status,
            priority: formData.priority,
            ai_flag: formData.ai_flag,
            due_date: formData.due_date || null,
            assignee_id: formData.assignee_id || null,
            ai_agent: formData.ai_agent || null,
            project_id: formData.project_id || null,
            space_id: targetSpaceId,
          })
          .eq('id', editingTask.id)
        
        if (error) throw error
        
        showSuccessToast('Task updated')
        loadTasks()
        handleClose()
      } else {
        const { error } = await supabase
          .from('tasks')
          .insert({
            title: formData.title,
            description: formData.description || null,
            status: formData.status,
            priority: formData.priority,
            ai_flag: formData.ai_flag,
            created_by: user.id,
            due_date: formData.due_date || null,
            space_id: targetSpaceId,
            assignee_id: formData.assignee_id || null,
            ai_agent: formData.ai_agent || null,
            project_id: formData.project_id || null,
          })
        
        if (error) throw error
        
        showSuccessToast('Task created')
        loadTasks()
        handleClose()
      }
    } catch (error) {
      console.error('Submit task error:', error)
      showErrorToast(error, editingTask ? 'Failed to update task' : 'Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMarkDone(taskId: string, currentStatus: string) {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done'
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId)
      
      if (error) throw error
      
      showSuccessToast(newStatus === 'done' ? 'Task completed! 🎉' : 'Task reopened')
      loadTasks()
    } catch (error) {
      console.error('Status update error:', error)
      showErrorToast(error, 'Failed to update task')
    }
  }

  function handleClose() {
    setEditingTask(null)
    setFormData({
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      ai_flag: false,
      due_date: '',
      assignee_id: '',
      ai_agent: '',
      project_id: '',
      space_id: (localSpaceId !== 'all' ? localSpaceId : '') || '',
    })
    onClose()
  }

  function handleNew() {
    setEditingTask(null)
    setFormData({
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      ai_flag: false,
      due_date: '',
      assignee_id: '',
      ai_agent: '',
      project_id: '',
      space_id: (localSpaceId !== 'all' ? localSpaceId : '') || '',
    })
    onOpen()
  }

  function handleViewDetails(task: Task) {
    setSelectedTask(task)
    onDetailOpen()
  }

  async function handleOpenTaskById(taskId: string) {
    if (!taskId) return

    const existingTask = tasks.find(t => t.id === taskId)
    if (existingTask) {
      handleViewDetails(existingTask)
      return
    }

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single()

      if (error) throw error
      if (data) {
        handleViewDetails(data as Task)
      }
    } catch (error) {
      console.error('Failed to load task:', error)
      // Only show toast if it's not a background load
      if (searchParams.get('openTask') === taskId) {
        showErrorToast(error, 'Failed to open task')
      }
    }
  }

  const getPriorityColor = (priority: string) => {
    return priorityOptions.find(p => p.key === priority)?.color || 'bg-slate-400'
  }

  // Focus tasks: YOUR tasks only (no AI agent tasks), todo/in_progress, sorted by priority
  const focusTasks = useMemo(() => {
    return tasks
      .filter(t => (t.status === 'todo' || t.status === 'in_progress') && !t.ai_agent)
      .sort((a, b) => (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99))
      .slice(0, MAX_FOCUS_TASKS)
  }, [tasks])

  // All non-done tasks for expanded view (still excludes AI tasks by default)
  const allActiveTasks = useMemo(() => {
    return tasks
      .filter(t => t.status !== 'done' && !t.ai_agent)
      .sort((a, b) => (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99))
  }, [tasks])

  // Recently completed (last 3)
  const recentlyCompleted = useMemo(() => {
    return tasks
      .filter(t => t.status === 'done')
      .slice(0, 3)
  }, [tasks])

  const displayTasks = showAllTasks ? allActiveTasks : focusTasks
  const hiddenCount = allActiveTasks.length - focusTasks.length

  // Group tasks by project
  const tasksByProject = useMemo(() => {
    const grouped: Record<string, Task[]> = {}
    displayTasks.forEach(task => {
      const projectId = task.project_id || 'none'
      if (!grouped[projectId]) grouped[projectId] = []
      grouped[projectId].push(task)
    })
    return grouped
  }, [displayTasks])

  // Render a clean task card
  const renderTaskCard = (task: Task) => (
    <div 
      key={task.id} 
      className={`group flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all cursor-pointer ${task.status === 'done' ? 'opacity-60' : ''}`}
      onClick={() => handleViewDetails(task)}
    >
      {/* Checkbox */}
      <div 
        className="flex-shrink-0 mt-0.5" 
        onClick={(e) => {
          e.stopPropagation()
          handleMarkDone(task.id, task.status)
        }}
      >
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
          task.status === 'done' 
            ? 'bg-green-500 border-green-500 text-white' 
            : 'border-slate-300 dark:border-slate-600 hover:border-green-400 dark:hover:border-green-500'
        }`}>
          {task.status === 'done' && <Check className="w-3 h-3" />}
        </div>
      </div>
      
      {/* Task content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority dot */}
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityColor(task.priority)}`} />
          
          <span className={`font-medium text-slate-900 dark:text-slate-100 ${task.status === 'done' ? 'line-through text-slate-500 dark:text-slate-400' : ''}`}>
            {task.title}
          </span>
          
          {task.ai_flag && (
            <Bot className="w-4 h-4 text-violet-500 flex-shrink-0" />
          )}
        </div>
        
        {/* Subtle metadata */}
        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {task.due_date && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.project_id && (
            <span className="truncate max-w-[120px]">
              {projects.find(p => p.id === task.project_id)?.name}
            </span>
          )}
          {task.status === 'in_progress' && (
            <Chip size="sm" variant="flat" color="warning" className="h-5 text-xs">
              In progress
            </Chip>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar user={user} onOpenTask={handleOpenTaskById} />

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="w-6 h-6 text-violet-600 dark:text-violet-400" />
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                {showAllTasks ? 'All Tasks' : 'My Focus'}
              </h1>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                isIconOnly
                variant="light"
                onPress={() => setShowAllTasks(!showAllTasks)}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <Button
              size="sm"
              variant={localSpaceId === 'all' ? 'solid' : 'flat'}
              color={localSpaceId === 'all' ? 'primary' : 'default'}
              onPress={() => setLocalSpaceId('all')}
              className="rounded-full"
            >
              All Spaces
            </Button>
            {spaces.map(space => (
              <Button
                key={space.id}
                size="sm"
                variant={localSpaceId === space.id ? 'solid' : 'flat'}
                color={localSpaceId === space.id ? 'primary' : 'default'}
                onPress={() => setLocalSpaceId(space.id)}
                className="rounded-full whitespace-nowrap"
                startContent={
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: space.color || '#3b82f6' }} 
                  />
                }
              >
                {space.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Error State */}
        {loadError && !loading && (
          <div className="mb-6">
            <ErrorFallback error={loadError} resetError={loadTasks} />
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : !loadError && (
          <>
            {/* Task list grouped by project */}
            <div className="space-y-6 mb-6">
              {displayTasks.length === 0 ? (
                <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <CardBody className="text-center py-12">
                    <Target className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    <p className="text-slate-500 dark:text-slate-400 mb-4">
                      {showAllTasks ? 'No active tasks' : 'All clear! Nothing to focus on.'}
                    </p>
                    <Button color="primary" variant="flat" onPress={handleNew}>
                      <Plus className="w-4 h-4" />
                      Add a task
                    </Button>
                  </CardBody>
                </Card>
              ) : (
                Object.entries(tasksByProject).map(([projectId, projectTasks]) => {
                  const project = projects.find(p => p.id === projectId)
                  return (
                    <div key={projectId} className="space-y-2">
                      <div className="flex items-center gap-2 px-1 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          {project ? project.name : 'No Project'}
                        </span>
                        <div className="flex-1 h-[1px] bg-slate-100 dark:bg-slate-800" />
                        <span className="text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded-full border border-slate-100 dark:border-slate-700">
                          {projectTasks.length}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {projectTasks.map(task => renderTaskCard(task))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Show more / less toggle */}
            {!showAllTasks && hiddenCount > 0 && (
              <button
                onClick={() => setShowAllTasks(true)}
                className="w-full py-3 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center gap-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
                Show {hiddenCount} more task{hiddenCount !== 1 ? 's' : ''}
              </button>
            )}

            {showAllTasks && (
              <button
                onClick={() => setShowAllTasks(false)}
                className="w-full py-3 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center gap-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
              >
                <ChevronUp className="w-4 h-4" />
                Show less
              </button>
            )}

            {/* Add task button */}
            <div className="mt-6">
              <Button
                color="primary"
                variant="flat"
                onPress={handleNew}
                className="w-full justify-center"
                size="lg"
              >
                <Plus className="w-4 h-4" />
                Add to my focus
              </Button>
            </div>

            {/* Recently completed (subtle) */}
            {recentlyCompleted.length > 0 && !showAllTasks && (
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                  Recently completed
                </h3>
                <div className="space-y-1.5">
                  {recentlyCompleted.map(task => (
                    <div 
                      key={task.id}
                      className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300"
                      onClick={() => handleViewDetails(task)}
                    >
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="line-through">{task.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Create/Edit Modal */}
      <AddTaskModal
        isOpen={isOpen}
        onClose={handleClose}
        onSuccess={loadTasks}
        initialSpaceId={localSpaceId !== 'all' ? localSpaceId : undefined}
        userId={user?.id}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isDetailOpen}
        onClose={onDetailClose}
        onTaskUpdated={loadTasks}
        userId={user?.id}
      />
    </div>
  )
}
