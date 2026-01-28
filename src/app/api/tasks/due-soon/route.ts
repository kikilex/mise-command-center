import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface Task {
  id: string
  title: string
  due_date: string
  priority: string
  assignee_id: string | null
  status: string
}

interface User {
  id: string
  email: string
  name: string | null
}

interface TaskWithAssignee extends Task {
  assignee: User | null
}

interface GroupedTasks {
  [assigneeId: string]: {
    assignee: User | null
    tasks: TaskWithAssignee[]
  }
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
    
    // Query tasks due within the next 24 hours
    // Exclude completed tasks (done status)
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, due_date, priority, assignee_id, status')
      .not('status', 'eq', 'done')
      .not('due_date', 'is', null)
      .gte('due_date', now.toISOString())
      .lte('due_date', in24Hours.toISOString())
      .order('due_date', { ascending: true })
    
    if (tasksError) {
      console.error('Error fetching tasks:', tasksError)
      return NextResponse.json({ error: tasksError.message }, { status: 500 })
    }
    
    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ 
        tasks: [],
        grouped: {},
        count: 0,
        message: 'No tasks due within the next 24 hours'
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
    
    // Group tasks by assignee
    const grouped: GroupedTasks = {}
    
    for (const task of tasks) {
      const key = task.assignee_id || 'unassigned'
      const assignee = task.assignee_id ? userMap.get(task.assignee_id) || null : null
      
      if (!grouped[key]) {
        grouped[key] = {
          assignee,
          tasks: []
        }
      }
      
      grouped[key].tasks.push({
        ...task,
        assignee
      })
    }
    
    return NextResponse.json({
      tasks: tasks.map(t => ({
        ...t,
        assignee: t.assignee_id ? userMap.get(t.assignee_id) || null : null
      })),
      grouped,
      count: tasks.length,
      window: {
        from: now.toISOString(),
        to: in24Hours.toISOString()
      }
    })
  } catch (error) {
    console.error('Due soon API error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
