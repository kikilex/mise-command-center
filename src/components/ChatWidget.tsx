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
import { MessageCircle, X, Send, ArrowLeft, Bot, User, Briefcase } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface ChatMessage {
  id: string
  content: string
  from_agent: string | null
  to_recipient: string | null
  thread_id: string | null
  created_at: string
}

interface ChatThread {
  id: string
  recipient: string
  lastMessage: string
  timestamp: string
  unreadCount: number
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  
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
    if (activeThread) loadMessages(activeThread)
  }, [activeThread])

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
      const partner = msg.from_agent || msg.to_recipient || 'unknown'
      if (!threadMap.has(partner)) {
        threadMap.set(partner, {
          id: partner,
          recipient: partner,
          lastMessage: msg.content,
          timestamp: msg.created_at,
          unreadCount: 0 // Logic for unread would go here
        })
      }
    })
    setThreads(Array.from(threadMap.values()))
  }

  async function loadMessages(partner: string) {
    setLoading(true)
    const { data } = await supabase
      .from('inbox')
      .select('*')
      .eq('item_type', 'message')
      .or(`from_agent.eq.${partner},to_recipient.eq.${partner}`)
      .order('created_at', { ascending: true })
    
    setMessages(data || [])
    setLoading(false)
  }

  function handleIncomingMessage(msg: any) {
    if (msg.item_type !== 'message') return
    const partner = msg.from_agent || msg.to_recipient
    
    // Update threads
    setThreads(prev => {
      const filtered = prev.filter(t => t.id !== partner)
      return [{
        id: partner,
        recipient: partner,
        lastMessage: msg.content,
        timestamp: msg.created_at,
        unreadCount: isOpen ? 0 : 1 // Simple increment
      }, ...filtered]
    })

    // Update active chat
    if (activeThread === partner) {
      setMessages(prev => [...prev, msg])
    }
  }

  async function handleSend() {
    if (!newMessage.trim() || !activeThread || !user) return
    const content = newMessage.trim()
    setNewMessage('')

    const { data, error } = await supabase
      .from('inbox')
      .insert({
        user_id: user.id,
        content: content,
        item_type: 'message',
        to_recipient: activeThread,
        status: 'pending'
      })
      .select().single()

    if (error) showErrorToast(error)
    else setMessages(prev => [...prev, data])
  }

  const unreadTotal = threads.reduce((sum, t) => sum + t.unreadCount, 0)

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-[350px] h-[500px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden mb-2"
          >
            {/* Header */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {activeThread ? (
                <div className="flex items-center gap-3">
                  <Button isIconOnly variant="light" size="sm" radius="full" onPress={() => setActiveThread(null)}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Avatar name={activeThread} size="sm" className="bg-gradient-to-br from-violet-500 to-purple-600" />
                  <span className="font-black uppercase tracking-tighter text-sm">{activeThread}</span>
                </div>
              ) : (
                <span className="font-black uppercase tracking-widest text-[10px] text-slate-400">Intelligence Hub</span>
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
                      onClick={() => setActiveThread(t.id)}
                      className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-3"
                    >
                      <Avatar name={t.recipient} size="sm" className="bg-gradient-to-br from-violet-500 to-purple-600 font-black" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-bold text-sm uppercase tracking-tighter">{t.recipient}</span>
                          <span className="text-[9px] text-slate-400 uppercase">{new Date(t.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{t.lastMessage}</p>
                      </div>
                      {t.unreadCount > 0 && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                  ))}
                </ScrollShadow>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-violet-600 rounded-full shadow-2xl flex items-center justify-center text-white relative group border-4 border-white dark:border-slate-800"
      >
        <MessageCircle className={`w-8 h-8 transition-transform duration-500 ${isOpen ? 'rotate-90' : ''}`} />
        {unreadTotal > 0 && (
          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800">
            {unreadTotal}
          </div>
        )}
      </motion.button>
    </div>
  )
}
