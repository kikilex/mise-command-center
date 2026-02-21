import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Create admin client for bypassing RLS
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

export interface CalendarEvent {
  id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  all_day: boolean
  location: string | null
  calendar_name: string
  apple_event_id: string | null
  business_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  last_synced_at: string | null
  sync_status: string
}

// GET - List events from Supabase
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const calendars = searchParams.get('calendars')?.split(',')
    
    let query = supabaseAdmin
      .from('calendar_events')
      .select('*')
      .eq('created_by', user.id)  // Filter by user!
      .order('start_time', { ascending: true })
    
    if (start) {
      query = query.gte('start_time', `${start}T00:00:00`)
    }
    if (end) {
      query = query.lte('start_time', `${end}T23:59:59`)
    }
    if (calendars && calendars.length > 0) {
      query = query.in('calendar_name', calendars)
    }
    
    const { data: events, error } = await query
    
    if (error) {
      console.error('Failed to fetch events:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Transform to the format expected by the frontend
    const transformedEvents = (events || []).map(e => ({
      id: e.id,
      title: e.title,
      date: e.start_time.split('T')[0],
      time: e.all_day ? null : e.start_time.split('T')[1]?.substring(0, 5),
      calendar: e.calendar_name,
      isAllDay: e.all_day,
      // Include full data for detail views
      description: e.description,
      start_time: e.start_time,
      end_time: e.end_time,
      location: e.location,
      apple_event_id: e.apple_event_id,
      sync_status: e.sync_status,
    }))
    
    return NextResponse.json({ 
      events: transformedEvents,
      calendars: ['Family', 'Work', 'Personal'],
    })
  } catch (error) {
    console.error('Calendar events API error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST - Create new event (also push to Apple Calendar)
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { 
      title, 
      description, 
      start_time, 
      end_time, 
      all_day = false, 
      location, 
      calendar_name = 'Personal',
      business_id 
    } = body
    
    if (!title || !start_time || !end_time) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    // First, create in Apple Calendar
    let apple_event_id: string | null = null
    try {
      apple_event_id = await createAppleCalendarEvent({
        title,
        description,
        start_time,
        end_time,
        all_day,
        location,
        calendar_name,
      })
    } catch (err) {
      console.error('Failed to create Apple Calendar event:', err)
      // Continue without Apple Calendar ID - will try again on sync
    }
    
    // Then insert into Supabase
    const { data: event, error } = await supabaseAdmin
      .from('calendar_events')
      .insert({
        title,
        description,
        start_time,
        end_time,
        all_day,
        location,
        calendar_name,
        apple_event_id,
        business_id,
        created_by: user.id,  // Set owner
        sync_status: apple_event_id ? 'synced' : 'pending_push',
        last_synced_at: apple_event_id ? new Date().toISOString() : null,
      })
      .select()
      .single()
    
    if (error) {
      console.error('Failed to create event:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ event })
  } catch (error) {
    console.error('Create event error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Helper: Create event in Apple Calendar using AppleScript
async function createAppleCalendarEvent(event: {
  title: string
  description?: string | null
  start_time: string
  end_time: string
  all_day: boolean
  location?: string | null
  calendar_name: string
}): Promise<string | null> {
  const startDate = new Date(event.start_time)
  const endDate = new Date(event.end_time)
  
  // Format dates for AppleScript
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
  
  // Escape for AppleScript
  const escapeForAppleScript = (s: string) => s.replace(/"/g, '\\"').replace(/\\/g, '\\\\')
  
  const titleEscaped = escapeForAppleScript(event.title)
  const descEscaped = event.description ? escapeForAppleScript(event.description) : ''
  const locationEscaped = event.location ? escapeForAppleScript(event.location) : ''
  
  // Map calendar names
  const calendarMap: Record<string, string> = {
    'Family': 'Home',
    'Work': 'Work',
    'Personal': 'Home',
  }
  const calendarName = calendarMap[event.calendar_name] || 'Home'
  
  const script = `
tell application "Calendar"
  tell calendar "${calendarName}"
    set newEvent to make new event with properties {summary:"${titleEscaped}", start date:${formatAppleDate(startDate)}, end date:${formatAppleDate(endDate)}${event.all_day ? ', allday event:true' : ''}${descEscaped ? `, description:"${descEscaped}"` : ''}${locationEscaped ? `, location:"${locationEscaped}"` : ''}}
    return uid of newEvent
  end tell
end tell
`
  
  try {
    const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`, {
      timeout: 15000,
      env: { ...process.env, PATH: '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin' }
    })
    return stdout.trim() || null
  } catch (error) {
    console.error('AppleScript error:', error)
    throw error
  }
}
