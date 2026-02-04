'use client'

import { useState, useEffect } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Spinner,
  Avatar,
} from '@heroui/react'
import { UserPlus, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'

interface User {
  id: string
  email: string
  name: string | null
  display_name: string | null
  avatar_url: string | null
}

interface InviteMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  spaceId: string
  currentUserId: string
}

export default function InviteMemberModal({
  isOpen,
  onClose,
  onSuccess,
  spaceId,
  currentUserId,
}: InviteMemberModalProps) {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<string>('viewer')
  const [inviting, setInviting] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      loadUsers()
    }
  }, [isOpen])

  useEffect(() => {
    if (search.trim() === '') {
      setFilteredUsers(users)
    } else {
      const searchLower = search.toLowerCase()
      setFilteredUsers(
        users.filter(
          (user) =>
            user.email.toLowerCase().includes(searchLower) ||
            (user.display_name && user.display_name.toLowerCase().includes(searchLower)) ||
            (user.name && user.name.toLowerCase().includes(searchLower))
        )
      )
    }
  }, [search, users])

  async function loadUsers() {
    setLoading(true)
    try {
      // Get all users except current user
      const { data: allUsers, error } = await supabase
        .from('users')
        .select('id, email, name, display_name, avatar_url')
        .neq('id', currentUserId)

      if (error) throw error

      // Get existing space members to filter them out
      const { data: existingMembers, error: membersError } = await supabase
        .from('space_members')
        .select('user_id')
        .eq('space_id', spaceId)

      if (membersError) throw membersError

      const existingMemberIds = new Set(existingMembers?.map(m => m.user_id) || [])
      const availableUsers = allUsers?.filter(user => !existingMemberIds.has(user.id)) || []

      setUsers(availableUsers)
      setFilteredUsers(availableUsers)
    } catch (error) {
      console.error('Error loading users:', error)
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite() {
    if (!selectedUserId) {
      toast.error('Please select a user')
      return
    }

    setInviting(true)
    try {
      const response = await fetch(`/api/spaces/${spaceId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUserId,
          role: selectedRole,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to invite member')
      }

      toast.success('Member invited successfully')
      onSuccess()
      handleClose()
    } catch (error) {
      console.error('Error inviting member:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to invite member')
    } finally {
      setInviting(false)
    }
  }

  function handleClose() {
    setSearch('')
    setSelectedUserId('')
    setSelectedRole('viewer')
    onClose()
  }

  const selectedUser = users.find(u => u.id === selectedUserId)

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" placement="center">
      <ModalContent className="max-h-[90vh] overflow-y-auto">
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                <span>Invite Member</span>
              </div>
              <p className="text-sm text-default-500 font-normal">
                Add a new member to this space
              </p>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-4">
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-default-400" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                    size="sm"
                  />
                </div>

                {/* User selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select User</label>
                  {loading ? (
                    <div className="flex justify-center py-4">
                      <Spinner size="sm" />
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-4 text-default-500 text-sm">
                      {search ? 'No users found' : 'No users available to invite'}
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {filteredUsers.map((user) => (
                        <div
                          key={user.id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                            selectedUserId === user.id
                              ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                              : 'hover:bg-default-100'
                          }`}
                          onClick={() => setSelectedUserId(user.id)}
                        >
                          <Avatar
                            size="sm"
                            src={user.avatar_url || undefined}
                            name={user.display_name || user.name || user.email}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {user.display_name || user.name || user.email}
                            </p>
                            <p className="text-xs text-default-500 truncate">{user.email}</p>
                          </div>
                          {selectedUserId === user.id && (
                            <div className="w-2 h-2 rounded-full bg-primary-500" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Role selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select
                    selectedKeys={[selectedRole]}
                    onSelectionChange={(keys) => setSelectedRole(Array.from(keys)[0] as string)}
                    size="sm"
                  >
                    <SelectItem key="viewer">
                      Viewer (can view only)
                    </SelectItem>
                    <SelectItem key="editor">
                      Editor (can edit content)
                    </SelectItem>
                    <SelectItem key="admin">
                      Admin (can manage members)
                    </SelectItem>
                  </Select>
                </div>

                {/* Selected user preview */}
                {selectedUser && (
                  <div className="p-3 bg-default-100 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={selectedUser.avatar_url || undefined}
                          name={selectedUser.display_name || selectedUser.name || selectedUser.email}
                        />
                        <div>
                          <p className="font-medium">
                            {selectedUser.display_name || selectedUser.name || selectedUser.email}
                          </p>
                          <p className="text-xs text-default-500">{selectedUser.email}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="light"
                        isIconOnly
                        onPress={() => setSelectedUserId('')}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={handleClose}>
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={handleInvite}
                isLoading={inviting}
                isDisabled={!selectedUserId}
              >
                Invite Member
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}