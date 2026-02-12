'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Table2, ArrowLeft, Save, Check, Loader2, Share2, Settings, Trash2, History, MessageSquare, Send, User } from 'lucide-react'
import { 
  Button, 
  Input, 
  Spinner, 
  Chip,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Avatar,
  Divider,
} from '@heroui/react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import SpreadsheetGrid from '@/components/SpreadsheetGrid'
import { showErrorToast, showSuccessToast } from '@/lib/errors'

interface SpreadsheetData {
  columns: { id: string; name: string; width: number }[]
  rows: { id: string; cells: { [columnId: string]: string } }[]
}

interface Spreadsheet {
  id: string
  title: string
  space_id: string | null
  project_id?: string | null
  created_by: string | null
  assigned_to: string | null
  status: string
  version: number
  data: SpreadsheetData
  created_at: string
  updated_at: string
  spaces?: { name: string; color: string } | null
  assignee?: { id: string; name: string; avatar_url: string } | null
}

interface Project {
  id: string
  name: string
  space_id: string
}

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

interface Comment {
  id: string
  spreadsheet_id: string
  content: string
  author_id: string | null
  author_name: string
  comment_type: string
  created_at: string
}

interface Version {
  id: string
  spreadsheet_id: string
  version: number
  title: string
  data: SpreadsheetData
  created_by: string | null
  created_at: string
  users?: { name: string; email: string } | null
}

const RECIPIENTS = [
  { id: 'alex', name: 'Alex', type: 'human' },
  { id: 'mom', name: 'Mom', type: 'human' },
  { id: 'ax', name: 'Ax', type: 'ai' },
  { id: 'tony', name: 'Tony', type: 'ai' },
  { id: 'neo', name: 'Neo', type: 'ai' },
]

