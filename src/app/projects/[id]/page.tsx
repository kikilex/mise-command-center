'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Card,
  CardBody,
  Button,
  Spinner,
  Avatar,
  Chip,
  Textarea,
  Input,
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Progress,
  Checkbox,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Select,
  SelectItem,
} from '@heroui/react'
import { 
  ArrowLeft, Plus, Pin, FileText, Link as LinkIcon, 
  MoreVertical, Send, X, ExternalLink, Trash2, 
  CheckCircle2, Circle, MessageSquare, GripVertical,
  User, Calendar, ChevronDown, ChevronUp, Users
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { formatDistanceToNow, format } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Phase {
  id: string
  project_id: string
  title: string
  position: number
  assigned_to: string | null
  status: string
  completed_at: string | null
  items?: PhaseItem[]
  assignee?: { id: string; name: string; display_name: string; avatar_url: string }
}

interface PhaseItem {
  id: string
  phase_id: string
  title: string
  sub_items: string[]
  assigned_to: string | null
  due_date: string | null
  completed: boolean
  completed_at: string | null
  position: number
  assignee?: { id: string; name: string; display_name: string; avatar_url: string }
}

interface ProjectUpdate {
  id: string
  content: string
  update_type: string
  created_at: string
  author?: { id: string; name: string; display_name: string; avatar_url: string }
}

interface ProjectPin {
  id: string
  title: string
  pin_type: string
  url: string | null
}

interface Project {
  id: string
  name: string
  description: string | null
  status: string
  icon: string | null
  color: string | null
  space_id: string
}

interface SpaceMember {
  id: string
  name: string
  display_name: string
  avatar_url: string
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])
  const [pins, setPins] = useState<ProjectPin[]>([])
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [members, setMembers] = useState<SpaceMember[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)
  const [newUpdate, setNewUpdate] = useState('')
  const [posting, setPosting] = useState(false)

  // Phase modal
  const { isOpen: isPhaseOpen, onOpen: onPhaseOpen, onClose: onPhaseClose } = useDisclosure()
  const [newPhaseTitle, setNewPhaseTitle] = useState('')
  const [addingPhase, setAddingPhase] = useState(false)

  // Pin modal
  const { isOpen: isPinOpen, onOpen: onPinOpen, onClose: onPinClose } = useDisclosure()
  const [pinTitle, setPinTitle] = useState('')
  const [pinUrl, setPinUrl] = useState('')
  const [addingPin, setAddingPin] = useState(false)

  // Item editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [addingItemToPhase, setAddingItemToPhase] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    setLoading(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: userData } = await supabase.from('users').select('*').eq('id', authUser.id).single()
        setUser(userData)
      }

      // Load project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()
      if (projectError) throw projectError
      setProject(projectData)

      // Load phases with items
      const { data: phasesData } = await supabase
        .from('project_phases')
        .select(`
          *,
          assignee:assigned_to (id, name, display_name, avatar_url),
          items:phase_items (
            *,
            assignee:assigned_to (id, name, display_name, avatar_url)
          )
        `)
        .eq('project_id', id)
        .order('position')

      // Sort items by position within each phase
      const sortedPhases = (phasesData || []).map(phase => ({
        ...phase,
        items: (phase.items || []).sort((a: PhaseItem, b: PhaseItem) => a.position - b.position)
      }))
      setPhases(sortedPhases)

      // Load pins
      const { data: pinsData } = await supabase
        .from('project_pins')
        .select('*')
        .eq('project_id', id)
        .order('position')
      setPins(pinsData || [])

      // Load updates (last 20)
      const { data: updatesData } = await supabase
        .from('project_updates')
        .select('*, author:author_id (id, name, display_name, avatar_url)')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(20)
      setUpdates(updatesData || [])

      // Load space members for assignments
      if (projectData?.space_id) {
        const { data: membersData } = await supabase
          .from('space_members')
          .select('users:user_id (id, name, display_name, avatar_url)')
          .eq('space_id', projectData.space_id)
        setMembers((membersData || []).map((m: any) => m.users).filter(Boolean))
      }

    } catch (error) {
      console.error('Load error:', error)
      showErrorToast(error, 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  // Add phase
  async function handleAddPhase() {
    if (!newPhaseTitle.trim()) return
    setAddingPhase(true)
    try {
      const { data, error } = await supabase
        .from('project_phases')
        .insert({
          project_id: id,
          title: newPhaseTitle.trim(),
          position: phases.filter(p => p.status === 'active').length,
        })
        .select('*, assignee:assigned_to (id, name, display_name, avatar_url)')
        .single()
      if (error) throw error
      setPhases(prev => [...prev, { ...data, items: [] }])
      setNewPhaseTitle('')
      onPhaseClose()
      
      // Post update
      await postUpdate(`Created phase: "${newPhaseTitle.trim()}"`, 'phase_created')
    } catch (error) {
      showErrorToast(error, 'Failed to create phase')
    } finally {
      setAddingPhase(false)
    }
  }

  // Delete phase
  async function handleDeletePhase(phaseId: string) {
    const phase = phases.find(p => p.id === phaseId)
    try {
      const { error } = await supabase.from('project_phases').delete().eq('id', phaseId)
      if (error) throw error
      setPhases(prev => prev.filter(p => p.id !== phaseId))
      if (phase) await postUpdate(`Removed phase: "${phase.title}"`, 'phase_deleted')
    } catch (error) {
      showErrorToast(error, 'Failed to delete phase')
    }
  }

  // Add item to phase
  async function handleAddItem(phaseId: string) {
    if (!newItemTitle.trim()) return
    try {
      const phase = phases.find(p => p.id === phaseId)
      const position = phase?.items?.length || 0
      
      const { data, error } = await supabase
        .from('phase_items')
        .insert({
          phase_id: phaseId,
          title: newItemTitle.trim(),
          position,
        })
        .select('*, assignee:assigned_to (id, name, display_name, avatar_url)')
        .single()
      if (error) throw error

      setPhases(prev => prev.map(p => 
        p.id === phaseId 
          ? { ...p, items: [...(p.items || []), data] }
          : p
      ))
      setNewItemTitle('')
      setAddingItemToPhase(null)
    } catch (error) {
      showErrorToast(error, 'Failed to add item')
    }
  }

  // Toggle item completion
  async function handleToggleItem(phaseId: string, itemId: string, currentlyCompleted: boolean) {
    const newCompleted = !currentlyCompleted
    const phase = phases.find(p => p.id === phaseId)
    const item = phase?.items?.find(i => i.id === itemId)

    try {
      const { error } = await supabase
        .from('phase_items')
        .update({
          completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
        })
        .eq('id', itemId)
      if (error) throw error

      // Update local state
      setPhases(prev => prev.map(p => {
        if (p.id !== phaseId) return p
        const updatedItems = p.items?.map(i => 
          i.id === itemId 
            ? { ...i, completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
            : i
        ) || []
        return { ...p, items: updatedItems }
      }))

      // Check if all items in phase are now complete
      if (newCompleted && item) {
        await postUpdate(`Completed: "${item.title}"`, 'item_completed')
        
        const updatedPhase = phases.find(p => p.id === phaseId)
        const allItems = updatedPhase?.items || []
        const allComplete = allItems.every(i => i.id === itemId ? true : i.completed)
        
        if (allComplete && allItems.length > 0) {
          // Auto-complete the phase
          await supabase
            .from('project_phases')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', phaseId)
          
          setPhases(prev => prev.map(p => 
            p.id === phaseId 
              ? { ...p, status: 'completed', completed_at: new Date().toISOString() }
              : p
          ))
          
          await postUpdate(`Completed phase: "${phase?.title}" 🎉`, 'phase_completed')
          showSuccessToast(`Phase "${phase?.title}" completed!`)
        }
      }
    } catch (error) {
      showErrorToast(error, 'Failed to update item')
    }
  }

  // Delete item
  async function handleDeleteItem(phaseId: string, itemId: string) {
    try {
      const { error } = await supabase.from('phase_items').delete().eq('id', itemId)
      if (error) throw error
      setPhases(prev => prev.map(p => 
        p.id === phaseId 
          ? { ...p, items: p.items?.filter(i => i.id !== itemId) }
          : p
      ))
    } catch (error) {
      showErrorToast(error, 'Failed to delete item')
    }
  }

  // Assign item
  async function handleAssignItem(itemId: string, phaseId: string, userId: string | null) {
    try {
      const { error } = await supabase
        .from('phase_items')
        .update({ assigned_to: userId })
        .eq('id', itemId)
      if (error) throw error

      const assignee = members.find(m => m.id === userId)
      setPhases(prev => prev.map(p => 
        p.id === phaseId 
          ? { 
              ...p, 
              items: p.items?.map(i => 
                i.id === itemId ? { ...i, assigned_to: userId, assignee } : i
              )
            }
          : p
      ))
    } catch (error) {
      showErrorToast(error, 'Failed to assign item')
    }
  }

  // Assign phase
  async function handleAssignPhase(phaseId: string, userId: string | null) {
    try {
      const { error } = await supabase
        .from('project_phases')
        .update({ assigned_to: userId })
        .eq('id', phaseId)
      if (error) throw error

      const assignee = members.find(m => m.id === userId)
      setPhases(prev => prev.map(p => 
        p.id === phaseId ? { ...p, assigned_to: userId, assignee } : p
      ))
      
      const phase = phases.find(p => p.id === phaseId)
      if (assignee && phase) {
        await postUpdate(`Assigned "${phase.title}" to ${assignee.display_name || assignee.name}`, 'phase_assigned')
      }
    } catch (error) {
      showErrorToast(error, 'Failed to assign phase')
    }
  }

  // Add pin
  async function handleAddPin() {
    if (!pinTitle.trim()) return
    setAddingPin(true)
    try {
      const { data, error } = await supabase
        .from('project_pins')
        .insert({
          project_id: id,
          title: pinTitle.trim(),
          pin_type: 'link',
          url: pinUrl.trim() || null,
          position: pins.length,
          created_by: user?.id,
        })
        .select()
        .single()
      if (error) throw error
      setPins(prev => [...prev, data])
      setPinTitle('')
      setPinUrl('')
      onPinClose()
    } catch (error) {
      showErrorToast(error, 'Failed to add pin')
    } finally {
      setAddingPin(false)
    }
  }

  // Delete pin
  async function handleDeletePin(pinId: string) {
    try {
      const { error } = await supabase.from('project_pins').delete().eq('id', pinId)
      if (error) throw error
      setPins(prev => prev.filter(p => p.id !== pinId))
    } catch (error) {
      showErrorToast(error, 'Failed to delete pin')
    }
  }

  // Post update
  async function postUpdate(content: string, type: string = 'post') {
    try {
      const { data, error } = await supabase
        .from('project_updates')
        .insert({
          project_id: id,
          author_id: user?.id,
          content,
          update_type: type,
        })
        .select('*, author:author_id (id, name, display_name, avatar_url)')
        .single()
      if (error) throw error
      setUpdates(prev => [data, ...prev])
    } catch (error) {
      console.error('Failed to post update:', error)
    }
  }

  // Manual update
  async function handlePostManualUpdate() {
    if (!newUpdate.trim()) return
    setPosting(true)
    try {
      await postUpdate(newUpdate.trim(), 'post')
      setNewUpdate('')
      showSuccessToast('Update posted')
    } catch (error) {
      showErrorToast(error, 'Failed to post update')
    } finally {
      setPosting(false)
    }
  }

  const renderProjectIcon = (iconName: string | null, fallback: string) => {
    if (iconName) {
      const Icon = (LucideIcons as any)[iconName]
      if (Icon) return <Icon className="w-6 h-6" />
    }
    return fallback
  }

  // Separate active and completed phases
  const activePhases = phases.filter(p => p.status === 'active')
  const completedPhases = phases.filter(p => p.status === 'completed')

  if (loading) {
    return (
      <div className="min-h-screen bg-default-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-default-50 flex items-center justify-center">
        <p>Project not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-default-50">
      <Navbar />

      <main className="max-w-5xl mx-auto py-6 px-4 sm:py-8 sm:px-6">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/spaces/${project.space_id}`} className="inline-flex items-center gap-2 text-default-500 hover:text-default-700 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Space
          </Link>

          <div>
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            {project.description && (
              <div className="prose prose-sm dark:prose-invert max-w-none mt-2 text-default-600">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {project.description}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Phases */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Phases</h2>
            <Button size="sm" color="primary" variant="flat" startContent={<Plus className="w-4 h-4" />} onPress={onPhaseOpen}>
              Add Phase
            </Button>
          </div>

          {activePhases.length === 0 && completedPhases.length === 0 ? (
            <Card className="border-2 border-dashed border-default-200 bg-transparent">
              <CardBody className="py-12 text-center">
                <p className="text-default-400 mb-4">No phases yet. Break down your project into phases.</p>
                <Button color="primary" onPress={onPhaseOpen}>Create First Phase</Button>
              </CardBody>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activePhases.map(phase => (
                <PhaseCard
                  key={phase.id}
                  phase={phase}
                  members={members}
                  onToggleItem={(itemId, completed) => handleToggleItem(phase.id, itemId, completed)}
                  onDeleteItem={(itemId) => handleDeleteItem(phase.id, itemId)}
                  onAssignItem={(itemId, userId) => handleAssignItem(itemId, phase.id, userId)}
                  onAssignPhase={(userId) => handleAssignPhase(phase.id, userId)}
                  onDeletePhase={() => handleDeletePhase(phase.id)}
                  onAddItem={() => setAddingItemToPhase(phase.id)}
                  addingItem={addingItemToPhase === phase.id}
                  newItemTitle={newItemTitle}
                  setNewItemTitle={setNewItemTitle}
                  onSubmitItem={() => handleAddItem(phase.id)}
                  onCancelAddItem={() => setAddingItemToPhase(null)}
                />
              ))}
            </div>
          )}

          {/* Completed phases toggle */}
          {completedPhases.length > 0 && (
            <div className="mt-6">
              <Button
                variant="light"
                size="sm"
                startContent={showCompleted ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                onPress={() => setShowCompleted(!showCompleted)}
              >
                {showCompleted ? 'Hide' : 'Show'} Completed ({completedPhases.length})
              </Button>

              {showCompleted && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 opacity-60">
                  {completedPhases.map(phase => (
                    <PhaseCard
                      key={phase.id}
                      phase={phase}
                      members={members}
                      onToggleItem={(itemId, completed) => handleToggleItem(phase.id, itemId, completed)}
                      onDeleteItem={(itemId) => handleDeleteItem(phase.id, itemId)}
                      onAssignItem={(itemId, userId) => handleAssignItem(itemId, phase.id, userId)}
                      onAssignPhase={(userId) => handleAssignPhase(phase.id, userId)}
                      onDeletePhase={() => handleDeletePhase(phase.id)}
                      completed
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pinned Resources */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-default-600">
              <Pin className="w-4 h-4" />
              <span className="text-sm font-medium">Pinned Resources</span>
            </div>
            <Button size="sm" variant="light" startContent={<Plus className="w-4 h-4" />} onPress={onPinOpen}>
              Add
            </Button>
          </div>
          {pins.length === 0 ? (
            <p className="text-sm text-default-400">No pinned resources yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pins.map(pin => (
                <Card key={pin.id} className="group">
                  <CardBody className="p-2 px-3 flex-row items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-default-400" />
                    {pin.url ? (
                      <a href={pin.url} target="_blank" rel="noopener noreferrer" className="text-sm hover:text-primary flex items-center gap-1">
                        {pin.title} <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-sm">{pin.title}</span>
                    )}
                    <Button isIconOnly size="sm" variant="light" className="opacity-0 group-hover:opacity-100 ml-1 min-w-6 w-6 h-6" onPress={() => handleDeletePin(pin.id)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Update Composer */}
        <Card className="mb-6">
          <CardBody className="p-4">
            <Textarea
              placeholder="Write an update..."
              value={newUpdate}
              onValueChange={setNewUpdate}
              minRows={2}
              variant="bordered"
            />
            <div className="flex justify-end mt-2">
              <Button size="sm" color="primary" isDisabled={!newUpdate.trim()} isLoading={posting} onPress={handlePostManualUpdate} endContent={<Send className="w-4 h-4" />}>
                Post
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Timeline */}
        <div>
          <h3 className="text-sm font-medium text-default-600 mb-3">Timeline</h3>
          {updates.length === 0 ? (
            <p className="text-sm text-default-400">No updates yet.</p>
          ) : (
            <div className="space-y-3">
              {updates.map(update => (
                <div key={update.id} className="flex items-start gap-3">
                  <Avatar src={update.author?.avatar_url} name={update.author?.display_name || update.author?.name} size="sm" className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{update.author?.display_name || update.author?.name}</span>
                      <span className="text-xs text-default-400">{formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm text-default-600">{update.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Add Phase Modal */}
      <Modal isOpen={isPhaseOpen} onClose={onPhaseClose}>
        <ModalContent>
          <ModalHeader>Add Phase</ModalHeader>
          <ModalBody>
            <Input
              label="Phase Title"
              placeholder="e.g., Research & Documentation"
              value={newPhaseTitle}
              onValueChange={setNewPhaseTitle}
              autoFocus
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onPhaseClose}>Cancel</Button>
            <Button color="primary" onPress={handleAddPhase} isLoading={addingPhase} isDisabled={!newPhaseTitle.trim()}>
              Add Phase
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Pin Modal */}
      <Modal isOpen={isPinOpen} onClose={onPinClose}>
        <ModalContent>
          <ModalHeader>Pin a Resource</ModalHeader>
          <ModalBody>
            <Input label="Title" placeholder="e.g., Login Credentials" value={pinTitle} onValueChange={setPinTitle} />
            <Input label="URL (optional)" placeholder="https://..." value={pinUrl} onValueChange={setPinUrl} className="mt-4" />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onPinClose}>Cancel</Button>
            <Button color="primary" onPress={handleAddPin} isLoading={addingPin} isDisabled={!pinTitle.trim()}>
              Pin
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

// Phase Card Component
function PhaseCard({
  phase,
  members,
  onToggleItem,
  onDeleteItem,
  onAssignItem,
  onAssignPhase,
  onDeletePhase,
  onAddItem,
  addingItem,
  newItemTitle,
  setNewItemTitle,
  onSubmitItem,
  onCancelAddItem,
  completed = false,
}: {
  phase: Phase
  members: SpaceMember[]
  onToggleItem: (itemId: string, completed: boolean) => void
  onDeleteItem: (itemId: string) => void
  onAssignItem: (itemId: string, userId: string | null) => void
  onAssignPhase: (userId: string | null) => void
  onDeletePhase: () => void
  onAddItem?: () => void
  addingItem?: boolean
  newItemTitle?: string
  setNewItemTitle?: (v: string) => void
  onSubmitItem?: () => void
  onCancelAddItem?: () => void
  completed?: boolean
}) {
  const items = phase.items || []
  const completedCount = items.filter(i => i.completed).length
  const totalCount = items.length
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <Card className={completed ? 'bg-success-50 dark:bg-success-900/10' : ''}>
      <CardBody className="p-4">
        {/* Phase Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{phase.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-default-400">{completedCount}/{totalCount}</span>
              {phase.assignee && (
                <Chip size="sm" variant="flat" avatar={<Avatar src={phase.assignee.avatar_url} name={phase.assignee.display_name || phase.assignee.name} />}>
                  {phase.assignee.display_name || phase.assignee.name}
                </Chip>
              )}
            </div>
          </div>
          <Dropdown>
            <DropdownTrigger>
              <Button isIconOnly size="sm" variant="light"><MoreVertical className="w-4 h-4" /></Button>
            </DropdownTrigger>
            <DropdownMenu>
              <DropdownItem key="assign" startContent={<Users className="w-4 h-4" />}>
                <Select
                  size="sm"
                  label="Assign Phase"
                  selectedKeys={phase.assigned_to ? [phase.assigned_to] : []}
                  onChange={(e) => onAssignPhase(e.target.value || null)}
                  className="min-w-[150px]"
                >
                  {members.map(m => (
                    <SelectItem key={m.id}>{m.display_name || m.name}</SelectItem>
                  ))}
                </Select>
              </DropdownItem>
              <DropdownItem key="delete" className="text-danger" color="danger" startContent={<Trash2 className="w-4 h-4" />} onPress={onDeletePhase}>
                Delete Phase
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>

        {/* Progress Bar */}
        <Progress value={progressPercent} size="sm" color={completed ? 'success' : 'primary'} className="mb-3" />

        {/* Items */}
        <div className="space-y-2">
          {items.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              members={members}
              onToggle={() => onToggleItem(item.id, item.completed)}
              onDelete={() => onDeleteItem(item.id)}
              onAssign={(userId) => onAssignItem(item.id, userId)}
            />
          ))}
        </div>

        {/* Add Item */}
        {!completed && (
          <>
            {addingItem ? (
              <div className="mt-3 flex items-center gap-2">
                <Input
                  size="sm"
                  placeholder="New item..."
                  value={newItemTitle}
                  onValueChange={setNewItemTitle}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && onSubmitItem?.()}
                  className="flex-1"
                />
                <Button size="sm" color="primary" onPress={onSubmitItem} isDisabled={!newItemTitle?.trim()}>Add</Button>
                <Button size="sm" variant="flat" onPress={onCancelAddItem}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="light" className="mt-3 w-full" startContent={<Plus className="w-4 h-4" />} onPress={onAddItem}>
                Add Item
              </Button>
            )}
          </>
        )}
      </CardBody>
    </Card>
  )
}

// Item Row Component
function ItemRow({
  item,
  members,
  onToggle,
  onDelete,
  onAssign,
}: {
  item: PhaseItem
  members: SpaceMember[]
  onToggle: () => void
  onDelete: () => void
  onAssign: (userId: string | null) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`rounded-lg p-2 ${item.completed ? 'bg-success-50 dark:bg-success-900/10' : 'bg-default-50 dark:bg-default-100'}`}>
      <div className="flex items-start gap-2">
        <Checkbox
          isSelected={item.completed}
          onValueChange={onToggle}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <span className={`text-sm ${item.completed ? 'line-through text-default-400' : ''}`}>{item.title}</span>
          
          {/* Sub-items */}
          {item.sub_items && item.sub_items.length > 0 && (
            <div className="mt-1 ml-4 space-y-1">
              {item.sub_items.map((sub, i) => (
                <div key={i} className="text-xs text-default-500 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-default-400" />
                  {sub}
                </div>
              ))}
            </div>
          )}

          {/* Assignee & Due */}
          <div className="flex items-center gap-2 mt-1">
            {item.assignee && (
              <Avatar src={item.assignee.avatar_url} name={item.assignee.display_name || item.assignee.name} size="sm" className="w-5 h-5" />
            )}
            {item.due_date && (
              <span className="text-xs text-default-400">{format(new Date(item.due_date), 'MMM d')}</span>
            )}
          </div>
        </div>

        <Dropdown>
          <DropdownTrigger>
            <Button isIconOnly size="sm" variant="light" className="min-w-6 w-6 h-6"><MoreVertical className="w-3 h-3" /></Button>
          </DropdownTrigger>
          <DropdownMenu>
            <DropdownItem key="assign">
              <Select
                size="sm"
                label="Assign to"
                selectedKeys={item.assigned_to ? [item.assigned_to] : []}
                onChange={(e) => onAssign(e.target.value || null)}
                className="min-w-[150px]"
              >
                {members.map(m => (
                  <SelectItem key={m.id}>{m.display_name || m.name}</SelectItem>
                ))}
              </Select>
            </DropdownItem>
            <DropdownItem key="delete" className="text-danger" color="danger" onPress={onDelete}>Delete</DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
    </div>
  )
}
