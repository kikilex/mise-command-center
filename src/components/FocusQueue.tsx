'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardBody, CardHeader, Button, Chip, Progress, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, DropdownSection, Popover, PopoverTrigger, PopoverContent } from '@heroui/react'
import { Zap, Pause, Play, Check, RotateCcw, ExternalLink, UserPlus, Clock, ChevronDown, User, Bot } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useCelebrations } from '@/hooks/useCelebrations'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import TaskDetailModal from './TaskDetailModal'

interface Session {
  num: number
  start: string
  end: string | null
  duration_ms: number | null
}

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  space_id: string | null
  project_id?: string | null
  focus_sessions?: Session[]
  total_session_count?: number
  total_time_spent_ms?: number
  timer_state?: string
  current_session_start?: string | null
  project?: { name: string; icon?: string } | null
}

interface FocusQueueProps {
  tasks: Task[]
  todayCompletedCount?: number
  onTaskComplete?: (taskId: string) => void
  onRefresh?: () => void
  onRemoveFromQueue?: (taskId: string) => Promise<void>
}

interface TeamMember {
  id: string
  name: string
  email: string
  is_agent?: boolean
  user_type?: string
  display_name?: string
}

const LATER_OPTIONS = [
  { key: 'tomorrow', label: 'Tomorrow', days: 1 },
  { key: '3days', label: 'In 3 days', days: 3 },
  { key: 'nextweek', label: 'Next week', days: 7 },
  { key: 'custom', label: 'Pick date...', days: 0 },
]

const SESSION_EMOJIS = ['🎯', '⚡', '🔥', '💪', '🚀', '💎', '👑', '🦁', '⭐', '🏆']

const BREAK_MESSAGES = [
  { text: "Get your ass up", emoji: "🖕" },
  { text: "Move it", emoji: "🏃" },
  { text: "Stand the fuck up", emoji: "🦵" },
  { text: "Water check", emoji: "💧" },
  { text: "Touch grass", emoji: "🌿" },
  { text: "Eyes off screen", emoji: "👀" },
  { text: "Deep breath bitch", emoji: "😤" },
  { text: "Walk it off", emoji: "🚶" },
]

const LOCALSTORAGE_KEY = 'focus-queue-timer-state'

interface SavedTimerState {
  taskId: string
  timerState: 'stopped' | 'running' | 'paused'
  sessionStartTimestamp: number | null
  sessions: Session[]
  savedAt: number
}

