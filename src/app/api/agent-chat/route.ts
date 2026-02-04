import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role for API access
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Regular client for auth checks
function getSupabaseClient(authToken?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Verify user with regular client
    const userClient = getSupabaseClient(token)
    const { data: { user } } = await userClient.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { message, to_agent = 'ax' } = await request.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Insert message using service role (bypasses RLS)
    const adminSupabase = getSupabaseAdmin()
    
    const { data, error } = await adminSupabase
      .from('agent_chat')
      .insert({
        from_agent: 'user',
        to_agent,
        message: message.trim(),
        context: { 
          user_id: user.id,
          user_email: user.email,
          type: 'user_message'
        },
        delivered: true,
        delivered_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting agent chat message:', error)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: data })
  } catch (error) {
    console.error('Error in agent-chat route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Verify user with regular client
    const userClient = getSupabaseClient(token)
    const { data: { user } } = await userClient.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get messages - using admin client to bypass RLS
    const adminSupabase = getSupabaseAdmin()
    
    const { data: messages, error } = await adminSupabase
      .from('agent_chat')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) {
      console.error('Error fetching agent chat messages:', error)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    // Filter messages: show only agent-to-agent conversations (both from_agent and to_agent are not 'user')
    const filteredMessages = messages.filter(msg => 
      msg.from_agent !== 'user' && msg.to_agent !== 'user'
    )

    return NextResponse.json({ messages: filteredMessages })
  } catch (error) {
    console.error('Error in agent-chat route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}