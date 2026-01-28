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

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selectedBusinessId, setSelectedBusinessIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  
  const supabase = createClient()

  // Load businesses on mount
  useEffect(() => {
    loadBusinesses()
  }, [])

  // Load saved selection from localStorage after businesses are loaded
  useEffect(() => {
    if (!initialized && !loading) {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'personal' || saved === null) {
        // User explicitly chose Personal mode or no selection saved
        setSelectedBusinessIdState(null)
      } else if (saved && businesses.find(b => b.id === saved)) {
        // Valid business ID saved
        setSelectedBusinessIdState(saved)
      } else {
        // No valid saved selection - default to Personal (null), not first business
        setSelectedBusinessIdState(null)
      }
      setInitialized(true)
    }
  }, [businesses, loading, initialized])

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
