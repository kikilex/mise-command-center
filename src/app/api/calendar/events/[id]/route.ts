import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Get authenticated user from request
async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// GET - Get single event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    
    const { data: event, error } = await supabaseAdmin
      .from('calendar_events')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ event })
  } catch (error) {
    console.error('Get event error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT - Update event
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    
    // Get existing event first
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('calendar_events')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .single()
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    
    const updateData = {
      title: body.title ?? existing.title,
      description: body.description ?? existing.description,
      start_time: body.start_time ?? existing.start_time,
      end_time: body.end_time ?? existing.end_time,
      all_day: body.all_day ?? existing.all_day,
      location: body.location ?? existing.location,
      calendar_name: body.calendar_name ?? existing.calendar_name,
      updated_at: new Date().toISOString(),
    }
    
    // Try to update in Apple Calendar if we have an apple_event_id
    let syncStatus = existing.sync_status
    let lastSyncedAt = existing.last_synced_at
    
    if (existing.apple_event_id) {
      try {
        await updateAppleCalendarEvent(existing.apple_event_id, {
          ...updateData,
          calendar_name: existing.calendar_name, // Use original calendar
        })
        syncStatus = 'synced'
        lastSyncedAt = new Date().toISOString()
      } catch (err) {
        console.error('Failed to update Apple Calendar event:', err)
        syncStatus = 'pending_push'
      }
    }
    
    // Update in Supabase
    const { data: event, error } = await supabaseAdmin
      .from('calendar_events')
      .update({
        ...updateData,
        sync_status: syncStatus,
        last_synced_at: lastSyncedAt,
      })
      .eq('id', id)
      .eq('created_by', user.id)
      .select()
      .single()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ event })
  } catch (error) {
    console.error('Update event error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE - Delete event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    
    // Get event first to get apple_event_id
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('calendar_events')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .single()
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    
    // Try to delete from Apple Calendar
    if (existing.apple_event_id) {
      try {
        await deleteAppleCalendarEvent(existing.apple_event_id, existing.calendar_name)
      } catch (err) {
        console.error('Failed to delete from Apple Calendar:', err)
        // Continue with Supabase deletion anyway
      }
    }
    
    // Delete from Supabase
    const { error } = await supabaseAdmin
      .from('calendar_events')
      .delete()
      .eq('id', id)
      .eq('created_by', user.id)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete event error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Helper: Update event in Apple Calendar
async function updateAppleCalendarEvent(uid: string, event: {
  title: string
  description?: string | null
  start_time: string
  end_time: string
  all_day: boolean
  location?: string | null
  calendar_name: string
}): Promise<void> {
  const startDate = new Date(event.start_time)
  const endDate = new Date(event.end_time)
  
  const formatAppleDate = (d: Date) => {
    return `date "${d.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })} at ${d.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })}"`
  }
  
  const escapeForAppleScript = (s: string) => s.replace(/"/g, '\\"').replace(/\\/g, '\\\\')
  
  const titleEscaped = escapeForAppleScript(event.title)
  const descEscaped = event.description ? escapeForAppleScript(event.description) : ''
  const locationEscaped = event.location ? escapeForAppleScript(event.location) : ''
  
  const calendarMap: Record<string, string> = {
    'Family': 'Home',
    'Work': 'Work',
    'Personal': 'Home',
  }
  const calendarName = calendarMap[event.calendar_name] || 'Home'
  
  const script = `
tell application "Calendar"
  tell calendar "${calendarName}"
    set theEvents to (every event whose uid is "${uid}")
    if (count of theEvents) > 0 then
      set theEvent to item 1 of theEvents
      set summary of theEvent to "${titleEscaped}"
      set start date of theEvent to ${formatAppleDate(startDate)}
      set end date of theEvent to ${formatAppleDate(endDate)}
      ${descEscaped ? `set description of theEvent to "${descEscaped}"` : ''}
      ${locationEscaped ? `set location of theEvent to "${locationEscaped}"` : ''}
    end if
  end tell
end tell
`
  
  await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`, {
    timeout: 15000,
    env: { ...process.env, PATH: '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin' }
  })
}

// Helper: Delete event from Apple Calendar
async function deleteAppleCalendarEvent(uid: string, calendarName: string): Promise<void> {
  const calendarMap: Record<string, string> = {
    'Family': 'Home',
    'Work': 'Work',
    'Personal': 'Home',
  }
  const calendar = calendarMap[calendarName] || 'Home'
  
  const script = `
tell application "Calendar"
  tell calendar "${calendar}"
    set theEvents to (every event whose uid is "${uid}")
    repeat with theEvent in theEvents
      delete theEvent
    end repeat
  end tell
end tell
`
  
  await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`, {
    timeout: 15000,
    env: { ...process.env, PATH: '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin' }
  })
}
