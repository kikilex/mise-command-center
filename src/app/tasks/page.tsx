'use client'

import { useState, useEffect } from 'react'
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
  Avatar
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast, getErrorMessage } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'

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
  created_at: string
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

// Default reminder windows by priority
const reminderWindowsByPriority: Record<string, string[]> = {
  critical: ['24h before', '6h before', '1h before'],
  high: ['24h before', '6h before', '1h before'],
  medium: ['24h before'],
  low: ['Morning of due date'],
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState<string>('all')
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    ai_flag: false,
    due_date: '',
  })
  
  const supabase = createClient()

  useEffect(() => {
    loadUser()
    loadTasks()
  }, [])

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
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
      
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

  const filteredTasks = filter === 'all' 
    ? tasks 
    : tasks.filter(t => t.status === filter)

  const getStatusColor = (status: string) => {
    return statusOptions.find(s => s.key === status)?.color || 'default'
  }

  const getPriorityColor = (priority: string) => {
    return priorityOptions.find(p => p.key === priority)?.color || 'bg-slate-400'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between mb-6">
          <div className="flex gap-2 flex-wrap">
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
          <Button 
            color="primary" 
            onPress={handleNew}
            className="font-semibold"
          >
            + New Task
          </Button>
        </div>

        {/* Error State */}
        {loadError && !loading && (
          <div className="mb-6">
            <ErrorFallback error={loadError} resetError={loadTasks} />
          </div>
        )}

        {/* Task List */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading tasks...</div>
        ) : !loadError && filteredTasks.length === 0 ? (
          <Card className="bg-white">
            <CardBody className="text-center py-12">
              <p className="text-slate-500 mb-4">No tasks yet</p>
              <Button color="primary" onPress={handleNew}>Create your first task</Button>
            </CardBody>
          </Card>
        ) : !loadError && (
          <div className="space-y-3">
            {filteredTasks.map(task => (
              <Card key={task.id} className="bg-white hover:shadow-md transition-shadow">
                <CardBody className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Priority indicator */}
                    <div className={`w-2 h-2 rounded-full mt-2 ${getPriorityColor(task.priority)}`} />
                    
                    {/* Task content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-slate-800 truncate">{task.title}</h3>
                        {task.ai_flag && (
                          <Chip size="sm" className="bg-violet-100 text-violet-700">🤖 AI</Chip>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-sm text-slate-500 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Select
                          size="sm"
                          selectedKeys={[task.status]}
                          className="w-32"
                          onChange={(e) => handleStatusChange(task.id, e.target.value)}
                        >
                          {statusOptions.map(s => (
                            <SelectItem key={s.key}>{s.label}</SelectItem>
                          ))}
                        </Select>
                        <Chip size="sm" variant="flat" className="capitalize">
                          {task.priority}
                        </Chip>
                        {task.due_date && (
                          <Chip size="sm" variant="flat" className="bg-blue-100 text-blue-700">
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </Chip>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
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
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
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
                    <span className="text-violet-500">🔔</span>
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
    </div>
  )
}
