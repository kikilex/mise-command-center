import { NextResponse } from 'next/server'

const AGENT_WEBHOOKS: Record<string, string> = {
  ax: 'http://localhost:18789/hooks?token=ax-tony-secret-2026',
  tony: 'http://localhost:19789/hooks?token=tony-ax-secret-2026'
}

export async function POST(request: Request) {
  try {
    const { agent, message, sender } = await request.json()

    if (!agent || !message) {
      return NextResponse.json({ error: 'Missing agent or message' }, { status: 400 })
    }

    const webhookUrl = AGENT_WEBHOOKS[agent.toLowerCase()]
    
    if (!webhookUrl) {
      return NextResponse.json({ error: 'Agent webhook not configured' }, { status: 404 })
    }

    // Try to notify the agent via webhook
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[Inbox Message from ${sender}] ${message}`,
          name: sender,
          source: 'inbox'
        })
      })

      if (!response.ok) {
        console.warn(`Webhook failed for ${agent}: ${response.statusText}`)
      }
    } catch (webhookErr) {
      console.error(`Error hitting webhook for ${agent}:`, webhookErr)
      // We don't fail the whole request if webhook is down, 
      // since the message is already saved in the inbox table
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in message-agent route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
