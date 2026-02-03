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
  Checkbox,
} from '@heroui/react'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { Bot, User, ClipboardList } from 'lucide-react'

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
    ai_flag: false,
    due_date: '',
    assignee_id: '',
    ai_agent: '',
    project_id: '',
    space_id: '',
  })
  
  const [users, setUsers] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
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

      setUsers(usersRes.data || [])
      setAgents(agentsRes.data || [])
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
      const { error } = await supabase
        .from('tasks')
        .insert({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          status: formData.status,
          priority: formData.priority,
          ai_flag: formData.ai_flag,
          due_date: formData.due_date || null,
          created_by: userId,
          space_id: formData.space_id || null,
          assignee_id: formData.assignee_id || null,
          ai_agent: formData.ai_agent || null,
          project_id: formData.project_id || null,
        })

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
      ai_flag: false,
      due_date: '',
      assignee_id: '',
      ai_agent: '',
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

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Assign to Human"
                placeholder="Select user"
                selectedKeys={formData.assignee_id ? [formData.assignee_id] : []}
                onChange={(e) => setFormData(f => ({ ...f, assignee_id: e.target.value }))}
                startContent={<User className="w-4 h-4" />}
              >
                {users.map(u => (
                  <SelectItem key={u.id}>{u.name || u.email}</SelectItem>
                ))}
              </Select>
              <Select
                label="Assign to Agent"
                placeholder="Select agent"
                selectedKeys={formData.ai_agent ? [formData.ai_agent] : []}
                onChange={(e) => setFormData(f => ({ ...f, ai_agent: e.target.value }))}
                startContent={<Bot className="w-4 h-4" />}
              >
                {agents.map(a => (
                  <SelectItem key={a.slug}>{a.name}</SelectItem>
                ))}
              </Select>
            </div>

            <Checkbox
              isSelected={formData.ai_flag}
              onValueChange={(v) => setFormData(f => ({ ...f, ai_flag: v }))}
            >
              <span className="text-sm">Allow AI to work on this task</span>
            </Checkbox>
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
