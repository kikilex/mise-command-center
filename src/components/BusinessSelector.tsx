'use client'

import { useState } from 'react'
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
  Chip,
  Spinner,
} from '@heroui/react'
import { useBusiness } from '@/lib/business-context'

export default function BusinessSelector() {
  const { 
    businesses, 
    selectedBusiness, 
    selectedBusinessId, 
    setSelectedBusinessId, 
    loading 
  } = useBusiness()

  if (loading) {
    return (
      <Button variant="flat" size="sm" isDisabled className="min-w-[120px]">
        <Spinner size="sm" />
      </Button>
    )
  }

  if (businesses.length === 0) {
    return (
      <Button variant="flat" size="sm" isDisabled className="min-w-[120px]">
        No Businesses
      </Button>
    )
  }

  const displayName = selectedBusinessId === null 
    ? 'Personal' 
    : selectedBusiness?.name || 'Select Business'

  const displayColor = selectedBusiness?.color || '#6366f1'

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button 
          variant="flat" 
          size="sm"
          className="min-w-[140px] justify-between font-medium"
          startContent={
            selectedBusinessId !== null && (
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: displayColor }}
              />
            )
          }
          endContent={
            <svg 
              className="w-4 h-4 text-slate-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          }
        >
          <span className="truncate max-w-[100px]">{displayName}</span>
        </Button>
      </DropdownTrigger>
      <DropdownMenu 
        aria-label="Select business"
        selectionMode="single"
        selectedKeys={selectedBusinessId ? new Set([selectedBusinessId]) : new Set(['personal'])}
        onSelectionChange={(keys) => {
          const selected = Array.from(keys)[0] as string
          setSelectedBusinessId(selected === 'personal' ? null : selected)
        }}
      >
        <DropdownSection title="Context" showDivider>
          <DropdownItem
            key="personal"
            description="Personal tasks and items"
            startContent={
              <div className="w-3 h-3 rounded-full bg-slate-400" />
            }
          >
            Personal
          </DropdownItem>
        </DropdownSection>
        <DropdownSection title="Businesses">
          {businesses.map((business) => (
            <DropdownItem
              key={business.id}
              description={business.description || undefined}
              startContent={
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: business.color || '#3b82f6' }}
                />
              }
            >
              {business.name}
            </DropdownItem>
          ))}
        </DropdownSection>
      </DropdownMenu>
    </Dropdown>
  )
}
