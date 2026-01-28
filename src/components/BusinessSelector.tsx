'use client'

import { useState } from 'react'
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
  Spinner,
  useDisclosure,
} from '@heroui/react'
import { PencilIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useBusiness, Business } from '@/lib/business-context'
import AddBusinessModal from './AddBusinessModal'
import EditBusinessModal from './EditBusinessModal'

export default function BusinessSelector() {
  const { 
    businesses, 
    selectedBusiness, 
    selectedBusinessId, 
    setSelectedBusinessId, 
    loading,
    refreshBusinesses,
  } = useBusiness()

  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null)
  
  const { 
    isOpen: isAddOpen, 
    onOpen: onAddOpen, 
    onClose: onAddClose 
  } = useDisclosure()
  
  const { 
    isOpen: isEditOpen, 
    onOpen: onEditOpen, 
    onClose: onEditClose 
  } = useDisclosure()

  function handleEditClick(e: React.MouseEvent, business: Business) {
    e.stopPropagation()
    setEditingBusiness(business)
    onEditOpen()
  }

  function handleAddSuccess() {
    refreshBusinesses()
  }

  function handleEditSuccess() {
    refreshBusinesses()
    setEditingBusiness(null)
  }

  if (loading) {
    return (
      <Button variant="flat" size="sm" isDisabled className="min-w-[120px]">
        <Spinner size="sm" />
      </Button>
    )
  }

  const displayName = selectedBusinessId === null 
    ? 'Personal' 
    : selectedBusiness?.name || 'Select Business'

  const displayColor = selectedBusiness?.color || '#6366f1'

  return (
    <>
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
            if (selected === 'add-new') {
              onAddOpen()
              return
            }
            setSelectedBusinessId(selected === 'personal' ? null : selected)
          }}
          disabledKeys={new Set(['add-new'])}
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
          <DropdownSection title="Businesses" showDivider>
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
                endContent={
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    className="min-w-6 w-6 h-6"
                    onPress={(e) => {
                      setEditingBusiness(business)
                      onEditOpen()
                    }}
                  >
                    <PencilIcon className="w-3.5 h-3.5 text-default-500" />
                  </Button>
                }
              >
                {business.name}
              </DropdownItem>
            ))}
          </DropdownSection>
          <DropdownSection>
            <DropdownItem
              key="add-new"
              startContent={
                <PlusIcon className="w-4 h-4 text-primary" />
              }
              className="text-primary"
              onPress={onAddOpen}
            >
              Add New Business
            </DropdownItem>
          </DropdownSection>
        </DropdownMenu>
      </Dropdown>

      <AddBusinessModal
        isOpen={isAddOpen}
        onClose={onAddClose}
        onSuccess={handleAddSuccess}
      />

      <EditBusinessModal
        isOpen={isEditOpen}
        onClose={() => {
          onEditClose()
          setEditingBusiness(null)
        }}
        onSuccess={handleEditSuccess}
        business={editingBusiness}
      />
    </>
  )
}
