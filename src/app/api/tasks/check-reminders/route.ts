import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/*
 * MIGRATION SQL - Run this in Supabase SQL Editor:
 * 
 * -- Change reminded_at from TIMESTAMPTZ to JSONB to track multiple reminder windows
 * ALTER TABLE tasks DROP COLUMN IF EXISTS reminded_at;
 * ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminded_windows JSONB DEFAULT '[]'::jsonb;
 * 
 * -- Add settings JSONB column to users table if not exists
 * ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
 * 
 * -- Create index for faster queries
 * CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE status != 'done';
 */

interface Task {
  id: string
  title: string
  due_date: string
  priority: string
  assignee_id: string | null
  status: string
  reminded_windows: string[] // Array of reminder windows already sent: ['24h', '6h', '1h', 'day_of']
}

interface User {
  id: string
  email: string
  name: string | null
  settings?: {
    reminders?: ReminderSettings
  }
}

interface ReminderSettings {
  high: {
    '24h': boolean
    '6h': boolean
    '1h': boolean
  }
  medium: {
    '24h': boolean
  }
  low: {
    'day_of': boolean
  }
}

interface ReminderTask {
  id: string
  title: string
  due_date: string
  priority: string
  status: string
  window: string // Which reminder window triggered this
  assignee: {
    id: string
    email: string
    name: string | null
  } | null
}

const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  high: { '24h': true, '6h': true, '1h': true },
  medium: { '24h': true },
  low: { 'day_of': true },
}

// Reminder window definitions in milliseconds
const REMINDER_WINDOWS = {
  '24h': 24 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '1h': 1 * 60 * 60 * 1000,
  'day_of': 0, // Special handling - morning of due date
}

// Use service role for cron/API access (no cookies needed)
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Get applicable reminder windows based on priority and settings
function getApplicableWindows(priority: string, settings: ReminderSettings): string[] {
  const normalizedPriority = priority === 'critical' ? 'high' : priority
  
  switch (normalizedPriority) {
    case 'high':
      return Object.entries(settings.high)
        .filter(([, enabled]) => enabled)
        .map(([window]) => window)
    case 'medium':
      return Object.entries(settings.medium)
        .filter(([, enabled]) => enabled)
        .map(([window]) => window)
    case 'low':
      return Object.entries(settings.low)
        .filter(([, enabled]) => enabled)
        .map(([window]) => window)
    default:
      return ['24h'] // Default to 24h for unknown priorities
  }
}

