'use client'

import { useState, useEffect } from 'react'
import { 
  Button, 
  Card, 
  CardBody,
  Chip,
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import UserMenu from '@/components/UserMenu'
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

interface UserData {
  id: string
  email: string
  name?: string
}

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [content, setContent] = useState<ContentItem[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

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
    
    const dayTasks = tasks.filter(t => t.due_date?.startsWith(dateStr))
    const dayContent = content.filter(c => c.scheduled_date?.startsWith(dateStr))
    
    return { tasks: dayTasks, content: dayContent }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <span className="font-semibold text-slate-800 text-lg">Mise</span>
              </a>
            </div>
            <h1 className="text-xl font-semibold text-slate-800">Calendar</h1>
            <div className="flex items-center gap-2">
              {user && <UserMenu user={user} />}
            </div>
          </div>
        </div>
      </header>

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
                  const { tasks: dayTasks, content: dayContent } = getItemsForDay(day)
                  const hasItems = dayTasks.length > 0 || dayContent.length > 0
                  
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
                        {dayTasks.slice(0, 2).map(task => (
                          <div 
                            key={task.id}
                            className="text-xs p-1 rounded bg-blue-100 text-blue-700 truncate"
                          >
                            📋 {task.title}
                          </div>
                        ))}
                        {dayContent.slice(0, 2).map(item => (
                          <div 
                            key={item.id}
                            className="text-xs p-1 rounded bg-purple-100 text-purple-700 truncate"
                          >
                            🎬 {item.title}
                          </div>
                        ))}
                        {(dayTasks.length + dayContent.length > 2) && (
                          <div className="text-xs text-slate-400">
                            +{dayTasks.length + dayContent.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex gap-4 mt-6 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="w-3 h-3 rounded bg-blue-100" />
                  <span>Tasks</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="w-3 h-3 rounded bg-purple-100" />
                  <span>Content</span>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </main>
    </div>
  )
}
