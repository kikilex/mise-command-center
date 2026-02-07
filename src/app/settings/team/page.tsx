'use client'

import { useState, useEffect } from 'react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Spinner,
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Select,
  SelectItem,
} from "@heroui/react"
import { Users, Mail, Calendar, MoreVertical, Trash2, UserPlus, CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import SettingsNav from '@/components/SettingsNav'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import { useSpace } from '@/lib/space-context'

export default function TeamPage() {
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [removingMember, setRemovingMember] = useState<string | null>(null)
  const [inviteData, setInviteData] = useState<any>({
    email: '',
    role: 'viewer'
  })
  
  const { selectedSpace: selectedBusiness } = useSpace()
  const supabase = createClient()
  
  const { 
    isOpen: isInviteOpen, 
    onOpen: onInviteOpen, 
    onClose: onInviteClose 
  } = useDisclosure()

  const { 
    isOpen: isRemoveOpen, 
    onOpen: onRemoveOpen, 
    onClose: onRemoveClose 
  } = useDisclosure()

  const [memberToRemove, setMemberToRemove] = useState<any>(null)

  useEffect(() => {
    if (selectedBusiness) {
      loadTeamMembers()
    } else {
      setLoading(false)
    }
  }, [selectedBusiness])

  async function loadTeamMembers() {
    if (!selectedBusiness) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('space_members')
        .select(`
          *,
          user:users(email, name, display_name, avatar_url)
        `)
        .eq('space_id', selectedBusiness.id)
        .order('joined_at', { ascending: false })

      if (error) throw error
      setMembers(data || [])
    } catch (error) {
      console.error('Failed to load team members:', error)
      showErrorToast(error, 'Failed to load team members')
    } finally {
      setLoading(false)
    }
  }

  async function handleInviteMember() {
    if (!selectedBusiness) return

    setInviting(true)
    try {
      // First, check if user exists
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', inviteData.email)
        .single()

      let userId: string

      if (userError) {
        // User doesn't exist, create a placeholder
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            email: inviteData.email,
            name: inviteData.email.split('@')[0],
          })
          .select('id')
          .single()

        if (createError) throw createError
        userId = newUser.id
      } else {
        userId = userData.id
      }

      // Add to space_members
      const { error: memberError } = await supabase
        .from('space_members')
        .insert({
          space_id: selectedBusiness.id,
          user_id: userId,
          role: inviteData.role,
        })

      if (memberError) throw memberError

      showSuccessToast(`Invited ${inviteData.email} as ${inviteData.role}`)
      setInviteData({ email: '', role: 'viewer' })
      onInviteClose()
      loadTeamMembers()
    } catch (error) {
      console.error('Failed to invite member:', error)
      showErrorToast(error, 'Failed to invite member')
    } finally {
      setInviting(false)
    }
  }

  async function handleUpdateRole(memberId: string, newRole: string) {
    if (!selectedBusiness) return

    setUpdatingRole(memberId)
    try {
      const { error } = await supabase
        .from('space_members')
        .update({ role: newRole })
        .eq('id', memberId)
        .eq('space_id', selectedBusiness.id)

      if (error) throw error

      showSuccessToast('Role updated successfully')
      loadTeamMembers()
    } catch (error) {
      console.error('Failed to update role:', error)
      showErrorToast(error, 'Failed to update role')
    } finally {
      setUpdatingRole(null)
    }
  }

  async function handleRemoveMember() {
    if (!selectedBusiness || !memberToRemove) return

    setRemovingMember(memberToRemove.id)
    try {
      const { error } = await supabase
        .from('space_members')
        .delete()
        .eq('id', memberToRemove.id)
        .eq('space_id', selectedBusiness.id)

      if (error) throw error

      showSuccessToast('Member removed successfully')
      onRemoveClose()
      setMemberToRemove(null)
      loadTeamMembers()
    } catch (error) {
      console.error('Failed to remove member:', error)
      showErrorToast(error, 'Failed to remove member')
    } finally {
      setRemovingMember(null)
    }
  }

  function getRoleColor(role: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' {
    switch (role) {
      case 'owner': return 'secondary'
      case 'admin': return 'primary'
      case 'editor': return 'success'
      case 'viewer': return 'default'
      default: return 'default'
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (!selectedBusiness) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Settings Sidebar */}
            <div className="lg:w-64 flex-shrink-0">
              <div className="sticky top-24">
                <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>
                <SettingsNav />
              </div>
            </div>

            {/* Settings Content */}
            <div className="flex-1">
              <Card>
                <CardBody className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto text-default-400 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Space Selected</h3>
                  <p className="text-default-500">
                    Please select a space to manage team members.
                  </p>
                </CardBody>
              </Card>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Settings Sidebar */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="sticky top-24">
              <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>
              <SettingsNav />
            </div>
          </div>

          {/* Settings Content */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Team Management</h2>
                <p className="text-default-500 mt-1">
                  Manage team members for {selectedBusiness.name}
                </p>
              </div>
              <Button
                color="primary"
                startContent={<UserPlus className="w-4 h-4" />}
                onPress={onInviteOpen}
              >
                Add Member
              </Button>
            </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : members.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-default-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Team Members</h3>
              <p className="text-default-500 mb-6">
                You haven&apos;t added any team members yet.
              </p>
              <Button
                color="primary"
                startContent={<UserPlus className="w-4 h-4" />}
                onPress={onInviteOpen}
              >
                Add Your First Member
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map((member) => (
              <Card key={member.id} className="hover:shadow-md transition-shadow">
                <CardBody className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold">
                        {member.user?.display_name || member.user?.name || member.user?.email || 'Unknown User'}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Mail className="w-3 h-3 text-default-400" />
                        <span className="text-sm text-default-500">
                          {member.user?.email || 'No email'}
                        </span>
                      </div>
                    </div>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button isIconOnly size="sm" variant="light">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="Member actions">
                        <DropdownItem
                          key="remove"
                          className="text-danger"
                          color="danger"
                          startContent={<Trash2 className="w-4 h-4" />}
                          onPress={() => {
                            setMemberToRemove(member)
                            onRemoveOpen()
                          }}
                        >
                          Remove Member
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-default-500">Role</span>
                      <div className="flex items-center gap-2">
                        <Chip
                          size="sm"
                          color={getRoleColor(member.role)}
                          variant="flat"
                        >
                          {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                        </Chip>
                        {member.role !== 'owner' && (
                          <Dropdown>
                            <DropdownTrigger>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                isLoading={updatingRole === member.id}
                              >
                                <MoreVertical className="w-3 h-3" />
                              </Button>
                            </DropdownTrigger>
                            <DropdownMenu
                              aria-label="Change role"
                              onAction={(key) => handleUpdateRole(member.id, key as string)}
                            >
                              <DropdownItem key="admin">Admin</DropdownItem>
                              <DropdownItem key="editor">Editor</DropdownItem>
                              <DropdownItem key="viewer">Viewer</DropdownItem>
                            </DropdownMenu>
                          </Dropdown>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-default-500">Status</span>
                      <div className="flex items-center gap-1">
                        {member.user ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-success" />
                            <span className="text-xs text-success">Active</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-warning" />
                            <span className="text-xs text-warning">Pending</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-default-500">Joined</span>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-default-400" />
                        <span className="text-xs">
                          {formatDate(member.joined_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
          </div>
        </div>
      </main>

      {/* Invite Member Modal */}
      <Modal isOpen={isInviteOpen} onClose={onInviteClose}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">Add Team Member</ModalHeader>
          <ModalBody>
            <Input
              label="Email Address"
              type="email"
              placeholder="team@example.com"
              value={inviteData.email}
              onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
              startContent={<Mail className="w-4 h-4 text-default-400" />}
            />
            <Select
              label="Role"
              selectedKeys={[inviteData.role]}
              onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
            >
              <SelectItem key="admin">Admin</SelectItem>
              <SelectItem key="editor">Editor</SelectItem>
              <SelectItem key="viewer">Viewer</SelectItem>
            </Select>
            <p className="text-xs text-default-500">
              Admins can manage team members and space settings. 
              Editors can create and edit content. 
              Viewers have read-only access.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onInviteClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleInviteMember}
              isLoading={inviting}
              isDisabled={!inviteData.email}
            >
              Add Member
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Remove Member Confirmation Modal */}
      <Modal isOpen={isRemoveOpen} onClose={onRemoveClose}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">Remove Team Member</ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to remove{' '}
              <span className="font-semibold">
                {memberToRemove?.user?.display_name || memberToRemove?.user?.name || memberToRemove?.user?.email || 'this member'}
              </span>
              ?
            </p>
            <p className="text-sm text-default-500">
              This action cannot be undone. The member will lose access to this space.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onRemoveClose}>
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={handleRemoveMember}
              isLoading={removingMember === memberToRemove?.id}
            >
              Remove Member
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
