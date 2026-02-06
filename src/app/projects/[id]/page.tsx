'use client'

import { useState, useEffect, use, useRef, useCallback } from 'react'
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
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
} from '@heroui/react'
import { 
  ArrowLeft, Plus, Pin, FileText, Link as LinkIcon, 
  MoreVertical, Send, X, ExternalLink, Trash2, 
  CheckCircle2, Circle, MessageSquare, GripVertical,
  User, Calendar, ChevronDown, ChevronUp, Users,
  Bold, Italic, Highlighter, RotateCcw, Save
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { formatDistanceToNow, format } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// DnD Kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SubItem {
  id: string
  text: string
  completed: boolean
}

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
  sub_items: string[] // stored as JSON strings in db
  assigned_to: string | null
  due_date: string | null
  completed: boolean
  completed_at: string | null
  position: number
  notes?: string | null
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

  // Item Drawer
  const { isOpen: isDrawerOpen, onOpen: onDrawerOpen, onClose: onDrawerClose } = useDisclosure()
  const [selectedItem, setSelectedItem] = useState<PhaseItem | null>(null)
  const [drawerTitle, setDrawerTitle] = useState('')
  const [drawerNotes, setDrawerNotes] = useState('')
  const [drawerAssignee, setDrawerAssignee] = useState<string | null>(null)
  const [drawerDueDate, setDrawerDueDate] = useState('')
  const [drawerSubItems, setDrawerSubItems] = useState<SubItem[]>([])
  const [newSubItemText, setNewSubItemText] = useState('')
  const [savingDrawer, setSavingDrawer] = useState(false)
  
  // Refs for selection-based formatting
  const titleInputRef = useRef<HTMLInputElement>(null)
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Phase assignment modal
  const { isOpen: isAssignPhaseOpen, onOpen: onAssignPhaseOpen, onClose: onAssignPhaseClose } = useDisclosure()
  const [phaseToAssign, setPhaseToAssign] = useState<Phase | null>(null)
  const [selectedPhaseAssignee, setSelectedPhaseAssignee] = useState<string | null>(null)

  // DnD state
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  // Selection-based text formatting helper
  function applyFormatting(
    inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
    value: string,
    setValue: (v: string) => void,
    prefix: string,
    suffix: string
  ) {
    const input = inputRef.current
    if (!input) return
    
    const start = input.selectionStart || 0
    const end = input.selectionEnd || 0
    
    if (start === end) {
      // No selection - insert placeholder
      const newValue = value.slice(0, start) + prefix + 'text' + suffix + value.slice(end)
      setValue(newValue)
      // Set cursor position after a tick
      setTimeout(() => {
        input.focus()
        input.setSelectionRange(start + prefix.length, start + prefix.length + 4)
      }, 0)
    } else {
      // Wrap selection
      const selectedText = value.slice(start, end)
      const newValue = value.slice(0, start) + prefix + selectedText + suffix + value.slice(end)
      setValue(newValue)
      // Keep selection on the wrapped text
      setTimeout(() => {
        input.focus()
        input.setSelectionRange(start + prefix.length, end + prefix.length)
      }, 0)
    }
  }

  // Open phase assignment modal
  function openAssignPhaseModal(phase: Phase) {
    setPhaseToAssign(phase)
    setSelectedPhaseAssignee(phase.assigned_to)
    onAssignPhaseOpen()
  }

  // Save phase assignment
  async function handleSavePhaseAssignment() {
    if (!phaseToAssign) return
    await handleAssignPhase(phaseToAssign.id, selectedPhaseAssignee)
    onAssignPhaseClose()
    setPhaseToAssign(null)
  }

  // DnD sensors with touch support
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

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

  // Restore completed phase
  async function handleRestorePhase(phaseId: string) {
    const phase = phases.find(p => p.id === phaseId)
    try {
      const { error } = await supabase
        .from('project_phases')
        .update({ status: 'active', completed_at: null })
        .eq('id', phaseId)
      if (error) throw error
      
      setPhases(prev => prev.map(p => 
        p.id === phaseId 
          ? { ...p, status: 'active', completed_at: null }
          : p
      ))
      
      if (phase) {
        await postUpdate(`Restored phase: "${phase.title}"`, 'phase_restored')
        showSuccessToast(`Phase "${phase.title}" restored`)
      }
    } catch (error) {
      showErrorToast(error, 'Failed to restore phase')
    }
  }

  // Add item to phase (inline)
  async function handleAddItem(phaseId: string, title: string) {
    if (!title.trim()) return
    try {
      const phase = phases.find(p => p.id === phaseId)
      const position = phase?.items?.length || 0
      
      const { data, error } = await supabase
        .from('phase_items')
        .insert({
          phase_id: phaseId,
          title: title.trim(),
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
      return true
    } catch (error) {
      showErrorToast(error, 'Failed to add item')
      return false
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
      onDrawerClose()
      showSuccessToast('Item deleted')
    } catch (error) {
      showErrorToast(error, 'Failed to delete item')
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

  // Open item drawer
  function openItemDrawer(item: PhaseItem) {
    setSelectedItem(item)
    setDrawerTitle(item.title)
    setDrawerNotes(item.notes || '')
    setDrawerAssignee(item.assigned_to)
    setDrawerDueDate(item.due_date || '')
    
    // Parse sub_items - stored as JSON strings or plain text[]
    const parsedSubItems: SubItem[] = (item.sub_items || []).map((sub, idx) => {
      try {
        const parsed = JSON.parse(sub)
        return { id: parsed.id || `sub-${idx}`, text: parsed.text || sub, completed: parsed.completed || false }
      } catch {
        return { id: `sub-${idx}`, text: sub, completed: false }
      }
    })
    setDrawerSubItems(parsedSubItems)
    setNewSubItemText('')
    onDrawerOpen()
  }

  // Save drawer changes
  async function handleSaveDrawer() {
    if (!selectedItem) return
    setSavingDrawer(true)
    
    try {
      // Serialize sub-items back to JSON strings
      const serializedSubItems = drawerSubItems.map(sub => JSON.stringify(sub))
      
      const { error } = await supabase
        .from('phase_items')
        .update({
          title: drawerTitle.trim(),
          notes: drawerNotes.trim() || null,
          assigned_to: drawerAssignee,
          due_date: drawerDueDate || null,
          sub_items: serializedSubItems,
        })
        .eq('id', selectedItem.id)
      
      if (error) throw error
      
      // Update local state
      const assignee = members.find(m => m.id === drawerAssignee)
      setPhases(prev => prev.map(p => ({
        ...p,
        items: p.items?.map(i => 
          i.id === selectedItem.id 
            ? { 
                ...i, 
                title: drawerTitle.trim(),
                notes: drawerNotes.trim() || null,
                assigned_to: drawerAssignee,
                due_date: drawerDueDate || null,
                sub_items: serializedSubItems,
                assignee
              }
            : i
        )
      })))
      
      showSuccessToast('Item updated')
      onDrawerClose()
    } catch (error) {
      showErrorToast(error, 'Failed to save item')
    } finally {
      setSavingDrawer(false)
    }
  }

  // Add sub-item
  function handleAddSubItem() {
    if (!newSubItemText.trim()) return
    const newSub: SubItem = {
      id: `sub-${Date.now()}`,
      text: newSubItemText.trim(),
      completed: false,
    }
    setDrawerSubItems(prev => [...prev, newSub])
    setNewSubItemText('')
  }

  // Toggle sub-item
  function handleToggleSubItem(subId: string) {
    setDrawerSubItems(prev => prev.map(sub =>
      sub.id === subId ? { ...sub, completed: !sub.completed } : sub
    ))
  }

  // Remove sub-item
  function handleRemoveSubItem(subId: string) {
    setDrawerSubItems(prev => prev.filter(sub => sub.id !== subId))
  }

  // Phase drag end
  function handlePhaseDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActivePhaseId(null)
    
    if (!over || active.id === over.id) return
    
    const activePhases = phases.filter(p => p.status === 'active')
    const oldIndex = activePhases.findIndex(p => p.id === active.id)
    const newIndex = activePhases.findIndex(p => p.id === over.id)
    
    if (oldIndex === -1 || newIndex === -1) return
    
    const reordered = arrayMove(activePhases, oldIndex, newIndex)
    
    // Update positions
    const updates = reordered.map((phase, idx) => ({
      id: phase.id,
      position: idx,
    }))
    
    // Optimistic update
    setPhases(prev => {
      const completed = prev.filter(p => p.status === 'completed')
      const updated = reordered.map((p, idx) => ({ ...p, position: idx }))
      return [...updated, ...completed]
    })
    
    // Persist to DB
    Promise.all(
      updates.map(u => 
        supabase.from('project_phases').update({ position: u.position }).eq('id', u.id)
      )
    ).catch(err => {
      showErrorToast(err, 'Failed to reorder phases')
      loadData() // Reload on error
    })
  }

  // Item drag end (within a phase)
  function handleItemDragEnd(phaseId: string, event: DragEndEvent) {
    const { active, over } = event
    setActiveItemId(null)
    
    if (!over || active.id === over.id) return
    
    const phase = phases.find(p => p.id === phaseId)
    if (!phase?.items) return
    
    const oldIndex = phase.items.findIndex(i => i.id === active.id)
    const newIndex = phase.items.findIndex(i => i.id === over.id)
    
    if (oldIndex === -1 || newIndex === -1) return
    
    const reordered = arrayMove(phase.items, oldIndex, newIndex)
    
    // Update positions
    const updates = reordered.map((item, idx) => ({
      id: item.id,
      position: idx,
    }))
    
    // Optimistic update
    setPhases(prev => prev.map(p => 
      p.id === phaseId 
        ? { ...p, items: reordered.map((item, idx) => ({ ...item, position: idx })) }
        : p
    ))
    
    // Persist to DB
    Promise.all(
      updates.map(u => 
        supabase.from('phase_items').update({ position: u.position }).eq('id', u.id)
      )
    ).catch(err => {
      showErrorToast(err, 'Failed to reorder items')
      loadData() // Reload on error
    })
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(e) => setActivePhaseId(e.active.id as string)}
              onDragEnd={handlePhaseDragEnd}
            >
              <SortableContext items={activePhases.map(p => p.id)} strategy={horizontalListSortingStrategy}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activePhases.map(phase => (
                    <SortablePhaseCard
                      key={phase.id}
                      phase={phase}
                      members={members}
                      sensors={sensors}
                      onToggleItem={(itemId, completed) => handleToggleItem(phase.id, itemId, completed)}
                      onOpenItem={(item) => openItemDrawer(item)}
                      onOpenAssignModal={() => openAssignPhaseModal(phase)}
                      onDeletePhase={() => handleDeletePhase(phase.id)}
                      onAddItem={(title) => handleAddItem(phase.id, title)}
                      onItemDragEnd={(e) => handleItemDragEnd(phase.id, e)}
                    />
                  ))}
                </div>
              </SortableContext>
              
              <DragOverlay>
                {activePhaseId && (
                  <div className="opacity-80">
                    <PhaseCardContent 
                      phase={phases.find(p => p.id === activePhaseId)!}
                      members={members}
                      isDragging
                    />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 opacity-70">
                  {completedPhases.map(phase => (
                    <PhaseCardContent
                      key={phase.id}
                      phase={phase}
                      members={members}
                      completed
                      onToggleItem={(itemId, completed) => handleToggleItem(phase.id, itemId, completed)}
                      onOpenItem={(item) => openItemDrawer(item)}
                      onDeletePhase={() => handleDeletePhase(phase.id)}
                      onRestorePhase={() => handleRestorePhase(phase.id)}
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

      {/* Assign Phase Modal */}
      <Modal isOpen={isAssignPhaseOpen} onClose={onAssignPhaseClose}>
        <ModalContent>
          <ModalHeader>Assign Phase: {phaseToAssign?.title}</ModalHeader>
          <ModalBody>
            <Select
              label="Assign to"
              selectedKeys={selectedPhaseAssignee ? [selectedPhaseAssignee] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string
                setSelectedPhaseAssignee(selected || null)
              }}
              variant="bordered"
              placeholder="Select team member..."
            >
              {members.map(m => (
                <SelectItem key={m.id} textValue={m.display_name || m.name}>
                  <div className="flex items-center gap-2">
                    <Avatar src={m.avatar_url} name={m.display_name || m.name} size="sm" className="w-6 h-6" />
                    <span>{m.display_name || m.name}</span>
                  </div>
                </SelectItem>
              ))}
            </Select>
            {selectedPhaseAssignee && (
              <Button 
                variant="light" 
                color="danger" 
                size="sm" 
                className="mt-2"
                onPress={() => setSelectedPhaseAssignee(null)}
              >
                Clear Assignment
              </Button>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onAssignPhaseClose}>Cancel</Button>
            <Button color="primary" onPress={handleSavePhaseAssignment}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Item Detail Drawer */}
      <Drawer isOpen={isDrawerOpen} onClose={onDrawerClose} placement="right" size="md">
        <DrawerContent>
          <DrawerHeader className="flex flex-col gap-1">
            <span className="text-lg font-semibold">Item Details</span>
          </DrawerHeader>
          <DrawerBody className="gap-4">
            {selectedItem && (
              <>
                {/* Title with formatting */}
                <div>
                  <label className="text-sm font-medium text-default-600 mb-2 block">Title</label>
                  <div className="flex gap-1 mb-2">
                    <Button 
                      size="sm" 
                      variant="flat" 
                      isIconOnly 
                      onPress={() => applyFormatting(titleInputRef, drawerTitle, setDrawerTitle, '**', '**')}
                      title="Bold"
                    >
                      <Bold className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="flat" 
                      isIconOnly 
                      onPress={() => applyFormatting(titleInputRef, drawerTitle, setDrawerTitle, '*', '*')}
                      title="Italic"
                    >
                      <Italic className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="flat" 
                      isIconOnly 
                      onPress={() => applyFormatting(titleInputRef, drawerTitle, setDrawerTitle, '==', '==')}
                      title="Highlight"
                    >
                      <Highlighter className="w-4 h-4" />
                    </Button>
                  </div>
                  <Input
                    ref={titleInputRef}
                    value={drawerTitle}
                    onValueChange={setDrawerTitle}
                    variant="bordered"
                    placeholder="Item title..."
                  />
                </div>

                {/* Assignment */}
                <div>
                  <label className="text-sm font-medium text-default-600 mb-2 block">Assigned To</label>
                  <Select
                    selectedKeys={drawerAssignee ? [drawerAssignee] : []}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys)[0] as string
                      setDrawerAssignee(selected || null)
                    }}
                    variant="bordered"
                    placeholder="Select assignee..."
                    classNames={{ trigger: 'h-10' }}
                  >
                    {members.map(m => (
                      <SelectItem key={m.id} textValue={m.display_name || m.name}>
                        <div className="flex items-center gap-2">
                          <Avatar src={m.avatar_url} name={m.display_name || m.name} size="sm" className="w-6 h-6" />
                          <span>{m.display_name || m.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </Select>
                </div>

                {/* Due Date */}
                <div>
                  <label className="text-sm font-medium text-default-600 mb-2 block">Due Date</label>
                  <Input
                    type="date"
                    value={drawerDueDate}
                    onValueChange={setDrawerDueDate}
                    variant="bordered"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-sm font-medium text-default-600 mb-2 block">Notes</label>
                  <div className="flex gap-1 mb-2">
                    <Button 
                      size="sm" 
                      variant="flat" 
                      isIconOnly 
                      onPress={() => applyFormatting(notesTextareaRef, drawerNotes, setDrawerNotes, '**', '**')}
                      title="Bold"
                    >
                      <Bold className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="flat" 
                      isIconOnly 
                      onPress={() => applyFormatting(notesTextareaRef, drawerNotes, setDrawerNotes, '*', '*')}
                      title="Italic"
                    >
                      <Italic className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="flat" 
                      isIconOnly 
                      onPress={() => applyFormatting(notesTextareaRef, drawerNotes, setDrawerNotes, '==', '==')}
                      title="Highlight"
                    >
                      <Highlighter className="w-4 h-4" />
                    </Button>
                  </div>
                  <Textarea
                    ref={notesTextareaRef}
                    value={drawerNotes}
                    onValueChange={setDrawerNotes}
                    variant="bordered"
                    placeholder="Add notes, comments, context..."
                    minRows={4}
                  />
                </div>

                {/* Sub-items */}
                <div>
                  <label className="text-sm font-medium text-default-600 mb-2 block">Sub-items</label>
                  <div className="space-y-2 mb-3">
                    {drawerSubItems.map(sub => (
                      <div key={sub.id} className="flex items-center gap-2 bg-default-100 rounded-lg p-2">
                        <Checkbox
                          isSelected={sub.completed}
                          onValueChange={() => handleToggleSubItem(sub.id)}
                          size="sm"
                        />
                        <span className={`flex-1 text-sm ${sub.completed ? 'line-through text-default-400' : ''}`}>
                          {sub.text}
                        </span>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={() => handleRemoveSubItem(sub.id)}
                          className="min-w-6 w-6 h-6"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      size="sm"
                      placeholder="Add sub-item..."
                      value={newSubItemText}
                      onValueChange={setNewSubItemText}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSubItem()}
                      variant="bordered"
                      className="flex-1"
                    />
                    <Button size="sm" color="primary" variant="flat" onPress={handleAddSubItem} isDisabled={!newSubItemText.trim()}>
                      Add
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DrawerBody>
          <DrawerFooter className="flex justify-between">
            <Button 
              color="danger" 
              variant="flat" 
              startContent={<Trash2 className="w-4 h-4" />}
              onPress={() => selectedItem && handleDeleteItem(selectedItem.phase_id, selectedItem.id)}
            >
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="flat" onPress={onDrawerClose}>Cancel</Button>
              <Button 
                color="primary" 
                onPress={handleSaveDrawer} 
                isLoading={savingDrawer}
                startContent={<Save className="w-4 h-4" />}
              >
                Save
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

// Sortable Phase Card wrapper
function SortablePhaseCard({
  phase,
  members,
  sensors,
  onToggleItem,
  onOpenItem,
  onOpenAssignModal,
  onDeletePhase,
  onAddItem,
  onItemDragEnd,
}: {
  phase: Phase
  members: SpaceMember[]
  sensors: ReturnType<typeof useSensors>
  onToggleItem: (itemId: string, completed: boolean) => void
  onOpenItem: (item: PhaseItem) => void
  onOpenAssignModal: () => void
  onDeletePhase: () => void
  onAddItem: (title: string) => Promise<boolean | undefined>
  onItemDragEnd: (event: DragEndEvent) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: phase.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <PhaseCardContent
        phase={phase}
        members={members}
        sensors={sensors}
        dragHandleProps={{ ...attributes, ...listeners }}
        onToggleItem={onToggleItem}
        onOpenItem={onOpenItem}
        onOpenAssignModal={onOpenAssignModal}
        onDeletePhase={onDeletePhase}
        onAddItem={onAddItem}
        onItemDragEnd={onItemDragEnd}
      />
    </div>
  )
}

// Phase Card Content (shared between sortable and static)
function PhaseCardContent({
  phase,
  members,
  sensors,
  dragHandleProps,
  onToggleItem,
  onOpenItem,
  onOpenAssignModal,
  onDeletePhase,
  onRestorePhase,
  onAddItem,
  onItemDragEnd,
  completed = false,
  isDragging = false,
}: {
  phase: Phase
  members: SpaceMember[]
  sensors?: ReturnType<typeof useSensors>
  dragHandleProps?: any
  onToggleItem?: (itemId: string, completed: boolean) => void
  onOpenItem?: (item: PhaseItem) => void
  onOpenAssignModal?: () => void
  onDeletePhase?: () => void
  onRestorePhase?: () => void
  onAddItem?: (title: string) => Promise<boolean | undefined>
  onItemDragEnd?: (event: DragEndEvent) => void
  completed?: boolean
  isDragging?: boolean
}) {
  const [newItemTitle, setNewItemTitle] = useState('')
  const [isAddingItem, setIsAddingItem] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  
  const items = phase.items || []
  const completedCount = items.filter(i => i.completed).length
  const totalCount = items.length
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  async function handleSubmitItem() {
    if (!newItemTitle.trim() || !onAddItem) return
    setIsAddingItem(true)
    const success = await onAddItem(newItemTitle.trim())
    setIsAddingItem(false)
    if (success) {
      setNewItemTitle('')
      // Keep focus on input for rapid entry
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return (
    <Card className={`${completed ? 'bg-success-50 dark:bg-success-900/10' : ''} ${isDragging ? 'shadow-lg' : ''}`}>
      <CardBody className="p-4">
        {/* Phase Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1">
            {dragHandleProps && !completed && (
              <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-default-100 rounded">
                <GripVertical className="w-4 h-4 text-default-400" />
              </div>
            )}
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
          </div>
          
          {!completed && onDeletePhase && (
            <Dropdown>
              <DropdownTrigger>
                <Button isIconOnly size="sm" variant="light"><MoreVertical className="w-4 h-4" /></Button>
              </DropdownTrigger>
              <DropdownMenu>
                {onOpenAssignModal && (
                  <DropdownItem 
                    key="assign" 
                    startContent={<Users className="w-4 h-4" />}
                    onPress={onOpenAssignModal}
                  >
                    {phase.assigned_to ? 'Change Assignment' : 'Assign Phase'}
                  </DropdownItem>
                )}
                <DropdownItem key="delete" className="text-danger" color="danger" startContent={<Trash2 className="w-4 h-4" />} onPress={onDeletePhase}>
                  Delete Phase
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          )}
          
          {completed && onRestorePhase && (
            <Button 
              size="sm" 
              variant="flat" 
              color="success"
              startContent={<RotateCcw className="w-4 h-4" />}
              onPress={onRestorePhase}
            >
              Restore
            </Button>
          )}
        </div>

        {/* Progress Bar */}
        <Progress value={progressPercent} size="sm" color={completed ? 'success' : 'primary'} className="mb-3" />

        {/* Items with DnD */}
        {sensors && onItemDragEnd && !completed ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(e) => setActiveItemId(e.active.id as string)}
            onDragEnd={(e) => {
              setActiveItemId(null)
              onItemDragEnd(e)
            }}
          >
            <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {items.map(item => (
                  <SortableItemRow
                    key={item.id}
                    item={item}
                    onToggle={() => onToggleItem?.(item.id, item.completed)}
                    onClick={() => onOpenItem?.(item)}
                  />
                ))}
              </div>
            </SortableContext>
            
            <DragOverlay>
              {activeItemId && (
                <div className="opacity-80">
                  <ItemRowContent item={items.find(i => i.id === activeItemId)!} isDragging />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <ItemRowContent
                key={item.id}
                item={item}
                onToggle={() => onToggleItem?.(item.id, item.completed)}
                onClick={() => onOpenItem?.(item)}
              />
            ))}
          </div>
        )}

        {/* Always-visible Add Item Input */}
        {!completed && onAddItem && (
          <div className="mt-3">
            <Input
              ref={inputRef}
              size="sm"
              placeholder="Add item and press Enter..."
              value={newItemTitle}
              onValueChange={setNewItemTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmitItem()
                if (e.key === 'Escape') {
                  setNewItemTitle('')
                  inputRef.current?.blur()
                }
              }}
              isDisabled={isAddingItem}
              startContent={<Plus className="w-4 h-4 text-default-400" />}
              variant="bordered"
              classNames={{
                input: 'text-sm',
                inputWrapper: 'h-9'
              }}
            />
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// Sortable Item Row wrapper
function SortableItemRow({
  item,
  onToggle,
  onClick,
}: {
  item: PhaseItem
  onToggle: () => void
  onClick: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <ItemRowContent
        item={item}
        onToggle={onToggle}
        onClick={onClick}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

// Item Row Content
function ItemRowContent({
  item,
  onToggle,
  onClick,
  dragHandleProps,
  isDragging = false,
}: {
  item: PhaseItem
  onToggle?: () => void
  onClick?: () => void
  dragHandleProps?: any
  isDragging?: boolean
}) {
  // Parse sub-items for display
  const subItems: SubItem[] = (item.sub_items || []).map((sub, idx) => {
    try {
      const parsed = JSON.parse(sub)
      return { id: parsed.id || `sub-${idx}`, text: parsed.text || sub, completed: parsed.completed || false }
    } catch {
      return { id: `sub-${idx}`, text: sub, completed: false }
    }
  })
  
  const completedSubCount = subItems.filter(s => s.completed).length

  return (
    <div 
      className={`rounded-lg p-2 ${item.completed ? 'bg-success-50 dark:bg-success-900/10' : 'bg-default-50 dark:bg-default-100'} ${isDragging ? 'shadow-md' : ''} ${onClick ? 'cursor-pointer hover:bg-default-100 dark:hover:bg-default-200/50' : ''}`}
      onClick={(e) => {
        // Don't trigger onClick if clicking checkbox or drag handle
        if ((e.target as HTMLElement).closest('[data-slot="wrapper"]') || 
            (e.target as HTMLElement).closest('[data-drag-handle]')) return
        onClick?.()
      }}
    >
      <div className="flex items-start gap-2">
        {dragHandleProps && (
          <div {...dragHandleProps} data-drag-handle className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 hover:bg-default-200 rounded mt-0.5">
            <GripVertical className="w-3 h-3 text-default-400" />
          </div>
        )}
        <Checkbox
          isSelected={item.completed}
          onValueChange={() => onToggle?.()}
          className="mt-0.5"
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <span className={`text-sm ${item.completed ? 'line-through text-default-400' : ''}`}>{item.title}</span>
          
          {/* Sub-items summary */}
          {subItems.length > 0 && (
            <div className="mt-1 text-xs text-default-400">
              {completedSubCount}/{subItems.length} sub-items
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
      </div>
    </div>
  )
}
