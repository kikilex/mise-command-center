'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  Card, 
  CardBody, 
  Button, 
  Spinner,
  Chip,
  Avatar,
  AvatarGroup,
  useDisclosure,
} from '@heroui/react'
import { PlusIcon, UserIcon } from '@heroicons/react/24/outline'
import Navbar from '@/components/Navbar'
import AddSpaceModal from '@/components/AddSpaceModal'
import { useSpace } from '@/lib/space-context'

export default function SpacesPage() {
  const { spaces, loading, refreshSpaces } = useSpace()
  const { isOpen, onOpen, onClose } = useDisclosure()

  function handleAddSuccess() {
    refreshSpaces()
    onClose()
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
      <Navbar user={null} />
      
      <main className="max-w-5xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Your Spaces</h1>
            <p className="text-default-500 mt-1">Organize your work into spaces</p>
          </div>
          <Button 
            color="primary" 
            startContent={<PlusIcon className="w-5 h-5" />}
            onPress={onOpen}
          >
            New Space
          </Button>
        </div>

        {spaces.length === 0 ? (
          <Card>
            <CardBody className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-default-100 flex items-center justify-center mx-auto mb-4">
                <UserIcon className="w-8 h-8 text-default-400" />
              </div>
              <h2 className="text-xl font-semibold mb-2">No spaces yet</h2>
              <p className="text-default-500 mb-4">Create your first space to get started</p>
              <Button color="primary" onPress={onOpen}>Create Space</Button>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {spaces.map((space) => (
              <Link key={space.id} href={`/spaces/${space.id}`}>
                <Card 
                  isPressable 
                  className="h-full hover:shadow-lg transition-shadow"
                >
                  <CardBody className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold"
                        style={{ backgroundColor: space.color || '#3b82f6' }}
                      >
                        {space.icon || space.name.charAt(0)}
                      </div>
                      {space.is_default && (
                        <Chip size="sm" variant="flat" color="secondary">Personal</Chip>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-semibold mb-1">{space.name}</h3>
                    <p className="text-sm text-default-500 line-clamp-2 mb-4">
                      {space.description || 'No description'}
                    </p>
                    
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-default-100">
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
        isOpen={isOpen} 
        onClose={onClose} 
        onSuccess={handleAddSuccess}
      />
    </div>
  )
}
