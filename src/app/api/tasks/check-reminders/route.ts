import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface Task {
  id: string
  title: string
  due_date: string
  priority: string
  assignee_id: string | null
  status: string
  reminded_at: string | null
}

interface User {
  id: string
  email: string
  name: string | null
}

interface ReminderTask {
  id: string
  title: string
  due_date: string
  priority: string
  status: string
  assignee: {
    id: string
    email: string
    name: string | null
  } | null
}

// Use service role for cron/API access (no cookies needed)
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    
    // Calculate 24 hours from now
    const now = new Date()
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    
    // Query tasks due within the next 24 hours that haven't been reminded
    // Exclude completed tasks (done status)
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, due_date, priority, assignee_id, status, reminded_at')
      .not('status', 'eq', 'done')
      .not('due_date', 'is', null)
      .gte('due_date', now.toISOString())
      .lte('due_date', in24Hours.toISOString())
      .is('reminded_at', null)
      .order('due_date', { ascending: true })
    
    if (tasksError) {
      // Check if the error is about missing reminded_at column
      if (tasksError.message.includes('reminded_at')) {
        return NextResponse.json({ 
          error: 'The reminded_at column does not exist in the tasks table. Please run the migration.',
          migration: `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;`,
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
    
    // Get unique assignee IDs (excluding null)
    const assigneeIds = [...new Set(tasks
      .map(t => t.assignee_id)
      .filter((id): id is string => id !== null)
    )]
    
    // Fetch user info for assignees
    let users: User[] = []
    if (assigneeIds.length > 0) {
      const { data: userData, error: usersError } = await supabase
        .from('users')
        .select('id, email, name')
        .in('id', assigneeIds)
      
      if (usersError) {
        console.error('Error fetching users:', usersError)
        // Continue without user data
      } else {
        users = userData || []
      }
    }
    
    // Create a lookup map for users
    const userMap = new Map(users.map(u => [u.id, u]))
    
    // Mark tasks as reminded
    const taskIds = tasks.map(t => t.id)
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ reminded_at: now.toISOString() })
      .in('id', taskIds)
    
    if (updateError) {
      console.error('Error marking tasks as reminded:', updateError)
      return NextResponse.json({ 
        error: `Failed to mark tasks as reminded: ${updateError.message}` 
      }, { status: 500 })
    }
    
    // Build reminder list with assignee info
    const reminders: ReminderTask[] = tasks.map(task => ({
      id: task.id,
      title: task.title,
      due_date: task.due_date,
      priority: task.priority,
      status: task.status,
      assignee: task.assignee_id ? userMap.get(task.assignee_id) || null : null
    }))
    
    return NextResponse.json({
      reminders,
      count: reminders.length,
      marked_at: now.toISOString(),
      window: {
        from: now.toISOString(),
        to: in24Hours.toISOString()
      }
    })
  } catch (error) {
    console.error('Check reminders API error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST endpoint to reset reminded_at for testing or re-sending reminders
export async function POST(request: Request) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()
    
    // Allow resetting specific task IDs or all reminded tasks
    const { taskIds, resetAll } = body as { taskIds?: string[], resetAll?: boolean }
    
    if (resetAll) {
      // Reset all reminded tasks
      const { error } = await supabase
        .from('tasks')
        .update({ reminded_at: null })
        .not('reminded_at', 'is', null)
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Reset all reminded tasks' 
      })
    }
    
    if (taskIds && taskIds.length > 0) {
      // Reset specific tasks
      const { error } = await supabase
        .from('tasks')
        .update({ reminded_at: null })
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
    
    return NextResponse.json({ 
      error: 'Provide taskIds array or set resetAll to true' 
    }, { status: 400 })
  } catch (error) {
    console.error('Reset reminders error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
