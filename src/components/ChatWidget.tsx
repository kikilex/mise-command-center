'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Button,
  ScrollShadow,
  Avatar,
  Textarea,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import {
  MessageCircle,
  X,
  Send,
  Bot,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Users,
  FolderOpen,
  Trash2,
  ArrowLeft,
} from 'lucide-react'
import { showErrorToast, showSuccessToast } from '@/lib/errors'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ChatMessage {
  id: string
  content: string
  item_type: string
  from_agent: string | null
  to_recipient: string | null
  thread_id: string | null
  subject: string | null
  space_id: string | null
  project_id: string | null
  status: string
  created_at: string
  user_id: string
}

interface ChatThread {
  id: string
  recipient: string
  subject: string | null
  lastMessage: string
  timestamp: string
  unreadCount: number
  spaceId: string | null
  projectId: string | null
  participants: string[]
}

interface SpaceOption {
  id: string
  name: string
}

interface ProjectOption {
  id: string
  name: string
  space_id: string | null
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const RECIPIENTS = [
  { id: 'ax', name: 'Ax', type: 'ai' },
  { id: 'tony', name: 'Tony', type: 'ai' },
  { id: 'neo', name: 'Neo', type: 'ai' },
  { id: 'alex', name: 'Alex', type: 'family' },
  { id: 'mom', name: 'Mom', type: 'family' },
]

const isAI = (name: string) => ['ax', 'tony', 'neo'].includes(name.toLowerCase())

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Notification sound using Web Audio API
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    gainNode.gain.value = 0.1
    
