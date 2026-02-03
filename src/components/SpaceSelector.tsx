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
import { PencilIcon, PlusIcon, UserIcon, BriefcaseIcon } from '@heroicons/react/24/outline'
import { useSpace, Space } from '@/lib/space-context'
import AddSpaceModal from './AddSpaceModal'
import EditSpaceModal from './EditSpaceModal'

export default function SpaceSelector() {
  const { 
    spaces, 
    selectedSpace, 
    selectedSpaceId, 
    setSelectedSpaceId, 
    loading,
    refreshSpaces,
  } = useSpace()

  const [editingSpace, setEditingSpace] = useState<Space | null>(null)
  
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

  function handleAddSuccess() {
    refreshSpaces()
  }

  function handleEditSuccess() {
    refreshSpaces()
  }

  if (loading) {
    return (
      <Button variant="flat" size="sm" isDisabled className="min-w-[120px]">
        <Spinner size="sm" />
      </Button>
    )
  }

  const displayName = selectedSpace?.name || 'Select Space'
  const displayColor = selectedSpace?.color || '#6366f1'

  return (
    <>
      <Dropdown>
        <DropdownTrigger>
          <Button 
            variant="flat" 
            size="sm"
            className="min-w-[140px] justify-between font-medium"
            startContent={
              selectedSpace?.is_default ? (
                <UserIcon className="w-4 h-4 text-slate-500" />
              ) : (
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
          aria-label="Select space"
          selectionMode="single"
          selectedKeys={selectedSpaceId ? new Set([selectedSpaceId]) : new Set()}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as string
            if (selected === 'add-new') {
              onAddOpen()
              return
            }
            setSelectedSpaceId(selected)
          }}
        >
          <DropdownSection title="Your Spaces">
            {spaces.map((space) => (
              <DropdownItem
                key={space.id}
                description={space.description || undefined}
                startContent={
                  space.is_default ? (
                    <UserIcon className="w-4 h-4 text-slate-400" />
                  ) : (
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: space.color || '#3b82f6' }}
                    />
                  )
                }
                // Edit button
                endContent={
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    className="min-w-6 w-6 h-6"
                    onPress={(e) => {
                      e.stopPropagation()
                      setEditingSpace(space)
                      onEditOpen()
                    }}
                  >
                    <PencilIcon className="w-3.5 h-3.5 text-default-500" />
                  </Button>
                }
              >
                {space.name}
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
              Add New Space
            </DropdownItem>
          </DropdownSection>
        </DropdownMenu>
      </Dropdown>

      <AddSpaceModal
        isOpen={isAddOpen}
        onClose={onAddClose}
        onSuccess={handleAddSuccess}
      />

      <EditSpaceModal
        space={editingSpace}
        isOpen={isEditOpen}
        onClose={onEditClose}
        onSuccess={handleEditSuccess}
      />
    </>
  )
}
