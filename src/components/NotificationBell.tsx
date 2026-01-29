'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Spinner, Divider, Badge } from '@heroui/react'
import { BellIcon, CheckIcon, XMarkIcon, ClipboardDocumentListIcon, ChatBubbleLeftIcon, ArrowPathIcon, ClockIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import { createClient } from '@/lib/supabase/client'

interface Notification {
  id: string
  user_id: string
  type: 'task_assigned' | 'feedback_received' | 'status_changed' | 'due_soon' | 'revision_requested'
  title: string
  message: string
  task_id: string | null
  read: boolean
  created_at: string
}

interface NotificationBellProps {
  userId?: string | null
  onNotificationClick?: (taskId: string) => void
}

const TypeIcon = ({ type }: { type: string }) => {
  const iconClass = "w-4 h-4"
  switch (type) {
    case 'task_assigned': return <ClipboardDocumentListIcon className={iconClass} />
    case 'feedback_received': return <ChatBubbleLeftIcon className={iconClass} />
    case 'status_changed': return <ArrowPathIcon className={iconClass} />
    case 'due_soon': return <ClockIcon className={iconClass} />
    case 'revision_requested': return <PencilSquareIcon className={iconClass} />
    default: return <BellIcon className={iconClass} />
  }
}

const typeColors: Record<string, string> = {
  task_assigned: 'bg-blue-100 dark:bg-blue-900/50',
  feedback_received: 'bg-green-100 dark:bg-green-900/50',
  status_changed: 'bg-yellow-100 dark:bg-yellow-900/50',
  due_soon: 'bg-red-100 dark:bg-red-900/50',
  revision_requested: 'bg-purple-100 dark:bg-purple-900/50',
}

export default function NotificationBell({ userId, onNotificationClick }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)
  const [markingRead, setMarkingRead] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const unreadCount = notifications.filter(n => !n.read).length

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([])
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) throw error
      setNotifications(data || [])
    } catch (error) {
      console.error('Failed to load notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, supabase])

  // Initial load
  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications(prev =>
            prev.map(n => n.id === payload.new.id ? payload.new as Notification : n)
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Mark single notification as read
  async function markAsRead(notificationId: string) {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      )
    } catch (error) {
      console.error('Failed to mark notification as read:', error)
    }
  }

  // Mark all as read
  async function markAllAsRead() {
    if (unreadCount === 0) return

    setMarkingRead(true)
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)

      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch (error) {
      console.error('Failed to mark all as read:', error)
    } finally {
      setMarkingRead(false)
    }
  }

  // Handle notification click
  function handleNotificationClick(notification: Notification) {
    markAsRead(notification.id)
    if (notification.task_id) {
      if (onNotificationClick) {
        // Use the provided handler (e.g., on tasks page)
        onNotificationClick(notification.task_id)
      } else {
        // Navigate to tasks page with task query param
        router.push(`/tasks?openTask=${notification.task_id}`)
      }
    }
    setIsOpen(false)
  }

  // Format relative time
  function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (!userId) {
    return (
      <Button isIconOnly variant="light" className="hidden sm:flex text-default-500 min-w-[44px] min-h-[44px]">
        <BellIcon className="w-5 h-5" />
      </Button>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button with Badge */}
      <Button
        isIconOnly
        variant="light"
        className="hidden sm:flex text-default-500 min-w-[44px] min-h-[44px] relative"
        onPress={() => setIsOpen(!isOpen)}
      >
        <BellIcon className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BellIcon className="w-5 h-5" /> Notifications
              {unreadCount > 0 && (
                <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="light"
                className="text-xs"
                onPress={markAllAsRead}
                isLoading={markingRead}
              >
                <CheckIcon className="w-3 h-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="sm" />
                <span className="ml-2 text-slate-500">Loading...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                <BellIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 ${
                      !notification.read ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Type Icon */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full ${typeColors[notification.type]} flex items-center justify-center`}>
                        <TypeIcon type={notification.type} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium text-sm ${!notification.read ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                            {notification.title}
                          </span>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                          {notification.message}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                          {formatRelativeTime(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 text-center">
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
