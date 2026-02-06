'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Card,
  CardBody,
  Button,
  Spinner,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  useDisclosure,
} from '@heroui/react'
import { Plus, User, MoreVertical, Edit, Trash2 } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import Navbar from '@/components/Navbar'
import AddSpaceModal from '@/components/AddSpaceModal'
import EditSpaceModal from '@/components/EditSpaceModal'
import { useSpace, Space } from '@/lib/space-context'
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'

export default function SpacesPage() {
  const { spaces, loading, refreshSpaces } = useSpace()
  const { isOpen: isAddOpen, onOpen: onAddOpen, onClose: onAddClose } = useDisclosure()
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure()
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const supabase = createClient()

  const renderSpaceIcon = (iconName: string | null, fallback: string) => {
    if (iconName) {
      const Icon = (LucideIcons as any)[iconName]
      if (Icon) return <Icon className="w-6 h-6" />
    }
    return fallback || '?'
  }

  function handleAddSuccess() {
    refreshSpaces()
    onAddClose()
  }

  function handleEditSuccess() {
    refreshSpaces()
    onEditClose()
    setSelectedSpace(null)
  }

  function handleEditSpace(space: Space, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setSelectedSpace(space)
    onEditOpen()
  }

  async function handleDeleteSpace(space: Space, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    
    if (space.is_default) {
      showErrorToast(new Error('Cannot delete the default space'), 'Delete Failed')
      return
    }

    if (!confirm(`Are you sure you want to delete "${space.name}"? This action cannot be undone.`)) {
      return
    }

    setDeletingId(space.id)
    try {
      const { error } = await supabase
        .from('spaces')
        .delete()
        .eq('id', space.id)

      if (error) throw error

      showSuccessToast('Space deleted')
      refreshSpaces()
    } catch (error) {
      console.error('Delete space error:', error)
      showErrorToast(error, 'Failed to delete space')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-default-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-default-50">
      <Navbar />

      <main className="max-w-5xl mx-auto py-6 px-4 sm:py-8 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Your Spaces</h1>
            <p className="text-default-500 mt-1">Organize your work into spaces</p>
          </div>
          <Button
            color="primary"
            startContent={<Plus className="w-5 h-5" />}
            onPress={onAddOpen}
            className="sm:self-start"
          >
            New Space
          </Button>
        </div>

        {spaces.length === 0 ? (
          <Card>
            <CardBody className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-default-100 flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-default-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No spaces yet</h2>
              <p className="text-default-500 mb-4">Create your first space to get started</p>
              <Button color="primary" onPress={onAddOpen}>Create Space</Button>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {spaces.map((space) => (
              <Link key={space.id} href={`/spaces/${space.id}`}>
                <Card
                  isPressable
                  className="h-[200px] hover:shadow-lg transition-shadow"
                >
                  <CardBody className="p-6 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-4">
                      <div 
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-md flex-shrink-0"
                        style={{ backgroundColor: space.color || '#3b82f6' }}
                      >
                        {renderSpaceIcon(space.icon, space.name.charAt(0))}
                      </div>
                      <Dropdown>
                        <DropdownTrigger>
                          <Button
                            isIconOnly
                            variant="light"
                            size="sm"
                            className="text-default-400 hover:text-default-600"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                            }}
                          >
                            <MoreVertical className="w-5 h-5" />
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Space actions">
                          <DropdownItem
                            key="edit"
                            startContent={<Edit className="w-4 h-4" />}
                            onClick={(e) => handleEditSpace(space, e)}
                          >
                            Edit Space
                          </DropdownItem>
                          <DropdownItem
                            key="delete"
                            className="text-danger"
                            color="danger"
                            startContent={<Trash2 className="w-4 h-4" />}
                            onClick={(e) => handleDeleteSpace(space, e)}
                            isDisabled={space.is_default || deletingId === space.id}
                          >
                            {deletingId === space.id ? 'Deleting...' : 'Delete Space'}
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    </div>

                    <h3 className="text-lg font-semibold mb-2 line-clamp-1">{space.name}</h3>
                    <p className="text-sm text-default-500 line-clamp-2 flex-1 min-h-[40px]">
                      {space.description || ''}
                    </p>

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-default-100">
                      <span className="text-xs text-default-400 capitalize">
                        {space.role || 'member'}
                      </span>
                      {/* TODO: Show member avatars when we have that data */}
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <AddSpaceModal
        isOpen={isAddOpen}
        onClose={onAddClose}
        onSuccess={handleAddSuccess}
      />

      <EditSpaceModal
        space={selectedSpace}
        isOpen={isEditOpen}
        onClose={() => {
          onEditClose()
          setSelectedSpace(null)
        }}
        onSuccess={handleEditSuccess}
      />
    </div>
  )
}