export default function SpreadsheetPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const id = params.id as string
  
  const [spreadsheet, setSpreadsheet] = useState<Spreadsheet | null>(null)
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [title, setTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [copied, setCopied] = useState(false)
  
  // Settings state
  const [spaces, setSpaces] = useState<{id: string, name: string}[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [spaceMembers, setSpaceMembers] = useState<{id: string, name: string, avatar_url: string}[]>([])
  const [editSpaceId, setEditSpaceId] = useState<string>('')
  const [editProjectId, setEditProjectId] = useState<string>('space')
  const [editAssignedTo, setEditAssignedTo] = useState<string>('')
  const [savingMeta, setSavingMeta] = useState(false)
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  
  // Delete modal
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure()
  const [deleting, setDeleting] = useState(false)
  
  // History modal
  const { isOpen: isHistoryOpen, onOpen: onHistoryOpen, onClose: onHistoryClose } = useDisclosure()
  const [versions, setVersions] = useState<Version[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  
  // Comments state
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const commentInputRef = useRef<HTMLInputElement>(null)
  const [avatarMap, setAvatarMap] = useState<Map<string, string>>(new Map())
  
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null)
  const pendingData = useRef<SpreadsheetData | null>(null)

  useEffect(() => {
    loadUser()
    loadSpreadsheet()
    loadAvatars()
    
    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current)
      }
    }
  }, [id])

  async function loadAvatars() {
    const { data: usersData } = await supabase.from('users').select('slug, name, avatar_url')
    const { data: agentsData } = await supabase.from('ai_agents').select('slug, avatar_url')
    const avatars = new Map<string, string>()
    usersData?.forEach(u => { 
      if (u.avatar_url) {
        avatars.set(u.slug?.toLowerCase() || '', u.avatar_url)
        avatars.set(u.name?.toLowerCase() || '', u.avatar_url)
      }
    })
    agentsData?.forEach(a => { 
      if (a.avatar_url) avatars.set(a.slug?.toLowerCase() || '', a.avatar_url)
    })
    setAvatarMap(avatars)
  }

  useEffect(() => {
    if (spreadsheet) {
      loadComments()
    }
  }, [spreadsheet?.id])

  async function loadUser() {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).single()
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: profile?.name || authUser.email?.split('@')[0],
          avatar_url: profile?.avatar_url,
        })
      }
    } catch (error) {
      console.error('Load user error:', error)
    }
  }

  async function loadSpreadsheet() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('spreadsheets')
        .select('*, spaces:space_id (name, color), assignee:assigned_to (id, name, avatar_url)')
        .eq('id', id)
        .single()

      if (error) throw error
      
      setSpreadsheet(data)
      setTitle(data.title)
      setEditSpaceId(data.space_id || '')
      setEditProjectId(data.project_id || 'space')
      setEditAssignedTo(data.assigned_to || '')
      
      // Load spaces and projects
      loadSpaces()
      if (data.space_id) {
        loadProjects(data.space_id)
        loadSpaceMembers(data.space_id)
      }
    } catch (error) {
      console.error('Load spreadsheet error:', error)
      showErrorToast(error, 'Failed to load spreadsheet')
      router.push('/docs')
    } finally {
      setLoading(false)
    }
  }

  async function loadSpaces() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data, error } = await supabase
        .from('space_members')
        .select('spaces:space_id (id, name)')
        .eq('user_id', user.id)
      
      if (error) throw error
      const spaceList = (data || [])
        .map((sm: any) => sm.spaces)
        .filter(Boolean)
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
      setSpaces(spaceList)
    } catch (error) {
      console.error('Load spaces error:', error)
    }
  }

  async function loadProjects(spaceId: string) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, space_id')
        .eq('space_id', spaceId)
        .eq('status', 'active')
        .order('name')
      
      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Load projects error:', error)
    }
  }

  async function loadSpaceMembers(spaceId: string) {
    try {
      const { data, error } = await supabase
        .from('space_members')
        .select('users:user_id (id, name, avatar_url)')
        .eq('space_id', spaceId)
      
      if (error) throw error
      const members = (data || [])
        .map((sm: any) => sm.users)
        .filter(Boolean)
      setSpaceMembers(members)
    } catch (error) {
      console.error('Load space members error:', error)
    }
  }

  async function loadComments() {
    setLoadingComments(true)
    try {
      const { data, error } = await supabase
        .from('spreadsheet_comments')
        .select('*')
        .eq('spreadsheet_id', id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error('Load comments error:', error)
    } finally {
      setLoadingComments(false)
    }
  }

  async function loadVersions() {
    setLoadingVersions(true)
    try {
      const { data, error } = await supabase
        .from('spreadsheet_versions')
        .select('*, users:created_by (name, email)')
        .eq('spreadsheet_id', id)
        .order('version', { ascending: false })

      if (error) throw error
      setVersions(data || [])
    } catch (error) {
      console.error('Load versions error:', error)
      showErrorToast(error, 'Failed to load version history')
    } finally {
      setLoadingVersions(false)
    }
  }

  const saveSpreadsheet = useCallback(async (dataToSave?: SpreadsheetData, createVersion = false) => {
    if (!spreadsheet || !user) return
    
    const data = dataToSave || pendingData.current || spreadsheet.data
    
    setSaving(true)
    try {
      // If creating version, save current state first
      if (createVersion) {
        await supabase.from('spreadsheet_versions').insert({
          spreadsheet_id: spreadsheet.id,
          version: spreadsheet.version,
          title: spreadsheet.title,
          data: spreadsheet.data,
          created_by: user.id,
        })
      }
      
      const newVersion = createVersion ? spreadsheet.version + 1 : spreadsheet.version
      
      const { error } = await supabase
        .from('spreadsheets')
        .update({
          title: title.trim() || 'Untitled Spreadsheet',
          data,
          version: newVersion,
          updated_at: new Date().toISOString()
        })
        .eq('id', spreadsheet.id)

      if (error) throw error
      
      setSpreadsheet(prev => prev ? { ...prev, data, title: title.trim() || 'Untitled Spreadsheet', version: newVersion } : null)
      setHasChanges(false)
      setLastSaved(new Date())
      pendingData.current = null
      
      if (createVersion) {
        showSuccessToast('Version saved')
      }
    } catch (error) {
      showErrorToast(error, 'Failed to save spreadsheet')
    } finally {
      setSaving(false)
    }
  }, [spreadsheet, title, user, supabase])

  const handleDataChange = useCallback((newData: SpreadsheetData) => {
    if (!spreadsheet) return
    
    setSpreadsheet(prev => prev ? { ...prev, data: newData } : null)
    setHasChanges(true)
    pendingData.current = newData
    
    // Auto-save after 2 seconds of no changes
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current)
    }
    autoSaveTimeout.current = setTimeout(() => {
      saveSpreadsheet(newData)
    }, 2000)
  }, [spreadsheet, saveSpreadsheet])

  const handleTitleSave = async () => {
    setEditingTitle(false)
    if (spreadsheet && title !== spreadsheet.title) {
      setHasChanges(true)
      await saveSpreadsheet()
    }
  }

  const handleShare = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      showSuccessToast('Link copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showErrorToast(null, 'Failed to copy link')
    }
  }

  async function saveSpreadsheetMeta() {
    if (!spreadsheet) return
    setSavingMeta(true)
    try {
      const newProjectId = editProjectId === 'space' ? null : editProjectId
      const spaceChanged = editSpaceId !== spreadsheet.space_id
      
      const { error } = await supabase
        .from('spreadsheets')
        .update({
          space_id: editSpaceId || null,
          project_id: spaceChanged ? null : newProjectId,
          assigned_to: editAssignedTo || null,
        })
        .eq('id', spreadsheet.id)
      
      if (error) throw error
      
      // If space changed, reload projects and reset selection
      if (spaceChanged) {
        setEditProjectId('space')
        if (editSpaceId) {
          loadProjects(editSpaceId)
          loadSpaceMembers(editSpaceId)
        } else {
          setProjects([])
          setSpaceMembers([])
        }
      }
      
      // Reload to get updated info
      loadSpreadsheet()
      showSuccessToast('Spreadsheet updated')
    } catch (error) {
      console.error('Save spreadsheet error:', error)
      showErrorToast(error, 'Failed to save spreadsheet')
    } finally {
      setSavingMeta(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('spreadsheets')
        .delete()
        .eq('id', id)

      if (error) throw error

      showSuccessToast('Spreadsheet deleted')
      router.push('/docs')
    } catch (error) {
      console.error('Delete spreadsheet error:', error)
      showErrorToast(error, 'Failed to delete spreadsheet')
    } finally {
      setDeleting(false)
      onDeleteClose()
    }
  }

  function handleOpenHistory() {
    onHistoryOpen()
    loadVersions()
  }

  async function handleAddComment() {
    if (!newComment.trim() || !user) return
    
    setSendingComment(true)
    try {
      const commentContent = newComment.trim()
      
      const { data, error } = await supabase
        .from('spreadsheet_comments')
        .insert({
          spreadsheet_id: id,
          content: commentContent,
          author_id: user.id,
          author_name: user.name || user.email,
          comment_type: 'comment',
        })
        .select()
        .single()

      if (error) throw error
      
      setComments(prev => [...prev, data])
      setNewComment('')
      setShowMentions(false)
      
      // Check for @mentions and create tasks
      const mentionRegex = /@(\w+)/g
      const mentions = commentContent.match(mentionRegex)
      if (mentions && mentions.length > 0) {
        // Create tasks for each mention
        for (const mention of mentions) {
          const name = mention.slice(1) // Remove @
          const recipient = RECIPIENTS.find(r => r.name.toLowerCase() === name.toLowerCase())
          if (recipient) {
            const isAi = recipient.type === 'ai'
            await supabase.from('tasks').insert({
              title: `Review spreadsheet: ${spreadsheet?.title}`,
              description: `${user.name || user.email} mentioned you in a comment:\n\n"${commentContent}"\n\nSpreadsheet: /sheets/${id}`,
              status: 'todo',
              priority: 'medium',
              ai_flag: isAi,
              ai_agent: isAi ? recipient.id : null,
              created_by: user.id,
              space_id: spreadsheet?.space_id,
            })
          }
        }
        showSuccessToast(`Comment added — task${mentions.length > 1 ? 's' : ''} created for ${mentions.join(', ')}`)
      }
    } catch (error) {
      console.error('Add comment error:', error)
      showErrorToast(error, 'Failed to add comment')
    } finally {
      setSendingComment(false)
    }
  }

  function handleCommentInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setNewComment(val)

    const cursor = e.target.selectionStart || 0
    const textBefore = val.slice(0, cursor)
    const atMatch = textBefore.match(/@(\w*)$/)
    if (atMatch) {
      setMentionFilter(atMatch[1])
      setShowMentions(true)
    } else {
      setShowMentions(false)
    }
  }

  function insertMention(name: string) {
    const input = commentInputRef.current
    if (!input) return
    const cursor = input.selectionStart || 0
    const textBefore = newComment.slice(0, cursor)
    const textAfter = newComment.slice(cursor)
    const atIdx = textBefore.lastIndexOf('@')
    const before = textBefore.slice(0, atIdx)
    const inserted = `@${name} `
    setNewComment(before + inserted + textAfter)
    setShowMentions(false)

    setTimeout(() => {
      if (commentInputRef.current) {
        const pos = before.length + inserted.length
        commentInputRef.current.focus()
        commentInputRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  const mentionCandidates = useMemo(() => {
    const f = mentionFilter.toLowerCase()
    return RECIPIENTS.filter(r => r.name.toLowerCase().includes(f))
  }, [mentionFilter])

  function renderMentions(text: string) {
    const parts = text.split(/(@\w+)/g)
    return parts.map((part, i) => {
      if (part.match(/^@\w+$/)) {
        return <span key={i} className="text-blue-500 dark:text-blue-400 font-semibold">{part}</span>
      }
      return <span key={i}>{part}</span>
    })
  }

  const formatCommentDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!spreadsheet) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <p className="text-slate-500">Spreadsheet not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar user={user} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              variant="light"
              onPress={() => router.push('/docs')}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            
            <Table2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            
            {editingTitle ? (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTitleSave()
                  if (e.key === 'Escape') {
                    setTitle(spreadsheet.title)
                    setEditingTitle(false)
                  }
                }}
                className="w-64"
                autoFocus
              />
            ) : (
              <h1
                onClick={() => setEditingTitle(true)}
                className="text-xl font-semibold text-slate-800 dark:text-slate-100 cursor-pointer hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                {spreadsheet.title}
              </h1>
            )}
            
            {spreadsheet.spaces && (
              <Chip 
                size="sm" 
                variant="flat"
                style={{ backgroundColor: spreadsheet.spaces.color + '20', color: spreadsheet.spaces.color }}
              >
                {spreadsheet.spaces.name}
              </Chip>
            )}
            
            {spreadsheet.version > 1 && (
              <Chip variant="dot" size="sm">v{spreadsheet.version}</Chip>
            )}
            
            {spreadsheet.assignee && (
              <Chip
                size="sm"
                variant="flat"
                avatar={<Avatar src={spreadsheet.assignee.avatar_url} name={spreadsheet.assignee.name} size="sm" />}
              >
                {spreadsheet.assignee.name}
              </Chip>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Save status indicator */}
            <div className="flex items-center gap-2 text-sm text-slate-500 mr-2">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : hasChanges ? (
                <span className="text-amber-500">Unsaved changes</span>
              ) : lastSaved ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span>Saved</span>
                </>
              ) : null}
            </div>
            
            {/* Share Button */}
            <Button
              variant="flat"
              isIconOnly
              size="sm"
              title={copied ? "Link copied!" : "Share spreadsheet"}
              onPress={handleShare}
            >
              {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            </Button>
            
            {/* History Button */}
            <Button
              variant="flat"
              isIconOnly
              size="sm"
              title="Version history"
              onPress={handleOpenHistory}
            >
              <History className="w-4 h-4" />
            </Button>
            
            {/* Settings Popover */}
            <Popover isOpen={propertiesOpen} onOpenChange={setPropertiesOpen} placement="bottom-end">
              <PopoverTrigger>
                <Button
                  variant="flat"
                  isIconOnly
                  size="sm"
                  title="Spreadsheet settings"
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4">
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Spreadsheet Settings
                  </h4>
                  
                  {/* Space Selection */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Space
                    </label>
                    <Select
                      size="sm"
                      selectedKeys={editSpaceId ? [editSpaceId] : []}
                      onChange={(e) => {
                        setEditSpaceId(e.target.value)
                        setEditProjectId('space')
                        setEditAssignedTo('')
                        if (e.target.value) {
                          loadProjects(e.target.value)
                          loadSpaceMembers(e.target.value)
                        } else {
                          setProjects([])
                          setSpaceMembers([])
                        }
                      }}
                      className="w-full"
                      placeholder="Select a space"
                    >
                      {spaces.map(s => (
                        <SelectItem key={s.id}>{s.name}</SelectItem>
                      ))}
                    </Select>
                  </div>
                  
                  {/* Project / Visibility */}
                  {editSpaceId && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Visibility
                      </label>
                      <Select
                        size="sm"
                        selectedKeys={[editProjectId]}
                        onChange={(e) => setEditProjectId(e.target.value)}
                        className="w-full"
                      >
                        <SelectItem key="space">Everyone in Space</SelectItem>
                        {projects.map(p => (
                          <SelectItem key={p.id}>{p.name} only</SelectItem>
                        ))}
                      </Select>
                    </div>
                  )}
                  
                  {/* Assignment */}
                  {editSpaceId && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Assigned To
                      </label>
                      <Select
                        size="sm"
                        selectedKeys={editAssignedTo ? [editAssignedTo] : []}
                        onChange={(e) => setEditAssignedTo(e.target.value)}
                        className="w-full"
                        placeholder="Unassigned"
                      >
                        <SelectItem key="">Unassigned</SelectItem>
                        {spaceMembers.map(m => (
                          <SelectItem key={m.id}>{m.name}</SelectItem>
                        ))}
                      </Select>
                    </div>
                  )}
                  
                  {/* Save Button */}
                  <Button
                    color="primary"
                    size="sm"
                    className="w-full"
                    onPress={() => {
                      saveSpreadsheetMeta()
                      setPropertiesOpen(false)
                    }}
                    isLoading={savingMeta}
                  >
                    {savingMeta ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            
            {/* Delete Button */}
            <Button
              variant="flat"
              color="danger"
              isIconOnly
              size="sm"
              title="Delete spreadsheet"
              onPress={onDeleteOpen}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            
            {/* Save Version Button */}
            <Button
              variant="flat"
              size="sm"
              onPress={() => saveSpreadsheet(undefined, true)}
              isLoading={saving}
              title="Save as new version"
            >
              Save Version
            </Button>
            
            {/* Save Button */}
            <Button
              color="primary"
              size="sm"
              onPress={() => saveSpreadsheet()}
              isLoading={saving}
              isDisabled={!hasChanges}
              startContent={!saving && <Save className="w-4 h-4" />}
            >
              Save
            </Button>
          </div>
        </div>
        
        {/* Spreadsheet Grid */}
        <SpreadsheetGrid
          data={spreadsheet.data}
          onChange={handleDataChange}
        />
        
        {/* Footer info */}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <div>
            {spreadsheet.data.rows.length} rows × {spreadsheet.data.columns.length} columns
          </div>
          <div>
            Created {new Date(spreadsheet.created_at).toLocaleDateString()} • Updated {new Date(spreadsheet.updated_at).toLocaleDateString()}
          </div>
        </div>
        
        {/* Comments Section */}
        <div className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Comments ({comments.length})
          </h3>
          
          {/* Comment List */}
          <div className="space-y-4 mb-4 max-h-80 overflow-y-auto">
            {loadingComments ? (
              <div className="flex justify-center py-4">
                <Spinner size="sm" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No comments yet. Use @mentions to tag someone.</p>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar name={comment.author_name} src={avatarMap.get(comment.author_name?.toLowerCase() || '')} size="sm" className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{comment.author_name}</span>
                      <span className="text-xs text-slate-400">{formatCommentDate(comment.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {renderMentions(comment.content)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Add Comment Input */}
          <div className="relative">
            <div className="flex gap-2">
              <Input
                ref={commentInputRef}
                value={newComment}
                onChange={handleCommentInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleAddComment()
                  }
                }}
                placeholder="Add a comment... Use @name to mention someone"
                className="flex-1"
                size="sm"
              />
              <Button
                color="primary"
                size="sm"
                isIconOnly
                onPress={handleAddComment}
                isLoading={sendingComment}
                isDisabled={!newComment.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Mention Autocomplete */}
            {showMentions && mentionCandidates.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10">
                {mentionCandidates.map(r => (
                  <button
                    key={r.id}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                    onClick={() => insertMention(r.name)}
                  >
                    <Avatar name={r.name} src={avatarMap.get(r.id.toLowerCase())} size="sm" className="w-6 h-6" />
                    <span>{r.name}</span>
                    <span className="text-xs text-slate-400">({r.type})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">Delete Spreadsheet</ModalHeader>
          <ModalBody>
            <p>Are you sure you want to delete <strong>"{spreadsheet.title}"</strong>?</p>
            <p className="text-sm text-slate-500">This action cannot be undone.</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDeleteClose}>
              Cancel
            </Button>
            <Button color="danger" onPress={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      
      {/* Version History Modal */}
      <Modal isOpen={isHistoryOpen} onClose={onHistoryClose} size="lg">
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Version History
          </ModalHeader>
          <ModalBody>
            {loadingVersions ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : versions.length === 0 ? (
              <p className="text-center text-slate-400 py-8">No version history yet. Click "Save Version" to create a checkpoint.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {versions.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <Chip size="sm" variant="flat">v{v.version}</Chip>
                        <span className="text-sm font-medium">{v.title}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {v.users?.name || v.users?.email || 'Unknown'} • {new Date(v.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onHistoryClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
