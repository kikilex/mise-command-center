'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as LucideIcons from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSpace } from '@/lib/space-context'

interface PinnedSpace {
  id: string
  name: string
  icon: string | null
  color: string | null
}

export default function SpaceSwitcher() {
  const [isOpen, setIsOpen] = useState(false)
  const [pinnedSpaces, setPinnedSpaces] = useState<PinnedSpace[]>([])
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const { currentSpace, setCurrentSpace, spaces } = useSpace()
  const supabase = createClient()

  const fetchPinnedSpaces = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsAuthenticated(false)
        setPinnedSpaces([])
        return
      }
      
      setIsAuthenticated(true)

      const { data: userData } = await supabase
        .from('users')
        .select('settings')
        .eq('id', user.id)
        .single()

      const pinnedIds: string[] = userData?.settings?.pinned_spaces || []
      
      if (pinnedIds.length === 0) {
        setPinnedSpaces([])
        return
      }

      // Fetch the actual space data for pinned spaces
      const { data: spacesData } = await supabase
        .from('spaces')
        .select('id, name, icon, color')
        .in('id', pinnedIds)

      if (spacesData) {
        // Maintain the order from pinnedIds
        const orderedSpaces = pinnedIds
          .map(id => spacesData.find(s => s.id === id))
          .filter((s): s is PinnedSpace => s !== undefined)
        setPinnedSpaces(orderedSpaces)
      }
    } catch (error) {
      console.error('Error fetching pinned spaces:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Initial fetch
  useEffect(() => {
    fetchPinnedSpaces()
  }, [fetchPinnedSpaces])

  // Listen for auth state changes (login/logout)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        fetchPinnedSpaces()
      } else if (event === 'SIGNED_OUT') {
        setPinnedSpaces([])
        setIsAuthenticated(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, fetchPinnedSpaces])

  // Listen for pinned spaces updates (from Spaces page)
  useEffect(() => {
    const handlePinnedUpdate = () => {
      fetchPinnedSpaces()
    }
    window.addEventListener('pinned-spaces-updated', handlePinnedUpdate)
    return () => window.removeEventListener('pinned-spaces-updated', handlePinnedUpdate)
  }, [fetchPinnedSpaces])

  const handleSpaceClick = (space: PinnedSpace) => {
    // Update context if we have the full space data
    const fullSpace = spaces.find(s => s.id === space.id)
    if (fullSpace) {
      setCurrentSpace(fullSpace)
    }
    
    // Close drawer first
    setIsOpen(false)
    
    // Navigate using window.location for reliability
    window.location.href = `/spaces/${space.id}`
  }

  const renderIcon = (iconName: string | null, fallbackName: string, color: string | null) => {
    const bgColor = color || '#3b82f6'
    
    if (iconName) {
      const Icon = (LucideIcons as any)[iconName]
      if (Icon) {
        return (
          <div
            className="w-14 h-14 rounded-[16px] flex items-center justify-center text-white shadow-md"
            style={{ backgroundColor: bgColor }}
          >
            <Icon className="w-7 h-7" />
          </div>
        )
      }
    }
    
    // Fallback to first letter
    return (
      <div
        className="w-14 h-14 rounded-[16px] flex items-center justify-center text-white text-xl font-bold shadow-md"
        style={{ backgroundColor: bgColor }}
      >
        {fallbackName.charAt(0).toUpperCase()}
      </div>
    )
  }

  // Don't render if not authenticated or no pinned spaces
  if (!isAuthenticated || (!loading && pinnedSpaces.length === 0)) {
    return null
  }

  // Don't render while loading
  if (loading) {
    return null
  }

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[998]"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Collapsed Tab */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            onClick={() => setIsOpen(true)}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-[999] w-6 h-20 flex items-center justify-center cursor-pointer group"
            style={{
              background: 'linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%)',
              borderRadius: '0 12px 12px 0',
              boxShadow: '2px 2px 8px rgba(0,0,0,0.1)',
              border: '1px solid rgba(0,0,0,0.08)',
              borderLeft: 'none',
            }}
            role="button"
            tabIndex={0}
            aria-label="Open space switcher"
          >
            <div 
              className="w-1 h-10 rounded-full transition-all group-hover:w-1.5 group-hover:h-11"
              style={{
                background: 'linear-gradient(180deg, #a855f7 0%, #7c3aed 100%)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed left-0 top-1/2 -translate-y-1/2 z-[1000] p-4 pr-6"
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: '0 20px 20px 0',
              boxShadow: '4px 4px 24px rgba(0,0,0,0.12)',
              border: '1px solid rgba(0,0,0,0.06)',
              borderLeft: 'none',
            }}
          >
            {/* Close handle */}
            <div
              onClick={() => setIsOpen(false)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-10 bg-gray-300 hover:bg-gray-400 rounded-full transition-colors cursor-pointer"
              role="button"
              aria-label="Close space switcher"
            />

            {/* Pinned spaces */}
            <div className="flex flex-col gap-3">
              {pinnedSpaces.map((space) => (
                <a
                  key={space.id}
                  href={`/spaces/${space.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    handleSpaceClick(space)
                  }}
                  className={`flex flex-col items-center gap-1 cursor-pointer transition-all no-underline ${
                    currentSpace?.id === space.id ? 'opacity-100' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  <div 
                    className={`transition-transform hover:scale-105 active:scale-95 ${
                      currentSpace?.id === space.id ? 'ring-3 ring-violet-400 ring-offset-2 rounded-[18px]' : ''
                    }`}
                  >
                    {renderIcon(space.icon, space.name, space.color)}
                  </div>
                  <span className="text-xs font-medium text-gray-600 max-w-[64px] truncate">
                    {space.name}
                  </span>
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
