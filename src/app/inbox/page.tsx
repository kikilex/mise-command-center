'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Button, 
  Card, 
  CardBody,
  Input,
  Spinner,
  Chip,
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { Check, Trash2, Calendar, FolderOpen, Archive, Send, Bot, ArrowRight, Inbox as InboxIcon } from 'lucide-react'

interface InboxItem {
  id: string
  content: string
  item_type: 'thought' | 'message' | 'task_draft'
  from_agent: string | null
  status: 'pending' | 'processed' | 'archived'
  processed_to: string | null
  processed_to_id: string | null
  created_at: string
}

interface UserData {
  id: string
  email: string
  name?: string
}

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserData | null>(null)
  const [newItem, setNewItem] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const supabase = createClient()

  // Load user and inbox items
  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) {
          window.location.href = '/login'
          return
        }

        // Get user profile
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
      } catch (error) {
        console.error('Error loading inbox:', error)
        showErrorToast('Failed to load inbox')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [supabase])

  // Add new item to inbox
  const handleAddItem = async () => {
    if (!newItem.trim() || !user) return

    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('inbox')
        .insert({
          user_id: user.id,
          content: newItem.trim(),
          item_type: 'thought',
          status: 'pending',
        })
        .select()
        .single()

      if (error) throw error

      setItems([data, ...items])
      setNewItem('')
      inputRef.current?.focus()
    } catch (error) {
      console.error('Error adding item:', error)
      showErrorToast('Failed to add item')
    } finally {
      setSubmitting(false)
    }
  }

  // Process item: convert to task
  const handleToTask = async (item: InboxItem) => {
    if (!user) return

    try {
      // Create task from inbox item
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

      // Mark inbox item as processed
      const { error: updateError } = await supabase
        .from('inbox')
        .update({
          status: 'processed',
          processed_to: 'task',
          processed_to_id: taskData.id,
        })
        .eq('id', item.id)

      if (updateError) throw updateError

      setItems(items.filter(i => i.id !== item.id))
      showSuccessToast('Added to tasks')
    } catch (error) {
      console.error('Error creating task:', error)
      showErrorToast('Failed to create task')
    }
  }

  // Process item: schedule for today
  const handleToday = async (item: InboxItem) => {
    if (!user) return

    try {
      // Create task with today's date
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

      // Mark inbox item as processed
      const { error: updateError } = await supabase
        .from('inbox')
        .update({
          status: 'processed',
          processed_to: 'task',
          processed_to_id: taskData.id,
        })
        .eq('id', item.id)

      if (updateError) throw updateError

      setItems(items.filter(i => i.id !== item.id))
      showSuccessToast('Added to today')
    } catch (error) {
      console.error('Error creating task:', error)
      showErrorToast('Failed to add to today')
    }
  }

  // Archive/delete item
  const handleArchive = async (item: InboxItem) => {
    try {
      const { error } = await supabase
        .from('inbox')
        .update({ status: 'archived' })
        .eq('id', item.id)

      if (error) throw error

      setItems(items.filter(i => i.id !== item.id))
    } catch (error) {
      console.error('Error archiving item:', error)
      showErrorToast('Failed to archive')
    }
  }

  // Delete item permanently
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

  // Handle Enter key in input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAddItem()
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar user={user} />
      
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center">
              <InboxIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
              <p className="text-sm text-default-500">
                {items.length === 0 ? 'All clear!' : `${items.length} item${items.length !== 1 ? 's' : ''} to process`}
              </p>
            </div>
          </div>
        </div>

        {/* Quick capture input */}
        <Card className="mb-6 shadow-sm">
          <CardBody className="p-3">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                placeholder="What's on your mind? Press Enter to capture..."
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={submitting}
                classNames={{
                  input: "text-base",
                  inputWrapper: "shadow-none bg-default-100",
                }}
                autoFocus
              />
              <Button
                isIconOnly
                color="primary"
                onPress={handleAddItem}
                isLoading={submitting}
                isDisabled={!newItem.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Inbox Zero State */}
        {items.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Inbox Zero!</h2>
            <p className="text-default-500">
              Your mind is clear. Capture new thoughts above.
            </p>
          </div>
        )}

        {/* Inbox Items */}
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="shadow-sm hover:shadow-md transition-shadow">
              <CardBody className="p-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Content */}
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

                  {/* Actions */}
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
      </main>
    </div>
  )
}
