'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardBody, Input, Button, ScrollShadow, Avatar, Spinner } from '@heroui/react'
import { Send, Bot, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

type ChatMessage = {
  id: string
  created_at: string
  from_agent: string
  to_agent: string
  message: string
  context: any
  thread_id: string | null
  delivered: boolean
  delivered_at: string | null
}

type UserMessage = {
  role: 'user' | 'agent'
  name: string
  content: string
  id?: string
  created_at?: string
}

export default function AgentChat() {
  const [message, setMessage] = useState('')
  const [chat, setChat] = useState<UserMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('You')
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        // Get user's name from profiles
        const { data: profile } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .single()
        
        if (profile?.full_name) {
          setUserName(profile.full_name)
        }
      }
    }
    getUser()
  }, [supabase])

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setLoading(true)
        
        // Get session token
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          throw new Error('Not authenticated')
        }
        
        // Fetch messages from API
        const response = await fetch('/api/agent-chat', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to load messages')
        }
        
        const { messages } = await response.json()
        
        // Transform to chat format
        const transformedMessages: UserMessage[] = messages.map((msg: ChatMessage) => ({
          id: msg.id,
          created_at: msg.created_at,
          role: msg.from_agent === 'user' ? 'user' : 'agent',
          name: getAgentName(msg.from_agent, msg.context),
          content: msg.message
        }))
        
        setChat(transformedMessages)
      } catch (error: any) {
        console.error('Error loading messages:', error)
        toast.error(error.message || 'Failed to load chat messages')
        
        // Fallback: try direct Supabase query (might fail due to RLS)
        try {
          const { data: messages, error } = await supabase
            .from('agent_chat')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(50)
          
          if (!error && messages) {
            const transformedMessages: UserMessage[] = messages.map(msg => ({
              id: msg.id,
              created_at: msg.created_at,
              role: msg.from_agent === 'user' ? 'user' : 'agent',
              name: getAgentName(msg.from_agent),
              content: msg.message
            }))
            setChat(transformedMessages)
          }
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError)
        }
      } finally {
        setLoading(false)
      }
    }
    
    loadMessages()
  }, [supabase])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel('agent_chat_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_chat',
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage
          // Only add if not already in chat (avoid duplicates)
          if (!chat.some(msg => msg.id === newMessage.id)) {
            setChat(prev => [...prev, {
              id: newMessage.id,
              created_at: newMessage.created_at,
              role: newMessage.from_agent === 'user' ? 'user' : 'agent',
              name: getAgentName(newMessage.from_agent, newMessage.context),
              content: newMessage.message
            }])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, chat])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chat])

  const getAgentName = (agentId: string, context?: any): string => {
    if (agentId.toLowerCase() === 'user') {
      // Try to get user name from context
      if (context?.user_id === userId) {
        return userName
      }
      // Fallback to 'You' for current user's messages, 'User' for others
      return context?.user_id ? 'User' : userName
    }
    
    switch (agentId.toLowerCase()) {
      case 'ax':
        return 'Ax'
      case 'tony':
        return 'Tony'
      default:
        return agentId
    }
  }

  const getAgentAvatar = (name: string) => {
    switch (name.toLowerCase()) {
      case 'ax':
        return <Bot className="w-4 h-4" />
      case 'tony':
        return <Bot className="w-4 h-4" />
      default:
        return <User className="w-4 h-4" />
    }
  }

  const getAgentColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'ax':
        return 'bg-violet-600'
      case 'tony':
        return 'bg-amber-600'
      default:
        return 'bg-blue-600'
    }
  }

  const handleSendMessage = async () => {
    if (!message.trim() || !userId || sending) return

    try {
      setSending(true)
      
      // Get session token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }
      
      // Send message via API (uses service role to bypass RLS)
      const response = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          message: message.trim(),
          to_agent: 'ax' // Default to Ax
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send message')
      }

      // Clear input
      setMessage('')
      
      // Optimistically add user message
      const optimisticMessage: UserMessage = {
        role: 'user',
        name: userName,
        content: message.trim(),
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString()
      }
      
      setChat(prev => [...prev, optimisticMessage])

    } catch (error: any) {
      console.error('Error sending message:', error)
      toast.error(error.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (loading) {
    return (
      <Card className="h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <CardBody className="flex items-center justify-center h-full">
          <Spinner size="lg" />
        </CardBody>
      </Card>
    )
  }

  return (
    <Card className="h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <CardBody className="p-0 flex flex-col h-full">
        {/* Chat History */}
        <ScrollShadow 
          ref={scrollRef}
          className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]"
        >
          {chat.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
              <Bot className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm">No messages yet. Start a conversation!</p>
            </div>
          ) : (
            chat.map((msg, i) => (
              <div 
                key={msg.id || i} 
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <Avatar 
                  size="sm"
                  icon={getAgentAvatar(msg.name)}
                  className={`${getAgentColor(msg.name)} text-white`}
                />
                <div className={`p-3 rounded-2xl text-sm max-w-[80%] ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none'
                }`}>
                  <p className="font-bold text-[10px] mb-1 opacity-70 uppercase">
                    {msg.name}
                    {msg.created_at && (
                      <span className="ml-2 font-normal opacity-50">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </p>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))
          )}
        </ScrollShadow>

        {/* Input Area */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex gap-2">
          <Input 
            placeholder="Talk to your agents..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            classNames={{
              inputWrapper: "bg-slate-50 dark:bg-slate-800 border-none flex-1"
            }}
          />
          <Button 
            isIconOnly 
            color="primary" 
            radius="full" 
            onClick={handleSendMessage}
            disabled={!message.trim() || sending}
            isLoading={sending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}