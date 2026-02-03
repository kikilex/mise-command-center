'use client'

/**
 * COMPATIBILITY LAYER
 * 
 * This file provides backward compatibility for code still using the old
 * business context. It maps to the new space context under the hood.
 * 
 * TODO: Migrate all usages to useSpace() and delete this file.
 */

import { createContext, useContext, ReactNode } from 'react'
import { useSpace, Space, SpaceProvider } from './space-context'

// Map Space to Business interface for compatibility
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
  selectedBusinessId: string | null
  setSelectedBusinessId: (id: string | null) => void
  loading: boolean
  error: string | null
  refreshBusinesses: () => Promise<void>
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined)

function spaceToBusinessCompat(space: Space): Business {
  return {
    id: space.id,
    name: space.name,
    slug: space.name.toLowerCase().replace(/\s+/g, '-'),
    description: space.description,
    logo_url: null,
    color: space.color || '#3b82f6',
    owner_id: space.created_by,
    created_at: space.created_at,
  }
}

export function BusinessProvider({ children }: { children: ReactNode }) {
  // Just wrap with SpaceProvider - the actual logic is in useSpace
  return <SpaceProvider>{children}</SpaceProvider>
}

export function useBusiness(): BusinessContextType {
  const spaceContext = useSpace()
  
  // Map spaces to businesses for compatibility
  const businesses = spaceContext.spaces.map(spaceToBusinessCompat)
  const selectedBusiness = spaceContext.selectedSpace 
    ? spaceToBusinessCompat(spaceContext.selectedSpace) 
    : null

  return {
    businesses,
    selectedBusiness,
    selectedBusinessId: spaceContext.selectedSpaceId,
    setSelectedBusinessId: spaceContext.setSelectedSpaceId,
    loading: spaceContext.loading,
    error: spaceContext.error,
    refreshBusinesses: spaceContext.refreshSpaces,
  }
}
