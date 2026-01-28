'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Button, 
  Card, 
  CardBody,
  Checkbox,
  CheckboxGroup,
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast, getErrorMessage } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'

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
}

interface UserData {
  id: string
  email: string
  name?: string
}

// Calendar colors for Apple Calendar events
const calendarColors: Record<string, { bg: string; text: string; border: string }> = {
  'Home': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  'Work': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  'US Holidays': { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  'Birthdays': { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
  'Reminders': { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
}

const defaultCalendarColor = { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' }

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
  const [enabledCalendars, setEnabledCalendars] = useState<string[]>(['Home', 'Work', 'US Holidays', 'Birthdays', 'Reminders'])
  
  const supabase = createClient()

  // Fetch Apple Calendar events
  const fetchCalendarEvents = useCallback(async (date: Date) => {
    try {
      const year = date.getFullYear()
      const month = date.getMonth()
      
      // Get first and last day of month
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
      // Non-fatal - don't show error, just continue without calendar events
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
      // Get user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        console.error('Auth error:', authError)
      }
      
      if (authUser) {
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: authUser.email?.split('@')[0],
        })
      }

      // Get tasks with due dates
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, status, priority, due_date')
        .not('due_date', 'is', null)
      
      if (tasksError) {
        console.error('Tasks fetch error:', tasksError)
        throw tasksError
      }
      
      setTasks(tasksData || [])

      // Get content with scheduled dates
      const { data: contentData, error: contentError } = await supabase
        .from('content_items')
        .select('id, title, status, scheduled_date')
        .not('scheduled_date', 'is', null)
      
      if (contentError) {
        console.error('Content fetch error:', contentError)
        // Non-fatal - calendar can still show tasks
      }
      
      setContent(contentData || [])
      
      // Fetch calendar events for current month
      await fetchCalendarEvents(new Date())
    } catch (error) {
      console.error('Load calendar data error:', error)
      setLoadError(getErrorMessage(error))
      showErrorToast(error, 'Failed to load calendar data')
    } finally {
      setLoading(false)
    }
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

  // Get unique calendars from events
  const availableCalendars = [...new Set(calendarEvents.map(e => e.calendar))]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Error State */}
        {loadError && !loading && (
          <div className="mb-6">
            <ErrorFallback error={loadError} resetError={loadData} />
          </div>
        )}
        
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading calendar...</div>
        ) : !loadError && (
          <div className="space-y-4">
            {/* Filters */}
            <Card className="bg-white shadow-sm">
              <CardBody className="p-4">
                <div className="flex flex-wrap gap-6">
                  {/* Source Filter */}
                  <div>
                    <h3 className="text-sm font-medium text-slate-700 mb-2">Show</h3>
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
                          Apple Calendar
                        </span>
                      </Checkbox>
                    </CheckboxGroup>
                  </div>
                  
                  {/* Calendar Filter (only show when calendar is enabled) */}
                  {enabledSources.includes('calendar') && availableCalendars.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-700 mb-2">Calendars</h3>
                      <CheckboxGroup
                        orientation="horizontal"
                        value={enabledCalendars}
                        onValueChange={setEnabledCalendars}
                        size="sm"
                      >
                        {availableCalendars.map(cal => {
                          const colors = getCalendarColor(cal)
                          return (
                            <Checkbox key={cal} value={cal}>
                              <span className="flex items-center gap-1">
                                <span className={`w-2 h-2 rounded ${colors.bg}`} />
                                {cal}
                              </span>
                            </Checkbox>
                          )
                        })}
                      </CheckboxGroup>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Calendar */}
            <Card className="bg-white shadow-sm">
              <CardBody className="p-6">
                {/* Calendar Header */}
                <div className="flex items-center justify-between mb-6">
                  <Button variant="flat" onPress={prevMonth}>←</Button>
                  <h2 className="text-xl font-semibold text-slate-800">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h2>
                  <Button variant="flat" onPress={nextMonth}>→</Button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {dayNames.map(day => (
                    <div key={day} className="text-center text-sm font-medium text-slate-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Empty cells for days before the 1st */}
                  {Array.from({ length: startingDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[100px] bg-slate-50/50 rounded-lg" />
                  ))}
                  
                  {/* Days of the month */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1
                    const { tasks: dayTasks, content: dayContent, events: dayEvents } = getItemsForDay(day)
                    const hasItems = dayTasks.length > 0 || dayContent.length > 0 || dayEvents.length > 0
                    const totalItems = dayTasks.length + dayContent.length + dayEvents.length
                    
                    return (
                      <div
                        key={day}
                        className={`min-h-[100px] p-2 rounded-lg border transition-colors ${
                          isToday(day) 
                            ? 'bg-violet-50 border-violet-200' 
                            : hasItems 
                              ? 'bg-white border-slate-200 hover:border-violet-200' 
                              : 'bg-slate-50/50 border-transparent'
                        }`}
                      >
                        <div className={`text-sm font-medium mb-1 ${
                          isToday(day) ? 'text-violet-600' : 'text-slate-700'
                        }`}>
                          {day}
                        </div>
                        <div className="space-y-1">
                          {/* Tasks */}
                          {dayTasks.slice(0, 1).map(task => (
                            <div 
                              key={task.id}
                              className="text-xs p-1 rounded bg-blue-100 text-blue-700 truncate"
                              title={task.title}
                            >
                              📋 {task.title}
                            </div>
                          ))}
                          
                          {/* Content */}
                          {dayContent.slice(0, 1).map(item => (
                            <div 
                              key={item.id}
                              className="text-xs p-1 rounded bg-purple-100 text-purple-700 truncate"
                              title={item.title}
                            >
                              🎬 {item.title}
                            </div>
                          ))}
                          
                          {/* Calendar Events */}
                          {dayEvents.slice(0, 2 - dayTasks.slice(0,1).length - dayContent.slice(0,1).length).map(event => {
                            const colors = getCalendarColor(event.calendar)
                            return (
                              <div 
                                key={event.id}
                                className={`text-xs p-1 rounded ${colors.bg} ${colors.text} truncate`}
                                title={`${event.title} (${event.calendar})${event.time ? ` at ${event.time}` : ''}`}
                              >
                                {event.time ? `${event.time} ` : '📅 '}{event.title}
                              </div>
                            )
                          })}
                          
                          {/* Show more indicator */}
                          {totalItems > 2 && (
                            <div className="text-xs text-slate-400">
                              +{totalItems - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-slate-100">
                  <div className="text-sm font-medium text-slate-600 mr-2">Legend:</div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200" />
                    <span>Tasks</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200" />
                    <span>Content</span>
                  </div>
                  {Object.entries(calendarColors).map(([name, colors]) => (
                    <div key={name} className="flex items-center gap-2 text-sm text-slate-600">
                      <div className={`w-3 h-3 rounded ${colors.bg} ${colors.border} border`} />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
