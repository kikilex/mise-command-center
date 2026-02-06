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
  Bold, Italic, Highlighter, RotateCcw, Save,
  Upload, File, Image as ImageIcon, Search, StickyNote
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { formatDistanceToNow, format } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import confetti from 'canvas-confetti'

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
  notes?: string | null
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
  const updateTextareaRef = useRef<HTMLTextAreaElement>(null)
  
  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  
  // Doc modal
  const { isOpen: isDocOpen, onOpen: onDocOpen, onClose: onDocClose } = useDisclosure()
  const [spaceDocs, setSpaceDocs] = useState<any[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [creatingDoc, setCreatingDoc] = useState(false)
  const [docSearch, setDocSearch] = useState('')
  
  // Note modal (for quick notes as resources)
  const { isOpen: isNoteOpen, onOpen: onNoteOpen, onClose: onNoteClose } = useDisclosure()
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  
  // Image preview modal
  const { isOpen: isImageOpen, onOpen: onImageOpen, onClose: onImageClose } = useDisclosure()
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  
  // Doc preview modal
  const { isOpen: isDocPreviewOpen, onOpen: onDocPreviewOpen, onClose: onDocPreviewClose } = useDisclosure()
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null)
  const [previewDocTitle, setPreviewDocTitle] = useState('')
  const [previewDocContent, setPreviewDocContent] = useState('')
  const [loadingDocContent, setLoadingDocContent] = useState(false)
  const [previewDocId, setPreviewDocId] = useState<string | null>(null)
  const [isEditingDoc, setIsEditingDoc] = useState(false)
  const [editDocContent, setEditDocContent] = useState('')
  const [savingDoc, setSavingDoc] = useState(false)
  
  // Update editing
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null)
  const [editUpdateContent, setEditUpdateContent] = useState('')

  // Resource notes modal
  const { isOpen: isNotesOpen, onOpen: onNotesOpen, onClose: onNotesClose } = useDisclosure()
  const [notesPinId, setNotesPinId] = useState<string | null>(null)
  const [notesContent, setNotesContent] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

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
          
          // Celebrate with confetti! 🎉
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
          })
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

  // Toggle sub-item completion (immediate save)
  async function handleToggleSubItem(phaseId: string, itemId: string, subId: string) {
    const phase = phases.find(p => p.id === phaseId)
    const item = phase?.items?.find(i => i.id === itemId)
    if (!item) return

    // Parse existing sub-items
    const subItems: SubItem[] = (item.sub_items || []).map((sub, idx) => {
      try {
        const parsed = JSON.parse(sub)
        return { id: parsed.id || `sub-${idx}`, text: parsed.text || sub, completed: parsed.completed || false }
      } catch {
        return { id: `sub-${idx}`, text: sub, completed: false }
      }
    })

    // Toggle the specific sub-item
    const updatedSubItems = subItems.map(sub => 
      sub.id === subId ? { ...sub, completed: !sub.completed } : sub
    )

    // Serialize back to JSON strings
    const serialized = updatedSubItems.map(sub => JSON.stringify(sub))

    try {
      const { error } = await supabase
        .from('phase_items')
        .update({ sub_items: serialized })
        .eq('id', itemId)
      if (error) throw error

      // Update local state
      setPhases(prev => prev.map(p => 
        p.id === phaseId 
          ? { 
              ...p, 
              items: p.items?.map(i => 
                i.id === itemId ? { ...i, sub_items: serialized } : i
              )
            }
          : p
      ))
    } catch (error) {
      showErrorToast(error, 'Failed to update sub-item')
    }
  }

  // Update phase title
  async function handleUpdatePhaseTitle(phaseId: string, newTitle: string) {
    if (!newTitle.trim()) return
    try {
      const { error } = await supabase
        .from('project_phases')
        .update({ title: newTitle.trim() })
        .eq('id', phaseId)
      if (error) throw error

      setPhases(prev => prev.map(p => 
        p.id === phaseId ? { ...p, title: newTitle.trim() } : p
      ))
    } catch (error) {
      showErrorToast(error, 'Failed to update phase title')
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

  // Open notes for a resource
  function openNotesModal(pin: ProjectPin) {
    setNotesPinId(pin.id)
    setNotesContent(pin.notes || '')
    onNotesOpen()
  }

  // Save notes for a resource
  async function handleSaveNotes() {
    if (!notesPinId) return
    setSavingNotes(true)
    try {
      const { error } = await supabase
        .from('project_pins')
        .update({ notes: notesContent || null })
        .eq('id', notesPinId)
      if (error) throw error
      
      setPins(prev => prev.map(p => 
        p.id === notesPinId ? { ...p, notes: notesContent || null } : p
      ))
      onNotesClose()
      showSuccessToast('Notes saved')
    } catch (error) {
      showErrorToast(error, 'Failed to save notes')
    } finally {
      setSavingNotes(false)
    }
  }

  // File upload
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Check file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      showErrorToast(new Error('File too large'), 'Maximum file size is 50MB')
      return
    }
    
    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${id}/${Date.now()}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(fileName, file)
      
      if (uploadError) throw uploadError
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('project-files')
        .getPublicUrl(fileName)
      
      // Create pin record
      const { data: pinData, error: pinError } = await supabase
        .from('project_pins')
        .insert({
          project_id: id,
          title: file.name,
          pin_type: 'file',
          url: urlData.publicUrl,
          position: pins.length,
          created_by: user?.id,
        })
        .select()
        .single()
      
      if (pinError) throw pinError
      
      setPins(prev => [...prev, pinData])
      showSuccessToast('File uploaded')
    } catch (error) {
      showErrorToast(error, 'Failed to upload file')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Save a quick note as a resource
  async function handleSaveNote() {
    if (!noteTitle.trim() || !noteContent.trim()) return
    setSavingNote(true)
    try {
      const { data, error } = await supabase
        .from('project_pins')
        .insert({
          project_id: id,
          title: noteTitle.trim(),
          pin_type: 'note',
          notes: noteContent.trim(),
          position: pins.length,
          created_by: user?.id,
        })
        .select()
        .single()
      
      if (error) throw error
      
      setPins(prev => [...prev, data])
      setNoteTitle('')
      setNoteContent('')
      onNoteClose()
      showSuccessToast('Note saved')
    } catch (error) {
      showErrorToast(error, 'Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  // Load docs for linking
  async function loadSpaceDocs() {
    if (!project?.space_id) return
    setLoadingDocs(true)
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, created_at')
        .eq('space_id', project.space_id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      setSpaceDocs(data || [])
    } catch (error) {
      console.error('Failed to load docs:', error)
    } finally {
      setLoadingDocs(false)
    }
  }

  // Open doc modal
  function openDocModal() {
    loadSpaceDocs()
    setNewDocTitle('')
    onDocOpen()
  }

  // Link existing doc
  async function handleLinkDoc(docId: string, docTitle: string) {
    try {
      const { data, error } = await supabase
        .from('project_pins')
        .insert({
          project_id: id,
          title: docTitle,
          pin_type: 'doc',
          url: `/docs/${docId}`,
          position: pins.length,
          created_by: user?.id,
        })
        .select()
        .single()
      
      if (error) throw error
      
      setPins(prev => [...prev, data])
      onDocClose()
      showSuccessToast('Document linked')
    } catch (error) {
      showErrorToast(error, 'Failed to link document')
    }
  }

  // Create new doc and link
  async function handleCreateDoc() {
    if (!newDocTitle.trim() || !project?.space_id) return
    setCreatingDoc(true)
    try {
      // Create the document
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .insert({
          title: newDocTitle.trim(),
          content: '',
          space_id: project.space_id,
          project_id: id,
          created_by: user?.id,
        })
        .select()
        .single()
      
      if (docError) throw docError
      
      // Create pin
      const { data: pinData, error: pinError } = await supabase
        .from('project_pins')
        .insert({
          project_id: id,
          title: newDocTitle.trim(),
          pin_type: 'doc',
          url: `/docs/${docData.id}`,
          position: pins.length,
          created_by: user?.id,
        })
        .select()
        .single()
      
      if (pinError) throw pinError
      
      setPins(prev => [...prev, pinData])
      onDocClose()
      showSuccessToast('Document created')
      
      // Open the new doc in edit mode within the modal
      setPreviewDocId(docData.id)
      setPreviewDocTitle(newDocTitle.trim())
      setPreviewDocUrl(`/docs/${docData.id}`)
      setPreviewDocContent('')
      setEditDocContent('')
      setIsEditingDoc(true)
      onDocPreviewOpen()
    } catch (error) {
      showErrorToast(error, 'Failed to create document')
    } finally {
      setCreatingDoc(false)
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

  // Edit update
  async function handleEditUpdate(updateId: string) {
    if (!editUpdateContent.trim()) return
    try {
      const { error } = await supabase
        .from('project_updates')
        .update({ content: editUpdateContent.trim() })
        .eq('id', updateId)
      if (error) throw error
      
      setUpdates(prev => prev.map(u => 
        u.id === updateId ? { ...u, content: editUpdateContent.trim() } : u
      ))
      setEditingUpdateId(null)
      showSuccessToast('Update edited')
    } catch (error) {
      showErrorToast(error, 'Failed to edit update')
    }
  }

  // Delete update
  async function handleDeleteUpdate(updateId: string) {
    try {
      const { error } = await supabase
        .from('project_updates')
        .delete()
        .eq('id', updateId)
      if (error) throw error
      
      setUpdates(prev => prev.filter(u => u.id !== updateId))
      showSuccessToast('Update deleted')
    } catch (error) {
      showErrorToast(error, 'Failed to delete update')
    }
  }

  // Load doc content for preview
  async function loadDocForPreview(docId: string, title: string) {
    setPreviewDocId(docId)
    setPreviewDocTitle(title)
    setPreviewDocUrl(`/docs/${docId}`)
    setLoadingDocContent(true)
    setIsEditingDoc(false)
    onDocPreviewOpen()
    
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('content')
        .eq('id', docId)
        .single()
      
      if (error) throw error
      setPreviewDocContent(data?.content || '')
      setEditDocContent(data?.content || '')
    } catch (error) {
      console.error('Failed to load doc:', error)
      setPreviewDocContent('Failed to load document content.')
    } finally {
      setLoadingDocContent(false)
    }
  }
  
  // Save doc changes
  async function handleSaveDocContent() {
    if (!previewDocId) return
    setSavingDoc(true)
    try {
      const { error } = await supabase
        .from('documents')
        .update({ content: editDocContent })
        .eq('id', previewDocId)
      
      if (error) throw error
      setPreviewDocContent(editDocContent)
      setIsEditingDoc(false)
      showSuccessToast('Document saved')
    } catch (error) {
      showErrorToast(error, 'Failed to save document')
    } finally {
      setSavingDoc(false)
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

  // Reorder sub-items
  function handleSubItemDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    
    const oldIndex = drawerSubItems.findIndex(s => s.id === active.id)
    const newIndex = drawerSubItems.findIndex(s => s.id === over.id)
    
    if (oldIndex === -1 || newIndex === -1) return
    
    setDrawerSubItems(prev => arrayMove(prev, oldIndex, newIndex))
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
          <Button
            as={Link}
            href={`/spaces/${project.space_id}`}
            variant="flat"
            size="sm"
            startContent={<ArrowLeft className="w-4 h-4" />}
            className="mb-4"
          >
            Back to Space
          </Button>

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
                      onToggleSubItem={(itemId, subId) => handleToggleSubItem(phase.id, itemId, subId)}
                      onOpenItem={(item) => openItemDrawer(item)}
                      onOpenAssignModal={() => openAssignPhaseModal(phase)}
                      onDeletePhase={() => handleDeletePhase(phase.id)}
                      onAddItem={(title) => handleAddItem(phase.id, title)}
                      onItemDragEnd={(e) => handleItemDragEnd(phase.id, e)}
                      onUpdateTitle={(title) => handleUpdatePhaseTitle(phase.id, title)}
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
        <Card className="mb-6">
          <CardBody className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-default-700">
                <Pin className="w-4 h-4" />
                <span className="text-sm font-semibold">Resources</span>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="flat" startContent={<LinkIcon className="w-4 h-4" />} onPress={onPinOpen}>
                  Link
                </Button>
                <Button 
                  size="sm" 
                  variant="flat" 
                  startContent={<Upload className="w-4 h-4" />} 
                  onPress={() => fileInputRef.current?.click()}
                  isLoading={uploading}
                >
                  Upload
                </Button>
                <Button size="sm" variant="flat" startContent={<FileText className="w-4 h-4" />} onPress={openDocModal}>
                  Doc
                </Button>
                <Button size="sm" variant="flat" startContent={<StickyNote className="w-4 h-4" />} onPress={onNoteOpen}>
                  Note
                </Button>
              </div>
            </div>
            <input 
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept="*/*"
            />
            {pins.length === 0 ? (
              <p className="text-sm text-default-400 text-center py-4">No resources pinned yet. Add links, files, or docs.</p>
            ) : (
              <div className="space-y-2">
                {pins.map(pin => {
                  const isFile = pin.pin_type === 'file'
                  const isDoc = pin.pin_type === 'doc'
                  const isNote = pin.pin_type === 'note'
                  const isImage = isFile && /\.(jpg|jpeg|png|gif|webp)$/i.test(pin.url || '')
                  
                  return (
                    <div 
                      key={pin.id} 
                      className={`group flex items-center gap-3 p-2 rounded-lg hover:bg-default-100 transition-colors ${isNote ? '' : 'cursor-pointer'}`}
                      onClick={() => {
                        if (isNote) return // Notes expand inline, no click action
                        if (isImage && pin.url) {
                          setPreviewImage(pin.url)
                          onImageOpen()
                        } else if (isDoc && pin.url) {
                          // Extract doc ID from URL like /docs/{id}
                          const docId = pin.url.split('/docs/')[1]
                          if (docId) loadDocForPreview(docId, pin.title)
                        } else if (pin.url) {
                          window.open(pin.url, '_blank')
                        }
                      }}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isNote ? 'bg-warning-100' : 'bg-default-100'}`}>
                        {isNote ? <StickyNote className="w-4 h-4 text-warning" /> :
                         isImage ? <ImageIcon className="w-4 h-4 text-default-500" /> :
                         isFile ? <File className="w-4 h-4 text-default-500" /> :
                         isDoc ? <FileText className="w-4 h-4 text-primary" /> :
                         <LinkIcon className="w-4 h-4 text-default-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium hover:text-primary">
                          {pin.title}
                        </span>
                        {!isDoc && !isImage && !isNote && pin.url && (
                          <ExternalLink className="inline-block w-3 h-3 text-default-400 ml-1" />
                        )}
                        {pin.notes && !isNote && (
                          <StickyNote className="inline-block w-3 h-3 text-warning ml-1" />
                        )}
                        {isNote && pin.notes && (
                          <p className="text-xs text-default-500 mt-1 whitespace-pre-wrap">{pin.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          isIconOnly 
                          size="sm" 
                          variant="light" 
                          className="min-w-7 w-7 h-7" 
                          onPress={(e) => {
                            e.stopPropagation()
                            handleDeletePin(pin.id)
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-danger" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Update Composer */}
        <Card className="mb-6">
          <CardBody className="p-3">
            <div className="flex items-start gap-3">
              <Avatar src={user?.avatar_url} name={user?.display_name || user?.name} size="sm" className="flex-shrink-0 mt-1" />
              <div className="flex-1">
                <div className="relative">
                  <Textarea
                    ref={updateTextareaRef}
                    placeholder="Write an update... (Enter to post)"
                    value={newUpdate}
                    onValueChange={setNewUpdate}
                    minRows={1}
                    maxRows={6}
                    variant="bordered"
                    classNames={{
                      inputWrapper: 'pr-10 bg-default-50'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (newUpdate.trim()) handlePostManualUpdate()
                      }
                    }}
                  />
                  <Button 
                    isIconOnly 
                    size="sm" 
                    color="primary" 
                    variant="solid"
                    className="absolute right-2 bottom-2 min-w-7 w-7 h-7"
                    isDisabled={!newUpdate.trim()} 
                    isLoading={posting} 
                    onPress={handlePostManualUpdate}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {/* Formatting buttons */}
                <div className="flex items-center gap-1 mt-2">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    onPress={() => applyFormatting(updateTextareaRef as any, newUpdate, setNewUpdate, '**', '**')}
                    title="Bold"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    onPress={() => applyFormatting(updateTextareaRef as any, newUpdate, setNewUpdate, '_', '_')}
                    title="Italic"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    onPress={() => applyFormatting(updateTextareaRef as any, newUpdate, setNewUpdate, '==', '==')}
                    title="Highlight"
                  >
                    <Highlighter className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Timeline */}
        <Card>
          <CardBody className="p-4">
            <h3 className="text-sm font-semibold text-default-700 mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Activity
            </h3>
            {updates.length === 0 ? (
              <p className="text-sm text-default-400 text-center py-6">No activity yet.</p>
            ) : (
              <div className="space-y-4">
                {updates.map((update, idx) => {
                  const isManualPost = update.update_type === 'post'
                  const isOwner = update.author?.id === user?.id
                  const isLast = idx === updates.length - 1
                  
                  return (
                    <div key={update.id} className="flex items-start gap-3">
                      <div className="relative">
                        <Avatar 
                          src={update.author?.avatar_url} 
                          name={update.author?.display_name || update.author?.name} 
                          size="sm" 
                          className={`flex-shrink-0 ${isManualPost ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                        />
                        {/* Timeline line */}
                        {!isLast && (
                          <div className="absolute top-8 left-1/2 -translate-x-1/2 w-px h-[calc(100%+0.5rem)] bg-default-200" />
                        )}
                      </div>
                      <div className={`flex-1 min-w-0 pb-4 group ${isManualPost ? 'bg-primary/10 rounded-lg p-3 -mt-1 border border-primary/20' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{update.author?.display_name || update.author?.name}</span>
                            <span className="text-xs text-default-400">{formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}</span>
                          </div>
                          {isManualPost && isOwner && editingUpdateId !== update.id && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button 
                                isIconOnly 
                                size="sm" 
                                variant="light"
                                className="min-w-6 w-6 h-6"
                                onPress={() => {
                                  setEditingUpdateId(update.id)
                                  setEditUpdateContent(update.content)
                                }}
                              >
                                <LucideIcons.Pencil className="w-3 h-3" />
                              </Button>
                              <Button 
                                isIconOnly 
                                size="sm" 
                                variant="light"
                                className="min-w-6 w-6 h-6 text-danger"
                                onPress={() => handleDeleteUpdate(update.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {editingUpdateId === update.id ? (
                          <div className="flex gap-2">
                            <Input
                              size="sm"
                              value={editUpdateContent}
                              onValueChange={setEditUpdateContent}
                              variant="bordered"
                              className="flex-1"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleEditUpdate(update.id)
                                if (e.key === 'Escape') setEditingUpdateId(null)
                              }}
                            />
                            <Button size="sm" color="primary" onPress={() => handleEditUpdate(update.id)}>Save</Button>
                            <Button size="sm" variant="flat" onPress={() => setEditingUpdateId(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <p className={`text-sm ${isManualPost ? 'text-foreground font-medium' : 'text-default-500'}`}>
                            {update.content}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardBody>
        </Card>
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

      {/* Add/Link Doc Modal */}
      <Modal isOpen={isDocOpen} onClose={onDocClose} size="lg">
        <ModalContent>
          <ModalHeader>Add Document</ModalHeader>
          <ModalBody>
            {/* Create new doc */}
            <div className="mb-4">
              <label className="text-sm font-medium text-default-600 mb-2 block">Create New Document</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Document title..."
                  value={newDocTitle}
                  onValueChange={setNewDocTitle}
                  variant="bordered"
                  className="flex-1"
                />
                <Button 
                  color="primary" 
                  onPress={handleCreateDoc}
                  isDisabled={!newDocTitle.trim()}
                  isLoading={creatingDoc}
                >
                  Create
                </Button>
              </div>
            </div>
            
            {/* Or link existing */}
            <div>
              <label className="text-sm font-medium text-default-600 mb-2 block">Or Link Existing Document</label>
              <Input
                placeholder="Search documents..."
                value={docSearch}
                onValueChange={setDocSearch}
                startContent={<Search className="w-4 h-4 text-default-400" />}
                variant="bordered"
                size="sm"
                className="mb-2"
              />
              {loadingDocs ? (
                <div className="flex justify-center py-4">
                  <Spinner size="sm" />
                </div>
              ) : spaceDocs.length === 0 ? (
                <p className="text-sm text-default-400 text-center py-4">No documents in this space yet.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {spaceDocs
                    .filter(doc => !docSearch || doc.title.toLowerCase().includes(docSearch.toLowerCase()))
                    .map(doc => (
                    <div 
                      key={doc.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-default-100 cursor-pointer transition-colors"
                      onClick={() => handleLinkDoc(doc.id, doc.title)}
                    >
                      <FileText className="w-4 h-4 text-default-400" />
                      <span className="text-sm flex-1">{doc.title}</span>
                      <span className="text-xs text-default-400">
                        {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDocClose}>Cancel</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Quick Note Modal */}
      <Modal isOpen={isNoteOpen} onClose={onNoteClose} size="lg">
        <ModalContent>
          <ModalHeader>Add Note</ModalHeader>
          <ModalBody>
            <Input
              label="Title"
              placeholder="Note title..."
              value={noteTitle}
              onValueChange={setNoteTitle}
              variant="bordered"
              className="mb-3"
            />
            <Textarea
              label="Content"
              placeholder="Write your note..."
              value={noteContent}
              onValueChange={setNoteContent}
              variant="bordered"
              minRows={4}
              maxRows={10}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onNoteClose}>Cancel</Button>
            <Button 
              color="primary" 
              onPress={handleSaveNote} 
              isLoading={savingNote}
              isDisabled={!noteTitle.trim() || !noteContent.trim()}
            >
              Save Note
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Item Detail Drawer */}
      <Drawer isOpen={isDrawerOpen} onClose={onDrawerClose} placement="right" size="md" classNames={{ wrapper: 'z-[200]', base: 'z-[200]' }}>
        <DrawerContent>
          <DrawerHeader className="flex flex-col gap-1">
            <span className="text-lg font-semibold">Item Details</span>
          </DrawerHeader>
          <DrawerBody className="gap-4">
            {selectedItem && (
              <>
                {/* Title */}
                <div>
                  <label className="text-sm font-medium text-default-600 mb-2 block">Title</label>
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
                  <Textarea
                    ref={notesTextareaRef}
                    value={drawerNotes}
                    onValueChange={setDrawerNotes}
                    variant="bordered"
                    placeholder="Add notes, comments, context..."
                    minRows={4}
                  />
                  <div className="flex items-center gap-1 mt-2">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="flat"
                      onPress={() => applyFormatting(notesTextareaRef as any, drawerNotes, setDrawerNotes, '**', '**')}
                      title="Bold"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="flat"
                      onPress={() => applyFormatting(notesTextareaRef as any, drawerNotes, setDrawerNotes, '_', '_')}
                      title="Italic"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="flat"
                      onPress={() => applyFormatting(notesTextareaRef as any, drawerNotes, setDrawerNotes, '==', '==')}
                      title="Highlight"
                    >
                      <Highlighter className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Sub-items */}
                <div>
                  <label className="text-sm font-medium text-default-600 mb-2 block">Sub-items</label>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleSubItemDragEnd}
                  >
                    <SortableContext items={drawerSubItems.map(s => s.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2 mb-3">
                        {drawerSubItems.map(sub => (
                          <SortableSubItem
                            key={sub.id}
                            sub={sub}
                            onToggle={() => handleToggleSubItem(sub.id)}
                            onRemove={() => handleRemoveSubItem(sub.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
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

      {/* Resource Notes Modal - Post-it style */}
      <Modal isOpen={isNotesOpen} onClose={onNotesClose} size="md">
        <ModalContent className="bg-amber-50 dark:bg-amber-900/20">
          <ModalHeader className="flex items-center gap-2 pb-2">
            <StickyNote className="w-5 h-5 text-amber-600" />
            <span className="text-amber-900 dark:text-amber-100">Note</span>
          </ModalHeader>
          <ModalBody className="pt-0">
            <Textarea
              placeholder="Add a note about this resource..."
              value={notesContent}
              onValueChange={setNotesContent}
              minRows={4}
              maxRows={10}
              variant="flat"
              classNames={{
                inputWrapper: 'bg-amber-100/50 dark:bg-amber-800/20 border-amber-200 dark:border-amber-700',
                input: 'text-amber-900 dark:text-amber-100 placeholder:text-amber-400'
              }}
            />
          </ModalBody>
          <ModalFooter className="pt-2">
            <Button variant="flat" onPress={onNotesClose} className="text-amber-700">
              Cancel
            </Button>
            <Button 
              color="warning" 
              onPress={handleSaveNotes}
              isLoading={savingNotes}
            >
              Save Note
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Image Preview Modal */}
      <Modal isOpen={isImageOpen} onClose={onImageClose} size="4xl">
        <ModalContent>
          <ModalBody className="p-2">
            {previewImage && (
              <img 
                src={previewImage} 
                alt="Preview" 
                className="max-w-full max-h-[80vh] object-contain mx-auto rounded-lg"
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Doc Preview/Edit Modal */}
      <Modal isOpen={isDocPreviewOpen} onClose={onDocPreviewClose} size="3xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {previewDocTitle}
          </ModalHeader>
          <ModalBody className="py-4">
            {loadingDocContent ? (
              <div className="flex justify-center py-8">
                <Spinner size="lg" />
              </div>
            ) : isEditingDoc ? (
              <Textarea
                value={editDocContent}
                onValueChange={setEditDocContent}
                variant="bordered"
                placeholder="Write document content (Markdown supported)..."
                minRows={15}
                maxRows={30}
                classNames={{ input: 'font-mono text-sm' }}
              />
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {previewDocContent || '*No content yet*'}
                </ReactMarkdown>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDocPreviewClose}>Close</Button>
            {isEditingDoc ? (
              <>
                <Button variant="flat" onPress={() => setIsEditingDoc(false)}>Cancel</Button>
                <Button color="primary" onPress={handleSaveDocContent} isLoading={savingDoc}>
                  Save
                </Button>
              </>
            ) : (
              <Button color="primary" onPress={() => { setEditDocContent(previewDocContent); setIsEditingDoc(true) }}>
                Edit
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}

// Sortable Phase Card wrapper
function SortablePhaseCard({
  phase,
  members,
  sensors,
  onToggleItem,
  onToggleSubItem,
  onOpenItem,
  onOpenAssignModal,
  onDeletePhase,
  onAddItem,
  onItemDragEnd,
  onUpdateTitle,
}: {
  phase: Phase
  members: SpaceMember[]
  sensors: ReturnType<typeof useSensors>
  onToggleItem: (itemId: string, completed: boolean) => void
  onToggleSubItem: (itemId: string, subId: string) => void
  onOpenItem: (item: PhaseItem) => void
  onOpenAssignModal: () => void
  onDeletePhase: () => void
  onAddItem: (title: string) => Promise<boolean | undefined>
  onItemDragEnd: (event: DragEndEvent) => void
  onUpdateTitle: (title: string) => void
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
        onToggleSubItem={onToggleSubItem}
        onOpenItem={onOpenItem}
        onOpenAssignModal={onOpenAssignModal}
        onDeletePhase={onDeletePhase}
        onAddItem={onAddItem}
        onItemDragEnd={onItemDragEnd}
        onUpdateTitle={onUpdateTitle}
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
  onToggleSubItem,
  onOpenItem,
  onOpenAssignModal,
  onDeletePhase,
  onRestorePhase,
  onAddItem,
  onItemDragEnd,
  onUpdateTitle,
  completed = false,
  isDragging = false,
}: {
  phase: Phase
  members: SpaceMember[]
  sensors?: ReturnType<typeof useSensors>
  dragHandleProps?: any
  onToggleItem?: (itemId: string, completed: boolean) => void
  onToggleSubItem?: (itemId: string, subId: string) => void
  onOpenItem?: (item: PhaseItem) => void
  onOpenAssignModal?: () => void
  onDeletePhase?: () => void
  onRestorePhase?: () => void
  onAddItem?: (title: string) => Promise<boolean | undefined>
  onItemDragEnd?: (event: DragEndEvent) => void
  onUpdateTitle?: (title: string) => void
  completed?: boolean
  isDragging?: boolean
}) {
  const [newItemTitle, setNewItemTitle] = useState('')
  const [isAddingItem, setIsAddingItem] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  
  // Inline title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState(phase.title)
  const titleInputRef = useRef<HTMLInputElement>(null)
  
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

  function handleTitleClick() {
    if (completed || !onUpdateTitle) return
    setEditTitle(phase.title)
    setIsEditingTitle(true)
    setTimeout(() => titleInputRef.current?.focus(), 0)
  }

  function handleTitleSave() {
    if (editTitle.trim() && editTitle.trim() !== phase.title) {
      onUpdateTitle?.(editTitle.trim())
    }
    setIsEditingTitle(false)
  }

  return (
    <Card className={`${completed ? 'bg-success-50 dark:bg-success-900/10' : ''} ${isDragging ? 'shadow-lg' : ''}`}>
      <CardBody className="p-4">
        {/* Phase Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-1">
            {dragHandleProps && !completed && (
              <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-default-100 rounded">
                <GripVertical className="w-4 h-4 text-default-400" />
              </div>
            )}
            {isEditingTitle ? (
              <Input
                ref={titleInputRef}
                value={editTitle}
                onValueChange={setEditTitle}
                size="sm"
                variant="bordered"
                classNames={{ input: 'font-semibold', base: 'flex-1' }}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave()
                  if (e.key === 'Escape') setIsEditingTitle(false)
                }}
              />
            ) : (
              <h3 
                className={`font-semibold text-foreground flex-1 ${!completed && onUpdateTitle ? 'cursor-pointer hover:text-primary' : ''}`}
                onClick={handleTitleClick}
              >
                {phase.title}
              </h3>
            )}
          </div>
          
          {/* Right side: count, avatar, kebab */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-default-400">{completedCount}/{totalCount}</span>
            {phase.assignee && (
              <Avatar 
                src={phase.assignee.avatar_url} 
                name={phase.assignee.display_name || phase.assignee.name} 
                size="sm" 
                className="w-5 h-5"
                title={phase.assignee.display_name || phase.assignee.name}
              />
            )}
          
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
                    onToggleSubItem={onToggleSubItem ? (subId) => onToggleSubItem(item.id, subId) : undefined}
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
                onToggleSubItem={onToggleSubItem ? (subId) => onToggleSubItem(item.id, subId) : undefined}
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
  onToggleSubItem,
}: {
  item: PhaseItem
  onToggle: () => void
  onClick: () => void
  onToggleSubItem?: (subId: string) => void
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
        onToggleSubItem={onToggleSubItem}
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
  onToggleSubItem,
  dragHandleProps,
  isDragging = false,
}: {
  item: PhaseItem
  onToggle?: () => void
  onClick?: () => void
  onToggleSubItem?: (subId: string) => void
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

  return (
    <div 
      className={`rounded-lg p-2 ${item.completed ? 'bg-success-50 dark:bg-success-900/10' : 'bg-default-50 dark:bg-default-100'} ${isDragging ? 'shadow-md' : ''} ${onClick ? 'cursor-pointer hover:bg-default-100 dark:hover:bg-default-200/50' : ''}`}
      onClick={(e) => {
        // Don't trigger onClick if clicking checkbox, sub-item, or drag handle
        if ((e.target as HTMLElement).closest('[data-slot="wrapper"]') || 
            (e.target as HTMLElement).closest('[data-drag-handle]') ||
            (e.target as HTMLElement).closest('[data-sub-item]')) return
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
          size="sm"
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm ${item.completed ? 'line-through text-default-400' : ''}`}>{item.title}</span>
            {item.due_date && (
              <span className="text-xs text-default-400">{format(new Date(item.due_date), 'MMM d')}</span>
            )}
          </div>
          
          {/* Sub-items */}
          {subItems.length > 0 && (
            <div className="mt-2 space-y-1 ml-1">
              {subItems.map(sub => (
                <div 
                  key={sub.id} 
                  data-sub-item
                  className="flex items-center gap-2"
                >
                  <Checkbox
                    isSelected={sub.completed}
                    size="sm"
                    onValueChange={() => {
                      if (onToggleSubItem) onToggleSubItem(sub.id)
                    }}
                  />
                  <span 
                    className={`text-sm ${sub.completed ? 'line-through text-default-400' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (onToggleSubItem) onToggleSubItem(sub.id)
                    }}
                  >
                    {sub.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Sortable Sub-Item for drawer
function SortableSubItem({
  sub,
  onToggle,
  onRemove,
}: {
  sub: SubItem
  onToggle: () => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sub.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className="flex items-center gap-2 bg-default-100 rounded-lg p-2"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-0.5 hover:bg-default-200 rounded">
        <GripVertical className="w-3 h-3 text-default-400" />
      </div>
      <Checkbox
        isSelected={sub.completed}
        onValueChange={onToggle}
        size="sm"
      />
      <span className={`flex-1 text-sm ${sub.completed ? 'line-through text-default-400' : ''}`}>
        {sub.text}
      </span>
      <Button
        isIconOnly
        size="sm"
        variant="light"
        onPress={onRemove}
        className="min-w-6 w-6 h-6"
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  )
}
