'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardBody,
  Button,
  Spinner,
  Chip,
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Select,
  SelectItem,
} from '@heroui/react'
import { 
  Plus, ClipboardList, MoreVertical, Edit, Trash2, 
  Play, GripVertical, X, Link as LinkIcon, FileText
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import { createClient } from '@/lib/supabase/client'
import { useBusiness } from '@/lib/business-context'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import RunPlaybookModal from '@/components/RunPlaybookModal'

interface Playbook {
  id: string
  space_id: string
  title: string
  description: string | null
  icon: string
  color: string | null
  created_at: string
  steps?: PlaybookStep[]
  _count?: { runs: number }
}

interface PlaybookStep {
  id: string
  playbook_id: string
  position: number
  title: string
  description: string | null
  resources: { type: string; title: string; url: string }[]
}

interface Space {
  id: string
  name: string
}

export default function PlaybooksPage() {
  const router = useRouter()
  const supabase = createClient()
  const { selectedBusinessId } = useBusiness()

  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [spaces, setSpaces] = useState<Space[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  // Create/Edit modal
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [editingPlaybook, setEditingPlaybook] = useState<Playbook | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [spaceId, setSpaceId] = useState('')
  const [steps, setSteps] = useState<Omit<PlaybookStep, 'id' | 'playbook_id'>[]>([])
  const [saving, setSaving] = useState(false)

  // Delete modal
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure()
  const [deletingPlaybook, setDeletingPlaybook] = useState<Playbook | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Run modal
  const { isOpen: isRunOpen, onOpen: onRunOpen, onClose: onRunClose } = useDisclosure()
  const [runningPlaybook, setRunningPlaybook] = useState<Playbook | null>(null)

  useEffect(() => {
    loadData()
  }, [selectedBusinessId])

  async function loadData() {
    setLoading(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        setUser(userData)
      }

      // Load user's spaces
      const { data: spacesData } = await supabase
        .from('space_members')
        .select('spaces:space_id (id, name)')
        .eq('user_id', authUser?.id)

      const spaceList = (spacesData || [])
        .map((sm: any) => sm.spaces)
        .filter(Boolean)
      setSpaces(spaceList)

      // Load playbooks
      // Load ALL playbooks the user has access to (RLS handles filtering)
      const { data: playbooksData, error } = await supabase
        .from('playbooks')
        .select(`
          *,
          steps:playbook_steps (*)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setPlaybooks(playbooksData || [])

    } catch (error) {
      console.error('Load error:', error)
      showErrorToast(error, 'Failed to load playbooks')
    } finally {
      setLoading(false)
    }
  }

  function openCreateModal() {
    setEditingPlaybook(null)
    setTitle('')
    setDescription('')
    setSpaceId(selectedBusinessId || spaces[0]?.id || '')
    setSteps([{ position: 0, title: '', description: '', resources: [] }])
    onOpen()
  }

  function openEditModal(playbook: Playbook) {
    setEditingPlaybook(playbook)
    setTitle(playbook.title)
    setDescription(playbook.description || '')
    setSpaceId(playbook.space_id)
    setSteps(playbook.steps?.map(s => ({
      position: s.position,
      title: s.title,
      description: s.description,
      resources: s.resources || []
    })) || [{ position: 0, title: '', description: '', resources: [] }])
    onOpen()
  }

  function addStep() {
    setSteps(prev => [...prev, { 
      position: prev.length, 
      title: '', 
      description: '', 
      resources: [] 
    }])
  }

  function removeStep(index: number) {
    setSteps(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, position: i })))
  }

  function updateStep(index: number, field: string, value: any) {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  function addResourceToStep(stepIndex: number) {
    setSteps(prev => prev.map((s, i) => {
      if (i === stepIndex) {
        return {
          ...s,
          resources: [...(s.resources || []), { type: 'link', title: '', url: '' }]
        }
      }
      return s
    }))
  }

  function updateResource(stepIndex: number, resourceIndex: number, field: string, value: string) {
    setSteps(prev => prev.map((s, i) => {
      if (i === stepIndex) {
        const newResources = [...(s.resources || [])]
        newResources[resourceIndex] = { ...newResources[resourceIndex], [field]: value }
        return { ...s, resources: newResources }
      }
      return s
    }))
  }

  function removeResource(stepIndex: number, resourceIndex: number) {
    setSteps(prev => prev.map((s, i) => {
      if (i === stepIndex) {
        return { ...s, resources: s.resources.filter((_, ri) => ri !== resourceIndex) }
      }
      return s
    }))
  }

  async function handleSave() {
    if (!title.trim() || !spaceId) {
      showErrorToast(null, 'Title and space are required')
      return
    }

    const validSteps = steps.filter(s => s.title.trim())
    if (validSteps.length === 0) {
      showErrorToast(null, 'At least one step is required')
      return
    }

    setSaving(true)
    try {
      if (editingPlaybook) {
        // Update playbook
        const { error: updateError } = await supabase
          .from('playbooks')
          .update({
            title: title.trim(),
            description: description.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingPlaybook.id)

        if (updateError) throw updateError

        // Delete old steps
        await supabase
          .from('playbook_steps')
          .delete()
          .eq('playbook_id', editingPlaybook.id)

        // Insert new steps
        const { error: stepsError } = await supabase
          .from('playbook_steps')
          .insert(validSteps.map((s, i) => ({
            playbook_id: editingPlaybook.id,
            position: i,
            title: s.title.trim(),
            description: s.description?.trim() || null,
            resources: s.resources || [],
          })))

        if (stepsError) throw stepsError

        showSuccessToast('Playbook updated')
      } else {
        // Create playbook
        const { data: newPlaybook, error: createError } = await supabase
          .from('playbooks')
          .insert({
            space_id: spaceId,
            title: title.trim(),
            description: description.trim() || null,
            created_by: user?.id,
          })
          .select()
          .single()

        if (createError) throw createError

        // Insert steps
        const { error: stepsError } = await supabase
          .from('playbook_steps')
          .insert(validSteps.map((s, i) => ({
            playbook_id: newPlaybook.id,
            position: i,
            title: s.title.trim(),
            description: s.description?.trim() || null,
            resources: s.resources || [],
          })))

        if (stepsError) throw stepsError

        showSuccessToast('Playbook created')
      }

      onClose()
      loadData()
    } catch (error) {
      console.error('Save error:', error)
      showErrorToast(error, 'Failed to save playbook')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingPlaybook) return

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('playbooks')
        .delete()
        .eq('id', deletingPlaybook.id)

      if (error) throw error

      showSuccessToast('Playbook deleted')
      onDeleteClose()
      setDeletingPlaybook(null)
      loadData()
    } catch (error) {
      showErrorToast(error, 'Failed to delete playbook')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-default-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-default-50">
      <Navbar />

      <main className="max-w-5xl mx-auto py-6 px-4 sm:py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <ClipboardList className="w-7 h-7 text-primary" />
              Playbooks
            </h1>
            <p className="text-default-500 mt-1">Reusable step-by-step procedures</p>
          </div>
          <Button color="primary" startContent={<Plus className="w-4 h-4" />} onPress={openCreateModal}>
            Create Playbook
          </Button>
        </div>

        {playbooks.length === 0 ? (
          <Card className="py-16">
            <CardBody className="text-center">
              <ClipboardList className="w-16 h-16 mx-auto mb-4 text-default-300" />
              <h3 className="text-lg font-semibold mb-2">No playbooks yet</h3>
              <p className="text-default-500 mb-4">Create your first playbook to standardize procedures</p>
              <Button color="primary" onPress={openCreateModal}>
                Create Playbook
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {playbooks.map(playbook => (
              <Card key={playbook.id} className="hover:shadow-md transition-shadow">
                <CardBody className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                        <ClipboardList className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground truncate">{playbook.title}</h3>
                        {playbook.description && (
                          <p className="text-sm text-default-500 line-clamp-2 mt-1">{playbook.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Chip size="sm" variant="flat">
                            {playbook.steps?.length || 0} steps
                          </Chip>
                        </div>
                      </div>
                    </div>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button isIconOnly variant="light" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu>
                        <DropdownItem 
                          key="run" 
                          startContent={<Play className="w-4 h-4" />}
                          onPress={() => {
                            setRunningPlaybook(playbook)
                            onRunOpen()
                          }}
                        >
                          Run Playbook
                        </DropdownItem>
                        <DropdownItem 
                          key="edit" 
                          startContent={<Edit className="w-4 h-4" />}
                          onPress={() => openEditModal(playbook)}
                        >
                          Edit
                        </DropdownItem>
                        <DropdownItem 
                          key="delete" 
                          className="text-danger" 
                          color="danger"
                          startContent={<Trash2 className="w-4 h-4" />}
                          onPress={() => {
                            setDeletingPlaybook(playbook)
                            onDeleteOpen()
                          }}
                        >
                          Delete
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create/Edit Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            {editingPlaybook ? 'Edit Playbook' : 'Create Playbook'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Title"
                  placeholder="e.g., DMCA Takedown Process"
                  value={title}
                  onValueChange={setTitle}
                  isRequired
                />
                {!editingPlaybook && (
                  <Select
                    label="Space"
                    selectedKeys={spaceId ? [spaceId] : []}
                    onChange={(e) => setSpaceId(e.target.value)}
                    isRequired
                  >
                    {spaces.map(s => (
                      <SelectItem key={s.id}>{s.name}</SelectItem>
                    ))}
                  </Select>
                )}
              </div>

              <Textarea
                label="Description"
                placeholder="What is this playbook for?"
                value={description}
                onValueChange={setDescription}
                minRows={2}
              />

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Steps</h4>
                  <Button size="sm" variant="flat" startContent={<Plus className="w-4 h-4" />} onPress={addStep}>
                    Add Step
                  </Button>
                </div>

                <div className="space-y-4">
                  {steps.map((step, stepIndex) => (
                    <Card key={stepIndex} className="bg-default-50">
                      <CardBody className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-sm font-medium flex-shrink-0 mt-1">
                            {stepIndex + 1}
                          </div>
                          <div className="flex-1 space-y-3">
                            <Input
                              placeholder="Step title"
                              value={step.title}
                              onValueChange={(v) => updateStep(stepIndex, 'title', v)}
                              size="sm"
                            />
                            <Textarea
                              placeholder="Instructions (optional)"
                              value={step.description || ''}
                              onValueChange={(v) => updateStep(stepIndex, 'description', v)}
                              minRows={2}
                              size="sm"
                            />

                            {/* Resources */}
                            {step.resources && step.resources.length > 0 && (
                              <div className="space-y-2">
                                {step.resources.map((resource, resourceIndex) => (
                                  <div key={resourceIndex} className="flex items-center gap-2">
                                    <LinkIcon className="w-4 h-4 text-default-400 flex-shrink-0" />
                                    <Input
                                      placeholder="Link title"
                                      value={resource.title}
                                      onValueChange={(v) => updateResource(stepIndex, resourceIndex, 'title', v)}
                                      size="sm"
                                      className="flex-1"
                                    />
                                    <Input
                                      placeholder="URL"
                                      value={resource.url}
                                      onValueChange={(v) => updateResource(stepIndex, resourceIndex, 'url', v)}
                                      size="sm"
                                      className="flex-1"
                                    />
                                    <Button
                                      isIconOnly
                                      size="sm"
                                      variant="light"
                                      onPress={() => removeResource(stepIndex, resourceIndex)}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <Button
                              size="sm"
                              variant="light"
                              startContent={<LinkIcon className="w-4 h-4" />}
                              onPress={() => addResourceToStep(stepIndex)}
                            >
                              Add Resource Link
                            </Button>
                          </div>
                          {steps.length > 1 && (
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              onPress={() => removeStep(stepIndex)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>Cancel</Button>
            <Button color="primary" onPress={handleSave} isLoading={saving}>
              {editingPlaybook ? 'Save Changes' : 'Create Playbook'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
        <ModalContent>
          <ModalHeader>Delete Playbook</ModalHeader>
          <ModalBody>
            <p>Are you sure you want to delete <strong>"{deletingPlaybook?.title}"</strong>?</p>
            <p className="text-sm text-default-500 mt-2">This will also delete all associated runs and progress. This cannot be undone.</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDeleteClose}>Cancel</Button>
            <Button color="danger" onPress={handleDelete} isLoading={deleting}>
              Delete Playbook
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Run Playbook Modal */}
      <RunPlaybookModal
        playbook={runningPlaybook}
        isOpen={isRunOpen}
        onClose={() => {
          onRunClose()
          setRunningPlaybook(null)
        }}
        onSuccess={(runId) => {
          router.push(`/checklists/${runId}`)
        }}
        spaceId={runningPlaybook?.space_id || selectedBusinessId || ''}
        currentUserId={user?.id}
      />
    </div>
  )
}
