'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { BellAlertIcon } from '@heroicons/react/24/outline'
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
  Tabs,
  Tab,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  SortDescriptor,
  Spinner,
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import { useBusiness } from '@/lib/business-context'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast, getErrorMessage } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'
import TaskDetailModal from '@/components/TaskDetailModal'

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
  due_date: string | null
  tags: string[]
  ai_flag: boolean
  ai_agent: string | null
  feedback: string | null
  created_at: string
  updated_at?: string
}

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

type ViewType = 'kanban' | 'list' | 'calendar' | 'my-tasks' | 'ai-queue'

const VIEW_STORAGE_KEY = 'mise-tasks-view'

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

const statusOrder: Record<string, number> = {
  'blocked': 1,
  'in_progress': 2,
  'review': 3,
  'todo': 4,
  'backlog': 5,
  'done': 6,
}

// Default reminder windows by priority
const reminderWindowsByPriority: Record<string, string[]> = {
  critical: ['24h before', '6h before', '1h before'],
  high: ['24h before', '6h before', '1h before'],
  medium: ['24h before'],
  low: ['Morning of due date'],
}

function TasksPageContent() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [currentView, setCurrentView] = useState<ViewType>('kanban')
  const [filter, setFilter] = useState<string>('all')
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'created_at',
    direction: 'descending',
  })
  const [currentDate, setCurrentDate] = useState(new Date())
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
  })
  
  const supabase = createClient()
  const { selectedBusinessId } = useBusiness()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Handle opening task from URL query param (e.g., from notification)
  useEffect(() => {
    const openTaskId = searchParams.get('openTask')
    if (openTaskId && !loading) {
      // Clear the query param to prevent re-opening on refresh
      router.replace('/tasks', { scroll: false })
      // Open the task
      handleOpenTaskById(openTaskId)
    }
  }, [searchParams, loading])

  // Load saved view from localStorage
  useEffect(() => {
    const savedView = localStorage.getItem(VIEW_STORAGE_KEY) as ViewType | null
    if (savedView && ['kanban', 'list', 'calendar', 'my-tasks', 'ai-queue'].includes(savedView)) {
      setCurrentView(savedView)
    }
  }, [])

  // Save view to localStorage when changed
  const handleViewChange = (view: ViewType) => {
    setCurrentView(view)
    localStorage.setItem(VIEW_STORAGE_KEY, view)
  }

  useEffect(() => {
    loadUser()
  }, [])

  // Reload tasks when business context changes
  useEffect(() => {
    loadTasks()
  }, [selectedBusinessId])

  async function loadUser() {
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        console.error('Auth error:', authError)
        return
      }
      
      if (authUser) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single()
          
          if (profileError) {
            console.error('Profile fetch error:', profileError)
          }
          
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            name: profile?.name || authUser.email?.split('@')[0],
            avatar_url: profile?.avatar_url,
          })
        } catch (err) {
          console.error('Failed to fetch profile:', err)
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            name: authUser.email?.split('@')[0],
          })
        }
      }
    } catch (error) {
      console.error('Load user error:', error)
      showErrorToast(error, 'Failed to load user data')
    }
  }

  async function loadTasks() {
    setLoading(true)
    setLoadError(null)
    
    try {
      let query = supabase
        .from('tasks')
        .select('*')
      
      // Filter by business context
      if (selectedBusinessId) {
        query = query.eq('business_id', selectedBusinessId)
      } else {
        query = query.is('business_id', null)
      }
      
      const { data, error } = await query.order('created_at', { ascending: false })
      
      if (error) {
        throw error
      }
      
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
    
    try {
      if (editingTask) {
        // Update existing task
        const { error } = await supabase
          .from('tasks')
          .update({
            title: formData.title,
            description: formData.description || null,
            status: formData.status,
            priority: formData.priority,
            ai_flag: formData.ai_flag,
            due_date: formData.due_date || null,
          })
          .eq('id', editingTask.id)
        
        if (error) {
          throw error
        }
        
        showSuccessToast('Task updated successfully')
        loadTasks()
        handleClose()
      } else {
        // Create new task
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
            business_id: selectedBusinessId, // null for Personal, business ID for business context
          })
        
        if (error) {
          throw error
        }
        
        showSuccessToast('Task created successfully')
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

  async function handleDelete(taskId: string) {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
      
      if (error) {
        throw error
      }
      
      showSuccessToast('Task deleted')
      loadTasks()
    } catch (error) {
      console.error('Delete task error:', error)
      showErrorToast(error, 'Failed to delete task')
    }
  }

  async function handleStatusChange(taskId: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId)
      
      if (error) {
        throw error
      }
      
      showSuccessToast('Status updated')
      loadTasks()
    } catch (error) {
      console.error('Status update error:', error)
      showErrorToast(error, 'Failed to update status')
    }
  }

  function handleEdit(task: Task) {
    setEditingTask(task)
    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      ai_flag: task.ai_flag,
      due_date: task.due_date || '',
    })
    onOpen()
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
    })
    onOpen()
  }

  function handleViewDetails(task: Task) {
    setSelectedTask(task)
    onDetailOpen()
  }

  // Open task by ID (used by notification clicks)
  async function handleOpenTaskById(taskId: string) {
    // First check if task is already loaded
    const existingTask = tasks.find(t => t.id === taskId)
    if (existingTask) {
      handleViewDetails(existingTask)
      return
    }

    // Otherwise fetch it from the database
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
      showErrorToast(error, 'Failed to open task')
    }
  }

  // Filter logic based on view
  const getViewFilteredTasks = () => {
    let filtered = tasks

    // Apply view-specific filters
    switch (currentView) {
      case 'my-tasks':
        filtered = tasks.filter(t => t.assignee_id === user?.id)
        break
      case 'ai-queue':
        filtered = tasks.filter(t => t.ai_flag === true)
        break
      default:
        break
    }

    // Apply status filter (for list view and kanban when not "all")
    if (filter !== 'all' && currentView !== 'kanban') {
      filtered = filtered.filter(t => t.status === filter)
    }

    return filtered
  }

  const filteredTasks = getViewFilteredTasks()

  // Sorted tasks for list view
  const sortedTasks = useMemo(() => {
    const sorted = [...filteredTasks]
    
    if (sortDescriptor.column) {
      sorted.sort((a, b) => {
        let aValue: any = a[sortDescriptor.column as keyof Task]
        let bValue: any = b[sortDescriptor.column as keyof Task]
        
        // Handle special sorting for priority and status
        if (sortDescriptor.column === 'priority') {
          aValue = priorityOrder[a.priority] || 99
          bValue = priorityOrder[b.priority] || 99
        } else if (sortDescriptor.column === 'status') {
          aValue = statusOrder[a.status] || 99
          bValue = statusOrder[b.status] || 99
        } else if (sortDescriptor.column === 'due_date') {
          aValue = a.due_date ? new Date(a.due_date).getTime() : Infinity
          bValue = b.due_date ? new Date(b.due_date).getTime() : Infinity
        }
        
        // Handle null/undefined values
        if (aValue == null) aValue = ''
        if (bValue == null) bValue = ''
        
        let cmp = 0
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          cmp = aValue.localeCompare(bValue)
        } else {
          cmp = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
        }
        
        return sortDescriptor.direction === 'descending' ? -cmp : cmp
      })
    }
    
    return sorted
  }, [filteredTasks, sortDescriptor])

  const getStatusColor = (status: string) => {
    return statusOptions.find(s => s.key === status)?.color || 'default'
  }

  const getPriorityColor = (priority: string) => {
    return priorityOptions.find(p => p.key === priority)?.color || 'bg-slate-400'
  }

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()
    
    return { daysInMonth, startingDay }
  }

  const { daysInMonth, startingDay } = getDaysInMonth(currentDate)

  const getTasksForDay = (day: number) => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    
    return filteredTasks.filter(t => t.due_date?.startsWith(dateStr))
  }

  const isToday = (day: number) => {
    const today = new Date()
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    )
  }

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Group tasks by status for Kanban view
  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {}
    statusOptions.forEach(s => {
      grouped[s.key] = filteredTasks.filter(t => t.status === s.key)
    })
    return grouped
  }, [filteredTasks])

  // Render task card (shared between views)
  const renderTaskCard = (task: Task, compact = false) => (
    <Card 
      key={task.id} 
      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      isPressable
      onPress={() => handleViewDetails(task)}
    >
      <CardBody className={compact ? "p-3" : "p-4"}>
        <div className="flex items-start gap-3">
          {/* Priority indicator */}
          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${getPriorityColor(task.priority)}`} />
          
          {/* Task content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className={`font-medium text-slate-900 dark:text-slate-100 ${compact ? 'text-sm' : ''} truncate`}>{task.title}</h3>
              {task.ai_flag && (
                <Chip size="sm" className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300">🤖 AI</Chip>
              )}
              {task.ai_agent && (
                <Chip size="sm" variant="flat" className="capitalize text-xs">
                  {task.ai_agent}
                </Chip>
              )}
              {task.feedback && (
                <Chip size="sm" variant="flat" className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                  💬
                </Chip>
              )}
            </div>
            {!compact && task.description && (
              <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{task.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {!compact && (
                <Select
                  size="sm"
                  selectedKeys={[task.status]}
                  className="w-32"
                  onChange={(e) => {
                    e.stopPropagation()
                    handleStatusChange(task.id, e.target.value)
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {statusOptions.map(s => (
                    <SelectItem key={s.key}>{s.label}</SelectItem>
                  ))}
                </Select>
              )}
              <Chip size="sm" variant="flat" className="capitalize">
                {task.priority}
              </Chip>
              {task.due_date && (
                <Chip size="sm" variant="flat" className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  Due: {new Date(task.due_date).toLocaleDateString()}
                </Chip>
              )}
            </div>
          </div>

          {/* Actions */}
          {!compact && (
            <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <Button 
                size="sm" 
                variant="flat" 
                onPress={() => handleEdit(task)}
                className="min-h-[44px] min-w-[44px]"
              >
                Edit
              </Button>
              <Button 
                size="sm" 
                variant="flat" 
                color="danger"
                onPress={() => handleDelete(task.id)}
                className="min-h-[44px] min-w-[44px]"
              >
                Delete
              </Button>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  )

  // Render Kanban View (Stacked Grid)
  const renderKanbanView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {statusOptions.map(status => (
        <div key={status.key} className="w-full">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <Chip 
                size="sm" 
                color={status.color as any}
                variant="flat"
              >
                {status.label}
              </Chip>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                ({tasksByStatus[status.key]?.length || 0})
              </span>
            </div>
          </div>
          <div className="space-y-2 min-h-[150px] bg-slate-100/80 dark:bg-slate-800/50 rounded-lg p-2 border border-slate-200/50 dark:border-slate-700/50">
            {tasksByStatus[status.key]?.map(task => renderTaskCard(task, true))}
            {tasksByStatus[status.key]?.length === 0 && (
              <div className="text-center text-slate-400 dark:text-slate-500 text-sm py-8">
                No tasks
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  // Render List View
  const renderListView = () => (
    <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <CardBody className="p-0">
        <Table
          aria-label="Tasks table"
          sortDescriptor={sortDescriptor}
          onSortChange={setSortDescriptor}
          classNames={{
            wrapper: "min-h-[400px]",
          }}
        >
          <TableHeader>
            <TableColumn key="title" allowsSorting>Title</TableColumn>
            <TableColumn key="status" allowsSorting width={140}>Status</TableColumn>
            <TableColumn key="priority" allowsSorting width={100}>Priority</TableColumn>
            <TableColumn key="assignee_id" width={120}>Assignee</TableColumn>
            <TableColumn key="due_date" allowsSorting width={120}>Due Date</TableColumn>
            <TableColumn key="actions" width={150}>Actions</TableColumn>
          </TableHeader>
          <TableBody items={sortedTasks} emptyContent="No tasks to display">
            {(task) => (
              <TableRow 
                key={task.id} 
                className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50"
                onClick={() => handleViewDetails(task)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getPriorityColor(task.priority)}`} />
                    <span className="font-medium truncate max-w-[300px]">{task.title}</span>
                    {task.ai_flag && (
                      <Chip size="sm" className="bg-violet-100 text-violet-700 flex-shrink-0">🤖</Chip>
                    )}
                    {task.feedback && (
                      <Chip size="sm" className="bg-amber-100 text-amber-700 flex-shrink-0">💬</Chip>
                    )}
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Select
                    size="sm"
                    selectedKeys={[task.status]}
                    className="w-full"
                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                  >
                    {statusOptions.map(s => (
                      <SelectItem key={s.key}>{s.label}</SelectItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" className="capitalize">
                    {task.priority}
                  </Chip>
                </TableCell>
                <TableCell>
                  <span className="text-slate-500 text-sm">
                    {task.assignee_id ? 'Assigned' : '—'}
                  </span>
                </TableCell>
                <TableCell>
                  {task.due_date ? (
                    <span className="text-sm">
                      {new Date(task.due_date).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="flat" 
                      onPress={() => handleEdit(task)}
                    >
                      Edit
                    </Button>
                    <Button 
                      size="sm" 
                      variant="flat" 
                      color="danger"
                      onPress={() => handleDelete(task.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  )

  // Render Calendar View
  const renderCalendarView = () => (
    <Card className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
      <CardBody className="p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="flat" onPress={prevMonth}>←</Button>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <Button variant="flat" onPress={nextMonth}>→</Button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map(day => (
            <div key={day} className="text-center text-sm font-medium text-slate-500 dark:text-slate-400 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before the 1st */}
          {Array.from({ length: startingDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[100px] bg-slate-100/50 dark:bg-slate-700/30 rounded-lg" />
          ))}
          
          {/* Days of the month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dayTasks = getTasksForDay(day)
            const hasItems = dayTasks.length > 0
            
            return (
              <div
                key={day}
                className={`min-h-[100px] p-2 rounded-lg border transition-colors ${
                  isToday(day) 
                    ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-200 dark:border-violet-700' 
                    : hasItems 
                      ? 'bg-white dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 hover:border-violet-200 dark:hover:border-violet-600' 
                      : 'bg-slate-100/50 dark:bg-slate-700/30 border-transparent'
                }`}
              >
                <div className={`text-sm font-medium mb-1 ${
                  isToday(day) ? 'text-violet-600 dark:text-violet-400' : 'text-slate-700 dark:text-slate-200'
                }`}>
                  {day}
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map(task => (
                    <div 
                      key={task.id}
                      className={`text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 ${
                        task.ai_flag 
                          ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' 
                          : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                      }`}
                      title={task.title}
                      onClick={() => handleViewDetails(task)}
                    >
                      {task.ai_flag ? '🤖 ' : '📋 '}{task.title}{task.feedback ? ' 💬' : ''}
                    </div>
                  ))}
                  
                  {/* Show more indicator */}
                  {dayTasks.length > 3 && (
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
          <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mr-2">Legend:</div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700" />
            <span>Regular Tasks</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <div className="w-3 h-3 rounded bg-violet-100 dark:bg-violet-900/50 border border-violet-200 dark:border-violet-700" />
            <span>AI Tasks</span>
          </div>
        </div>
      </CardBody>
    </Card>
  )

  // Render My Tasks View (uses list format with filter)
  const renderMyTasksView = () => {
    if (!user) {
      return (
        <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <CardBody className="text-center py-12">
            <p className="text-slate-500 dark:text-slate-400 mb-4">Please sign in to view your tasks</p>
          </CardBody>
        </Card>
      )
    }

    return (
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardBody className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400 mb-4">No tasks assigned to you</p>
              <Button color="primary" onPress={handleNew}>Create a task</Button>
            </CardBody>
          </Card>
        ) : (
          filteredTasks.map(task => renderTaskCard(task))
        )}
      </div>
    )
  }

  // Render AI Queue View
  const renderAIQueueView = () => (
    <div className="space-y-3">
      {filteredTasks.length === 0 ? (
        <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <CardBody className="text-center py-12">
            <div className="text-4xl mb-4">🤖</div>
            <p className="text-slate-500 dark:text-slate-400 mb-4">No tasks in the AI queue</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
              Tasks with the AI flag enabled will appear here
            </p>
            <Button color="primary" onPress={handleNew}>Create an AI task</Button>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4 px-1">
            <span className="text-lg">🤖</span>
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} ready for AI
            </span>
          </div>
          {filteredTasks.map(task => renderTaskCard(task))}
        </>
      )}
    </div>
  )

  // Render current view
  const renderCurrentView = () => {
    switch (currentView) {
      case 'kanban':
        return renderKanbanView()
      case 'list':
        return renderListView()
      case 'calendar':
        return renderCalendarView()
      case 'my-tasks':
        return renderMyTasksView()
      case 'ai-queue':
        return renderAIQueueView()
      default:
        return renderKanbanView()
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar user={user} onOpenTask={handleOpenTaskById} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* View Tabs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
          {/* Scrollable tabs container for mobile */}
          <div className="w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
            <Tabs 
              selectedKey={currentView} 
              onSelectionChange={(key) => handleViewChange(key as ViewType)}
              color="primary"
              variant="solid"
              size="md"
              classNames={{
                tabList: "flex-nowrap",
                tab: "whitespace-nowrap",
              }}
            >
              <Tab key="kanban" title={
                <div className="flex items-center gap-2">
                  <span>📊</span>
                  <span>Kanban</span>
                </div>
              } />
              <Tab key="list" title={
                <div className="flex items-center gap-2">
                  <span>📋</span>
                  <span>List</span>
                </div>
              } />
              <Tab key="calendar" title={
                <div className="flex items-center gap-2">
                  <span>📅</span>
                  <span>Calendar</span>
                </div>
              } />
              <Tab key="my-tasks" title={
                <div className="flex items-center gap-2">
                  <span>👤</span>
                  <span>My Tasks</span>
                  {user && (
                    <Chip size="sm" variant="flat">
                      {tasks.filter(t => t.assignee_id === user.id).length}
                    </Chip>
                  )}
                </div>
              } />
              <Tab key="ai-queue" title={
                <div className="flex items-center gap-2">
                  <span>🤖</span>
                  <span>AI Queue</span>
                  <Chip size="sm" variant="flat" className="bg-violet-100 text-violet-700">
                    {tasks.filter(t => t.ai_flag).length}
                  </Chip>
                </div>
              } />
            </Tabs>
          </div>
          
          <Button 
            color="primary" 
            onPress={handleNew}
            className="font-semibold flex-shrink-0"
          >
            + New Task
          </Button>
        </div>

        {/* Status filter (for list view only) */}
        {currentView === 'list' && (
          <div className="flex gap-2 flex-wrap mb-6">
            <Button 
              size="sm" 
              variant={filter === 'all' ? 'solid' : 'flat'}
              color="primary"
              onPress={() => setFilter('all')}
            >
              All ({tasks.length})
            </Button>
            {statusOptions.map(status => (
              <Button
                key={status.key}
                size="sm"
                variant={filter === status.key ? 'solid' : 'flat'}
                onPress={() => setFilter(status.key)}
              >
                {status.label} ({tasks.filter(t => t.status === status.key).length})
              </Button>
            ))}
          </div>
        )}

        {/* Error State */}
        {loadError && !loading && (
          <div className="mb-6">
            <ErrorFallback error={loadError} resetError={loadTasks} />
          </div>
        )}

        {/* Main Content */}
        {loading ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading tasks...</div>
        ) : !loadError && (
          renderCurrentView()
        )}
      </main>

      {/* Create/Edit Modal */}
      <Modal isOpen={isOpen} onClose={handleClose} size="lg">
        <ModalContent>
          <ModalHeader>
            {editingTask ? 'Edit Task' : 'New Task'}
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input
                label="Title"
                placeholder="What needs to be done?"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                isRequired
              />
              <Textarea
                label="Description"
                placeholder="Add details..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              <Input
                label="Due Date"
                type="date"
                placeholder="Set a due date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-4">
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
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.ai_flag}
                  onChange={(e) => setFormData({ ...formData, ai_flag: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">🤖 Allow AI to work on this task</span>
              </label>
              
              {/* Reminder Preview */}
              {formData.due_date && (
                <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <BellAlertIcon className="w-5 h-5 text-violet-500" />
                    <div>
                      <p className="text-sm font-medium text-violet-700 mb-1">
                        Reminders for this task:
                      </p>
                      <ul className="text-sm text-violet-600 list-disc list-inside">
                        {reminderWindowsByPriority[formData.priority]?.map((window, i) => (
                          <li key={i}>{window}</li>
                        ))}
                      </ul>
                      <p className="text-xs text-violet-500 mt-2">
                        Customize in <a href="/settings" className="underline hover:text-violet-700">Settings</a>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={handleClose}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onPress={handleSubmit}
              isDisabled={!formData.title.trim()}
              isLoading={submitting}
            >
              {editingTask ? 'Save Changes' : 'Create Task'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

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
