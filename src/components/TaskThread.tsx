'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@heroui/react'
import TaskComment from './TaskComment'
import TaskCommentInput from './TaskCommentInput'
import { showErrorToast } from '@/lib/errors'

interface Comment {
  id: string
  task_id: string
  author_type: 'human' | 'agent'
  author_id: string | null
  author_agent: string | null
  message: string
  created_at: string
  users?: {
    name: string
    avatar_url: string | null
  }
}

interface TaskThreadProps {
  taskId?: string
  agentTaskId?: string
  className?: string
}

export default function TaskThread({ taskId, agentTaskId, className = '' }: TaskThreadProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    loadComments()
    getCurrentUser()
    
    // Subscribe to new comments
    const filter = taskId ? `task_id=eq.${taskId}` : `agent_task_id=eq.${agentTaskId}`
    const channel = supabase
      .channel(`task_comments:${taskId || agentTaskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_comments',
          filter: filter,
        },
        (payload) => {
          loadComments() 
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [taskId, agentTaskId])

  useEffect(() => {
    scrollToBottom()
  }, [comments, scrollToBottom])

  async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)
  }

  async function loadComments() {
    try {
      let query = supabase
        .from('task_comments')
        .select('*, users(name, avatar_url)')
        
      if (taskId) {
        query = query.eq('task_id', taskId)
      } else if (agentTaskId) {
        query = query.eq('agent_task_id', agentTaskId)
      } else {
        setLoading(false)
        return
      }

      const { data, error } = await query.order('created_at', { ascending: true })

      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error('Error loading comments:', error)
      showErrorToast(error, 'Failed to load conversation')
    } finally {
      setLoading(false)
    }
  }

  async function handleSendMessage(message: string) {
    if (!currentUserId) {
      showErrorToast(null, 'You must be logged in to comment')
      return
    }

    setSending(true)
    try {
      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId || null,
          agent_task_id: agentTaskId || null,
          author_type: 'human',
          author_id: currentUserId,
          message: message,
        })

      if (error) throw error
      loadComments()
    } catch (error) {
      console.error('Error sending message:', error)
      showErrorToast(error, 'Failed to send message')
      throw error
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getAuthorName = (comment: Comment) => {
    if (comment.author_type === 'agent') {
      return comment.author_agent?.toUpperCase() || 'AGENT'
    }
    return comment.users?.name || 'User'
  }

  return (
    <div className={`flex flex-col h-full bg-slate-50 dark:bg-slate-900/30 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 ${className}`}>
      {/* Header */}
      <div className="px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Thread</h3>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Spinner size="sm" />
            <span className="text-xs text-slate-500">Loading conversation...</span>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
              <span className="text-xl">💬</span>
            </div>
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs mt-1">Be the first to say something about this task.</p>
          </div>
        ) : (
          comments.map((comment) => (
            <TaskComment
              key={comment.id}
              authorType={comment.author_type}
              authorName={getAuthorName(comment)}
              message={comment.message}
              timestamp={formatTime(comment.created_at)}
              isOwn={comment.author_id === currentUserId}
            />
          ))
        )}
      </div>

      {/* Input */}
      <TaskCommentInput onSend={handleSendMessage} isLoading={sending} />
    </div>
  )
}
