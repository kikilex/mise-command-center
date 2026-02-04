'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardBody, ScrollShadow, Avatar, Spinner } from '@heroui/react'
import { Bot, User } from 'lucide-react'
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
  role: 'agent'
  name: string
  content: string
  id?: string
  created_at?: string
}

export default function AgentChat() {
  const [chat, setChat] = useState<UserMessage[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

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
          role: 'agent',
          name: getAgentName(msg.from_agent),
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
            // Filter for agent-to-agent only in fallback
            const agentMessages = messages.filter(msg => msg.from_agent !== 'user' && msg.to_agent !== 'user')
            const transformedMessages: UserMessage[] = agentMessages.map(msg => ({
              id: msg.id,
              created_at: msg.created_at,
              role: 'agent',
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
          // Only add agent-to-agent messages
          if (newMessage.from_agent === 'user' || newMessage.to_agent === 'user') return
          
          setChat(prev => {
            // Only add if not already in chat (avoid duplicates)
            if (prev.some(msg => msg.id === newMessage.id)) return prev
            return [...prev, {
              id: newMessage.id,
              created_at: newMessage.created_at,
              role: 'agent',
              name: getAgentName(newMessage.from_agent),
              content: newMessage.message
            }]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chat])

  const getAgentName = (agentId: string): string => {
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
        {/* Header - Agent Comms */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Inter-Agent Chat</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Monitor conversations between AI agents</p>
        </div>
        
        {/* Chat History */}
        <ScrollShadow 
          ref={scrollRef}
          className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]"
        >
          {chat.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
              <Bot className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm">No agent conversations yet</p>
              <p className="text-xs mt-1 text-slate-500">Agents will appear here when they talk to each other</p>
            </div>
          ) : (
            chat.map((msg, i) => (
              <div 
                key={msg.id || i} 
                className="flex gap-3"
              >
                <Avatar 
                  size="sm"
                  icon={getAgentAvatar(msg.name)}
                  className={`${getAgentColor(msg.name)} text-white`}
                />
                <div className="p-3 rounded-2xl text-sm max-w-[80%] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none">
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
      </CardBody>
    </Card>
  )
}