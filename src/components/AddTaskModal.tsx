'use client'

import { useState, useEffect } from 'react'
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
} from '@heroui/react'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { User, Bot } from 'lucide-react'

interface AddTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  initialSpaceId?: string
  userId?: string | null
}

const statusOptions = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'backlog', label: 'Backlog' },
]

const priorityOptions = [
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
]

interface UserItem {
  id: string
  name: string
  email: string
  type: 'human'
}

interface AgentItem {
  id: string
  name: string
  slug: string
  type: 'agent'
}

type AssigneeItem = UserItem | AgentItem

export default function AddTaskModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  initialSpaceId,
  userId 
}: AddTaskModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    due_date: '',
    assignee_id: '', // Unified assignee field
    project_id: '',
    space_id: '',
  })
  
  const [assignees, setAssignees] = useState<AssigneeItem[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [spaces, setSpaces] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        space_id: initialSpaceId || '',
      }))
      loadDropdownData()
    }
  }, [isOpen, initialSpaceId])

  async function loadDropdownData() {
    setLoading(true)
    try {
      const [usersRes, agentsRes, spacesRes] = await Promise.all([
        supabase.from('users').select('id, name, email'),
        supabase.from('ai_agents').select('id, name, slug, role').eq('is_active', true),
        supabase.from('spaces').select('id, name').is('archived_at', null)
      ])
      
      let projectQuery = supabase.from('projects').select('id, name, space_id')
      if (formData.space_id) {
        projectQuery = projectQuery.eq('space_id', formData.space_id)
      }
      const { data: projectsData } = await projectQuery

      // Combine users and agents into a single list
      const userItems: UserItem[] = (usersRes.data || []).map(user => ({
        id: user.id,
        name: user.name || user.email,
        email: user.email,
        type: 'human' as const
      }))

      const agentItems: AgentItem[] = (agentsRes.data || []).map(agent => ({
        id: agent.slug, // Use slug as ID for agents
        name: agent.name,
        slug: agent.slug,
        type: 'agent' as const
      }))

      setAssignees([...userItems, ...agentItems])
      setSpaces(spacesRes.data || [])
      setProjects(projectsData || [])
    } catch (error) {
      console.error('Error loading dropdown data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    if (!formData.title.trim() || !userId) return
    
    setSubmitting(true)
    try {
      // Determine if assignee is a human or agent
      const assignee = assignees.find(a => a.id === formData.assignee_id)
      const isAgent = assignee?.type === 'agent'
      
      const taskData: any = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        status: formData.status,
        priority: formData.priority,
        due_date: formData.due_date || null,
        created_by: userId,
        space_id: formData.space_id || null,
        project_id: formData.project_id || null,
      }

      // Set the appropriate assignment field based on type
      if (isAgent) {
        taskData.ai_agent = formData.assignee_id
        taskData.assignee_id = null
      } else {
        taskData.assignee_id = formData.assignee_id || null
        taskData.ai_agent = null
      }

      const { error } = await supabase
        .from('tasks')
        .insert(taskData)

      if (error) throw error
      
      showSuccessToast('Task created successfully')
      onSuccess()
      handleClose()
    } catch (error) {
      console.error('Create task error:', error)
      showErrorToast(error, 'Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setFormData({
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      due_date: '',
      assignee_id: '',
      project_id: '',
      space_id: '',
    })
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <ModalContent>
        <ModalHeader>New Task</ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <Input
              label="Title"
              placeholder="What needs to be done?"
              value={formData.title}
              onValueChange={(v) => setFormData(f => ({ ...f, title: v }))}
              isRequired
              autoFocus
            />
            <Textarea
              label="Description"
              placeholder="Add details..."
              value={formData.description}
              onValueChange={(v) => setFormData(f => ({ ...f, description: v }))}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Priority"
                selectedKeys={[formData.priority]}
                onChange={(e) => setFormData(f => ({ ...f, priority: e.target.value }))}
              >
                {priorityOptions.map(p => (
                  <SelectItem key={p.key}>{p.label}</SelectItem>
                ))}
              </Select>
              <Input
                label="Due Date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(f => ({ ...f, due_date: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Space"
                placeholder="Select space"
                selectedKeys={formData.space_id ? [formData.space_id] : []}
                onChange={(e) => setFormData(f => ({ ...f, space_id: e.target.value }))}
                isRequired
              >
                {spaces.map(s => (
                  <SelectItem key={s.id}>{s.name}</SelectItem>
                ))}
              </Select>
              <Select
                label="Project"
                placeholder="Optional project"
                selectedKeys={formData.project_id ? [formData.project_id] : []}
                onChange={(e) => setFormData(f => ({ ...f, project_id: e.target.value }))}
              >
                {projects.map(p => (
                  <SelectItem key={p.id}>{p.name}</SelectItem>
                ))}
              </Select>
            </div>

            {/* Unified Assign to dropdown */}
            <Select
              label="Assign to"
              placeholder="Select assignee (human or AI agent)"
              selectedKeys={formData.assignee_id ? [formData.assignee_id] : []}
              onChange={(e) => setFormData(f => ({ ...f, assignee_id: e.target.value }))}
              startContent={<User className="w-4 h-4" />}
            >
              <SelectItem key="" className="text-slate-400">
                Unassigned
              </SelectItem>
              
              {/* Humans section */}
              {assignees.filter(a => a.type === 'human').length > 0 && (
                <SelectItem 
                  key="humans-header" 
                  isReadOnly 
                  className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800"
                >
                  Humans
                </SelectItem>
              )}
              {assignees
                .filter(a => a.type === 'human')
                .map(user => (
                  <SelectItem 
                    key={user.id} 
                    startContent={<User className="w-4 h-4 text-slate-400" />}
                  >
                    {user.name}
                  </SelectItem>
                ))}
              
              {/* Agents section */}
              {assignees.filter(a => a.type === 'agent').length > 0 && (
                <SelectItem 
                  key="agents-header" 
                  isReadOnly 
                  className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-800"
                >
                  AI Agents
                </SelectItem>
              )}
              {assignees
                .filter(a => a.type === 'agent')
                .map(agent => (
                  <SelectItem 
                    key={agent.id} 
                    startContent={<Bot className="w-4 h-4 text-violet-400" />}
                  >
                    {agent.name}
                  </SelectItem>
                ))}
            </Select>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={handleClose}>Cancel</Button>
          <Button 
            color="primary" 
            onPress={handleSubmit}
            isLoading={submitting}
            isDisabled={!formData.title.trim()}
          >
            Create Task
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
