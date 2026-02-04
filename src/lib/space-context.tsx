'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Space {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  created_by: string
  created_at: string
  is_default: boolean
  role?: string
}

interface SpaceContextType {
  spaces: Space[]
  selectedSpace: Space | null
  selectedSpaceId: string | null
  setSelectedSpaceId: (id: string | null) => void
  loading: boolean
  error: string | null
  refreshSpaces: () => Promise<void>
}

const SpaceContext = createContext<SpaceContextType | undefined>(undefined)

const STORAGE_KEY = 'mise-selected-space-id'

function getInitialSpaceId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY)
}

export function SpaceProvider({ children }: { children: ReactNode }) {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [selectedSpaceId, setSelectedSpaceIdState] = useState<string | null>(getInitialSpaceId)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    loadSpaces()
  }, [])

  useEffect(() => {
    if (!initialized && !loading && spaces.length > 0) {
      const currentId = selectedSpaceId
      // If no ID is saved, or saved ID doesn't exist, default to the 'is_default' space
      const found = currentId ? spaces.find(s => s.id === currentId) : null
      
      if (!found) {
        const defaultSpace = spaces.find(s => s.is_default) || spaces[0]
        setSelectedSpaceIdState(defaultSpace.id)
        localStorage.setItem(STORAGE_KEY, defaultSpace.id)
      }
      setInitialized(true)
    }
  }, [spaces, loading, initialized, selectedSpaceId])

  async function loadSpaces() {
    setLoading(true)
    setError(null)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data, error: fetchError } = await supabase
        .from('spaces')
        .select('*, space_members!inner(role, user_id)')
        .eq('space_members.user_id', user.id)
        .is('archived_at', null)
        .order('is_default', { ascending: false })
        .order('name')
      
      if (fetchError) {
        throw fetchError
      }
      
      // Flatten the role from space_members
      const flattenedSpaces = (data || []).map((s: any) => ({
        ...s,
        role: s.space_members[0]?.role
      }))
      
      setSpaces(flattenedSpaces)
    } catch (err) {
      console.error('Failed to load spaces:', err)
      setError(err instanceof Error ? err.message : 'Failed to load spaces')
    } finally {
      setLoading(false)
    }
  }

  function setSelectedSpaceId(id: string | null) {
    if (!id) return // Space ID should not be null in new architecture
    setSelectedSpaceIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  const selectedSpace = spaces.find(s => s.id === selectedSpaceId) || null

  return (
    <SpaceContext.Provider
      value={{
        spaces,
        selectedSpace,
        selectedSpaceId,
        setSelectedSpaceId,
        loading,
        error,
        refreshSpaces: loadSpaces,
      }}
    >
      {children}
    </SpaceContext.Provider>
  )
}

export function useSpace() {
  const context = useContext(SpaceContext)
  if (context === undefined) {
    throw new Error('useSpace must be used within a SpaceProvider')
  }
  return context
}
