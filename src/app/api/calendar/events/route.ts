import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface CalendarEvent {
  id: string
  title: string
  date: string
  time: string | null
  calendar: string
  isAllDay: boolean
}

// Parse icalBuddy output grouped by calendar
function parseIcalBuddyOutput(output: string): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const lines = output.trim().split('\n')
  
  let currentCalendar = 'Unknown'
  
  for (const line of lines) {
    // Calendar header line (e.g., "US Holidays:")
    if (line.endsWith(':') && !line.includes(' | ')) {
      currentCalendar = line.slice(0, -1).trim()
      continue
    }
    
    // Separator line
    if (line.startsWith('---')) {
      continue
    }
    
    // Event line (e.g., "Valentine's Day | 2026-02-14" or "Meeting | 2026-02-14 at 09:00 - 10:00")
    if (line.includes(' | ')) {
      const parts = line.split(' | ')
      if (parts.length >= 2) {
        const title = parts[0].trim()
        const datetime = parts[1].trim()
        
        // Parse date and time
        // All-day: "2026-02-14"
        // Timed: "2026-02-14 at 09:00 - 10:00" or "2026-02-14 at 09:00"
        let date = ''
        let time: string | null = null
        let isAllDay = true
        
        const atIndex = datetime.indexOf(' at ')
        if (atIndex !== -1) {
          date = datetime.slice(0, atIndex).trim()
          const timeStr = datetime.slice(atIndex + 4).trim()
          // Extract start time (before any " - ")
          time = timeStr.split(' - ')[0].trim()
          isAllDay = false
        } else {
          // All-day event - just the date
          date = datetime.split(' ')[0] // Handle any trailing notes
        }
        
        // Generate a unique ID
        const id = `${currentCalendar}-${title}-${date}`.replace(/\s+/g, '-').toLowerCase()
        
        events.push({
          id,
          title,
          date,
          time,
          calendar: currentCalendar,
          isAllDay,
        })
      }
    }
  }
  
  return events
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start') || 'today'
    const end = searchParams.get('end') || 'today+30'
    const calendars = searchParams.get('calendars') || 'Home,Work,US Holidays,Birthdays'
    
    // Build icalBuddy command
    // -nc: no calendar names in output (we use -sc instead)
    // -nrd: no relative dates
    // -sc: separate by calendar (gives us calendar headers)
    // -b "": no bullet prefix
    // -ps "/ | /": property separator
    // -iep: include only these properties
    // -po: property order
    // -df: date format
    // -tf: time format
    // -ic: include calendars
    const cmd = `icalBuddy -nc -nrd -sc -b "" -ps "/ | /" -iep "title,datetime" -po "title,datetime" -df "%Y-%m-%d" -tf "%H:%M" -ic "${calendars}" eventsFrom:${start} to:${end}`
    
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 10000,
      env: { ...process.env, PATH: '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin' }
    })
    
    if (stderr && !stdout) {
      console.error('icalBuddy stderr:', stderr)
      return NextResponse.json({ events: [], error: stderr }, { status: 500 })
    }
    
    const events = parseIcalBuddyOutput(stdout)
    
    return NextResponse.json({ 
      events,
      calendars: calendars.split(',').map(c => c.trim()),
    })
  } catch (error) {
    console.error('Calendar API error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ events: [], error: message }, { status: 500 })
  }
}
