'use client'

import { useState, useEffect } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Select,
  SelectItem,
  Avatar,
} from '@heroui/react'
import { ClipboardList, Play } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'

interface Playbook {
  id: string
  title: string
  description: string | null
  steps?: any[]
}

interface Project {
  id: string
  name: string
}

interface User {
  id: string
  name: string
  display_name: string
  avatar_url: string
}

interface RunPlaybookModalProps {
  playbook: Playbook | null
  isOpen: boolean
  onClose: () => void
  onSuccess: (runId: string) => void
  spaceId: string
  currentUserId?: string
}

export default function RunPlaybookModal({
  playbook,
  isOpen,
  onClose,
  onSuccess,
  spaceId,
  currentUserId,
}: RunPlaybookModalProps) {
  const supabase = createClient()

  const [projects, setProjects] = useState<Project[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (isOpen && spaceId) {
      loadOptions()
    }
  }, [isOpen, spaceId])

  async function loadOptions() {
    setLoading(true)
    try {
      // Load projects in this space
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name')
        .eq('space_id', spaceId)
        .eq('status', 'active')
        .order('name')

      setProjects(projectsData || [])

      // Load space members
      const { data: membersData } = await supabase
        .from('space_members')
        .select('users:user_id (id, name, display_name, avatar_url)')
        .eq('space_id', spaceId)

      const membersList = (membersData || [])
        .map((m: any) => m.users)
        .filter(Boolean)
      setMembers(membersList)

      // Default to current user
      if (currentUserId) {
        setAssignedTo(currentUserId)
      }
    } catch (error) {
      console.error('Load options error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleStart() {
    if (!playbook || !selectedProject || !assignedTo) {
      showErrorToast(null, 'Please select a project and assignee')
      return
    }

    setStarting(true)
    try {
      // Create the checklist run
      const { data: run, error: runError } = await supabase
        .from('checklist_runs')
        .insert({
          playbook_id: playbook.id,
          project_id: selectedProject,
          assigned_to: assignedTo,
          assigned_by: currentUserId,
          status: 'active',
        })
        .select()
        .single()

      if (runError) throw runError

      // Initialize step progress for all steps
      if (playbook.steps && playbook.steps.length > 0) {
        const progressRows = playbook.steps.map(step => ({
          run_id: run.id,
          step_id: step.id,
          completed: false,
        }))

        const { error: progressError } = await supabase
          .from('checklist_step_progress')
          .insert(progressRows)

        if (progressError) throw progressError
      }

      // Get assignee name for the update
      const assignee = members.find(m => m.id === assignedTo)
      const assigneeName = assignee?.display_name || assignee?.name || 'Someone'

      // Post update to project feed
      const { error: updateError } = await supabase
        .from('project_updates')
        .insert({
          project_id: selectedProject,
          author_id: currentUserId,
          content: `Started the "${playbook.title}" playbook`,
          update_type: 'checklist_started',
          metadata: {
            checklist_run_id: run.id,
            playbook_id: playbook.id,
            playbook_name: playbook.title,
            assigned_to: assignedTo,
            assigned_to_name: assigneeName,
            total_steps: playbook.steps?.length || 0,
          },
        })

      if (updateError) console.error('Failed to post update:', updateError)

      showSuccessToast('Playbook started!')
      onSuccess(run.id)
      onClose()
    } catch (error) {
      console.error('Start error:', error)
      showErrorToast(error, 'Failed to start playbook')
    } finally {
      setStarting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <ModalHeader className="flex items-center gap-2">
          <Play className="w-5 h-5 text-primary" />
          Run Playbook
        </ModalHeader>
        <ModalBody>
          {playbook && (
            <div className="mb-4 p-3 bg-default-100 rounded-lg">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                <span className="font-semibold">{playbook.title}</span>
              </div>
              {playbook.description && (
                <p className="text-sm text-default-500 mt-1">{playbook.description}</p>
              )}
              <p className="text-xs text-default-400 mt-2">
                {playbook.steps?.length || 0} steps
              </p>
            </div>
          )}

          <div className="space-y-4">
            <Select
              label="Project"
              placeholder="Select a project"
              selectedKeys={selectedProject ? [selectedProject] : []}
              onChange={(e) => setSelectedProject(e.target.value)}
              isRequired
              isLoading={loading}
            >
              {projects.map(p => (
                <SelectItem key={p.id}>{p.name}</SelectItem>
              ))}
            </Select>

            <Select
              label="Assign to"
              placeholder="Who will complete this?"
              selectedKeys={assignedTo ? [assignedTo] : []}
              onChange={(e) => setAssignedTo(e.target.value)}
              isRequired
              isLoading={loading}
            >
              {members.map(m => (
                <SelectItem key={m.id} textValue={m.display_name || m.name}>
                  <div className="flex items-center gap-2">
                    <Avatar src={m.avatar_url} name={m.display_name || m.name} size="sm" />
                    <span>{m.display_name || m.name}</span>
                  </div>
                </SelectItem>
              ))}
            </Select>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>Cancel</Button>
          <Button 
            color="primary" 
            onPress={handleStart}
            isLoading={starting}
            isDisabled={!selectedProject || !assignedTo}
            startContent={<Play className="w-4 h-4" />}
          >
            Start Playbook
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
