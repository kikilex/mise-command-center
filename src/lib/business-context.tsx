'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Business {
  id: string
  name: string
  slug: string
  description: string | null
  logo_url: string | null
  color: string
  owner_id: string
  created_at: string
}

interface BusinessContextType {
  businesses: Business[]
  selectedBusiness: Business | null
  selectedBusinessId: string | null // null means "Personal"
  setSelectedBusinessId: (id: string | null) => void
  loading: boolean
  error: string | null
  refreshBusinesses: () => Promise<void>
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined)

const STORAGE_KEY = 'mise-selected-business-id'

// Read initial value from localStorage synchronously to prevent flash
function getInitialBusinessId(): string | null {
  if (typeof window === 'undefined') return null
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'personal' || saved === null) return null
  return saved // Will be validated against businesses list later
}

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedBusinessId, setSelectedBusinessIdState] = useState<string | null>(getInitialBusinessId)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  
  const supabase = createClient()

  // Load businesses on mount
  useEffect(() => {
    loadBusinesses()
  }, [])

  // Validate saved selection after businesses are loaded
  useEffect(() => {
    if (!initialized && !loading && businesses.length >= 0) {
      const currentId = selectedBusinessId
      // If we have a saved business ID, validate it exists
      if (currentId && currentId !== 'personal' && !businesses.find(b => b.id === currentId)) {
        // Invalid business ID - reset to Personal
        setSelectedBusinessIdState(null)
        localStorage.setItem(STORAGE_KEY, 'personal')
      }
      setInitialized(true)
    }
  }, [businesses, loading, initialized, selectedBusinessId])

  async function loadBusinesses() {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error: fetchError } = await supabase
        .from('businesses')
        .select('*')
        .order('name')
      
      if (fetchError) {
        throw fetchError
      }
      
      setBusinesses(data || [])
    } catch (err) {
      console.error('Failed to load businesses:', err)
      setError(err instanceof Error ? err.message : 'Failed to load businesses')
    } finally {
      setLoading(false)
    }
  }

  function setSelectedBusinessId(id: string | null) {
    setSelectedBusinessIdState(id)
    if (id) {
      localStorage.setItem(STORAGE_KEY, id)
    } else {
      // Explicitly save "personal" so we know user chose Personal mode
      localStorage.setItem(STORAGE_KEY, 'personal')
    }
  }

  const selectedBusiness = businesses.find(b => b.id === selectedBusinessId) || null

  return (
    <BusinessContext.Provider
      value={{
        businesses,
        selectedBusiness,
        selectedBusinessId,
        setSelectedBusinessId,
        loading,
        error,
        refreshBusinesses: loadBusinesses,
      }}
    >
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusiness() {
  const context = useContext(BusinessContext)
  if (context === undefined) {
    throw new Error('useBusiness must be used within a BusinessProvider')
  }
  return context
}