// Check if a reminder window should fire now
function shouldSendReminder(
  dueDate: Date,
  window: string,
  now: Date,
  alreadySent: string[]
): boolean {
  // Skip if already sent
  if (alreadySent.includes(window)) {
    return false
  }
  
  const dueTime = dueDate.getTime()
  const nowTime = now.getTime()
  
  if (window === 'day_of') {
    // Day-of reminder: check if we're on the same day and it's morning (after 9 AM)
    const isSameDay = 
      dueDate.getFullYear() === now.getFullYear() &&
      dueDate.getMonth() === now.getMonth() &&
      dueDate.getDate() === now.getDate()
    
    const isAfter9AM = now.getHours() >= 9
    const isBefore = nowTime < dueTime
    
    return isSameDay && isAfter9AM && isBefore
  }
  
  // Standard window (24h, 6h, 1h)
  const windowMs = REMINDER_WINDOWS[window as keyof typeof REMINDER_WINDOWS]
  const windowStart = dueTime - windowMs
  
  // We're in the window if: windowStart <= now < dueTime
  // Also add a 30-minute buffer so we don't miss reminders
  const bufferMs = 30 * 60 * 1000
  return nowTime >= windowStart - bufferMs && nowTime < dueTime
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const now = new Date()
    
    // Query tasks with due dates that haven't passed yet
    // Include tasks due within the next 48 hours to catch all possible reminder windows
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000)
    
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, due_date, priority, assignee_id, status, reminded_windows')
      .not('status', 'eq', 'done')
      .not('due_date', 'is', null)
      .gte('due_date', now.toISOString())
      .lte('due_date', in48Hours.toISOString())
      .order('due_date', { ascending: true })
    
    if (tasksError) {
      // Check if error is about missing column
      if (tasksError.message.includes('reminded_windows')) {
        return NextResponse.json({ 
          error: 'The reminded_windows column does not exist. Please run the migration.',
          migration: `
ALTER TABLE tasks DROP COLUMN IF EXISTS reminded_at;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminded_windows JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
          `.trim(),
          hint: 'Run this SQL in your Supabase dashboard SQL editor'
        }, { status: 500 })
      }
      console.error('Error fetching tasks:', tasksError)
      return NextResponse.json({ error: tasksError.message }, { status: 500 })
    }
    
    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ 
        reminders: [],
        count: 0,
        message: 'No tasks need reminders'
      })
    }
    
    // Get unique assignee IDs
    const assigneeIds = [...new Set(tasks
      .map(t => t.assignee_id)
      .filter((id): id is string => id !== null)
    )]
    
    // Fetch users with their settings
    let users: User[] = []
    if (assigneeIds.length > 0) {
      const { data: userData, error: usersError } = await supabase
        .from('users')
        .select('id, email, name, settings')
        .in('id', assigneeIds)
      
      if (usersError) {
        console.error('Error fetching users:', usersError)
      } else {
        users = userData || []
      }
    }
    
    const userMap = new Map(users.map(u => [u.id, u]))
    
    // Process each task and determine which reminders to send
    const remindersToSend: ReminderTask[] = []
    const updatesToMake: { id: string; windows: string[] }[] = []
    
    for (const task of tasks) {
      const dueDate = new Date(task.due_date)
      const alreadySent: string[] = task.reminded_windows || []
      
      // Get user's reminder settings (or use defaults)
      const assigneeUser = task.assignee_id ? userMap.get(task.assignee_id) : null
      const settings = assigneeUser?.settings?.reminders || DEFAULT_REMINDER_SETTINGS
      
      // Get applicable windows for this priority
      const applicableWindows = getApplicableWindows(task.priority, settings)
      
      // Check each window
      const windowsToSendNow: string[] = []
      
      for (const window of applicableWindows) {
        if (shouldSendReminder(dueDate, window, now, alreadySent)) {
          windowsToSendNow.push(window)
          
          remindersToSend.push({
            id: task.id,
            title: task.title,
            due_date: task.due_date,
            priority: task.priority,
            status: task.status,
            window,
            assignee: assigneeUser ? {
              id: assigneeUser.id,
              email: assigneeUser.email,
              name: assigneeUser.name,
            } : null,
          })
        }
      }
      
      // Track which windows need to be marked as sent
      if (windowsToSendNow.length > 0) {
        updatesToMake.push({
          id: task.id,
          windows: [...alreadySent, ...windowsToSendNow],
        })
      }
    }
    
    // Update tasks to mark reminders as sent
    for (const update of updatesToMake) {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ reminded_windows: update.windows })
        .eq('id', update.id)
      
      if (updateError) {
        console.error(`Error updating task ${update.id}:`, updateError)
      }
    }
    
    return NextResponse.json({
      reminders: remindersToSend,
      count: remindersToSend.length,
      checked_at: now.toISOString(),
      tasks_checked: tasks.length,
      window: {
        from: now.toISOString(),
        to: in48Hours.toISOString(),
      },
    })
  } catch (error) {
    console.error('Check reminders API error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST endpoint to reset reminders for testing
export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()
    
    const { taskIds, resetAll, window: specificWindow } = body as { 
      taskIds?: string[]
      resetAll?: boolean
      window?: string
    }
    
    if (resetAll) {
      // Reset all tasks
      const { error } = await supabase
        .from('tasks')
        .update({ reminded_windows: [] })
        .not('reminded_windows', 'eq', '[]')
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Reset all task reminders' 
      })
    }
    
    if (taskIds && taskIds.length > 0) {
      if (specificWindow) {
        // Remove a specific window from the tasks
        for (const taskId of taskIds) {
          const { data: task, error: fetchError } = await supabase
            .from('tasks')
            .select('reminded_windows')
            .eq('id', taskId)
            .single()
          
          if (fetchError) continue
          
          const currentWindows: string[] = task?.reminded_windows || []
          const updatedWindows = currentWindows.filter(w => w !== specificWindow)
          
          await supabase
            .from('tasks')
            .update({ reminded_windows: updatedWindows })
            .eq('id', taskId)
        }
        
        return NextResponse.json({ 
          success: true, 
          message: `Removed ${specificWindow} reminder from ${taskIds.length} tasks`,
          taskIds 
        })
      } else {
        // Reset all windows for specific tasks
        const { error } = await supabase
          .from('tasks')
          .update({ reminded_windows: [] })
          .in('id', taskIds)
        
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
        
        return NextResponse.json({ 
          success: true, 
          message: `Reset ${taskIds.length} tasks`,
          taskIds 
        })
      }
    }
    
    return NextResponse.json({ 
      error: 'Provide taskIds array or set resetAll to true' 
    }, { status: 400 })
  } catch (error) {
    console.error('Reset reminders error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
