'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Button, 
  Card, 
  CardBody,
  Checkbox,
  CheckboxGroup,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  Select,
  SelectItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@heroui/react"
import { Plus, Calendar, MapPin, Clock, AlertCircle, Trash2, Edit, X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, getErrorMessage } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'
import toast from 'react-hot-toast'

interface Task {
  id: string
  title: string
  status: string
  priority: string
  due_date: string | null
}

interface ContentItem {
  id: string
  title: string
  status: string
  scheduled_date: string | null
}

interface CalendarEvent {
  id: string
  title: string
  date: string
  time: string | null
  calendar: string
  isAllDay: boolean
  description?: string | null
  start_time?: string
  end_time?: string
  location?: string | null
  apple_event_id?: string | null
  sync_status?: string
}

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
}

// Calendar colors
const calendarColors: Record<string, { bg: string; text: string; border: string; darkBg: string; darkText: string }> = {
  'Mise Family': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', darkBg: 'dark:bg-green-900/30', darkText: 'dark:text-green-300' },
  'Alex\'s Work': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', darkBg: 'dark:bg-blue-900/30', darkText: 'dark:text-blue-300' },
  'Ax': { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', darkBg: 'dark:bg-purple-900/30', darkText: 'dark:text-purple-300' },
  'Work': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', darkBg: 'dark:bg-orange-900/30', darkText: 'dark:text-orange-300' },
  'Personal': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', darkBg: 'dark:bg-blue-900/30', darkText: 'dark:text-blue-300' },
  'US Holidays': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', darkBg: 'dark:bg-red-900/30', darkText: 'dark:text-red-300' },
  'Birthdays': { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200', darkBg: 'dark:bg-pink-900/30', darkText: 'dark:text-pink-300' },
}

const defaultCalendarColor = { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', darkBg: 'dark:bg-slate-800', darkText: 'dark:text-slate-300' }

const CALENDARS = ['Mise Family', 'Alex\'s Work', 'Ax']

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [content, setContent] = useState<ContentItem[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  
  // Filter state
  const [enabledSources, setEnabledSources] = useState<string[]>(['tasks', 'content', 'calendar'])
  const [enabledCalendars, setEnabledCalendars] = useState<string[]>(CALENDARS)
  
  // Event modal state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    all_day: false,
    location: '',
    calendar_name: 'Mise Family',
  })
  const [saving, setSaving] = useState(false)
  
  // Delete confirmation state
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const supabase = createClient()

  // Fetch calendar events from Supabase
  const fetchCalendarEvents = useCallback(async (date: Date) => {
    try {
      const year = date.getFullYear()
      const month = date.getMonth()
      
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      
      const startStr = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`
      const endStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
      
      const response = await fetch(`/api/calendar/events?start=${startStr}&end=${endStr}`)
      const data = await response.json()
      
      if (data.error) {
        console.warn('Calendar API warning:', data.error)
      }
      
      setCalendarEvents(data.events || [])
    } catch (error) {
      console.error('Failed to fetch calendar events:', error)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    fetchCalendarEvents(currentDate)
  }, [currentDate, fetchCalendarEvents])

  async function loadData() {
    setLoading(true)
    setLoadError(null)
    
    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        console.error('Auth error:', authError)
      }
      
      if (authUser) {
        // Fetch full profile including avatar
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: profile?.name || authUser.email?.split('@')[0],
          avatar_url: profile?.avatar_url,
        })
      }

      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, status, priority, due_date')
        .not('due_date', 'is', null)
      
      if (tasksError) {
        console.error('Tasks fetch error:', tasksError)
        throw tasksError
      }
      
      setTasks(tasksData || [])

      const { data: contentData, error: contentError } = await supabase
        .from('content_items')
        .select('id, title, status, scheduled_date')
        .not('scheduled_date', 'is', null)
      
      if (contentError) {
        console.error('Content fetch error:', contentError)
      }
      
      setContent(contentData || [])
      await fetchCalendarEvents(new Date())
    } catch (error) {
      console.error('Load calendar data error:', error)
      setLoadError(getErrorMessage(error))
      showErrorToast(error, 'Failed to load calendar data')
    } finally {
      setLoading(false)
    }
  }

  // Create/Update event
  async function handleSaveEvent() {
    if (!eventForm.title || !eventForm.start_date || !eventForm.end_date) {
      toast.error('Please fill in required fields')
      return
    }
    
    setSaving(true)
    try {
      const startTime = eventForm.all_day 
        ? `${eventForm.start_date}T00:00:00Z`
        : `${eventForm.start_date}T${eventForm.start_time || '00:00'}:00Z`
      
      const endTime = eventForm.all_day
        ? `${eventForm.end_date}T23:59:59Z`
        : `${eventForm.end_date}T${eventForm.end_time || '23:59'}:00Z`
      
      const payload = {
        title: eventForm.title,
        description: eventForm.description || null,
        start_time: startTime,
        end_time: endTime,
        all_day: eventForm.all_day,
        location: eventForm.location || null,
        calendar_name: eventForm.calendar_name,
      }
      
      let response
      if (selectedEvent) {
        response = await fetch(`/api/calendar/events/${selectedEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        response = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      toast.success(selectedEvent ? 'Event updated!' : 'Event created!')
      setIsEventModalOpen(false)
      resetEventForm()
      await fetchCalendarEvents(currentDate)
    } catch (error) {
      console.error('Save event error:', error)
      showErrorToast(error, 'Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  // Delete event
  async function handleDeleteEvent(event?: CalendarEvent) {
    const eventToDelete = event || selectedEvent
    if (!eventToDelete) return
    
    setSaving(true)
    try {
      const response = await fetch(`/api/calendar/events/${eventToDelete.id}`, {
        method: 'DELETE',
      })
      
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      toast.success('Event deleted!')
      setShowDeleteConfirm(false)
      setEventToDelete(null)
      setIsEventModalOpen(false)
      resetEventForm()
      await fetchCalendarEvents(currentDate)
    } catch (error) {
      console.error('Delete event error:', error)
      showErrorToast(error, 'Failed to delete event')
    } finally {
      setSaving(false)
    }
  }
  
  // Show delete confirmation
  function confirmDeleteEvent(event: CalendarEvent, e: React.MouseEvent) {
    e.stopPropagation()
    setEventToDelete(event)
    setShowDeleteConfirm(true)
  }

  function resetEventForm() {
    setSelectedEvent(null)
    setEventForm({
      title: '',
      description: '',
      start_date: '',
      start_time: '',
      end_date: '',
      end_time: '',
      all_day: false,
      location: '',
      calendar_name: 'Mise Family',
    })
  }

  function openNewEventModal(date?: Date) {
    resetEventForm()
    if (date) {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      setEventForm(prev => ({ ...prev, start_date: dateStr, end_date: dateStr }))
    }
    setIsEventModalOpen(true)
  }

  function openEventDetailModal(event: CalendarEvent) {
    setSelectedEvent(event)
    
    const startDate = event.start_time ? event.start_time.split('T')[0] : event.date
    const endDate = event.end_time ? event.end_time.split('T')[0] : event.date
    const startTime = event.start_time && !event.isAllDay ? event.start_time.split('T')[1]?.substring(0, 5) : ''
    const endTime = event.end_time && !event.isAllDay ? event.end_time.split('T')[1]?.substring(0, 5) : ''
    
    setEventForm({
      title: event.title,
      description: event.description || '',
      start_date: startDate,
      start_time: startTime,
      end_date: endDate,
      end_time: endTime,
      all_day: event.isAllDay,
      location: event.location || '',
      calendar_name: event.calendar,
    })
    setIsEventModalOpen(true)
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()
    
    return { daysInMonth, startingDay }
  }

  const { daysInMonth, startingDay } = getDaysInMonth(currentDate)

  const getItemsForDay = (day: number) => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    
    const dayTasks = enabledSources.includes('tasks') 
      ? tasks.filter(t => t.due_date?.startsWith(dateStr))
      : []
    const dayContent = enabledSources.includes('content')
      ? content.filter(c => c.scheduled_date?.startsWith(dateStr))
      : []
    const dayEvents = enabledSources.includes('calendar')
      ? calendarEvents.filter(e => e.date === dateStr && enabledCalendars.includes(e.calendar))
      : []
    
    return { tasks: dayTasks, content: dayContent, events: dayEvents }
  }

  const isToday = (day: number) => {
    const today = new Date()
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    )
  }

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const getCalendarColor = (calendarName: string) => {
    return calendarColors[calendarName] || defaultCalendarColor
  }

  const getSyncStatusChip = (status?: string) => {
    if (!status || status === 'synced') return null
    
    const statusConfig: Record<string, { color: 'warning' | 'danger' | 'primary'; label: string }> = {
      pending_push: { color: 'warning', label: 'Pending sync' },
      pending_pull: { color: 'primary', label: 'Update available' },
      conflict: { color: 'danger', label: 'Conflict' },
    }
    
    const config = statusConfig[status]
    if (!config) return null
    
    return (
      <Chip size="sm" color={config.color} variant="flat" className="text-xs">
        {config.label}
      </Chip>
    )
  }

  // Get unique calendars from events
  const availableCalendars = [...new Set([...CALENDARS, ...calendarEvents.map(e => e.calendar)])]

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {loadError && !loading && (
          <div className="mb-6">
            <ErrorFallback error={loadError} resetError={loadData} />
          </div>
        )}
        
        {loading ? (
          <div className="text-center py-12 text-default-500">Loading calendar...</div>
        ) : !loadError && (
          <div className="space-y-4">
            {/* Header with actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-6 h-6" />
                Calendar
              </h1>
              <div className="flex gap-2">
                <Button
                  isIconOnly
                  color="primary"
                  radius="full"
                  onPress={() => openNewEventModal()}
                  className="sm:hidden"
                >
                  <Plus className="w-5 h-5" />
                </Button>
                <Button
                  color="primary"
                  radius="full"
                  onPress={() => openNewEventModal()}
                  startContent={<Plus className="w-5 h-5" />}
                  className="hidden sm:flex"
                >
                  New Event
                </Button>
              </div>
            </div>

            {/* Filters */}
            <Card className="bg-content1 shadow-sm">
              <CardBody className="p-4">
                <div className="flex flex-wrap gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-default-700 mb-2">Show</h3>
                    <CheckboxGroup
                      orientation="horizontal"
                      value={enabledSources}
                      onValueChange={setEnabledSources}
                      size="sm"
                    >
                      <Checkbox value="tasks">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded bg-blue-400" />
                          Tasks
                        </span>
                      </Checkbox>
                      <Checkbox value="content">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded bg-purple-400" />
                          Content
                        </span>
                      </Checkbox>
                      <Checkbox value="calendar">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded bg-green-400" />
                          Calendar Events
                        </span>
                      </Checkbox>
                    </CheckboxGroup>
                  </div>
                  
                  {enabledSources.includes('calendar') && availableCalendars.length > 0 && (
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-default-700 mb-2">Calendars</h3>
                      <div className="flex flex-wrap gap-3">
                        {availableCalendars.map(cal => {
                          const colors = getCalendarColor(cal)
                          const isChecked = enabledCalendars.includes(cal)
                          return (
                            <label
                              key={cal}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                                isChecked
                                  ? `${colors.bg} ${colors.darkBg} ${colors.border} border`
                                  : 'bg-default-100 dark:bg-default-900 border-default-200 dark:border-default-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEnabledCalendars([...enabledCalendars, cal])
                                  } else {
                                    setEnabledCalendars(enabledCalendars.filter(c => c !== cal))
                                  }
                                }}
                                className="sr-only"
                              />
                              <span className={`w-2 h-2 rounded ${colors.bg}`} />
                              <span className="text-sm whitespace-nowrap truncate max-w-[120px]">
                                {cal}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Calendar */}
            <Card className="bg-content1 shadow-sm">
              <CardBody className="p-6">
                {/* Calendar Header */}
                <div className="flex items-center justify-between mb-6">
                  <Button variant="flat" onPress={prevMonth} className="min-w-[44px] min-h-[44px]">←</Button>
                  <h2 className="text-xl font-semibold text-foreground">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h2>
                  <Button variant="flat" onPress={nextMonth} className="min-w-[44px] min-h-[44px]">→</Button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {dayNames.map(day => (
                    <div key={day} className="text-center text-sm font-medium text-default-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: startingDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[100px] bg-default-50 rounded-lg" />
                  ))}
                  
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const { tasks: dayTasks, content: dayContent, events: dayEvents } = getItemsForDay(day)
                    const hasItems = dayTasks.length > 0 || dayContent.length > 0 || dayEvents.length > 0
                    const totalItems = dayTasks.length + dayContent.length + dayEvents.length
                    const dateForDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
                    
                    return (
                      <div
                        key={day}
                        onClick={() => openNewEventModal(dateForDay)}
                        className={`min-h-[100px] p-2 rounded-lg border transition-colors cursor-pointer ${
                          isToday(day) 
                            ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700' 
                            : hasItems 
                              ? 'bg-content1 border-default-200 hover:border-violet-200 dark:hover:border-violet-700' 
                              : 'bg-default-50 border-transparent hover:bg-default-100'
                        }`}
                      >
                        <div className={`text-sm font-medium mb-1 ${
                          isToday(day) ? 'text-violet-600 dark:text-violet-400' : 'text-foreground'
                        }`}>
                          {day}
                        </div>
                        <div className="space-y-1">
                          {dayTasks.slice(0, 1).map(task => (
                            <div 
                              key={task.id}
                              className="text-xs p-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 truncate cursor-pointer hover:opacity-80 group relative"
                              title={task.title}
                              onClick={(e) => {
                                e.stopPropagation()
                                window.location.href = `/tasks?task=${task.id}`
                              }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="truncate">📋 {task.title}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // Delete task directly
                                    if (window.confirm('Delete this task?')) {
                                      supabase.from('tasks').delete().eq('id', task.id).then(() => {
                                        setTasks(prev => prev.filter(t => t.id !== task.id))
                                        toast.success('Task deleted')
                                      })
                                    }
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded flex-shrink-0"
                                  title="Delete task"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                          
                          {dayContent.slice(0, 1).map(item => (
                            <div 
                              key={item.id}
                              className="text-xs p-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 truncate cursor-pointer hover:opacity-80"
                              title={item.title}
                              onClick={(e) => {
                                e.stopPropagation()
                                window.location.href = `/content/${item.id}`
                              }}
                            >
                              🎬 {item.title}
                            </div>
                          ))}
                          
                          {dayEvents.slice(0, 2 - dayTasks.slice(0,1).length - dayContent.slice(0,1).length).map(event => {
                            const colors = getCalendarColor(event.calendar)
                            return (
                              <Popover key={event.id} placement="top">
                                <PopoverTrigger>
                                  <div 
                                    className={`text-xs p-1 rounded ${colors.bg} ${colors.darkBg} ${colors.text} ${colors.darkText} truncate cursor-pointer hover:opacity-80 group relative`}
                                    title={`${event.title} (${event.calendar})${event.time ? ` at ${event.time}` : ''}`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="flex-1 truncate">
                                        {event.time ? `${event.time} ` : '📅 '}{event.title}
                                        {event.sync_status && event.sync_status !== 'synced' && (
                                          <AlertCircle className="w-3 h-3 inline ml-1 text-warning" />
                                        )}
                                      </span>
                                      <div
                                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-0.5 hover:bg-white/20 rounded"
                                        title="Options"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </div>
                                    </div>
                                  </div>
                                </PopoverTrigger>
                                <PopoverContent className="p-3">
                                  <div className="space-y-3">
                                    <div className="space-y-1">
                                      <p className="font-bold text-sm">{event.title}</p>
                                      <p className="text-xs text-default-500">{event.calendar}</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button size="sm" variant="flat" onPress={() => openEventDetailModal(event)}>Edit</Button>
                                      <Button 
                                        size="sm" 
                                        color="danger" 
                                        variant="flat" 
                                        onPress={() => handleDeleteEvent(event)}
                                        isLoading={saving && eventToDelete?.id === event.id}
                                      >
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )
                          })}
                          
                          {totalItems > 2 && (
                            <div className="text-xs text-default-400">
                              +{totalItems - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-default-100">
                  <div className="text-sm font-medium text-default-600 mr-2">Legend:</div>
                  <div className="flex items-center gap-2 text-sm text-default-600">
                    <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700" />
                    <span>Tasks</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-default-600">
                    <div className="w-3 h-3 rounded bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700" />
                    <span>Content</span>
                  </div>
                  {Object.entries(calendarColors).slice(0, 3).map(([name, colors]) => (
                    <div key={name} className="flex items-center gap-2 text-sm text-default-600">
                      <div className={`w-3 h-3 rounded ${colors.bg} ${colors.darkBg} ${colors.border} border`} />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Event Modal */}
        <Modal isOpen={isEventModalOpen} onClose={() => { setIsEventModalOpen(false); resetEventForm() }} size="lg">
          <ModalContent>
            <ModalHeader>
              {selectedEvent ? 'Edit Event' : 'New Event'}
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                <Input
                  label="Title"
                  placeholder="Event title"
                  value={eventForm.title}
                  onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                  isRequired
                />
                
                <Textarea
                  label="Description"
                  placeholder="Event description"
                  value={eventForm.description}
                  onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                />
                
                <div className="flex gap-4">
                  <Input
                    type="date"
                    label="Start Date"
                    value={eventForm.start_date}
                    onChange={(e) => setEventForm(prev => ({ ...prev, start_date: e.target.value }))}
                    isRequired
                    className="flex-1"
                  />
                  {!eventForm.all_day && (
                    <Input
                      type="time"
                      label="Start Time"
                      value={eventForm.start_time}
                      onChange={(e) => setEventForm(prev => ({ ...prev, start_time: e.target.value }))}
                      className="flex-1"
                    />
                  )}
                </div>
                
                <div className="flex gap-4">
                  <Input
                    type="date"
                    label="End Date"
                    value={eventForm.end_date}
                    onChange={(e) => setEventForm(prev => ({ ...prev, end_date: e.target.value }))}
                    isRequired
                    className="flex-1"
                  />
                  {!eventForm.all_day && (
                    <Input
                      type="time"
                      label="End Time"
                      value={eventForm.end_time}
                      onChange={(e) => setEventForm(prev => ({ ...prev, end_time: e.target.value }))}
                      className="flex-1"
                    />
                  )}
                </div>
                
                <Checkbox
                  isSelected={eventForm.all_day}
                  onValueChange={(checked) => setEventForm(prev => ({ ...prev, all_day: checked }))}
                >
                  All day event
                </Checkbox>
                
                <Input
                  label="Location"
                  placeholder="Event location"
                  value={eventForm.location}
                  onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                  startContent={<MapPin className="w-4 h-4 text-default-400" />}
                />
                
                <Select
                  label="Calendar"
                  selectedKeys={[eventForm.calendar_name]}
                  onChange={(e) => setEventForm(prev => ({ ...prev, calendar_name: e.target.value }))}
                >
                  {CALENDARS.map((cal) => (
                    <SelectItem key={cal} textValue={cal}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded ${getCalendarColor(cal).bg}`} />
                        {cal}
                      </span>
                    </SelectItem>
                  ))}
                </Select>
                
                {selectedEvent && getSyncStatusChip(selectedEvent.sync_status)}
              </div>
            </ModalBody>
            <ModalFooter>
              <div className="flex justify-between w-full">
                <div>
                  {selectedEvent && showDeleteConfirm && eventToDelete?.id === selectedEvent.id ? (
                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 rounded-lg px-3 py-2 border border-red-200 dark:border-red-700">
                      <span className="text-sm font-medium text-red-700 dark:text-red-300">Delete event?</span>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => {
                            setShowDeleteConfirm(false)
                            setEventToDelete(null)
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          color="danger"
                          onPress={() => handleDeleteEvent(selectedEvent)}
                          isLoading={saving}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ) : selectedEvent ? (
                    <Button
                      color="danger"
                      variant="flat"
                      startContent={<Trash2 className="w-4 h-4" />}
                      onPress={() => {
                        setEventToDelete(selectedEvent)
                        setShowDeleteConfirm(true)
                      }}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button variant="flat" onPress={() => { setIsEventModalOpen(false); resetEventForm() }}>
                    Cancel
                  </Button>
                  <Button color="primary" onPress={handleSaveEvent} isLoading={saving}>
                    {selectedEvent ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </main>
    </div>
  )
}
