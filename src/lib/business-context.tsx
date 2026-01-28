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
    if (!initialized && businesses.length > 0) {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && businesses.find(b => b.id === saved)) {
        setSelectedBusinessIdState(saved)
      } else if (businesses.length > 0) {
        // Default to first business if no valid saved selection
        setSelectedBusinessIdState(businesses[0].id)
      }
      setInitialized(true)
    }
  }, [businesses, initialized])

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
      localStorage.removeItem(STORAGE_KEY)
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
