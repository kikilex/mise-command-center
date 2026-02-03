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
  const [showAllTasks, setShowAllTasks] = useState(false)
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
        supabase.from('tasks')
          .select('*, assignee:users(*)')
          .eq('space_id', id)
          .order('status', { ascending: true }) // Put active tasks first
          .order('priority', { ascending: false }) // High priority first
          .order('created_at', { ascending: false })
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

  const displayedTasks = showAllTasks ? tasks : tasks.slice(0, 5)

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
          <Tab key="tasks" title="Tasks">
            <div className="mt-8 flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold text-foreground/80">What&apos;s Next</h2>
                <Button 
                  color="primary" 
                  variant="flat"
                  startContent={<PlusIcon className="w-4 h-4" />} 
                  size="sm"
                  className="rounded-full px-4"
                >
                  Add Task
                </Button>
              </div>
              
              {tasks.length === 0 ? (
                <Card className="border-none bg-default-100 shadow-none">
                  <CardBody className="py-12 text-center text-default-400">
                    No tasks in this space yet. Focus on the vision first.
                  </CardBody>
                </Card>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-3">
                    {displayedTasks.map(task => (
                      <Card key={task.id} isPressable className="border-none shadow-sm hover:shadow-md transition-shadow">
                        <CardBody className="flex-row items-center justify-between py-4 px-6">
                          <div className="flex items-center gap-4">
                            <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${
                              task.priority === 'critical' ? 'bg-danger' : 
                              task.priority === 'high' ? 'bg-warning' : 'bg-primary'
                            }`} />
                            <span className="font-medium text-foreground/90">{task.title}</span>
                          </div>
                          <div className="flex items-center gap-6">
                            <Chip 
                              size="sm" 
                              variant="flat" 
                              className="capitalize bg-default-200/50 text-default-600 border-none"
                            >
                              {task.status}
                            </Chip>
                            {task.assignee && (
                              <Avatar 
                                size="sm" 
                                src={task.assignee.avatar_url} 
                                name={task.assignee.display_name || task.assignee.name} 
                                className="ring-2 ring-white shadow-sm"
                              />
                            )}
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                  
                  {tasks.length > 5 && (
                    <div className="flex justify-center mt-4">
                      <Button 
                        variant="light" 
                        color="primary" 
                        size="md"
                        onClick={() => setShowAllTasks(!showAllTasks)}
                        className="font-medium"
                      >
                        {showAllTasks ? 'Show Focused View' : `View All Tasks (${tasks.length})`}
                      </Button>
                    </div>
                  )}
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
