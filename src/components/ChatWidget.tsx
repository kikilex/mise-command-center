'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { 
  Button, 
  Card, 
  CardBody,
  Input,
  ScrollShadow,
  Avatar,
  Badge,
  Textarea
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, X, Send, ArrowLeft, Bot, User, Briefcase, Plus } from 'lucide-react'
import { showErrorToast } from '@/lib/errors'

interface ChatMessage {
  id: string
  content: string
  from_agent: string | null
  to_recipient: string | null
  thread_id: string | null
  subject: string | null
  created_at: string
}

interface ChatThread {
  id: string // thread_id or computed id
  recipient: string
  subject: string | null
  lastMessage: string
  timestamp: string
  unreadCount: number
}

// Recipients configuration
const RECIPIENTS = [
  { id: 'ax', name: 'Ax' },
  { id: 'tony', name: 'Tony' },
  { id: 'mom', name: 'Mom' },
]

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeThread, setActiveThread] = useState<ChatThread | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const [newRecipient, setNewRecipient] = useState('')
  const [newSubject, setNewSubject] = useState('')
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    loadInitialData()
    
    // Global subscription for new messages
    const channel = supabase
      .channel('chat-widget')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inbox' }, (payload) => {
        handleIncomingMessage(payload.new as any)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    if (activeThread) loadMessages(activeThread.id)
  }, [activeThread?.id])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  async function loadInitialData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUser(user)
    loadThreads(user.id)
  }

  async function loadThreads(userId: string) {
    const { data } = await supabase
      .from('inbox')
      .select('*')
      .eq('item_type', 'message')
      .order('created_at', { ascending: false })

    if (!data) return

    const threadMap = new Map<string, ChatThread>()
    data.forEach(msg => {
      // Use thread_id as the primary key. 
      // Fallback to a recipient-based key ONLY if no thread_id exists (legacy or direct message)
      const partner = msg.from_agent || msg.to_recipient || 'unknown'
      const id = msg.thread_id || `dm-${partner}`
      
      if (!threadMap.has(id)) {
        threadMap.set(id, {
          id,
          recipient: partner,
          subject: msg.subject,
          lastMessage: msg.content,
          timestamp: msg.created_at,
          unreadCount: 0 
        })
      }
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
    setLoading(false)
  }

  function handleIncomingMessage(msg: any) {
    if (msg.item_type !== 'message') return
    const partner = msg.from_agent || msg.to_recipient
    const threadId = msg.thread_id || `dm-${partner}`
    
    // Update threads
    setThreads(prev => {
      const filtered = prev.filter(t => t.id !== threadId)
      return [{
        id: threadId,
        recipient: partner,
        subject: msg.subject,
        lastMessage: msg.content,
        timestamp: msg.created_at,
        unreadCount: (isOpen && activeThread?.id === threadId) ? 0 : 1
      }, ...filtered]
    })

    // Update active chat
    if (activeThread?.id === threadId) {
      setMessages(prev => [...prev, msg])
    }
  }

  async function handleSend() {
    if (!newMessage.trim() || !activeThread || !user) return
    const content = newMessage.trim()
    setNewMessage('')

    // Use existing thread_id if available (not a dummy dm- id)
    const threadId = activeThread.id.startsWith('dm-') ? null : activeThread.id

    const { data, error } = await supabase
      .from('inbox')
      .insert({
        user_id: user.id,
        content: content,
        item_type: 'message',
        to_recipient: activeThread.recipient,
        thread_id: threadId,
        subject: activeThread.subject,
        status: 'pending'
      })
      .select().single()

    if (error) showErrorToast(error)
    else setMessages(prev => [...prev, data])
  }

  async function handleStartNewChat() {
    if (!newRecipient || !newMessage.trim() || !user) return
    const content = newMessage.trim()
    
    // Generate a unique thread ID
    const threadId = `thread-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const { data, error } = await supabase
      .from('inbox')
      .insert({
        user_id: user.id,
        content: content,
        item_type: 'message',
        to_recipient: newRecipient,
        thread_id: threadId,
        subject: newSubject.trim() || null,
        status: 'pending'
      })
      .select().single()

    if (error) {
      showErrorToast(error)
      return
    }

    const newThread = {
      id: threadId,
      recipient: newRecipient,
      subject: newSubject.trim() || null,
      lastMessage: content,
      timestamp: data.created_at,
      unreadCount: 0
    }

    setThreads([newThread, ...threads])
    setActiveThread(newThread)
    setIsComposing(false)
    setNewRecipient('')
    setNewSubject('')
    setNewMessage('')
  }

  const unreadTotal = threads.reduce((sum, t) => sum + t.unreadCount, 0)

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4">
        {isOpen && (
          <div
            className="w-[350px] h-[500px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden mb-2 animate-in fade-in slide-in-from-bottom-4 duration-200"
          >
            {/* Header */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {activeThread ? (
                <div className="flex items-center gap-3 min-w-0">
                  <Button isIconOnly variant="light" size="sm" radius="full" onPress={() => setActiveThread(null)}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Avatar name={activeThread.recipient} size="sm" className="bg-gradient-to-br from-violet-500 to-purple-600" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-black uppercase tracking-tighter text-xs truncate">{activeThread.recipient}</span>
                    {activeThread.subject && <span className="text-[10px] text-slate-500 truncate">{activeThread.subject}</span>}
                  </div>
                </div>
              ) : isComposing ? (
                <div className="flex items-center gap-3">
                   <Button isIconOnly variant="light" size="sm" radius="full" onPress={() => setIsComposing(false)}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <span className="font-black uppercase tracking-widest text-[10px] text-slate-400">New Hit</span>
                </div>
              ) : (
                <span className="font-black uppercase tracking-widest text-[10px] text-slate-400">Intelligence Hub</span>
              )}
              
              {!activeThread && !isComposing && (
                <Button isIconOnly variant="flat" color="primary" size="sm" radius="full" onPress={() => setIsComposing(true)}>
                  <Plus className="w-4 h-4" />
                </Button>
              )}
              
              <Button isIconOnly variant="light" size="sm" radius="full" onPress={() => setIsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {activeThread ? (
                <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
                  <ScrollShadow ref={scrollRef} className="flex-1 p-4 space-y-3">
                    {messages.map((msg) => {
                      const isMe = !msg.from_agent
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                            isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-700'
                          }`}>
                            <p className="leading-tight">{msg.content}</p>
                          </div>
                        </div>
                      )
                    })}
                  </ScrollShadow>
                  <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex gap-2 items-end">
                    <Textarea 
                      placeholder="Send message..."
                      minRows={1} maxRows={4}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                      classNames={{ inputWrapper: "bg-slate-50 dark:bg-slate-800 border-none shadow-none" }}
                    />
                    <Button isIconOnly color="primary" radius="full" className="min-w-10 h-10" onPress={handleSend}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : isComposing ? (
                <div className="p-4 space-y-4 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
                   <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Recipient</label>
                    <select 
                      className="w-full h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 text-sm outline-none focus:ring-2 ring-primary/20 transition-all"
                      value={newRecipient}
                      onChange={(e) => setNewRecipient(e.target.value)}
                    >
                      <option value="">Select partner...</option>
                      {RECIPIENTS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Subject / Project</label>
                    <Input 
                      placeholder="e.g. Website Refactor"
                      value={newSubject}
                      onValueChange={setNewSubject}
                      classNames={{ inputWrapper: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-none h-10" }}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Initial Message</label>
                    <Textarea 
                      placeholder="Start the conversation..."
                      value={newMessage}
                      onValueChange={setNewMessage}
                      minRows={4}
                      classNames={{ inputWrapper: "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-none" }}
                    />
                  </div>
                  <Button 
                    color="primary" 
                    className="w-full font-black uppercase tracking-widest h-12 rounded-2xl" 
                    onPress={handleStartNewChat}
                    isLoading={submitting}
                    isDisabled={!newRecipient || !newMessage.trim()}
                  >
                    Launch Thread
                  </Button>
                </div>
              ) : (
                <ScrollShadow className="h-full divide-y divide-slate-50 dark:divide-slate-800">
                  {threads.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                      <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="text-xs font-bold uppercase tracking-widest leading-none">No active intel</p>
                    </div>
                  ) : threads.map(t => (
                    <div 
                      key={t.id} 
                      onClick={() => setActiveThread(t)}
                      className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-3"
                    >
                      <Avatar name={t.recipient} size="sm" className="bg-gradient-to-br from-violet-500 to-purple-600 font-black" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-sm uppercase tracking-tighter truncate">{t.recipient}</span>
                            {t.subject && <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded uppercase font-black tracking-tighter truncate">{t.subject}</span>}
                          </div>
                          <span className="text-[9px] text-slate-400 uppercase flex-shrink-0">{new Date(t.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{t.lastMessage}</p>
                      </div>
                      {t.unreadCount > 0 && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                  ))}
                </ScrollShadow>
              )}
            </div>
          </div>
        )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-violet-600 hover:bg-violet-700 active:scale-95 rounded-full shadow-2xl flex items-center justify-center text-white relative transition-all border-4 border-white dark:border-slate-800"
      >
        <MessageCircle className={`w-7 h-7 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
        {unreadTotal > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800">
            {unreadTotal}
          </div>
        )}
      </button>
    </div>
  )
}
