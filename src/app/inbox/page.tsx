'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { 
  Button, 
  Card, 
  CardBody,
  CardHeader,
  Input,
  Spinner,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Select,
  SelectItem,
  Textarea,
  Divider,
  Avatar,
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { 
  Check, Trash2, Calendar, FolderOpen, Send, Bot, ArrowRight, 
  Inbox as InboxIcon, MessageCircle, Plus, X, ChevronDown, ChevronRight,
  User, Users
} from 'lucide-react'

interface InboxItem {
  id: string
  content: string
  item_type: 'thought' | 'message' | 'task_draft'
  from_agent: string | null
  to_recipient: string | null
  cc_recipients: string[] | null
  subject: string | null
  thread_id: string | null
  status: 'pending' | 'processed' | 'archived'
  processed_to: string | null
  processed_to_id: string | null
  created_at: string
}

interface Thread {
  id: string
  recipient: string
  subject: string | null
  messages: InboxItem[]
  lastMessage: InboxItem
}

interface UserData {
  id: string
  email: string
  name?: string
}

// Recipients configuration
const RECIPIENTS = [
  { id: 'ax', name: 'Ax', type: 'ai', icon: 'bot', color: 'violet' },
  { id: 'tony', name: 'Tony', type: 'ai', icon: 'bot', color: 'blue' },
  { id: 'mom', name: 'Mom', type: 'family', icon: 'user', color: 'pink' },
]

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserData | null>(null)
  const [newThought, setNewThought] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [projects, setProjects] = useState<any[]>([])
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set())
  
  // Compose form state
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeTo, setComposeTo] = useState('')
  const [composeCC, setComposeCC] = useState<string[]>([])
  const [composeSubject, setComposeSubject] = useState('')
  const [composeMessage, setComposeMessage] = useState('')
  const [showCCField, setShowCCField] = useState(false)
  
  const { isOpen: isScheduleOpen, onOpen: onScheduleOpen, onClose: onScheduleClose } = useDisclosure()
  const { isOpen: isProjectOpen, onOpen: onProjectOpen, onClose: onProjectClose } = useDisclosure()
  
  const thoughtInputRef = useRef<HTMLInputElement>(null)
  const messageInputRef = useRef<HTMLTextAreaElement>(null)
  
  const supabase = createClient()

  // Group items into threads
  const { threads, thoughts } = useMemo(() => {
    const messageItems = items.filter(i => i.item_type === 'message' && (i.to_recipient || i.from_agent))
    const thoughtItems = items.filter(i => i.item_type === 'thought' || (i.item_type === 'message' && !i.to_recipient && !i.from_agent))
    
    // Group by thread_id or create pseudo-threads by recipient
    const threadMap = new Map<string, InboxItem[]>()
    
    messageItems.forEach(item => {
      const threadKey = item.thread_id || item.to_recipient || item.from_agent || 'unknown'
      if (!threadMap.has(threadKey)) {
        threadMap.set(threadKey, [])
      }
      threadMap.get(threadKey)!.push(item)
    })
    
    // Convert to thread objects
    const threadList: Thread[] = []
    threadMap.forEach((messages, key) => {
      // Sort messages by date (oldest first within thread)
      messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const lastMsg = messages[messages.length - 1]
      
      threadList.push({
        id: key,
        recipient: lastMsg.to_recipient || lastMsg.from_agent || 'Unknown',
        subject: lastMsg.subject,
        messages,
        lastMessage: lastMsg,
      })
    })
    
    // Sort threads by most recent message
    threadList.sort((a, b) => 
      new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    )
    
    return { threads: threadList, thoughts: thoughtItems }
  }, [items])

  // Load user and inbox items
  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
          window.location.href = '/login'
          return
        }

        const { data: userData } = await supabase
          .from('users')
          .select('id, email, name')
          .eq('id', authUser.id)
          .single()

        setUser(userData)

        // Load pending inbox items
        const { data: inboxData, error } = await supabase
          .from('inbox')
          .select('*')
          .eq('user_id', authUser.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        if (error) throw error
        setItems(inboxData || [])

        // Load projects
        const { data: projectsData } = await supabase.from('projects').select('id, name')
        setProjects(projectsData || [])
      } catch (error) {
        console.error('Error loading inbox:', error)
        showErrorToast('Failed to load inbox')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase])

  // Add quick thought (no recipient)
  const handleAddThought = async () => {
    if (!newThought.trim() || !user) return

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('inbox')
        .insert({
          user_id: user.id,
          content: newThought.trim(),
          item_type: 'thought',
          status: 'pending',
        })
        .select()
        .single()

      if (error) throw error

      setItems([data, ...items])
      setNewThought('')
      thoughtInputRef.current?.focus()
    } catch (error) {
      console.error('Error adding thought:', error)
      showErrorToast('Failed to add thought')
    } finally {
      setSubmitting(false)
    }
  }

  // Send message to recipient
  const handleSendMessage = async () => {
    if (!composeTo || !composeMessage.trim() || !user) return
    
    setSubmitting(true)
    try {
      const recipient = RECIPIENTS.find(r => r.id === composeTo)
      const threadId = `${user.id}-${composeTo}-${Date.now()}`
      
      // Save to inbox
      const { data, error: dbError } = await supabase
        .from('inbox')
        .insert({
          user_id: user.id,
          content: composeMessage.trim(),
          item_type: 'message',
          to_recipient: composeTo,
          cc_recipients: composeCC.length > 0 ? composeCC : null,
          subject: composeSubject.trim() || null,
          thread_id: threadId,
          status: 'pending',
        })
        .select()
        .single()

      if (dbError) throw dbError

      // Try to notify AI agents
      if (recipient?.type === 'ai') {
        try {
          const response = await fetch('/api/inbox/message-agent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agent: composeTo,
              message: composeMessage.trim(),
              sender: user.name || user.email
            })
          })
          if (!response.ok) console.warn('Failed to notify agent')
        } catch (webhookErr) {
          console.error('Webhook error:', webhookErr)
        }
      }

      setItems([data, ...items])
      showSuccessToast(`Message sent to ${recipient?.name || composeTo}`)
      
      // Reset compose form
      setComposeTo('')
      setComposeCC([])
      setComposeSubject('')
      setComposeMessage('')
      setShowCCField(false)
      setComposeOpen(false)
    } catch (error) {
      console.error('Error sending message:', error)
      showErrorToast('Failed to send message')
    } finally {
      setSubmitting(false)
    }
  }

  const handleScheduleLater = async () => {
    if (!selectedItem || !scheduleDate || !user) return
    setSubmitting(true)
    try {
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: selectedItem.content,
          status: 'todo',
          priority: 'medium',
          due_date: scheduleDate,
          created_by: user.id,
        })
        .select()
        .single()

      if (taskError) throw taskError

      await supabase
        .from('inbox')
        .update({
          status: 'processed',
          processed_to: 'task',
          processed_to_id: taskData.id,
        })
        .eq('id', selectedItem.id)

      setItems(items.filter(i => i.id !== selectedItem.id))
      showSuccessToast(`Scheduled for ${scheduleDate}`)
      onScheduleClose()
    } catch (error) {
      console.error('Error scheduling:', error)
      showErrorToast('Failed to schedule')
    } finally {
      setSubmitting(false)
    }
  }

  const handleMoveToProject = async () => {
    if (!selectedItem || !selectedProject || !user) return
    setSubmitting(true)
    try {
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: selectedItem.content,
          status: 'todo',
          priority: 'medium',
          project_id: selectedProject,
          created_by: user.id,
        })
        .select()
        .single()

      if (taskError) throw taskError

      await supabase
        .from('inbox')
        .update({
          status: 'processed',
          processed_to: 'task',
          processed_to_id: taskData.id,
        })
        .eq('id', selectedItem.id)

      const projectName = projects.find(p => p.id === selectedProject)?.name || 'Project'
      setItems(items.filter(i => i.id !== selectedItem.id))
      showSuccessToast(`Moved to ${projectName}`)
      onProjectClose()
    } catch (error) {
      console.error('Error moving to project:', error)
      showErrorToast('Failed to move to project')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToTask = async (item: InboxItem) => {
    if (!user) return
    try {
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: item.content,
          status: 'todo',
          priority: 'medium',
          created_by: user.id,
        })
        .select()
        .single()

      if (taskError) throw taskError

      await supabase
        .from('inbox')
        .update({
          status: 'processed',
          processed_to: 'task',
          processed_to_id: taskData.id,
        })
        .eq('id', item.id)

      setItems(items.filter(i => i.id !== item.id))
      showSuccessToast('Added to tasks')
    } catch (error) {
      console.error('Error creating task:', error)
      showErrorToast('Failed to create task')
    }
  }

  const handleToday = async (item: InboxItem) => {
    if (!user) return
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: item.content,
          status: 'todo',
          priority: 'high',
          due_date: today,
          created_by: user.id,
        })
        .select()
        .single()

      if (taskError) throw taskError

      await supabase
        .from('inbox')
        .update({
          status: 'processed',
          processed_to: 'task',
          processed_to_id: taskData.id,
        })
        .eq('id', item.id)

      setItems(items.filter(i => i.id !== item.id))
      showSuccessToast('Added to today')
    } catch (error) {
      console.error('Error creating task:', error)
      showErrorToast('Failed to add to today')
    }
  }

  const handleDelete = async (item: InboxItem) => {
    try {
      const { error } = await supabase
        .from('inbox')
        .delete()
        .eq('id', item.id)

      if (error) throw error
      setItems(items.filter(i => i.id !== item.id))
    } catch (error) {
      console.error('Error deleting item:', error)
      showErrorToast('Failed to delete')
    }
  }

  const handleArchiveThread = async (thread: Thread) => {
    try {
      const ids = thread.messages.map(m => m.id)
      const { error } = await supabase
        .from('inbox')
        .update({ status: 'archived' })
        .in('id', ids)

      if (error) throw error
      setItems(items.filter(i => !ids.includes(i.id)))
      showSuccessToast('Thread archived')
    } catch (error) {
      console.error('Error archiving thread:', error)
      showErrorToast('Failed to archive')
    }
  }

  const toggleThread = (threadId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev)
      if (next.has(threadId)) {
        next.delete(threadId)
      } else {
        next.add(threadId)
      }
      return next
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAddThought()
    }
  }

  const handleMessageKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'yesterday'
    return `${diffDays}d ago`
  }

  const getRecipientInfo = (id: string) => {
    return RECIPIENTS.find(r => r.id === id) || { name: id, avatar: '👤', color: 'default' }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  const totalItems = items.length

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar user={user} />
      
      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center">
                <InboxIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
                <p className="text-sm text-default-500">
                  {totalItems === 0 ? 'All clear!' : `${totalItems} item${totalItems !== 1 ? 's' : ''} to process`}
                </p>
              </div>
            </div>
            <Button 
              color="primary" 
              onPress={() => setComposeOpen(true)}
              startContent={<MessageCircle className="w-4 h-4" />}
            >
              New Message
            </Button>
          </div>
        </div>

        {/* Compose Card - Email Style */}
        {composeOpen && (
          <Card className="mb-6 shadow-md border-2 border-primary-200 dark:border-primary-800">
            <CardHeader className="pb-2 flex justify-between items-center">
              <span className="font-semibold text-lg">New Message</span>
              <Button
                isIconOnly
                variant="light"
                size="sm"
                onPress={() => setComposeOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="space-y-3">
                {/* To Field */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-default-500 w-12">To:</span>
                  <Select
                    placeholder="Select recipient"
                    selectedKeys={composeTo ? [composeTo] : []}
                    onChange={(e) => setComposeTo(e.target.value)}
                    className="flex-1"
                    size="sm"
                    classNames={{
                      trigger: "shadow-none bg-default-100",
                    }}
                  >
                    {RECIPIENTS.map(r => (
                      <SelectItem key={r.id} textValue={r.name}>
                        <div className="flex items-center gap-2">
                          {r.type === 'ai' ? <Bot className="w-4 h-4 text-violet-500" /> : <User className="w-4 h-4 text-pink-500" />}
                          <span>{r.name}</span>
                          <Chip size="sm" variant="flat" color={r.type === 'ai' ? 'secondary' : 'default'}>
                            {r.type === 'ai' ? 'AI' : 'Family'}
                          </Chip>
                        </div>
                      </SelectItem>
                    ))}
                  </Select>
                  {!showCCField && (
                    <Button
                      variant="light"
                      size="sm"
                      onPress={() => setShowCCField(true)}
                      startContent={<Plus className="w-3 h-3" />}
                    >
                      CC
                    </Button>
                  )}
                </div>

                {/* CC Field */}
                {showCCField && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-default-500 w-12">CC:</span>
                    <Select
                      placeholder="Add CC recipients"
                      selectionMode="multiple"
                      selectedKeys={new Set(composeCC)}
                      onSelectionChange={(keys) => setComposeCC(Array.from(keys) as string[])}
                      className="flex-1"
                      size="sm"
                      classNames={{
                        trigger: "shadow-none bg-default-100",
                      }}
                    >
                      {RECIPIENTS.filter(r => r.id !== composeTo).map(r => (
                        <SelectItem key={r.id} textValue={r.name}>
                          <div className="flex items-center gap-2">
                            {r.type === 'ai' ? <Bot className="w-4 h-4 text-violet-500" /> : <User className="w-4 h-4 text-pink-500" />}
                            <span>{r.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </Select>
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      onPress={() => {
                        setShowCCField(false)
                        setComposeCC([])
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}

                {/* Subject Field (Optional) */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-default-500 w-12">Re:</span>
                  <Input
                    placeholder="Subject (optional)"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    size="sm"
                    classNames={{
                      inputWrapper: "shadow-none bg-default-100",
                    }}
                  />
                </div>

                <Divider />

                {/* Message Body */}
                <Textarea
                  ref={messageInputRef}
                  placeholder="Write your message... (⌘+Enter to send)"
                  value={composeMessage}
                  onChange={(e) => setComposeMessage(e.target.value)}
                  onKeyDown={handleMessageKeyDown}
                  minRows={3}
                  maxRows={8}
                  classNames={{
                    inputWrapper: "shadow-none bg-default-100",
                  }}
                />

                {/* Send Button */}
                <div className="flex justify-end">
                  <Button
                    color="primary"
                    onPress={handleSendMessage}
                    isLoading={submitting}
                    isDisabled={!composeTo || !composeMessage.trim()}
                    startContent={<Send className="w-4 h-4" />}
                  >
                    Send Message
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Quick Capture for Thoughts */}
        <Card className="mb-6 shadow-sm">
          <CardBody className="p-3">
            <div className="flex gap-2">
              <Input
                ref={thoughtInputRef}
                placeholder="Quick thought... (no recipient = goes to inbox)"
                value={newThought}
                onChange={(e) => setNewThought(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={submitting}
                classNames={{
                  input: "text-base",
                  inputWrapper: "shadow-none bg-default-100",
                }}
                startContent={<InboxIcon className="w-4 h-4 text-default-400" />}
              />
              <Button
                isIconOnly
                color="default"
                variant="flat"
                onPress={handleAddThought}
                isLoading={submitting}
                isDisabled={!newThought.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Inbox Zero State */}
        {totalItems === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Inbox Zero!</h2>
            <p className="text-default-500">
              Your mind is clear. Capture thoughts or send a message above.
            </p>
          </div>
        )}

        {/* Message Threads Section */}
        {threads.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-4 h-4 text-default-500" />
              <h2 className="font-semibold text-default-700">Message Threads</h2>
              <Chip size="sm" variant="flat">{threads.length}</Chip>
            </div>
            <div className="space-y-3">
              {threads.map((thread) => {
                const recipient = getRecipientInfo(thread.recipient)
                const isExpanded = expandedThreads.has(thread.id)
                const hasMultiple = thread.messages.length > 1
                
                return (
                  <Card key={thread.id} className="shadow-sm hover:shadow-md transition-shadow">
                    <CardBody className="p-4">
                      {/* Thread Header */}
                      <div 
                        className="flex items-start justify-between gap-4 cursor-pointer"
                        onClick={() => hasMultiple && toggleThread(thread.id)}
                      >
                        <div className="flex items-center gap-3">
                          {hasMultiple && (
                            <div className="w-4">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-default-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-default-400" />
                              )}
                            </div>
                          )}
                          <div className="w-8 h-8 rounded-full bg-default-100 flex items-center justify-center">
                            {recipient?.type === 'ai' ? <Bot className="w-4 h-4 text-violet-500" /> : <User className="w-4 h-4 text-pink-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">To: {recipient.name}</span>
                              {thread.subject && (
                                <span className="text-default-500 text-sm">• {thread.subject}</span>
                              )}
                              {hasMultiple && (
                                <Chip size="sm" variant="flat" color="default">
                                  {thread.messages.length} messages
                                </Chip>
                              )}
                            </div>
                            <p className="text-foreground text-sm line-clamp-2">
                              {thread.lastMessage.content}
                            </p>
                            <p className="text-xs text-default-400 mt-1">
                              {formatTime(thread.lastMessage.created_at)}
                            </p>
                          </div>
                        </div>

                        {/* Thread Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="light"
                            isIconOnly
                            onPress={(e) => {
                              e.stopPropagation()
                              handleArchiveThread(thread)
                            }}
                            className="text-default-400 hover:text-success"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="light"
                            isIconOnly
                            onPress={(e) => {
                              e.stopPropagation()
                              handleDelete(thread.lastMessage)
                            }}
                            className="text-default-400 hover:text-danger"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Expanded Messages */}
                      {isExpanded && hasMultiple && (
                        <div className="mt-4 ml-7 pl-4 border-l-2 border-default-200 space-y-3">
                          {thread.messages.map((msg, idx) => (
                            <div key={msg.id} className="text-sm">
                              <div className="flex items-center gap-2 mb-1">
                                {msg.from_agent ? (
                                  <Bot className="w-3 h-3 text-violet-500" />
                                ) : (
                                  <User className="w-3 h-3 text-default-400" />
                                )}
                                <span className="text-default-500 text-xs">
                                  {msg.from_agent ? `From ${msg.from_agent}` : 'You'}
                                </span>
                                <span className="text-default-400 text-xs">
                                  {formatTime(msg.created_at)}
                                </span>
                              </div>
                              <p className="text-foreground">{msg.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Thoughts Section */}
        {thoughts.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <InboxIcon className="w-4 h-4 text-default-500" />
              <h2 className="font-semibold text-default-700">Thoughts to Process</h2>
              <Chip size="sm" variant="flat">{thoughts.length}</Chip>
            </div>
            <div className="space-y-3">
              {thoughts.map((item) => (
                <Card key={item.id} className="shadow-sm hover:shadow-md transition-shadow">
                  <CardBody className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {item.from_agent && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <Bot className="w-3.5 h-3.5 text-violet-500" />
                            <span className="text-xs font-medium text-violet-500 capitalize">
                              {item.from_agent}
                            </span>
                          </div>
                        )}
                        <p className="text-foreground">{item.content}</p>
                        <p className="text-xs text-default-400 mt-2">
                          {formatTime(item.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="flat"
                          color="success"
                          onPress={() => handleToday(item)}
                          className="min-w-0 px-3"
                        >
                          Today
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          color="secondary"
                          isIconOnly
                          onPress={() => {
                            setSelectedItem(item)
                            onScheduleOpen()
                          }}
                        >
                          <Calendar className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          isIconOnly
                          onPress={() => {
                            setSelectedItem(item)
                            onProjectOpen()
                          }}
                        >
                          <FolderOpen className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => handleToTask(item)}
                          startContent={<ArrowRight className="w-3.5 h-3.5" />}
                          className="min-w-0 px-3"
                        >
                          Task
                        </Button>
                        <Button
                          size="sm"
                          variant="light"
                          isIconOnly
                          onPress={() => handleDelete(item)}
                          className="text-default-400 hover:text-danger"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Schedule Later Modal */}
      <Modal isOpen={isScheduleOpen} onClose={onScheduleClose}>
        <ModalContent>
          <ModalHeader>Schedule for Later</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-default-500 italic">"{selectedItem?.content}"</p>
              <Input
                label="Select Date"
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onScheduleClose}>Cancel</Button>
            <Button 
              color="primary" 
              onPress={handleScheduleLater}
              isLoading={submitting}
              isDisabled={!scheduleDate}
            >
              Schedule
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Move to Project Modal */}
      <Modal isOpen={isProjectOpen} onClose={onProjectClose}>
        <ModalContent>
          <ModalHeader>Move to Project</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-default-500 italic">"{selectedItem?.content}"</p>
              <Select
                label="Select Project"
                placeholder="Choose a project"
                selectedKeys={selectedProject ? [selectedProject] : []}
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                {projects.map(p => (
                  <SelectItem key={p.id}>{p.name}</SelectItem>
                ))}
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onProjectClose}>Cancel</Button>
            <Button 
              color="primary" 
              onPress={handleMoveToProject}
              isLoading={submitting}
              isDisabled={!selectedProject}
            >
              Move to Project
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
