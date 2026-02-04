import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: members, error } = await supabase
      .from('space_members')
      .select('*, users(email, name, display_name, avatar_url)')
      .eq('space_id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(members)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to invite (admin/owner)
    const { data: currentUserMember, error: memberError } = await supabase
      .from('space_members')
      .select('role')
      .eq('space_id', id)
      .eq('user_id', user.id)
      .single()

    if (memberError || !['owner', 'admin'].includes(currentUserMember.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, role } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Check if user is already a member
    const { data: existingMember, error: checkError } = await supabase
      .from('space_members')
      .select('id')
      .eq('space_id', id)
      .eq('user_id', userId)
      .single()

    if (!checkError && existingMember) {
      return NextResponse.json({ error: 'User is already a member of this space' }, { status: 400 })
    }

    // Add member
    const { data: newMember, error } = await supabase
      .from('space_members')
      .insert({
        space_id: id,
        user_id: userId,
        role: role || 'viewer',
        invited_by: user.id
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(newMember)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the member ID from query params
    const url = new URL(request.url)
    const memberId = url.searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 })
    }

    // Check if user has permission to remove members (admin/owner)
    const { data: currentUserMember, error: memberError } = await supabase
      .from('space_members')
      .select('role')
      .eq('space_id', id)
      .eq('user_id', user.id)
      .single()

    if (memberError || !['owner', 'admin'].includes(currentUserMember.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get the member to be removed
    const { data: targetMember, error: targetError } = await supabase
      .from('space_members')
      .select('user_id, role')
      .eq('id', memberId)
      .single()

    if (targetError) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Prevent removing the owner
    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove space owner' }, { status: 400 })
    }

    // Prevent removing yourself if you're an admin (only owner can remove admins)
    if (targetMember.user_id === user.id && currentUserMember.role !== 'owner') {
      return NextResponse.json({ error: 'Cannot remove yourself as an admin' }, { status: 400 })
    }

    // Remove member
    const { error: deleteError } = await supabase
      .from('space_members')
      .delete()
      .eq('id', memberId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
