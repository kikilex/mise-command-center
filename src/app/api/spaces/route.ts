import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: spaces, error } = await supabase
      .from('spaces')
      .select('*, space_members!inner(role)')
      .eq('space_members.user_id', user.id)
      .is('archived_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(spaces)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, icon, color } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // 1. Create the space
    const { data: space, error: spaceError } = await supabase
      .from('spaces')
      .insert({
        name,
        description,
        icon,
        color,
        created_by: user.id
      })
      .select()
      .single()

    if (spaceError) {
      return NextResponse.json({ error: spaceError.message }, { status: 500 })
    }

    // 2. Add creator as owner
    const { error: memberError } = await supabase
      .from('space_members')
      .insert({
        space_id: space.id,
        user_id: user.id,
        role: 'owner'
      })

    if (memberError) {
      // Cleanup space if member creation fails
      await supabase.from('spaces').delete().eq('id', space.id)
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    return NextResponse.json(space)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
