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
import UserMenu from '@/components/UserMenu'
import toast from 'react-hot-toast'

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

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
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

  async function loadTasks() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (data) setTasks(data)
    setLoading(false)
  }

  async function handleSubmit() {
    if (!user) return
    
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
      
      if (!error) {
        toast.success('Task updated')
        loadTasks()
        handleClose()
      } else {
        toast.error('Failed to update task')
      }
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
      
      if (!error) {
        toast.success('Task created')
        loadTasks()
        handleClose()
      } else {
        toast.error('Failed to create task')
      }
    }
  }

  async function handleDelete(taskId: string) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
    
    if (!error) {
      toast.success('Task deleted')
      loadTasks()
    } else {
      toast.error('Failed to delete task')
    }
  }

  async function handleStatusChange(taskId: string, newStatus: string) {
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId)
    
    if (!error) {
      toast.success('Status updated')
      loadTasks()
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
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <span className="font-semibold text-slate-800 text-lg">Mise</span>
              </a>
            </div>
            <h1 className="text-xl font-semibold text-slate-800">Tasks</h1>
            <div className="flex items-center gap-2">
              {user && <UserMenu user={user} />}
            </div>
          </div>
        </div>
      </header>

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

        {/* Task List */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <Card className="bg-white">
            <CardBody className="text-center py-12">
              <p className="text-slate-500 mb-4">No tasks yet</p>
              <Button color="primary" onPress={handleNew}>Create your first task</Button>
            </CardBody>
          </Card>
        ) : (
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
            >
              {editingTask ? 'Save Changes' : 'Create Task'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
