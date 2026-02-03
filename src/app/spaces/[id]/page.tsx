'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  Chip,
  Link as NextUILink
} from '@heroui/react'
import { Plus, Settings, ArrowRight, ListTodo, Calendar, Users, FileText, MessageSquare, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useSpace } from '@/lib/space-context'
import { toast } from 'react-hot-toast'

export default function SpaceDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { spaces } = useSpace()
  const [space, setSpace] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAllTasks, setShowAllTasks] = useState(false)
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
          .order('due_date', { ascending: true, nullsFirst: false })
          .order('priority', { ascending: false })
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

  // Get top 5 tasks for "What's Next" section
  const whatsNextTasks = tasks.slice(0, 5)
  const hasMoreTasks = tasks.length > 5

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-slate-400'
      default: return 'bg-slate-400'
    }
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'review': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
      case 'done': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300'
    }
  }

  return (
    <div className="min-h-screen bg-default-50">
      <Navbar user={null} /> {/* User will be handled by providers */}
      
      <main className="max-w-7xl mx-auto py-8 px-4">
        {/* Space Header - Calm and focused */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: space.color || '#3b82f6' }}
            >
              {space.icon || space.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{space.name}</h1>
              {space.description && (
                <p className="text-default-500 mt-1">{space.description}</p>
              )}
            </div>
          </div>
          
          {/* Quick stats - minimal */}
          <div className="flex items-center gap-6 text-sm text-default-500">
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4" />
              <span>{tasks.length} tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{members.length} members</span>
            </div>
            {space.is_default && (
              <Chip size="sm" variant="flat" className="text-xs">Personal Space</Chip>
            )}
          </div>
        </div>

        {/* Main Content - Tabs with calm default view */}
        <Tabs 
          aria-label="Space content" 
          variant="underlined" 
          color="primary"
          className="mb-6"
        >
          <Tab 
            key="overview" 
            title={
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4" />
                <span>Overview</span>
              </div>
            }
          >
            <div className="mt-6 space-y-8">
              {/* What's Next Section - Focused, ADHD-friendly */}
              <div className="bg-white dark:bg-default-100 rounded-2xl p-6 border border-default-200">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">What's Next</h2>
                    <p className="text-sm text-default-500 mt-1">Top priorities for this space</p>
                  </div>
                  <Button 
                    color="primary" 
                    variant="flat" 
                    size="sm"
                    startContent={<Plus className="w-4 h-4" />}
                    onPress={() => router.push(`/tasks?space=${id}`)}
                  >
                    Add Task
                  </Button>
                </div>
                
                {whatsNextTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <ListTodo className="w-12 h-12 text-default-300 mx-auto mb-4" />
                    <p className="text-default-500">No tasks yet. Add one to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {whatsNextTasks.map(task => (
                      <Card 
                        key={task.id} 
                        isPressable 
                        className="hover:shadow-sm transition-shadow"
                        onPress={() => router.push(`/tasks?task=${task.id}`)}
                      >
                        <CardBody className="py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                              <span className="font-medium text-foreground">{task.title}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <Chip 
                                size="sm" 
                                variant="flat" 
                                className={`text-xs ${getStatusColor(task.status)}`}
                              >
                                {task.status.replace('_', ' ')}
                              </Chip>
                              {task.assignee && (
                                <Avatar 
                                  size="sm" 
                                  src={task.assignee.avatar_url} 
                                  name={task.assignee.display_name || task.assignee.name} 
                                />
                              )}
                            </div>
                          </div>
                          {task.due_date && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-default-500">
                              <Calendar className="w-3 h-3" />
                              <span>Due {new Date(task.due_date).toLocaleDateString()}</span>
                            </div>
                          )}
                        </CardBody>
                      </Card>
                    ))}
                    
                    {/* View All Tasks Button */}
                    {hasMoreTasks && (
                      <div className="pt-4 border-t border-default-200">
                        <Button
                          variant="light"
                          className="w-full"
                          onPress={() => setShowAllTasks(!showAllTasks)}
                          endContent={<ChevronRight className={`w-4 h-4 transition-transform ${showAllTasks ? 'rotate-90' : ''}`} />}
                        >
                          {showAllTasks ? 'Show Less' : `View All ${tasks.length} Tasks`}
                        </Button>
                        
                        {/* Expanded task list */}
                        {showAllTasks && tasks.length > 5 && (
                          <div className="mt-4 space-y-3">
                            {tasks.slice(5).map(task => (
                              <Card 
                                key={task.id} 
                                isPressable 
                                className="hover:shadow-sm transition-shadow"
                                onPress={() => router.push(`/tasks?task=${task.id}`)}
                              >
                                <CardBody className="py-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                                      <span className="font-medium text-foreground">{task.title}</span>
                                    </div>
                                    <Chip 
                                      size="sm" 
                                      variant="flat" 
                                      className={`text-xs ${getStatusColor(task.status)}`}
                                    >
                                      {task.status.replace('_', ' ')}
                                    </Chip>
                                  </div>
                                </CardBody>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Team Members - Minimal view */}
              <div className="bg-white dark:bg-default-100 rounded-2xl p-6 border border-default-200">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">Team</h2>
                    <p className="text-sm text-default-500 mt-1">Members in this space</p>
                  </div>
                  <AvatarGroup isBordered size="md" max={5}>
                    {members.slice(0, 5).map(m => (
                      <Avatar 
                        key={m.id} 
                        src={m.users.avatar_url} 
                        name={m.users.display_name || m.users.name} 
                      />
                    ))}
                  </AvatarGroup>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {members.slice(0, 4).map(member => (
                    <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-default-100">
                      <Avatar 
                        src={member.users.avatar_url} 
                        name={member.users.display_name || member.users.name} 
                        size="sm"
                      />
                      <div>
                        <p className="font-medium text-foreground">{member.users.display_name || member.users.name}</p>
                        <p className="text-xs text-default-400 capitalize">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                {members.length > 4 && (
                  <div className="mt-4 pt-4 border-t border-default-200">
                    <Button
                      variant="light"
                      className="w-full"
                      onPress={() => {/* TODO: Navigate to members tab */}}
                      endContent={<ArrowRight className="w-4 h-4" />}
                    >
                      View All {members.length} Members
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Tab>
          
          <Tab 
            key="tasks" 
            title={
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4" />
                <span>Tasks</span>
                {tasks.length > 0 && (
                  <span className="text-xs bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300 px-2 py-0.5 rounded-full">
                    {tasks.length}
                  </span>
                )}
              </div>
            }
          >
            <div className="mt-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">All Tasks</h2>
                  <p className="text-sm text-default-500 mt-1">Everything in this space</p>
                </div>
                <Button 
                  color="primary" 
                  startContent={<Plus className="w-4 h-4" />}
                  onPress={() => router.push(`/tasks?space=${id}`)}
                >
                  Add Task
                </Button>
              </div>
              
              {tasks.length === 0 ? (
                <Card className="py-12">
                  <CardBody className="text-center text-default-400">
                    <ListTodo className="w-12 h-12 mx-auto mb-4" />
                    <p>No tasks in this space yet.</p>
                  </CardBody>
                </Card>
              ) : (
                <div className="space-y-3">
                  {tasks.map(task => (
                    <Card key={task.id} isPressable>
                      <CardBody className="flex-row items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
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
          
          <Tab 
            key="docs" 
            title={
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>Documents</span>
              </div>
            }
          >
             <Card className="mt-6">
              <CardBody className="py-12 text-center text-default-400">
                <FileText className="w-12 h-12 mx-auto mb-4" />
                <p>Documents coming soon.</p>
              </CardBody>
            </Card>
          </Tab>

          <Tab 
            key="threads" 
            title={
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                <span>Threads</span>
              </div>
            }
          >
             <Card className="mt-6">
              <CardBody className="py-12 text-center text-default-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-4" />
                <p>Linked message threads coming soon.</p>
              </CardBody>
            </Card>
          </Tab>

          <Tab 
            key="members" 
            title={
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Members</span>
              </div>
            }
          >
            <div className="mt-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Team Members</h2>
                  <p className="text-sm text-default-500 mt-1">Everyone in this space</p>
                </div>
                <Button variant="flat" startContent={<Plus className="w-4 h-4" />} size="sm">
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