    oscillator.start()
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
    oscillator.stop(audioContext.currentTime + 0.2)
  } catch {}
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ChatWidget() {
  /* ---- core state ---- */
  const [isOpen, setIsOpen] = useState(false)
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  /* ---- mobile ---- */
  const [mobileShowConversation, setMobileShowConversation] = useState(false)

  /* ---- refs for callbacks ---- */
  const activeThreadRef = useRef<ChatThread | null>(null)
  const userRef = useRef<any>(null)
  const userNameRef = useRef<string>('')
  const isOpenRef = useRef(false)
  const channelRef = useRef<any>(null)

  useEffect(() => {
    activeThreadRef.current = activeThread
  }, [activeThread])

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    isOpenRef.current = isOpen
  }, [isOpen])

  /* ---- search ---- */
  const [search, setSearch] = useState('')

  /* ---- compose ---- */
  const [isComposing, setIsComposing] = useState(false)
  const [newRecipient, setNewRecipient] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [composeSpaceId, setComposeSpaceId] = useState('')
  const [composeProjectId, setComposeProjectId] = useState('')

  /* ---- spaces / projects ---- */
  const [spaces, setSpaces] = useState<SpaceOption[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])

  /* ---- thread management ---- */
  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitleValue, setEditTitleValue] = useState('')
  const [showHeaderMenu, setShowHeaderMenu] = useState(false)
  const [showMembersPanel, setShowMembersPanel] = useState(false)
  const [showAssignPanel, setShowAssignPanel] = useState(false)
  const [assignSpaceId, setAssignSpaceId] = useState('')
  const [assignProjectId, setAssignProjectId] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null)

  /* ---- @mention ---- */
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editingMsgText, setEditingMsgText] = useState('')
  const [confirmDeleteThreadId, setConfirmDeleteThreadId] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  /* ---- resize ---- */
  const [size, setSize] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('chat-widget-size')
        if (saved) return JSON.parse(saved)
      } catch {}
    }
    return { w: 750, h: 550 }
  })
  const resizing = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null)

  /* ---- detect mobile (md breakpoint = 768px) ---- */
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    setIsMobile(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizing.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h }

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return
      const dw = resizing.current.startX - ev.clientX  // dragging left = bigger
      const dh = resizing.current.startY - ev.clientY  // dragging up = bigger
      const w = Math.max(500, Math.min(1200, resizing.current.startW + dw))
      const h = Math.max(400, Math.min(900, resizing.current.startH + dh))
      setSize({ w, h })
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      // persist
      setSize((s: { w: number; h: number }) => {
        try { localStorage.setItem('chat-widget-size', JSON.stringify(s)) } catch {}
        return s
      })
      resizing.current = null
    }

    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'nw-resize'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [size.w, size.h])

  const scrollRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  /* ---- derived ---- */
  const filteredProjects = useMemo(() => {
    if (!composeSpaceId) return projects
    return projects.filter(p => p.space_id === composeSpaceId)
  }, [projects, composeSpaceId])

  const assignFilteredProjects = useMemo(() => {
    if (!assignSpaceId) return projects
    return projects.filter(p => p.space_id === assignSpaceId)
  }, [projects, assignSpaceId])

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads
    const q = search.toLowerCase()
    return threads.filter(t =>
      t.recipient.toLowerCase().includes(q) ||
      (t.subject && t.subject.toLowerCase().includes(q)) ||
      t.lastMessage.toLowerCase().includes(q)
    )
  }, [threads, search])

  const mentionCandidates = useMemo(() => {
    const f = mentionFilter.toLowerCase()
    return RECIPIENTS.filter(r => r.name.toLowerCase().includes(f))
  }, [mentionFilter])

  /* ================================================================ */
  /*  Effects                                                          */
  /* ================================================================ */

  useEffect(() => {
    loadInitialData()

    // Use broadcast channel for instant messaging (bypasses RLS issues)
    const channel = supabase
      .channel('chat-messages')
      .on('broadcast', { event: 'new-message' }, (payload) => {
        console.log('[ChatWidget] Broadcast received:', payload)
        if (payload.payload) {
          handleIncomingMessage(payload.payload)
        }
      })
      .subscribe((status) => {
        console.log('[ChatWidget] Broadcast subscription status:', status)
      })

    // Store channel ref for sending broadcasts
    channelRef.current = channel

    // Poll every 3s for reliability (broadcast may fail)
    const pollInterval = setInterval(async () => {
      const currentUser = userRef.current
      if (!currentUser) return
      
      // If chat is OPEN and viewing a thread, mark messages as read FIRST
      const activeThread = activeThreadRef.current
      const isChatOpen = isOpenRef.current
      if (activeThread && isChatOpen) {
        let query = supabase.from('inbox').select('*').eq('item_type', 'message')
        
        if (activeThread.id.startsWith('dm-')) {
          const partner = activeThread.id.replace('dm-', '')
          query = query.or(`from_agent.eq.${partner},to_recipient.eq.${partner}`).is('thread_id', null)
        } else {
          query = query.eq('thread_id', activeThread.id)
        }
        
        const { data } = await query.order('created_at', { ascending: true })
        
        if (data) {
          const currentSlug = userNameRef.current?.toLowerCase()
          
          // Mark pending messages as read
          const pendingIds = data
            .filter(msg => msg.status === 'pending' && msg.to_recipient?.toLowerCase() === currentSlug)
            .map(msg => msg.id)
          
          if (pendingIds.length > 0) {
            await supabase.from('inbox').update({ status: 'processed' }).in('id', pendingIds)
            // Update thread unread count
            setThreads(prev => prev.map(t => t.id === activeThread.id ? { ...t, unreadCount: 0 } : t))
          }
          
          // Only update messages if we have new ones
          setMessages(prev => {
            if (data.length > prev.length) {
              const newMsgs = data.slice(prev.length)
              const hasIncoming = newMsgs.some(m => m.user_id !== currentUser.id)
              if (hasIncoming) playNotificationSound()
              return data
            }
            return prev
          })
        }
      }
      
      // Refresh thread list AFTER marking messages as read
      await loadThreads(currentUser.id, userNameRef.current)
    }, 3000)

    return () => { 
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
    }
  }, [])

  // Listen for open-chat-thread from dashboard
  useEffect(() => {
    function handleOpenThread(e: Event) {
      const detail = (e as CustomEvent).detail
      
      if (detail?.threadId) {
        const thread = threads.find(t => t.id === detail.threadId)
        if (thread) {
          setActiveThread(thread)
          setIsComposing(false)
          setMobileShowConversation(true)
        }
      } else if (detail?.recipient) {
        // Open new conversation with recipient pre-selected
        setIsComposing(true)
        setActiveThread(null)
        setNewRecipient(detail.recipient)
        setMobileShowConversation(true)
      }
      
      setIsOpen(true)
    }

    window.addEventListener('open-chat-thread', handleOpenThread)
    return () => window.removeEventListener('open-chat-thread', handleOpenThread)
  }, [threads])

  useEffect(() => {
    if (activeThread) loadMessages(activeThread.id)
  }, [activeThread?.id])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  // Close header menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowHeaderMenu(false)
      }
    }
    if (showHeaderMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showHeaderMenu])

  /* ================================================================ */
  /*  Data loading                                                     */
  /* ================================================================ */

  async function loadInitialData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUser(user)
    
    // Fetch profile to get user slug for recipient matching
    const { data: profile } = await supabase.from('users').select('slug').eq('id', user.id).single()
    const userSlug = profile?.slug || user.email?.split('@')[0] || ''
    userNameRef.current = userSlug
    
    await Promise.all([loadThreads(user.id, userSlug), loadSpacesAndProjects()])
  }

  async function loadSpacesAndProjects() {
    const [spacesRes, projectsRes] = await Promise.all([
      supabase.from('spaces').select('id, name'),
      supabase.from('projects').select('id, name, space_id'),
    ])
    setSpaces(spacesRes.data || [])
    setProjects(projectsRes.data || [])
  }

  async function loadThreads(userId: string, userName?: string) {
    // Load users for sender lookup
    const { data: usersData } = await supabase.from('users').select('id, slug')
    const userIdToSlug = new Map<string, string>()
    usersData?.forEach(u => userIdToSlug.set(u.id, u.slug))
    
    const { data } = await supabase
      .from('inbox')
      .select('*')
      .eq('item_type', 'message')
      .order('created_at', { ascending: false })

    if (!data) return

    const threadMap = new Map<string, ChatThread>()
    const currentUserName = userName?.toLowerCase()

    data.forEach(item => {
      // Determine the conversation partner (the other person in the chat)
      let partner: string
      if (item.from_agent) {
        // AI message - partner is the AI
        partner = item.from_agent
      } else if (item.user_id === userId) {
        // I sent this message - partner is the recipient
        partner = item.to_recipient || 'unknown'
      } else {
        // Someone else sent this to me - partner is the sender
        partner = userIdToSlug.get(item.user_id) || item.to_recipient || 'unknown'
      }
      
      const id = item.thread_id || `dm-${partner}`

      if (!threadMap.has(id)) {
        threadMap.set(id, {
          id,
          recipient: partner,
          subject: item.subject,
          lastMessage: item.content,
          timestamp: item.created_at,
          unreadCount: 0,
          spaceId: item.space_id || null,
          projectId: item.project_id || null,
          participants: [],
        })
      }

      const t = threadMap.get(id)!
      
      // Increment unread count if message is pending and user is the recipient
      if (item.status === 'pending' && item.to_recipient?.toLowerCase() === currentUserName) {
        t.unreadCount++
      }

      // Collect participants
      if (item.from_agent && !t.participants.includes(item.from_agent)) t.participants.push(item.from_agent)
      if (item.to_recipient && !t.participants.includes(item.to_recipient)) t.participants.push(item.to_recipient)
    })

    setThreads(Array.from(threadMap.values()))
  }

  async function loadMessages(threadId: string) {
    setLoading(true)
    let query = supabase.from('inbox').select('*').eq('item_type', 'message')

    if (threadId.startsWith('dm-')) {
      const partner = threadId.replace('dm-', '')
      query = query.or(`from_agent.eq.${partner},to_recipient.eq.${partner}`).is('thread_id', null)
    } else {
      query = query.eq('thread_id', threadId)
    }

    const { data } = await query.order('created_at', { ascending: true })
    setMessages(data || [])
    
    // Mark messages as read (processed) if they are pending and for the current user
    const currentUserName = userNameRef.current?.toLowerCase()
    const pendingIds = (data || [])
      .filter(msg => msg.status === 'pending' && msg.to_recipient?.toLowerCase() === currentUserName)
      .map(msg => msg.id)
    
    if (pendingIds.length > 0) {
      await supabase.from('inbox').update({ status: 'processed' }).in('id', pendingIds)
      // Update thread unread count locally
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, unreadCount: 0 } : t))
    }

    setLoading(false)
  }

  function handleIncomingMessage(msg: any) {
    if (msg.item_type !== 'message') return
    
    const currentUser = userRef.current
    const currentUserName = userNameRef.current?.toLowerCase()
    
    // Only process messages relevant to me
    const isFromMe = msg.user_id === currentUser?.id
    const isToMe = msg.to_recipient?.toLowerCase() === currentUserName
    
    // Ignore messages that aren't from me or to me
    if (!isFromMe && !isToMe) return
    
    const partner = msg.from_agent || msg.to_recipient
    const threadId = msg.thread_id || `dm-${partner}`
    const isActive = isOpenRef.current && activeThreadRef.current?.id === threadId

    // Play notification sound for incoming messages (not from me, not actively viewing)
    if (isToMe && !isFromMe && !isActive) {
      playNotificationSound()
    }

    // If active and for me, mark as read immediately in DB
    if (isActive && isToMe && msg.status === 'pending') {
      supabase.from('inbox').update({ status: 'processed' }).eq('id', msg.id).then()
    }

    // Update thread list
    setThreads(prev => {
      const existing = prev.find(t => t.id === threadId)
      const participants = existing ? [...existing.participants] : []
      if (msg.from_agent && !participants.includes(msg.from_agent)) participants.push(msg.from_agent)
      if (msg.to_recipient && !participants.includes(msg.to_recipient)) participants.push(msg.to_recipient)

      const filtered = prev.filter(t => t.id !== threadId)
      
      // Calculate new unread count
      let unreadCount = existing?.unreadCount || 0
      if (isToMe && msg.status === 'pending' && !isActive) {
        unreadCount++
      }

      return [{
        id: threadId,
        recipient: partner,
        subject: msg.subject || existing?.subject || null,
        lastMessage: msg.content,
        timestamp: msg.created_at,
        unreadCount,
        spaceId: msg.space_id || existing?.spaceId || null,
        projectId: msg.project_id || existing?.projectId || null,
        participants,
      }, ...filtered]
    })

    // Add to active thread if it matches
    if (activeThreadRef.current?.id === threadId) {
      setMessages(prev => [...prev, msg])
    }
  }

  /* ================================================================ */
  /*  Actions                                                          */
  /* ================================================================ */

  async function handleSend() {
    if (!newMessage.trim() || !activeThread || !user) return
    const content = newMessage.trim()
    setNewMessage('')
    setShowMentions(false)

    const threadId = activeThread.id.startsWith('dm-') ? null : activeThread.id

    // Extract @mentions from the message
    const mentionRegex = /@(\w+)/g
    const mentions: string[] = []
    let match
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1].toLowerCase())
    }

    // Send the main message
    const { data, error } = await supabase
      .from('inbox')
      .insert({
        user_id: user.id,
        content,
        item_type: 'message',
        to_recipient: activeThread.recipient,
        thread_id: threadId,
        subject: activeThread.subject,
        space_id: activeThread.spaceId || null,
        project_id: activeThread.projectId || null,
        status: 'pending',
      })
      .select().single()

    if (error) {
      showErrorToast(error)
      return
    }

    setMessages(prev => [...prev, data])
    
    // Broadcast to other users for instant delivery
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'new-message',
        payload: data
      })
    }

    // Add mentioned users to the thread if they're not already participants
    if (threadId && mentions.length > 0) {
      const currentParticipants = activeThread.participants.length > 0 
        ? activeThread.participants 
        : [activeThread.recipient]
      
      for (const mentionedUser of mentions) {
        // Check if this is a valid recipient
        const recipientInfo = RECIPIENTS.find(r => r.id.toLowerCase() === mentionedUser)
        if (!recipientInfo) continue
        
        // Check if already a participant
        if (currentParticipants.includes(recipientInfo.id)) continue
        
        // Add them to the thread by inserting a message
        await supabase
          .from('inbox')
          .insert({
            user_id: user.id,
            content: `@${recipientInfo.name} was mentioned in this thread`,
            item_type: 'message',
            to_recipient: recipientInfo.id,
            thread_id: threadId,
            subject: activeThread.subject,
            space_id: activeThread.spaceId || null,
            project_id: activeThread.projectId || null,
            status: 'pending',
          })
        
        // Update local state
        const updatedParticipants = [...currentParticipants, recipientInfo.id]
        const updatedThread = { ...activeThread, participants: updatedParticipants }
        setActiveThread(updatedThread)
        setThreads(prev => prev.map(t => t.id === activeThread.id ? updatedThread : t))
      }
    }
  }

  async function handleStartNewChat() {
    if (!newRecipient || !newMessage.trim() || !user) return
    const content = newMessage.trim()
    const threadId = `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Extract @mentions from the message
    const mentionRegex = /@(\w+)/g
    const mentions: string[] = []
    let match
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1].toLowerCase())
    }

    const { data, error } = await supabase
      .from('inbox')
      .insert({
        user_id: user.id,
        content,
        item_type: 'message',
        to_recipient: newRecipient,
        thread_id: threadId,
        subject: newSubject.trim() || null,
        space_id: composeSpaceId || null,
        project_id: composeProjectId || null,
        status: 'pending',
      })
      .select().single()

    if (error) { showErrorToast(error); return }

    // Broadcast to other users for instant delivery
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'new-message',
        payload: data
      })
    }

    // Start with the primary recipient as participant
    const participants = [newRecipient]

    // Add mentioned users to the thread
    for (const mentionedUser of mentions) {
      // Check if this is a valid recipient and not the primary recipient
      const recipientInfo = RECIPIENTS.find(r => r.id.toLowerCase() === mentionedUser)
      if (!recipientInfo || recipientInfo.id === newRecipient) continue
      
      // Add them to the thread by inserting a message
      await supabase
        .from('inbox')
        .insert({
          user_id: user.id,
          content: `@${recipientInfo.name} was mentioned in this thread`,
          item_type: 'message',
          to_recipient: recipientInfo.id,
          thread_id: threadId,
          subject: newSubject.trim() || null,
          space_id: composeSpaceId || null,
          project_id: composeProjectId || null,
          status: 'pending',
        })
      
      participants.push(recipientInfo.id)
    }

    const newThread: ChatThread = {
      id: threadId,
      recipient: newRecipient,
      subject: newSubject.trim() || null,
      lastMessage: content,
      timestamp: data.created_at,
      unreadCount: 0,
      spaceId: composeSpaceId || null,
      projectId: composeProjectId || null,
      participants,
    }

    setThreads(prev => [newThread, ...prev])
    setActiveThread(newThread)
    setIsComposing(false)
    setNewRecipient('')
    setNewSubject('')
    setNewMessage('')
    setComposeSpaceId('')
    setComposeProjectId('')
  }

  /* ---- Thread management ---- */

  async function handleSaveTitle() {
    if (!activeThread || !editTitleValue.trim()) { setEditingTitle(false); return }
    const newSubj = editTitleValue.trim()

    const filter = activeThread.id.startsWith('dm-')
      ? supabase.from('inbox').update({ subject: newSubj }).or(
          `from_agent.eq.${activeThread.recipient},to_recipient.eq.${activeThread.recipient}`
        ).is('thread_id', null)
      : supabase.from('inbox').update({ subject: newSubj }).eq('thread_id', activeThread.id)

    const { error } = await filter
    if (error) { showErrorToast(error); return }

    setActiveThread(prev => prev ? { ...prev, subject: newSubj } : null)
    setThreads(prev => prev.map(t => t.id === activeThread.id ? { ...t, subject: newSubj } : t))
    setEditingTitle(false)
    showSuccessToast('Title updated')
  }

  async function handleAssignProject() {
    if (!activeThread) return

    const updates: Record<string, string | null> = {
      space_id: assignSpaceId || null,
      project_id: assignProjectId || null,
    }

    const filter = activeThread.id.startsWith('dm-')
      ? supabase.from('inbox').update(updates).or(
          `from_agent.eq.${activeThread.recipient},to_recipient.eq.${activeThread.recipient}`
        ).is('thread_id', null)
      : supabase.from('inbox').update(updates).eq('thread_id', activeThread.id)

    const { error } = await filter
    if (error) { showErrorToast(error); return }

    setActiveThread(prev => prev ? { ...prev, spaceId: assignSpaceId || null, projectId: assignProjectId || null } : null)
    setThreads(prev => prev.map(t => t.id === activeThread.id ? { ...t, spaceId: assignSpaceId || null, projectId: assignProjectId || null } : t))
    setShowAssignPanel(false)
    showSuccessToast('Project assigned')
  }

  async function removeMember(memberName: string) {
    if (!activeThread || !user) return
    
    // Don't allow removing the primary recipient (the thread starter)
    if (memberName === activeThread.recipient) {
      showErrorToast('Cannot remove the primary recipient from the thread')
      return
    }
    
    // For thread-based chats, we need to delete all messages for this member in the thread
    if (!activeThread.id.startsWith('dm-')) {
      const { error } = await supabase
        .from('inbox')
        .delete()
        .eq('thread_id', activeThread.id)
        .or(`from_agent.eq.${memberName},to_recipient.eq.${memberName}`)
      
      if (error) {
        showErrorToast(error)
        return
      }
    }
    
    // Update local state
    const updatedParticipants = activeThread.participants.filter(p => p !== memberName)
    const updatedThread = { ...activeThread, participants: updatedParticipants }
    setActiveThread(updatedThread)
    setThreads(prev => prev.map(t => t.id === activeThread.id ? updatedThread : t))
    
    setMemberToRemove(null)
    showSuccessToast(`Removed ${cap(memberName)} from thread`)
  }

  async function handleDeleteThread() {
    if (!activeThread) return

    const filter = activeThread.id.startsWith('dm-')
      ? supabase.from('inbox').delete().eq('item_type', 'message').or(
          `from_agent.eq.${activeThread.recipient},to_recipient.eq.${activeThread.recipient}`
        ).is('thread_id', null)
      : supabase.from('inbox').delete().eq('thread_id', activeThread.id)

    const { error } = await filter
    if (error) { showErrorToast(error); return }

    setThreads(prev => prev.filter(t => t.id !== activeThread.id))
    setActiveThread(null)
    setMessages([])
    setDeleteConfirm(false)
    setMobileShowConversation(false)
    showSuccessToast('Thread deleted')
  }

  /* ---- @mention handling ---- */

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setNewMessage(val)

    // Check for @ trigger
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
    const ta = inputRef.current
    if (!ta) return
    const cursor = ta.selectionStart || 0
    const textBefore = newMessage.slice(0, cursor)
    const textAfter = newMessage.slice(cursor)
    const atIdx = textBefore.lastIndexOf('@')
    const before = textBefore.slice(0, atIdx)
    const inserted = `@${name} `
    setNewMessage(before + inserted + textAfter)
    setShowMentions(false)

    // refocus
    setTimeout(() => {
      if (inputRef.current) {
        const pos = before.length + inserted.length
        inputRef.current.focus()
        inputRef.current.setSelectionRange(pos, pos)
      }
    }, 0)
  }

  /* ---- render helpers ---- */

  function renderMentions(text: string) {
    const parts = text.split(/(@\w+)/g)
    return parts.map((part, i) => {
      if (part.match(/^@\w+$/)) {
        return <span key={i} className="text-blue-400 font-semibold">{part}</span>
      }
      return <span key={i}>{part}</span>
    })
  }

  const unreadTotal = threads.reduce((sum, t) => sum + t.unreadCount, 0)

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4">
      {isOpen && (
        <div
          style={isMobile ? undefined : { width: size.w, height: size.h }}
          className="fixed inset-0 md:inset-auto md:relative bg-white dark:bg-slate-900 md:rounded-2xl shadow-2xl md:border border-slate-200 dark:border-slate-800 flex overflow-hidden md:mb-2 animate-in fade-in slide-in-from-bottom-4 duration-200 z-[101] md:z-auto"
        >
          {/* resize handle — top-left corner (hidden on mobile) */}
          <div
            onMouseDown={onResizeStart}
            className="hidden md:block absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-50 group"
            title="Drag to resize"
          >
            <div className="absolute top-1 left-1 w-2 h-2 border-t-2 border-l-2 border-slate-300 dark:border-slate-600 group-hover:border-blue-500 transition-colors rounded-tl" />
          </div>

          {/* ============================================================ */}
          {/*  LEFT SIDEBAR                                                */}
          {/* ============================================================ */}
          <div className={`w-full md:w-[250px] border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50 dark:bg-slate-950 md:flex-shrink-0 ${mobileShowConversation ? 'hidden md:flex' : 'flex'}`}>
            {/* sidebar header */}
            <div className="px-4 py-3 md:p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <span className="font-bold text-lg md:text-sm text-slate-700 dark:text-slate-200 tracking-tight">Messages</span>
              <div className="flex items-center gap-3 md:gap-1">
                <button
                  onClick={() => { setIsComposing(true); setActiveThread(null); setMessages([]); setMobileShowConversation(true) }}
                  className="w-8 h-8 md:w-7 md:h-7 rounded-lg bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-colors"
                  title="New Thread"
                >
                  <Plus className="w-5 h-5 md:w-4 md:h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 md:w-7 md:h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-500"
                >
                  <X className="w-5 h-5 md:w-4 md:h-4" />
                </button>
              </div>
            </div>

            {/* search */}
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg px-2.5 h-8 border border-slate-200 dark:border-slate-700">
                <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent outline-none text-sm w-full text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* thread list */}
            <ScrollShadow className="flex-1 overflow-y-auto">
              {filteredThreads.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No conversations</p>
                </div>
              ) : filteredThreads.map(t => {
                const active = activeThread?.id === t.id
                return (
                  <div
                    key={t.id}
                    onClick={() => { setActiveThread(t); setIsComposing(false); setMobileShowConversation(true) }}
                    className={`px-4 py-3.5 md:px-3 md:py-2.5 cursor-pointer transition-colors flex items-center gap-3 md:gap-2.5 ${
                      active
                        ? 'bg-blue-500 text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar
                        name={t.recipient}
                        size="sm"
                        className={`${active ? 'bg-white/20 text-white' : isAI(t.recipient) ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-blue-500 to-blue-600'} font-bold text-xs w-10 h-10 md:w-9 md:h-9`}
                      />
                      {isAI(t.recipient) && !active && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white dark:bg-slate-950 flex items-center justify-center">
                          <Bot className="w-2.5 h-2.5 text-violet-500" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className={`font-semibold text-base truncate ${active ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                          {t.subject || `Chat with ${cap(t.recipient)}`}
                        </span>
                        <div className="flex items-center gap-2 md:gap-1.5 flex-shrink-0 ml-1">
                          <span className={`text-xs md:text-[9px] ${active ? 'text-blue-100' : 'text-slate-400'}`}>
                            {new Date(t.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfirmDeleteThreadId(t.id)
                            }}
                            className={`${active ? 'text-blue-200 hover:text-white' : 'text-slate-300 hover:text-red-500'} transition-colors`}
                            title="Delete thread"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {confirmDeleteThreadId === t.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-red-500 font-semibold">Delete?</span>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              const filter = t.id.startsWith('dm-')
                                ? supabase.from('inbox').delete().eq('item_type', 'message').or(`from_agent.eq.${t.recipient},to_recipient.eq.${t.recipient}`).is('thread_id', null)
                                : supabase.from('inbox').delete().eq('thread_id', t.id)
                              const { error } = await filter
                              if (error) showErrorToast(error)
                              else {
                                setThreads(prev => prev.filter(th => th.id !== t.id))
                                if (activeThread?.id === t.id) { setActiveThread(null); setMessages([]) }
                              }
                              setConfirmDeleteThreadId(null)
                            }}
                            className="text-[10px] font-bold text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-md transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteThreadId(null) }}
                            className="text-[10px] text-slate-400 hover:text-slate-600 px-2 py-0.5 rounded-md transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1">
                            <p className={`text-[15px] truncate ${active ? 'text-blue-100' : 'text-slate-500'}`}>
                              {cap(t.recipient)}: {t.lastMessage}
                            </p>
                          </div>
                          {t.spaceId && (
                            <span className={`text-[9px] ${active ? 'text-blue-200' : 'text-violet-500'}`}>
                              📌 {spaces.find(s => s.id === t.spaceId)?.name || 'Space'}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    {t.unreadCount > 0 && (
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                        active ? 'bg-white text-blue-500' : 'bg-blue-500 text-white'
                      }`}>
                        {t.unreadCount}
                      </div>
                    )}
                  </div>
                )
              })}
            </ScrollShadow>
          </div>

          {/* ============================================================ */}
          {/*  RIGHT PANEL                                                 */}
          {/* ============================================================ */}
          <div className={`flex-1 flex flex-col min-w-0 ${mobileShowConversation ? 'flex' : 'hidden md:flex'}`}>
            {activeThread ? (
              <>
                {/* ---- header bar ---- */}
                <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 bg-white dark:bg-slate-900 flex-shrink-0">
                  {/* Mobile back button */}
                  <button
                    onClick={() => setMobileShowConversation(false)}
                    className="md:hidden w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-500 flex-shrink-0"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="flex-1 min-w-0">
                    {editingTitle ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={editTitleValue}
                          onChange={(e) => setEditTitleValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTitle()
                            if (e.key === 'Escape') setEditingTitle(false)
                          }}
                          onBlur={handleSaveTitle}
                          className="bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1 text-sm font-semibold outline-none focus:ring-2 ring-blue-500/40 w-full text-slate-800 dark:text-slate-100"
                        />
                      </div>
                    ) : (
                      <h3
                        className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate cursor-pointer hover:text-blue-500 transition-colors"
                        onClick={() => {
                          setEditTitleValue(activeThread.subject || `Chat with ${cap(activeThread.recipient)}`)
                          setEditingTitle(true)
                        }}
                        title="Click to edit title"
                      >
                        {activeThread.subject || `Chat with ${cap(activeThread.recipient)}`}
                      </h3>
                    )}
                    <p className="text-[10px] text-slate-400 truncate">
                      {activeThread.participants.length > 0
                        ? activeThread.participants.map(cap).join(', ')
                        : cap(activeThread.recipient)
                      }
                      {activeThread.spaceId && (
                        <> · 📌 {spaces.find(s => s.id === activeThread.spaceId)?.name || 'Space'}
                        {activeThread.projectId && (
                          <> / {projects.find(p => p.id === activeThread.projectId)?.name || 'Project'}</>
                        )}
                        </>
                      )}
                    </p>
                  </div>

                  {/* menu button */}
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setShowHeaderMenu(!showHeaderMenu)}
                      className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-500"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>

                    {showHeaderMenu && (
                      <div className="absolute right-0 top-9 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                        <button
                          onClick={() => {
                            setEditTitleValue(activeThread.subject || `Chat with ${cap(activeThread.recipient)}`)
                            setEditingTitle(true)
                            setShowHeaderMenu(false)
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
                        >
                          <Pencil className="w-4 h-4 text-slate-400" /> Edit Title
                        </button>
                        <button
                          onClick={() => { setShowMembersPanel(true); setShowHeaderMenu(false) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
                        >
                          <Users className="w-4 h-4 text-slate-400" /> Manage Members
                        </button>
                        <button
                          onClick={() => {
                            setAssignSpaceId(activeThread.spaceId || '')
                            setAssignProjectId(activeThread.projectId || '')
                            setShowAssignPanel(true)
                            setShowHeaderMenu(false)
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
                        >
                          <FolderOpen className="w-4 h-4 text-slate-400" /> Assign to Project
                        </button>
                        <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                        <button
                          onClick={() => { setDeleteConfirm(true); setShowHeaderMenu(false) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600"
                        >
                          <Trash2 className="w-4 h-4" /> Delete Thread
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ---- members panel (overlay) ---- */}
                {showMembersPanel && (
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Members</span>
                      <button onClick={() => setShowMembersPanel(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(activeThread.participants.length > 0 ? activeThread.participants : [activeThread.recipient]).map(p => (
                        <div key={p} className="inline-flex items-center gap-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 group">
                          {cap(p)}
                          {isAI(p) && <Bot className="w-3 h-3 text-violet-500" />}
                          {/* Show trash icon for non-primary recipients */}
                          {p !== activeThread.recipient && (
                            <button
                              onClick={() => setMemberToRemove(p)}
                              className="ml-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              title={`Remove ${cap(p)} from thread`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {/* Removal confirmation */}
                    {memberToRemove && (
                      <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-xs text-red-700 dark:text-red-300 mb-2">
                          Remove {cap(memberToRemove)} from this thread?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => removeMember(memberToRemove)}
                            className="flex-1 px-2 py-1 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                          >
                            Yes, remove
                          </button>
                          <button
                            onClick={() => setMemberToRemove(null)}
                            className="flex-1 px-2 py-1 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    <select
                      className="w-full h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 text-xs outline-none"
                      defaultValue=""
                      onChange={(e) => {
                        if (!e.target.value) return
                        const name = e.target.value
                        if (!activeThread.participants.includes(name)) {
                          const updated = { ...activeThread, participants: [...activeThread.participants, name] }
                          setActiveThread(updated)
                          setThreads(prev => prev.map(t => t.id === activeThread.id ? updated : t))
                        }
                        e.target.value = ''
                      }}
                    >
                      <option value="">Add member…</option>
                      {RECIPIENTS.filter(r => !activeThread.participants.includes(r.id)).map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* ---- assign to project panel (overlay) ---- */}
                {showAssignPanel && (
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Assign to Project</span>
                      <button onClick={() => setShowAssignPanel(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      <select
                        className="w-full h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 text-xs outline-none"
                        value={assignSpaceId}
                        onChange={(e) => { setAssignSpaceId(e.target.value); setAssignProjectId('') }}
                      >
                        <option value="">No space</option>
                        {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      {assignSpaceId && assignFilteredProjects.length > 0 && (
                        <select
                          className="w-full h-8 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 text-xs outline-none"
                          value={assignProjectId}
                          onChange={(e) => setAssignProjectId(e.target.value)}
                        >
                          <option value="">No project</option>
                          {assignFilteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      )}
                      <Button size="sm" color="primary" className="w-full" onPress={handleAssignProject}>
                        Save Assignment
                      </Button>
                    </div>
                  </div>
                )}

                {/* ---- message area ---- */}
                <ScrollShadow ref={scrollRef} className="flex-1 p-4 space-y-2 bg-slate-50 dark:bg-slate-950 overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-xs text-slate-400">Loading…</span>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-xs text-slate-400">No messages yet. Start the conversation.</span>
                    </div>
                  ) : messages.map((msg) => {
                    // isMe = sent by current user (not an AI reply)
                    const isMe = msg.user_id === user?.id && !msg.from_agent
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                          isMe
                            ? 'bg-blue-500 text-white rounded-br-md'
                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md border border-slate-100 dark:border-slate-700'
                        }`}>
                          {!isMe && (
                            <p className={`text-[10px] font-semibold mb-0.5 ${msg.from_agent ? 'text-violet-500' : 'text-blue-500'}`}>
                              {cap(msg.from_agent || activeThread?.recipient || 'Someone')}
                            </p>
                          )}
                          {editingMsgId === msg.id ? (
                            <div className="space-y-1.5">
                              <textarea
                                autoFocus
                                value={editingMsgText}
                                onChange={(e) => setEditingMsgText(e.target.value)}
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    if (!editingMsgText.trim()) return
                                    const { error } = await supabase.from('inbox').update({ content: editingMsgText.trim() }).eq('id', msg.id)
                                    if (error) showErrorToast(error)
                                    else setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: editingMsgText.trim() } : m))
                                    setEditingMsgId(null)
                                  }
                                  if (e.key === 'Escape') setEditingMsgId(null)
                                }}
                                className={`w-full text-sm rounded-lg px-2 py-1 resize-none outline-none ${
                                  isMe ? 'bg-blue-400 text-white placeholder:text-blue-200' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                                }`}
                                rows={2}
                              />
                              <div className="flex gap-1.5 text-[9px]">
                                <button onClick={async () => {
                                  if (!editingMsgText.trim()) return
                                  const { error } = await supabase.from('inbox').update({ content: editingMsgText.trim() }).eq('id', msg.id)
                                  if (error) showErrorToast(error)
                                  else setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: editingMsgText.trim() } : m))
                                  setEditingMsgId(null)
                                }} className={`font-semibold ${isMe ? 'text-white' : 'text-blue-500'}`}>Save</button>
                                <button onClick={() => setEditingMsgId(null)} className={`${isMe ? 'text-blue-200' : 'text-slate-400'}`}>Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <p className="leading-relaxed break-words">{renderMentions(msg.content)}</p>
                          )}
                          <div className={`flex items-center gap-1.5 mt-1`}>
                            <span className={`text-[9px] ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </span>
                            <button
                              onClick={() => { setEditingMsgId(msg.id); setEditingMsgText(msg.content) }}
                              className={`${isMe ? 'text-blue-200 hover:text-white' : 'text-slate-300 hover:text-blue-500'} transition-colors`}
                              title="Edit message"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                const { error } = await supabase.from('inbox').delete().eq('id', msg.id)
                                if (error) showErrorToast(error)
                                else setMessages(prev => prev.filter(m => m.id !== msg.id))
                              }}
                              className={`${isMe ? 'text-blue-200 hover:text-white' : 'text-slate-300 hover:text-red-500'} transition-colors`}
                              title="Delete message"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </ScrollShadow>

                {/* ---- input bar ---- */}
                <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex-shrink-0 relative">
                  {/* mention dropdown */}
                  {showMentions && mentionCandidates.length > 0 && (
                    <div className="absolute bottom-full left-3 right-3 mb-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-100">
                      {mentionCandidates.map(r => (
                        <button
                          key={r.id}
                          onMouseDown={(e) => { e.preventDefault(); insertMention(r.name) }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
                        >
                          <Avatar name={r.name} className={`${isAI(r.id) ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-blue-500 to-blue-600'} w-6 h-6 text-[10px] text-white`} />
                          <span className="font-medium">{r.name}</span>
                          <span className="text-xs text-slate-400 ml-auto">{r.type}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 items-end">
                    <textarea
                      ref={inputRef}
                      placeholder="Message…"
                      rows={1}
                      value={newMessage}
                      onChange={handleInputChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          if (showMentions && mentionCandidates.length > 0) {
                            insertMention(mentionCandidates[0].name)
                          } else {
                            handleSend()
                          }
                        }
                        if (e.key === 'Escape') setShowMentions(false)
                      }}
                      className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-2 text-sm outline-none resize-none max-h-24 min-h-[36px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 ring-blue-500/30 transition-shadow"
                      style={{ fieldSizing: 'content' } as React.CSSProperties}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!newMessage.trim()}
                      className="w-9 h-9 rounded-full bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white flex items-center justify-center transition-colors flex-shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : isComposing ? (
              /* ---- compose new thread ---- */
              <div className="flex flex-col h-full">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => { setMobileShowConversation(false); setIsComposing(false) }}
                    className="md:hidden w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors text-slate-500 flex-shrink-0"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">New Conversation</h3>
                </div>
                <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-slate-50 dark:bg-slate-950">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Recipient</label>
                    <select
                      className="w-full h-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 text-sm outline-none focus:ring-2 ring-blue-500/30 transition-shadow text-slate-800 dark:text-slate-100"
                      value={newRecipient}
                      onChange={(e) => setNewRecipient(e.target.value)}
                    >
                      <option value="">Select recipient…</option>
                      {RECIPIENTS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Subject</label>
                    <input
                      type="text"
                      placeholder="e.g. Website Refactor"
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      className="w-full h-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 text-sm outline-none focus:ring-2 ring-blue-500/30 transition-shadow text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Space</label>
                    <select
                      className="w-full h-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 text-sm outline-none focus:ring-2 ring-blue-500/30 transition-shadow text-slate-800 dark:text-slate-100"
                      value={composeSpaceId}
                      onChange={(e) => { setComposeSpaceId(e.target.value); setComposeProjectId('') }}
                    >
                      <option value="">None</option>
                      {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  {composeSpaceId && filteredProjects.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Project</label>
                      <select
                        className="w-full h-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 text-sm outline-none focus:ring-2 ring-blue-500/30 transition-shadow text-slate-800 dark:text-slate-100"
                        value={composeProjectId}
                        onChange={(e) => setComposeProjectId(e.target.value)}
                      >
                        <option value="">None</option>
                        {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Message</label>
                    <textarea
                      placeholder="Start the conversation…"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      rows={4}
                      className="w-full rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none resize-none focus:ring-2 ring-blue-500/30 transition-shadow text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    onClick={handleStartNewChat}
                    disabled={!newRecipient || !newMessage.trim()}
                    className="w-full h-10 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-semibold text-sm transition-colors"
                  >
                    Create Thread
                  </button>
                </div>
              </div>
            ) : (
              /* ---- empty state ---- */
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-950">
                <MessageCircle className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">Select a conversation</p>
                <p className="text-xs mt-1">or start a new one</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal isOpen={deleteConfirm} onClose={() => setDeleteConfirm(false)} size="sm">
        <ModalContent>
          <ModalHeader>Delete Thread</ModalHeader>
          <ModalBody>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This will permanently delete all messages in this thread. This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setDeleteConfirm(false)}>Cancel</Button>
            <Button color="danger" onPress={handleDeleteThread}>Delete</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-violet-600 hover:bg-violet-700 active:scale-95 rounded-full shadow-2xl flex items-center justify-center text-white relative transition-all border-4 border-white dark:border-slate-800"
      >
        <MessageCircle className={`w-7 h-7 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
        {unreadTotal > 0 && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold min-w-6 h-6 px-1 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 animate-pulse shadow-lg">
            {unreadTotal}
          </div>
        )}
      </button>
    </div>
  )
}
