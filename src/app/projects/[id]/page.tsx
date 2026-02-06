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
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Progress,
} from '@heroui/react'
import { 
  ArrowLeft, Plus, Pin, FileText, Link as LinkIcon, 
  ClipboardList, MoreVertical, Send, Paperclip, X,
  ExternalLink, Trash2, GripVertical, Clock, User,
  CheckCircle2, Circle, MessageSquare
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { formatDistanceToNow } from 'date-fns'

interface ProjectUpdate {
  id: string
  project_id: string
  author_id: string | null
  content: string
  update_type: string
  metadata: any
  created_at: string
  author?: {
    id: string
    name: string
    display_name: string
    avatar_url: string
  }
}

interface ProjectPin {
  id: string
  project_id: string
  title: string
  pin_type: string
  resource_id: string | null
  url: string | null
  position: number
}

interface Project {
  id: string
  name: string
  description: string | null
  status: string
  icon: string | null
  color: string | null
  space_id: string
  created_by: string
}

interface ActiveChecklist {
  id: string
  status: string
  started_at: string
  playbook?: { id: string; title: string }
  assignee?: { id: string; name: string; display_name: string; avatar_url: string }
  progress?: { completed: number; total: number }
}

export default function ProjectJournalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [project, setProject] = useState<Project | null>(null)
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [pins, setPins] = useState<ProjectPin[]>([])
  const [activeChecklists, setActiveChecklists] = useState<ActiveChecklist[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [newUpdate, setNewUpdate] = useState('')
  
  // Pin modal
  const { isOpen: isPinOpen, onOpen: onPinOpen, onClose: onPinClose } = useDisclosure()
  const [pinTitle, setPinTitle] = useState('')
  const [pinUrl, setPinUrl] = useState('')
  const [pinType, setPinType] = useState<string>('link')
  const [addingPin, setAddingPin] = useState(false)

  useEffect(() => {
    loadData()
  }, [id])

  async function loadData() {
    setLoading(true)
    try {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
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

      // Load updates with author info
      const { data: updatesData, error: updatesError } = await supabase
        .from('project_updates')
        .select(`
          *,
          author:author_id (id, name, display_name, avatar_url)
        `)
        .eq('project_id', id)
        .order('created_at', { ascending: false })

      if (updatesError) throw updatesError
      setUpdates(updatesData || [])

      // Load pins
      const { data: pinsData, error: pinsError } = await supabase
        .from('project_pins')
        .select('*')
        .eq('project_id', id)
        .order('position', { ascending: true })

      if (pinsError) throw pinsError
      setPins(pinsData || [])

      // Load active checklists
      const { data: checklistsData, error: checklistsError } = await supabase
        .from('checklist_runs')
        .select(`
          id, status, started_at,
          playbook:playbook_id (id, title),
          assignee:assigned_to (id, name, display_name, avatar_url)
        `)
        .eq('project_id', id)
        .eq('status', 'active')
        .order('started_at', { ascending: false })

      if (!checklistsError && checklistsData) {
        // Get progress for each checklist
        const checklistsWithProgress = await Promise.all(
          checklistsData.map(async (cl) => {
            const { data: progressData } = await supabase
              .from('checklist_step_progress')
              .select('completed')
              .eq('run_id', cl.id)
            
            const total = progressData?.length || 0
            const completed = progressData?.filter(p => p.completed).length || 0
            
            return { ...cl, progress: { completed, total } }
          })
        )
        setActiveChecklists(checklistsWithProgress)
      }

    } catch (error) {
      console.error('Load error:', error)
      showErrorToast(error, 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  async function handlePostUpdate() {
    if (!newUpdate.trim() || !user) return

    setPosting(true)
    try {
      const { data, error } = await supabase
        .from('project_updates')
        .insert({
          project_id: id,
          author_id: user.id,
          content: newUpdate.trim(),
          update_type: 'post',
        })
        .select(`
          *,
          author:author_id (id, name, display_name, avatar_url)
        `)
        .single()

      if (error) throw error

      setUpdates(prev => [data, ...prev])
      setNewUpdate('')
      showSuccessToast('Update posted')
    } catch (error) {
      console.error('Post error:', error)
      showErrorToast(error, 'Failed to post update')
    } finally {
      setPosting(false)
    }
  }

  async function handleAddPin() {
    if (!pinTitle.trim()) return

    setAddingPin(true)
    try {
      const { data, error } = await supabase
        .from('project_pins')
        .insert({
          project_id: id,
          title: pinTitle.trim(),
          pin_type: pinType,
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
      setPinType('link')
      onPinClose()
      showSuccessToast('Resource pinned')
    } catch (error) {
      console.error('Pin error:', error)
      showErrorToast(error, 'Failed to pin resource')
    } finally {
      setAddingPin(false)
    }
  }

  async function handleDeletePin(pinId: string) {
    try {
      const { error } = await supabase
        .from('project_pins')
        .delete()
        .eq('id', pinId)

      if (error) throw error

      setPins(prev => prev.filter(p => p.id !== pinId))
      showSuccessToast('Pin removed')
    } catch (error) {
      showErrorToast(error, 'Failed to remove pin')
    }
  }

  async function handleDeleteUpdate(updateId: string) {
    try {
      const { error } = await supabase
        .from('project_updates')
        .delete()
        .eq('id', updateId)

      if (error) throw error

      setUpdates(prev => prev.filter(u => u.id !== updateId))
    } catch (error) {
      showErrorToast(error, 'Failed to delete update')
    }
  }

  const renderProjectIcon = (iconName: string | null, fallback: string) => {
    if (iconName) {
      const Icon = (LucideIcons as any)[iconName]
      if (Icon) return <Icon className="w-6 h-6" />
    }
    return fallback
  }

  const getPinIcon = (type: string) => {
    switch (type) {
      case 'doc': return <FileText className="w-4 h-4" />
      case 'link': return <LinkIcon className="w-4 h-4" />
      case 'playbook': return <ClipboardList className="w-4 h-4" />
      default: return <Pin className="w-4 h-4" />
    }
  }

  const getUpdateIcon = (type: string) => {
    switch (type) {
      case 'checklist_started': return <ClipboardList className="w-4 h-4 text-blue-500" />
      case 'checklist_progress': return <Circle className="w-4 h-4 text-amber-500" />
      case 'checklist_completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />
      default: return <MessageSquare className="w-4 h-4 text-slate-400" />
    }
  }

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

      <main className="max-w-4xl mx-auto py-6 px-4 sm:py-8 sm:px-6">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/spaces/${project.space_id}`} className="inline-flex items-center gap-2 text-default-500 hover:text-default-700 mb-4">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Space</span>
          </Link>

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg"
                style={{ backgroundColor: project.color || '#3b82f6' }}
              >
                {renderProjectIcon(project.icon, project.name.charAt(0))}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
                {project.description && (
                  <p className="text-default-500 mt-1">{project.description}</p>
                )}
                <Chip size="sm" variant="flat" color="success" className="mt-2">
                  {project.status}
                </Chip>
              </div>
            </div>
          </div>
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
            <Card className="border-dashed border-2 border-default-200 bg-transparent">
              <CardBody className="py-6 text-center text-default-400">
                <p className="text-sm">No pinned resources yet. Add docs, links, or playbooks for quick access.</p>
              </CardBody>
            </Card>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pins.map(pin => (
                <Card key={pin.id} className="group">
                  <CardBody className="p-3 flex-row items-center gap-2">
                    {getPinIcon(pin.pin_type)}
                    {pin.url ? (
                      <a 
                        href={pin.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:text-primary flex items-center gap-1"
                      >
                        {pin.title}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-sm font-medium">{pin.title}</span>
                    )}
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      className="opacity-0 group-hover:opacity-100 ml-1"
                      onPress={() => handleDeletePin(pin.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Active Checklists */}
        {activeChecklists.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-default-600 mb-3">
              <ClipboardList className="w-4 h-4" />
              <span className="text-sm font-medium">Active Checklists</span>
            </div>
            <div className="space-y-2">
              {activeChecklists.map(checklist => (
                <Card 
                  key={checklist.id} 
                  isPressable 
                  className="hover:shadow-sm transition-shadow"
                  onPress={() => router.push(`/checklists/${checklist.id}`)}
                >
                  <CardBody className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-primary" />
                        <span className="font-medium">{checklist.playbook?.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Avatar 
                          src={checklist.assignee?.avatar_url}
                          name={checklist.assignee?.display_name || checklist.assignee?.name}
                          size="sm"
                        />
                        <span className="text-sm text-default-500">
                          {checklist.progress?.completed}/{checklist.progress?.total}
                        </span>
                      </div>
                    </div>
                    <Progress 
                      value={checklist.progress?.total ? (checklist.progress.completed / checklist.progress.total) * 100 : 0}
                      size="sm"
                      color="primary"
                    />
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Update Composer */}
        <Card className="mb-6">
          <CardBody className="p-4">
            <Textarea
              placeholder="Write an update..."
              value={newUpdate}
              onValueChange={setNewUpdate}
              minRows={2}
              maxRows={6}
              variant="bordered"
              classNames={{
                inputWrapper: "border-default-200"
              }}
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex gap-2">
                {/* Future: attachment buttons */}
              </div>
              <Button 
                color="primary" 
                size="sm"
                isDisabled={!newUpdate.trim()}
                isLoading={posting}
                onPress={handlePostUpdate}
                endContent={<Send className="w-4 h-4" />}
              >
                Post
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Updates Feed */}
        <div className="space-y-4">
          {updates.length === 0 ? (
            <Card>
              <CardBody className="py-12 text-center text-default-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-4" />
                <p>No updates yet. Post the first update to get started!</p>
              </CardBody>
            </Card>
          ) : (
            updates.map(update => (
              <Card key={update.id} className="group">
                <CardBody className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar 
                      src={update.author?.avatar_url} 
                      name={update.author?.display_name || update.author?.name || 'Unknown'}
                      size="sm"
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {update.author?.display_name || update.author?.name || 'Unknown'}
                          </span>
                          <span className="text-xs text-default-400">
                            {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <Dropdown>
                          <DropdownTrigger>
                            <Button 
                              isIconOnly 
                              size="sm" 
                              variant="light"
                              className="opacity-0 group-hover:opacity-100"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu>
                            <DropdownItem 
                              key="delete" 
                              className="text-danger" 
                              color="danger"
                              startContent={<Trash2 className="w-4 h-4" />}
                              onPress={() => handleDeleteUpdate(update.id)}
                            >
                              Delete
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      </div>
                      <p className="text-default-700 mt-1 whitespace-pre-wrap">
                        {update.content}
                      </p>
                      
                      {/* Checklist progress indicator */}
                      {update.update_type === 'checklist_started' && update.metadata?.playbook_name && (
                        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                            <ClipboardList className="w-4 h-4" />
                            <span className="text-sm font-medium">
                              Started: {update.metadata.playbook_name}
                            </span>
                          </div>
                          {update.metadata.assigned_to_name && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              Assigned to: {update.metadata.assigned_to_name}
                            </p>
                          )}
                        </div>
                      )}

                      {update.update_type === 'checklist_completed' && update.metadata?.playbook_name && (
                        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-sm font-medium">
                              Completed: {update.metadata.playbook_name}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      </main>

      {/* Add Pin Modal */}
      <Modal isOpen={isPinOpen} onClose={onPinClose}>
        <ModalContent>
          <ModalHeader>Pin a Resource</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="flex gap-2">
                {['link', 'doc', 'playbook'].map(type => (
                  <Button
                    key={type}
                    size="sm"
                    variant={pinType === type ? 'solid' : 'flat'}
                    color={pinType === type ? 'primary' : 'default'}
                    onPress={() => setPinType(type)}
                    startContent={getPinIcon(type)}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Button>
                ))}
              </div>
              <Input
                label="Title"
                placeholder="e.g., Login Credentials"
                value={pinTitle}
                onValueChange={setPinTitle}
                isRequired
              />
              <Input
                label="URL"
                placeholder="https://..."
                value={pinUrl}
                onValueChange={setPinUrl}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onPinClose}>Cancel</Button>
            <Button 
              color="primary" 
              onPress={handleAddPin}
              isDisabled={!pinTitle.trim()}
              isLoading={addingPin}
            >
              Pin Resource
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
