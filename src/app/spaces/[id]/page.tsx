'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  Tabs, 
  Tab, 
  Card, 
  CardBody, 
  Spinner, 
  Button,
  Avatar,
  AvatarGroup,
  Chip
} from '@heroui/react'
import { PlusIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import Navbar from '@/components/Navbar'
import { useSpace } from '@/lib/space-context'
import { toast } from 'react-hot-toast'

export default function SpaceDetailPage() {
  const { id } = useParams()
  const { spaces } = useSpace()
  const [space, setSpace] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (id) {
      loadSpaceData()
    }
  }, [id])

  async function loadSpaceData() {
    setLoading(true)
    try {
      const [spaceRes, membersRes, tasksRes] = await Promise.all([
        supabase.from('spaces').select('*').eq('id', id).single(),
        supabase.from('space_members').select('*, users(*)').eq('space_id', id),
        supabase.from('tasks').select('*, assignee:users(*)').eq('space_id', id).order('created_at', { ascending: false })
      ])

      if (spaceRes.error) throw spaceRes.error
      setSpace(spaceRes.data)
      setMembers(membersRes.data || [])
      setTasks(tasksRes.data || [])
    } catch (error) {
      console.error('Error loading space:', error)
      toast.error('Failed to load space')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!space) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Space not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-default-50">
      <Navbar user={null} /> {/* User will be handled by providers */}
      
      <main className="max-w-7xl mx-auto py-8 px-4">
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: space.color || '#3b82f6' }}
              >
                {space.icon || space.name.charAt(0)}
              </div>
              <h1 className="text-3xl font-bold">{space.name}</h1>
              {space.is_default && <Chip size="sm" variant="flat">Personal</Chip>}
            </div>
            <p className="text-default-500">{space.description || 'No description'}</p>
          </div>
          
          <div className="flex items-center gap-2">
            <AvatarGroup isBordered size="sm" max={3}>
              {members.map(m => (
                <Avatar 
                  key={m.id} 
                  src={m.users.avatar_url} 
                  name={m.users.display_name || m.users.name} 
                />
              ))}
            </AvatarGroup>
            <Button isIconOnly variant="flat" size="sm">
              <Cog6ToothIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <Tabs aria-label="Space content" variant="underlined" color="primary">
          <Tab key="tasks" title={`Tasks (${tasks.length})`}>
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Tasks</h2>
                <Button color="primary" startContent={<PlusIcon className="w-4 h-4" />} size="sm">
                  Add Task
                </Button>
              </div>
              
              {tasks.length === 0 ? (
                <Card>
                  <CardBody className="py-12 text-center text-default-400">
                    No tasks in this space yet.
                  </CardBody>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {tasks.map(task => (
                    <Card key={task.id} isPressable>
                      <CardBody className="flex-row items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            task.priority === 'critical' ? 'bg-danger' : 
                            task.priority === 'high' ? 'bg-warning' : 'bg-primary'
                          }`} />
                          <span className="font-medium">{task.title}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <Chip size="sm" variant="flat">{task.status}</Chip>
                          {task.assignee && (
                            <Avatar 
                              size="sm" 
                              src={task.assignee.avatar_url} 
                              name={task.assignee.display_name || task.assignee.name} 
                            />
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </Tab>
          
          <Tab key="docs" title="Documents">
             <Card className="mt-4">
              <CardBody className="py-12 text-center text-default-400">
                Documents coming soon.
              </CardBody>
            </Card>
          </Tab>

          <Tab key="threads" title="Threads">
             <Card className="mt-4">
              <CardBody className="py-12 text-center text-default-400">
                Linked message threads coming soon.
              </CardBody>
            </Card>
          </Tab>

          <Tab key="members" title="Members">
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Team Members</h2>
                <Button variant="flat" startContent={<PlusIcon className="w-4 h-4" />} size="sm">
                  Invite Member
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map(member => (
                  <Card key={member.id}>
                    <CardBody className="flex-row items-center gap-4">
                      <Avatar 
                        src={member.users.avatar_url} 
                        name={member.users.display_name || member.users.name} 
                      />
                      <div>
                        <p className="font-semibold">{member.users.display_name || member.users.name}</p>
                        <p className="text-xs text-default-400 capitalize">{member.role}</p>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          </Tab>
        </Tabs>
      </main>
    </div>
  )
}