export default function FocusQueue({ tasks, todayCompletedCount = 0, onTaskComplete, onRefresh, onRemoveFromQueue }: FocusQueueProps) {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0)
  const [timerState, setTimerState] = useState<'stopped' | 'running' | 'paused'>('stopped')
  const [sessionCount, setSessionCount] = useState(1)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [sessions, setSessions] = useState<Session[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [hypeMessage, setHypeMessage] = useState<string | null>(null)
  const [viewTask, setViewTask] = useState<Task | null>(null)
  const [restored, setRestored] = useState(false)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [customDate, setCustomDate] = useState('')
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null)
  const sessionStartRef = useRef<number | null>(null)
  const supabase = createClient()
  const { celebrate, getRandomHype } = useCelebrations()
  
  const currentTask = tasks[currentTaskIndex] || null
  const queuedTasks = tasks.slice(0, 5)
  const completedCount = currentTaskIndex

  // Save to localStorage for instant persistence
  const saveToLocalStorage = useCallback((state: SavedTimerState) => {
    try {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.error('Failed to save timer to localStorage:', e)
    }
  }, [])

  // Load from localStorage
  const loadFromLocalStorage = useCallback((): SavedTimerState | null => {
    try {
      const saved = localStorage.getItem(LOCALSTORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch (e) {
      console.error('Failed to load timer from localStorage:', e)
    }
    return null
  }, [])

  // Clear localStorage timer state
  const clearLocalStorage = useCallback(() => {
    try {
      localStorage.removeItem(LOCALSTORAGE_KEY)
    } catch (e) {
      console.error('Failed to clear localStorage:', e)
    }
  }, [])

  // Restore timer state on mount - check localStorage first (survives browser close)
  useEffect(() => {
    if (!currentTask || restored) return
    
    const savedState = loadFromLocalStorage()
    
    // Check if we have localStorage state for this task
    if (savedState && savedState.taskId === currentTask.id) {
      console.log('Restoring timer from localStorage:', savedState)
      setSessions(savedState.sessions)
      setSessionCount(savedState.sessions.length || 1)
      
      if (savedState.timerState === 'running' && savedState.sessionStartTimestamp) {
        // Resume running timer - calculate elapsed since browser closed
        sessionStartRef.current = savedState.sessionStartTimestamp
        setTimerState('running')
        // Elapsed will be calculated in the tick effect
      } else if (savedState.timerState === 'paused') {
        setTimerState('paused')
        const totalElapsed = savedState.sessions.reduce((sum, s) => sum + (s.duration_ms || 0), 0)
        setElapsedMs(totalElapsed)
      }
      setRestored(true)
      return
    }
    
    // Fall back to DB state (from task props)
    if (currentTask.focus_sessions && currentTask.focus_sessions.length > 0) {
      setSessions(currentTask.focus_sessions)
      setSessionCount(currentTask.focus_sessions.length)
      const totalElapsed = currentTask.focus_sessions.reduce((sum, s) => sum + (s.duration_ms || 0), 0)
      setElapsedMs(totalElapsed)
    }
    if (currentTask.timer_state === 'running' && currentTask.current_session_start) {
      sessionStartRef.current = new Date(currentTask.current_session_start).getTime()
      setTimerState('running')
    }
    setRestored(true)
  }, [currentTask?.id, restored, loadFromLocalStorage])

  // Reset restored flag when task changes
  useEffect(() => {
    setRestored(false)
  }, [currentTask?.id])

  // Fetch team members for handoff
  useEffect(() => {
    async function loadTeamMembers() {
      const { data } = await supabase
        .from('users')
        .select('id, name, email, is_agent, user_type, display_name')
        .order('is_agent', { ascending: true })
      setTeamMembers(data || [])
    }
    loadTeamMembers()
  }, [])

  // Save to localStorage on every state change while running
  useEffect(() => {
    if (!currentTask) return
    
    const state: SavedTimerState = {
      taskId: currentTask.id,
      timerState,
      sessionStartTimestamp: sessionStartRef.current,
      sessions,
      savedAt: Date.now()
    }
    saveToLocalStorage(state)
  }, [currentTask?.id, timerState, sessions, saveToLocalStorage])

  // Save to DB periodically while running (every 30s as backup)
  useEffect(() => {
    if (timerState === 'running' && currentTask) {
      autoSaveRef.current = setInterval(() => {
        console.log('Auto-saving timer state to DB...')
        saveTimerState('running', sessions)
      }, 30000) // 30 seconds
    } else {
      if (autoSaveRef.current) {
        clearInterval(autoSaveRef.current)
        autoSaveRef.current = null
      }
    }
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current)
    }
  }, [timerState, currentTask?.id, sessions])

  // Save on beforeunload (browser close/refresh)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (timerState === 'running' && currentTask && sessionStartRef.current) {
        // Update localStorage one final time with current timestamp
        const state: SavedTimerState = {
          taskId: currentTask.id,
          timerState: 'running',
          sessionStartTimestamp: sessionStartRef.current,
          sessions,
          savedAt: Date.now()
        }
        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(state))
      }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [timerState, currentTask?.id, sessions])

  // Timer tick
  useEffect(() => {
    if (timerState === 'running') {
      timerRef.current = setInterval(() => {
        if (sessionStartRef.current) {
          const sessionElapsed = Date.now() - sessionStartRef.current
          const previousElapsed = sessions.slice(0, -1).reduce((sum, s) => sum + (s.duration_ms || 0), 0)
          setElapsedMs(previousElapsed + sessionElapsed)
        }
      }, 100)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerState, sessions])

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const saveTimerState = async (state: string, sessionData?: Session[]) => {
    if (!currentTask) return
    try {
      await supabase
        .from('tasks')
        .update({
          timer_state: state,
          current_session_start: state === 'running' ? new Date().toISOString() : null,
          focus_sessions: sessionData || sessions,
          total_session_count: sessionData?.length || sessions.length,
          total_time_spent_ms: (sessionData || sessions).reduce((sum, s) => sum + (s.duration_ms || 0), 0)
        })
        .eq('id', currentTask.id)
    } catch (error) {
      console.error('Error saving timer state:', error)
    }
  }

  const startTimer = useCallback(() => {
    const newSessionCount = timerState === 'paused' ? sessionCount + 1 : (sessions.length > 0 ? sessions.length + 1 : 1)
    const now = Date.now()
    sessionStartRef.current = now
    
    const newSession: Session = {
      num: newSessionCount,
      start: new Date().toLocaleTimeString(),
      end: null,
      duration_ms: null
    }
    
    const updatedSessions = [...sessions, newSession]
    setSessions(updatedSessions)
    setSessionCount(newSessionCount)
    setTimerState('running')
    saveTimerState('running', updatedSessions)
  }, [timerState, sessionCount, sessions])

  const pauseTimer = useCallback(() => {
    if (timerState !== 'running' || !sessionStartRef.current) return
    
    const duration = Date.now() - sessionStartRef.current
    const updatedSessions = sessions.map((s, i) => 
      i === sessions.length - 1 
        ? { ...s, end: new Date().toLocaleTimeString(), duration_ms: duration }
        : s
    )
    
    setSessions(updatedSessions)
    setTimerState('paused')
    sessionStartRef.current = null
    saveTimerState('paused', updatedSessions)
  }, [timerState, sessions])

  const finishTask = useCallback(async () => {
    if (!currentTask) return
    
    // Complete current session if running
    let finalSessions = sessions
    if (timerState === 'running' && sessionStartRef.current) {
      const duration = Date.now() - sessionStartRef.current
      finalSessions = sessions.map((s, i) => 
        i === sessions.length - 1 
          ? { ...s, end: new Date().toLocaleTimeString(), duration_ms: duration }
          : s
      )
    }
    
    try {
      // Update task as completed
      await supabase
        .from('tasks')
        .update({
          status: 'done',
          timer_state: 'stopped',
          current_session_start: null,
          focus_sessions: finalSessions,
          total_session_count: finalSessions.length,
          total_time_spent_ms: finalSessions.reduce((sum, s) => sum + (s.duration_ms || 0), 0)
        })
        .eq('id', currentTask.id)

      // Celebrate!
      const result = celebrate()
      setHypeMessage(result.hypeMessage)
      setTimeout(() => setHypeMessage(null), 2500)
      
      showSuccessToast(`Completed in ${finalSessions.length} session${finalSessions.length > 1 ? 's' : ''}!`)
      
      // Reset for next task
      setTimerState('stopped')
      setSessions([])
      setSessionCount(1)
      setElapsedMs(0)
      sessionStartRef.current = null
      clearLocalStorage()
      
      // Move to next task
      if (currentTaskIndex < tasks.length - 1) {
        setCurrentTaskIndex(prev => prev + 1)
      }
      
      onTaskComplete?.(currentTask.id)
      onRefresh?.()
    } catch (error) {
      console.error('Error completing task:', error)
      showErrorToast(error, 'Failed to complete task')
    }
  }, [currentTask, sessions, timerState, currentTaskIndex, tasks.length, celebrate, onTaskComplete, onRefresh, clearLocalStorage])

  // Hand off task to someone else - counts as completed for today
  const handOffTask = useCallback(async (assigneeId: string) => {
    if (!currentTask) return
    
    const assignee = teamMembers.find(m => m.id === assigneeId)
    if (!assignee) return
    
    // Complete current session if running
    let finalSessions = sessions
    if (timerState === 'running' && sessionStartRef.current) {
      const duration = Date.now() - sessionStartRef.current
      finalSessions = sessions.map((s, i) => 
        i === sessions.length - 1 
          ? { ...s, end: new Date().toLocaleTimeString(), duration_ms: duration }
          : s
      )
    }
    
    const isAgent = assignee.is_agent || assignee.user_type === 'ai_agent'
    
    try {
      await supabase
        .from('tasks')
        .update({
          status: 'todo',
          assignee_id: isAgent ? null : assigneeId,
          ai_agent: isAgent ? assignee.name?.toLowerCase() : null,
          focus_queue_order: null, // Remove from focus queue
          timer_state: 'stopped',
          current_session_start: null,
          focus_sessions: finalSessions,
          total_session_count: finalSessions.length,
          total_time_spent_ms: finalSessions.reduce((sum, s) => sum + (s.duration_ms || 0), 0)
        })
        .eq('id', currentTask.id)

      // Celebrate - this counts!
      const result = celebrate()
      setHypeMessage(result.hypeMessage)
      setTimeout(() => setHypeMessage(null), 2500)
      
      showSuccessToast(`Handed off to ${assignee.display_name || assignee.name || assignee.email}!`)
      
      // Reset for next task
      setTimerState('stopped')
      setSessions([])
      setSessionCount(1)
      setElapsedMs(0)
      sessionStartRef.current = null
      clearLocalStorage()
      
      // Move to next task
      if (currentTaskIndex < tasks.length - 1) {
        setCurrentTaskIndex(prev => prev + 1)
      }
      
      onTaskComplete?.(currentTask.id)
      onRefresh?.()
    } catch (error) {
      console.error('Error handing off task:', error)
      showErrorToast(error, 'Failed to hand off task')
    }
  }, [currentTask, sessions, timerState, teamMembers, currentTaskIndex, tasks.length, celebrate, onTaskComplete, onRefresh, clearLocalStorage])

  // Follow up later - counts as completed for today, stays assigned to me
  const followUpLater = useCallback(async (days: number, specificDate?: string) => {
    if (!currentTask) return
    
    // Complete current session if running
    let finalSessions = sessions
    if (timerState === 'running' && sessionStartRef.current) {
      const duration = Date.now() - sessionStartRef.current
      finalSessions = sessions.map((s, i) => 
        i === sessions.length - 1 
          ? { ...s, end: new Date().toLocaleTimeString(), duration_ms: duration }
          : s
      )
    }
    
    // Calculate follow-up date
    let followUpDate: string
    if (specificDate) {
      followUpDate = specificDate
    } else {
      const date = new Date()
      date.setDate(date.getDate() + days)
      followUpDate = date.toISOString().split('T')[0]
    }
    
    try {
      await supabase
        .from('tasks')
        .update({
          status: 'in_progress', // Keep in progress
          focus_queue_order: null, // Remove from today's queue
          due_date: followUpDate, // Set as new due date
          timer_state: 'stopped',
          current_session_start: null,
          focus_sessions: finalSessions,
          total_session_count: finalSessions.length,
          total_time_spent_ms: finalSessions.reduce((sum, s) => sum + (s.duration_ms || 0), 0)
        })
        .eq('id', currentTask.id)

      // Celebrate - this counts!
      const result = celebrate()
      setHypeMessage(result.hypeMessage)
      setTimeout(() => setHypeMessage(null), 2500)
      
      const dateLabel = days === 1 ? 'tomorrow' : days === 7 ? 'next week' : `in ${days} days`
      showSuccessToast(`Following up ${specificDate ? 'on ' + followUpDate : dateLabel}!`)
      
      // Reset for next task
      setTimerState('stopped')
      setSessions([])
      setSessionCount(1)
      setElapsedMs(0)
      sessionStartRef.current = null
      clearLocalStorage()
      setShowDatePicker(false)
      setCustomDate('')
      
      // Move to next task
      if (currentTaskIndex < tasks.length - 1) {
        setCurrentTaskIndex(prev => prev + 1)
      }
      
      onTaskComplete?.(currentTask.id)
      onRefresh?.()
    } catch (error) {
      console.error('Error setting follow up:', error)
      showErrorToast(error, 'Failed to set follow up')
    }
  }, [currentTask, sessions, timerState, currentTaskIndex, tasks.length, celebrate, onTaskComplete, onRefresh, clearLocalStorage])

  const resetTimer = useCallback(() => {
    setTimerState('stopped')
    setSessions([])
    setSessionCount(1)
    setElapsedMs(0)
    sessionStartRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    clearLocalStorage()
    saveTimerState('stopped', [])
  }, [clearLocalStorage])

  const getSessionBadgeStyle = () => {
    if (sessionCount >= 5) return 'bg-red-500 text-white'
    if (sessionCount >= 3) return 'bg-yellow-500 text-white'
    return 'bg-white/20 text-white'
  }

  const getSessionEmoji = () => {
    return SESSION_EMOJIS[Math.min(sessionCount - 1, SESSION_EMOJIS.length - 1)]
  }

  if (!currentTask) {
    return (
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <CardBody className="text-center py-12">
          <Zap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No tasks in queue</p>
          <p className="text-xs text-slate-400 mt-1">Add tasks to get started</p>
        </CardBody>
      </Card>
    )
  }

  return (
    <>
      {/* Hype Message Overlay */}
      {hypeMessage && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="text-5xl font-black text-white animate-bounce drop-shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
               style={{ textShadow: '0 0 30px rgba(34, 197, 94, 0.8), 0 0 60px rgba(34, 197, 94, 0.5)' }}>
            {hypeMessage}
          </div>
        </div>
      )}

      <Card className={`bg-white dark:bg-slate-900 border-2 shadow-lg overflow-hidden transition-all ${
        timerState === 'running' 
          ? 'border-green-500 shadow-green-500/30 shadow-xl animate-pulse-border' 
          : 'border-violet-500'
      }`}>
        {/* Header */}
        <CardHeader className={`px-6 py-4 flex items-center justify-between transition-all ${
          timerState === 'running'
            ? 'bg-gradient-to-r from-green-600 to-emerald-600'
            : 'bg-gradient-to-r from-violet-600 to-purple-600'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center ${timerState === 'running' ? 'animate-bounce' : ''}`}>
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white">Focus Queue</h2>
              <p className="text-xs text-white/70">
                {currentTaskIndex + 1} of {Math.min(tasks.length, 5)} • {timerState === 'running' ? 'LOCKED IN 🔥' : 'Stay locked in'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Break Reminder Pill - shows after 3+ tasks */}
            {todayCompletedCount >= 3 && (
              <div className="flex items-center gap-1.5 bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-full animate-bounce">
                <span>{BREAK_MESSAGES[todayCompletedCount % BREAK_MESSAGES.length].emoji}</span>
                <span>{BREAK_MESSAGES[todayCompletedCount % BREAK_MESSAGES.length].text}</span>
              </div>
            )}
            {/* Session Badge */}
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition-all ${getSessionBadgeStyle()}`}>
              <span className="text-sm font-medium">Session {getSessionEmoji()}</span>
              <span className="bg-white text-violet-600 text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center">
                {sessionCount}
              </span>
            </div>
            {/* Progress dots */}
            <div className="flex gap-1.5">
              {queuedTasks.slice(0, 5).map((_, i) => (
                <div 
                  key={i} 
                  className={`w-3 h-3 rounded-full ${
                    i < currentTaskIndex 
                      ? 'bg-green-400' 
                      : i === currentTaskIndex 
                        ? 'bg-yellow-400 animate-pulse' 
                        : 'bg-white/30'
                  }`} 
                />
              ))}
            </div>
          </div>
        </CardHeader>

        <CardBody className="p-6">
          {/* Task Info - Clickable to view details */}
          <div 
            className="mb-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-2 px-2 py-2 rounded-lg transition-colors group"
            onClick={() => setViewTask(currentTask)}
          >
            <div className="flex items-center gap-2 mb-2">
              <Chip size="sm" color={currentTask.priority === 'high' ? 'danger' : currentTask.priority === 'medium' ? 'warning' : 'default'}>
                {currentTask.priority?.toUpperCase()}
              </Chip>
              {currentTask.project?.name && (
                <Chip size="sm" variant="flat" color="secondary">
                  {currentTask.project.icon} {currentTask.project.name}
                </Chip>
              )}
              <ExternalLink className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{currentTask.title}</h3>
            {currentTask.description && (
              <p className="text-slate-500 text-sm mt-1 line-clamp-2">
                {currentTask.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to view details</p>
          </div>

          {/* Timer */}
          <div className="flex items-center justify-center my-6">
            <div className={`rounded-2xl px-8 py-5 text-center transition-all ${
              timerState === 'running'
                ? 'bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 ring-2 ring-green-400 ring-offset-2 dark:ring-offset-slate-900'
                : 'bg-slate-100 dark:bg-slate-800'
            }`}>
              <div className={`text-5xl font-mono font-bold transition-colors ${
                timerState === 'running' 
                  ? 'text-green-600 dark:text-green-400 animate-pulse' 
                  : 'text-slate-800 dark:text-slate-100'
              }`}>
                {formatTime(elapsedMs)}
              </div>
              <div className={`text-sm mt-2 ${timerState === 'running' ? 'text-green-600 dark:text-green-400 font-medium' : 'text-slate-500'}`}>
                {timerState === 'stopped' && sessions.length === 0 && 'Ready to start'}
                {timerState === 'running' && `🔥 Session ${sessionCount} • GO GO GO`}
                {timerState === 'paused' && `Paused — Resume = Session ${sessionCount + 1}`}
                {timerState === 'stopped' && sessions.length > 0 && `Completed in ${sessions.length} sessions`}
              </div>
              
              {/* Session dots */}
              {sessions.length > 0 && (
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  {sessions.map((s, i) => (
                    <div 
                      key={i}
                      className={`w-3 h-3 rounded-full transition-all ${
                        s.duration_ms !== null ? 'bg-green-500' : 'bg-violet-500 animate-pulse'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {timerState === 'stopped' && sessions.length === 0 && (
              <Button 
                color="success" 
                size="lg" 
                onPress={startTimer}
                startContent={<Play className="w-5 h-5" />}
                className="font-bold shadow-lg"
              >
                Start
              </Button>
            )}
            {(timerState === 'running' || timerState === 'paused') && (
              <>
                {timerState === 'running' && (
                  <Button 
                    variant="flat" 
                    size="sm"
                    onPress={pauseTimer}
                    startContent={<Pause className="w-4 h-4" />}
                  >
                    Pause
                  </Button>
                )}
                {timerState === 'paused' && (
                  <Button 
                    color="primary" 
                    size="sm"
                    onPress={startTimer}
                    startContent={<Play className="w-4 h-4" />}
                  >
                    Resume
                  </Button>
                )}
                
                {/* Main action buttons */}
                <Button 
                  color="success" 
                  onPress={finishTask}
                  startContent={<Check className="w-4 h-4" />}
                  className="font-bold"
                >
                  Done ✓
                </Button>
                
                {/* Hand Off dropdown */}
                <Dropdown>
                  <DropdownTrigger>
                    <Button 
                      color="primary" 
                      variant="flat"
                      endContent={<ChevronDown className="w-4 h-4" />}
                    >
                      Hand Off →
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu 
                    aria-label="Hand off to"
                    onAction={(key) => handOffTask(key as string)}
                  >
                    <DropdownSection title="Hand off to">
                      {teamMembers.map(member => (
                        <DropdownItem 
                          key={member.id}
                          startContent={
                            member.is_agent || member.user_type === 'ai_agent' 
                              ? <Bot className="w-4 h-4 text-purple-500" />
                              : <User className="w-4 h-4 text-blue-500" />
                          }
                        >
                          {member.display_name || member.name || member.email}
                        </DropdownItem>
                      ))}
                    </DropdownSection>
                  </DropdownMenu>
                </Dropdown>
                
                {/* Later dropdown */}
                <Popover isOpen={showDatePicker} onOpenChange={setShowDatePicker}>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button 
                        color="warning" 
                        variant="flat"
                        endContent={<ChevronDown className="w-4 h-4" />}
                      >
                        Later ⏰
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu 
                      aria-label="Follow up later"
                      onAction={(key) => {
                        const option = LATER_OPTIONS.find(o => o.key === key)
                        if (option) {
                          if (option.key === 'custom') {
                            setShowDatePicker(true)
                          } else {
                            followUpLater(option.days)
                          }
                        }
                      }}
                    >
                      {LATER_OPTIONS.map(option => (
                        <DropdownItem 
                          key={option.key}
                          startContent={<Clock className="w-4 h-4 text-amber-500" />}
                        >
                          {option.label}
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  </Dropdown>
                  <PopoverTrigger>
                    <span></span>
                  </PopoverTrigger>
                  <PopoverContent>
                    <div className="p-3 space-y-3">
                      <p className="text-sm font-medium">Pick a date</p>
                      <input 
                        type="date" 
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full p-2 border rounded-lg text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="flat" onPress={() => setShowDatePicker(false)}>
                          Cancel
                        </Button>
                        <Button 
                          size="sm" 
                          color="warning" 
                          isDisabled={!customDate}
                          onPress={() => followUpLater(0, customDate)}
                        >
                          Set Follow Up
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            )}
            {timerState === 'stopped' && sessions.length > 0 && (
              <Button 
                variant="flat" 
                onPress={resetTimer}
                startContent={<RotateCcw className="w-4 h-4" />}
              >
                Reset
              </Button>
            )}
          </div>

          {/* Session History */}
          {sessions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="w-full text-left text-xs text-slate-400 uppercase font-medium mb-2 flex items-center gap-2 hover:text-slate-600"
              >
                <span>Session History</span>
                <span>{showHistory ? '▲' : '▼'}</span>
              </button>
              {showHistory && (
                <div className="space-y-1.5">
                  {sessions.map((s) => (
                    <div key={s.num} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-400 rounded-full flex items-center justify-center text-xs font-bold">
                          {s.num}
                        </span>
                        <span className="text-slate-500">{s.start} → {s.end || '...'}</span>
                      </div>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {s.duration_ms ? formatTime(s.duration_ms) : '...'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Up Next */}
          {tasks[currentTaskIndex + 1] && (
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-400 uppercase font-medium mb-2">Up Next</div>
              <div 
                className="flex items-center gap-3 text-slate-600 dark:text-slate-400 cursor-pointer hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                onClick={() => setViewTask(tasks[currentTaskIndex + 1])}
              >
                <div className="w-7 h-7 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center text-sm font-medium">
                  {currentTaskIndex + 2}
                </div>
                <span className="line-clamp-1">{tasks[currentTaskIndex + 1].title}</span>
                <Chip size="sm" variant="flat" className="ml-auto">
                  {tasks[currentTaskIndex + 1].priority?.toUpperCase()}
                </Chip>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
      
      {/* Task Detail Modal */}
      <TaskDetailModal
        task={viewTask}
        isOpen={!!viewTask}
        onClose={() => setViewTask(null)}
        onTaskUpdated={() => {
          setViewTask(null)
          onRefresh?.()
        }}
      />
    </>
  )
}
