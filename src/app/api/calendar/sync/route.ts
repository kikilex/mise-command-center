import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface AppleCalendarEvent {
  uid: string
  title: string
  start_time: string
  end_time: string
  all_day: boolean
  description: string | null
  location: string | null
  calendar_name: string
}

// POST - Trigger full sync
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const calendars = body.calendars || ['Home', 'Work']
    const daysBack = body.daysBack || 30
    const daysForward = body.daysForward || 90
    
    const results = {
      pulled: 0,
      pushed: 0,
      updated: 0,
      deleted: 0,
      conflicts: 0,
      errors: [] as string[],
    }
    
    // Step 1: Pull events from Apple Calendar
    const appleEvents = await fetchAppleCalendarEvents(calendars, daysBack, daysForward)
    
    // Step 2: Get existing events from Supabase
    const { data: supabaseEvents, error: fetchError } = await supabaseAdmin
      .from('calendar_events')
      .select('*')
    
    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    
    // Create maps for easier lookup
    const supabaseByAppleId = new Map(
      supabaseEvents
        .filter(e => e.apple_event_id)
        .map(e => [e.apple_event_id, e])
    )
    const appleByUid = new Map(appleEvents.map(e => [e.uid, e]))
    
    // Step 3: Process Apple events (pull)
    for (const appleEvent of appleEvents) {
      const existingEvent = supabaseByAppleId.get(appleEvent.uid)
      
      if (!existingEvent) {
        // New event from Apple Calendar - insert into Supabase
        try {
          const { error } = await supabaseAdmin
            .from('calendar_events')
            .insert({
              title: appleEvent.title,
              description: appleEvent.description,
              start_time: appleEvent.start_time,
              end_time: appleEvent.end_time,
              all_day: appleEvent.all_day,
              location: appleEvent.location,
              calendar_name: mapCalendarName(appleEvent.calendar_name),
              apple_event_id: appleEvent.uid,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
            })
          
          if (error) throw error
          results.pulled++
        } catch (err) {
          results.errors.push(`Failed to pull event: ${appleEvent.title}`)
        }
      } else {
        // Event exists - check if Apple version is newer (compare content)
        const appleNewer = hasEventChanged(existingEvent, appleEvent)
        
        if (appleNewer && existingEvent.sync_status !== 'pending_push') {
          // Update Supabase from Apple
          try {
            const { error } = await supabaseAdmin
              .from('calendar_events')
              .update({
                title: appleEvent.title,
                description: appleEvent.description,
                start_time: appleEvent.start_time,
                end_time: appleEvent.end_time,
                all_day: appleEvent.all_day,
                location: appleEvent.location,
                sync_status: 'synced',
                last_synced_at: new Date().toISOString(),
              })
              .eq('id', existingEvent.id)
            
            if (error) throw error
            results.updated++
          } catch (err) {
            results.errors.push(`Failed to update event: ${appleEvent.title}`)
          }
        }
      }
    }
    
    // Step 4: Push pending events to Apple Calendar
    const pendingPush = supabaseEvents.filter(e => e.sync_status === 'pending_push')
    
    for (const event of pendingPush) {
      try {
        const appleUid = await createAppleCalendarEvent(event)
        
        if (appleUid) {
          await supabaseAdmin
            .from('calendar_events')
            .update({
              apple_event_id: appleUid,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', event.id)
          
          results.pushed++
        }
      } catch (err) {
        results.errors.push(`Failed to push event: ${event.title}`)
      }
    }
    
    // Step 5: Handle deleted events (in Apple but not in Supabase)
    // Events that exist in Supabase with apple_event_id but not in Apple anymore
    for (const event of supabaseEvents) {
      if (event.apple_event_id && !appleByUid.has(event.apple_event_id)) {
        // Event was deleted from Apple Calendar
        // For now, we also delete from Supabase (could make this configurable)
        try {
          await supabaseAdmin
            .from('calendar_events')
            .delete()
            .eq('id', event.id)
          
          results.deleted++
        } catch (err) {
          results.errors.push(`Failed to sync deletion: ${event.title}`)
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      results,
      synced_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Sync error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Map Apple Calendar names to our names
function mapCalendarName(appleName: string): string {
  const map: Record<string, string> = {
    'Home': 'Family',
    'Work': 'Work',
    'Personal': 'Personal',
  }
  return map[appleName] || 'Personal'
}

// Check if event content has changed
function hasEventChanged(
  supabase: { title: string; start_time: string; end_time: string; description: string | null; location: string | null },
  apple: AppleCalendarEvent
): boolean {
  // Normalize times for comparison (remove milliseconds)
  const normalizeTime = (t: string) => t.replace(/\.\d{3}Z$/, 'Z')
  
  return (
    supabase.title !== apple.title ||
    normalizeTime(supabase.start_time) !== normalizeTime(apple.start_time) ||
    normalizeTime(supabase.end_time) !== normalizeTime(apple.end_time) ||
    (supabase.description || '') !== (apple.description || '') ||
    (supabase.location || '') !== (apple.location || '')
  )
}

// Fetch events from Apple Calendar using AppleScript
async function fetchAppleCalendarEvents(
  calendars: string[],
  daysBack: number,
  daysForward: number
): Promise<AppleCalendarEvent[]> {
  const events: AppleCalendarEvent[] = []
  
  for (const calendar of calendars) {
    try {
      const script = `
set startDate to (current date) - ${daysBack} * days
set endDate to (current date) + ${daysForward} * days
set eventList to {}

tell application "Calendar"
  tell calendar "${calendar}"
    set theEvents to (every event whose start date ≥ startDate and start date ≤ endDate)
    repeat with theEvent in theEvents
      set eventUID to uid of theEvent
      set eventSummary to summary of theEvent
      set eventStart to start date of theEvent
      set eventEnd to end date of theEvent
      set isAllDay to allday event of theEvent
      set eventDesc to ""
      set eventLoc to ""
      try
        set eventDesc to description of theEvent
      end try
      try
        set eventLoc to location of theEvent
      end try
      
      -- Format dates as ISO strings
      set startISO to (year of eventStart as string) & "-" & my padNum(month of eventStart as integer) & "-" & my padNum(day of eventStart) & "T" & my padNum(hours of eventStart) & ":" & my padNum(minutes of eventStart) & ":00Z"
      set endISO to (year of eventEnd as string) & "-" & my padNum(month of eventEnd as integer) & "-" & my padNum(day of eventEnd) & "T" & my padNum(hours of eventEnd) & ":" & my padNum(minutes of eventEnd) & ":00Z"
      
      set end of eventList to {eventUID, eventSummary, startISO, endISO, isAllDay, eventDesc, eventLoc}
    end repeat
  end tell
end tell

on padNum(n)
  if n < 10 then
    return "0" & (n as string)
  else
    return n as string
  end if
end padNum

set output to ""
repeat with e in eventList
  set {eUID, eSummary, eStart, eEnd, eAllDay, eDesc, eLoc} to e
  set output to output & eUID & "|||" & eSummary & "|||" & eStart & "|||" & eEnd & "|||" & (eAllDay as string) & "|||" & eDesc & "|||" & eLoc & return
end repeat

return output
`
      
      const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`, {
        timeout: 30000,
        env: { ...process.env, PATH: '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin' }
      })
      
      // Parse output
      const lines = stdout.trim().split('\n').filter(l => l.includes('|||'))
      
      for (const line of lines) {
        const parts = line.split('|||')
        if (parts.length >= 5) {
          events.push({
            uid: parts[0].trim(),
            title: parts[1].trim(),
            start_time: parts[2].trim(),
            end_time: parts[3].trim(),
            all_day: parts[4].trim().toLowerCase() === 'true',
            description: parts[5]?.trim() || null,
            location: parts[6]?.trim() || null,
            calendar_name: calendar,
          })
        }
      }
    } catch (err) {
      console.error(`Failed to fetch events from ${calendar}:`, err)
    }
  }
  
  return events
}

// Create event in Apple Calendar
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
    console.error('AppleScript create error:', error)
    throw error
  }
}
