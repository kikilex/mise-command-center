'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
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
  Link as NextUILink,
  useDisclosure,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react'
import { Plus, Settings, ArrowRight, ListTodo, Calendar, Users, FileText, MessageSquare, ChevronRight, ChevronDown, FolderKanban, X, MoreVertical, Edit, Trash2 } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useSpace } from '@/lib/space-context'
import { toast } from 'react-hot-toast'
import AddTaskModal from '@/components/AddTaskModal'
import AddProjectModal from '@/components/AddProjectModal'
import EditProjectModal from '@/components/EditProjectModal'
import InviteMemberModal from '@/components/InviteMemberModal'
import { showErrorToast, showSuccessToast } from '@/lib/errors'

// TasksByProject component - groups tasks by project, separates done tasks
function TasksByProject({ 
  tasks, 
  projects, 
  onTaskClick, 
  getPriorityColor 
}: { 
  tasks: any[]
  projects: any[]
  onTaskClick: (taskId: string) => void
  getPriorityColor: (priority: string) => string
}) {
  const [showCompleted, setShowCompleted] = useState(false)

  // Separate active and done tasks
  const activeTasks = tasks.filter(t => t.status !== 'done')
  const doneTasks = tasks.filter(t => t.status === 'done')

  // Group active tasks by project
  const groupedTasks = useMemo(() => {
    const groups: Record<string, any[]> = { unassigned: [] }
    projects.forEach(p => { groups[p.id] = [] })
    
    activeTasks.forEach(task => {
      if (task.project_id && groups[task.project_id]) {
        groups[task.project_id].push(task)
      } else {
        groups.unassigned.push(task)
      }
    })
    
    return groups
  }, [activeTasks, projects])

  const projectsWithTasks = projects.filter(p => groupedTasks[p.id]?.length > 0)
  const unassignedTasks = groupedTasks.unassigned || []

  const renderTask = (task: any) => (
    <div 
      key={task.id}
      onClick={() => onTaskClick(task.id)}
      className="flex items-center justify-between px-4 py-3 hover:bg-default-50 dark:hover:bg-default-100 cursor-pointer transition-colors border-b border-default-100 last:border-b-0"
    >
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
        <span className={task.status === 'done' ? 'line-through text-default-400' : ''}>{task.title}</span>
      </div>
      <div className="flex items-center gap-2">
        {task.status !== 'done' && task.status !== 'todo' && (
          <Chip size="sm" variant="flat" color="warning">{task.status}</Chip>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Active Tasks by Project */}
      {projectsWithTasks.map(project => (
        <div key={project.id}>
          <div className="flex items-center gap-2 mb-2">
            <FolderKanban className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">{project.name}</span>
            <span className="text-xs text-default-400">({groupedTasks[project.id]?.length || 0})</span>
          </div>
          <div className="bg-white dark:bg-default-100 rounded-lg border border-default-200 overflow-hidden">
            {groupedTasks[project.id]?.map(renderTask)}
          </div>
        </div>
      ))}

      {/* Unassigned active tasks */}
      {unassignedTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ListTodo className="w-4 h-4 text-default-400" />
            <span className="font-medium text-sm text-default-600">No Project</span>
            <span className="text-xs text-default-400">({unassignedTasks.length})</span>
          </div>
          <div className="bg-white dark:bg-default-100 rounded-lg border border-default-200 overflow-hidden">
            {unassignedTasks.map(renderTask)}
          </div>
        </div>
      )}

      {/* Empty state for active tasks */}
      {projectsWithTasks.length === 0 && unassignedTasks.length === 0 && doneTasks.length === 0 && (
        <Card className="py-12">
          <CardBody className="text-center text-default-400">
            <ListTodo className="w-12 h-12 mx-auto mb-4" />
            <p>No tasks in this space yet.</p>
          </CardBody>
        </Card>
      )}

      {/* Completed Tasks - Collapsed by default */}
      {doneTasks.length > 0 && (
        <div className="pt-4 border-t border-default-200">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-sm text-default-500 hover:text-default-700 transition-colors"
          >
            {showCompleted ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <span>Completed ({doneTasks.length})</span>
          </button>
          
          {showCompleted && (
            <div className="mt-3 bg-default-50 dark:bg-default-100 rounded-lg border border-default-200 overflow-hidden">
              {doneTasks.map(task => (
                <div 
                  key={task.id}
                  onClick={() => onTaskClick(task.id)}
                  className="flex items-center justify-between px-4 py-2 hover:bg-default-100 dark:hover:bg-default-200 cursor-pointer transition-colors border-b border-default-200 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="line-through text-default-400">{task.title}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function SpaceDetailPage() {
  // ... rest
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { spaces } = useSpace()
  const [space, setSpace] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [threads, setThreads] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [selectedTab, setSelectedTab] = useState<string>(searchParams.get('tab') || 'overview')
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [confirmingMemberId, setConfirmingMemberId] = useState<string | null>(null)
  
  const { isOpen: isTaskOpen, onOpen: onTaskOpen, onClose: onTaskClose } = useDisclosure()
  const { isOpen: isProjectOpen, onOpen: onProjectOpen, onClose: onProjectClose } = useDisclosure()
  const { isOpen: isEditProjectOpen, onOpen: onEditProjectOpen, onClose: onEditProjectClose } = useDisclosure()
  const { isOpen: isDeleteProjectOpen, onOpen: onDeleteProjectOpen, onClose: onDeleteProjectClose } = useDisclosure()
  const { isOpen: isInviteOpen, onOpen: onInviteOpen, onClose: onInviteClose } = useDisclosure()
  const [selectedProject, setSelectedProject] = useState<any>(null)
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null)
  
  const supabase = createClient()

  // Compute task counts per project
  const projectTaskCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    tasks.forEach(task => {
      if (task.project_id) {
        counts[task.project_id] = (counts[task.project_id] || 0) + 1
      }
    })
    return counts
  }, [tasks])

  useEffect(() => {
    async function init() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)
      if (id && authUser) {
        loadSpaceData(authUser.id)
      }
    }
    init()
  }, [id])

  async function loadSpaceData(userId?: string) {
    const uid = userId || user?.id
    setLoading(true)
    try {
      // First fetch members to get user IDs
      const { data: membersData, error: membersError } = await supabase
        .from('space_members')
        .select('*')
        .eq('space_id', id)
      
      if (membersError) throw membersError

      const memberUserIds = membersData?.map(m => m.user_id) || []
      
      // Then fetch user profiles for those IDs
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .in('id', memberUserIds)

      // Map profiles back to members
      const membersWithUsers = (membersData || []).map(member => ({
        ...member,
        user: usersData?.find(u => u.id === member.user_id)
      }))

      const [spaceRes, tasksRes, projectsRes, docsRes, threadsRes, userRoleRes] = await Promise.all([
        supabase.from('spaces').select('*').eq('id', id).single(),
        supabase.from('tasks')
          .select('*')
          .eq('space_id', id)
          .order('created_at', { ascending: false }),
        supabase.from('projects')
          .select('*')
          .eq('space_id', id)
          .order('created_at', { ascending: false }),
        supabase.from('documents')
          .select('*')
          .eq('space_id', id)
          .order('updated_at', { ascending: false }),
        supabase.from('inbox')
          .select('*')
          .eq('space_id', id)
          .order('created_at', { ascending: false }),
        // Get current user's role in this space
        uid ? supabase.from('space_members')
          .select('role')
          .eq('space_id', id)
          .eq('user_id', uid)
          .maybeSingle() : Promise.resolve({ data: null, error: null })
      ])

      if (spaceRes.error) throw spaceRes.error
      if (tasksRes.error) console.error('Tasks query error:', tasksRes.error)
      console.log('Tasks loaded:', tasksRes.data?.length || 0)
      setSpace(spaceRes.data)
      setMembers(membersWithUsers)
      setTasks(tasksRes.data || [])
      setProjects(projectsRes.data || [])
      setDocuments(docsRes.data || [])
      setThreads(threadsRes.data || [])
      
      // Set current user's role
      if (userRoleRes.data) {
        setCurrentUserRole(userRoleRes.data.role)
      } else {
        setCurrentUserRole(null)
      }
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

  // Remove member function
  async function removeMember(memberId: string) {
    setRemovingMemberId(memberId)
    try {
      const response = await fetch(`/api/spaces/${id}/members?memberId=${memberId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove member')
      }

      toast.success('Member removed successfully')
      loadSpaceData() // Refresh the data
    } catch (error) {
      console.error('Error removing member:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to remove member')
    } finally {
      setRemovingMemberId(null)
    }
  }

  // Check if user can manage members (owner or admin)
  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin'

  // Get project status color
  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success'
      case 'on_hold': return 'warning'
      case 'completed': return 'primary'
      case 'archived': return 'default'
      default: return 'default'
    }
  }

  const renderSpaceIcon = (iconName: string, fallback: string) => {
    const Icon = (LucideIcons as any)[iconName]
    if (Icon) return <Icon className="w-5 h-5" />
    return fallback || iconName
  }

  const renderProjectIcon = (iconName: string | null) => {
    if (iconName) {
      const Icon = (LucideIcons as any)[iconName]
      if (Icon) return <Icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
    }
    return <FolderKanban className="w-4 h-4 text-primary-600 dark:text-primary-400" />
  }

  async function handleDeleteProject() {
    if (!selectedProject) return
    setDeletingProjectId(selectedProject.id)
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', selectedProject.id)

      if (error) throw error

      showSuccessToast('Project deleted')
      setProjects(prev => prev.filter(p => p.id !== selectedProject.id))
      onDeleteProjectClose()
      setSelectedProject(null)
    } catch (error) {
      console.error('Delete project error:', error)
      showErrorToast(error, 'Failed to delete project')
    } finally {
      setDeletingProjectId(null)
    }
  }

  return (
    <div className="min-h-screen bg-default-50">
      <Navbar /> {/* User will be handled by providers */}
      
      <main className="max-w-7xl mx-auto py-6 px-4 sm:py-8 sm:px-6">
        {/* Space Header - Calm and focused */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg flex-shrink-0"
                style={{ backgroundColor: space.color || '#3b82f6' }}
              >
                {renderSpaceIcon(space.icon, space.name.charAt(0))}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-foreground truncate">{space.name}</h1>
                {space.description && (
                  <p className="text-default-500 mt-1 line-clamp-2">{space.description}</p>
                )}
              </div>
            </div>
          </div>
          
          {/* Quick stats - minimal */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-default-500">
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4" />
              <span>{tasks.length} tasks</span>
            </div>
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4" />
              <span>{projects.length} projects</span>
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
          selectedKey={selectedTab}
          onSelectionChange={(key) => setSelectedTab(key as string)}
          classNames={{
            tabList: "gap-0 overflow-x-auto scrollbar-hide flex-nowrap",
            tab: "px-3 min-w-fit",
            cursor: "w-full",
          }}
        >
          <Tab 
            key="overview" 
            title={
              <div className="flex items-center gap-1.5">
                <ListTodo className="w-4 h-4" />
                <span className="hidden sm:inline">Overview</span>
              </div>
            }
          >
            <div className="mt-6 space-y-8">
              {/* Projects Section - Overview cards */}
              {projects.length > 0 && (
                <div className="bg-white dark:bg-default-100 rounded-2xl p-6 border border-default-200">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Projects</h2>
                      <p className="text-sm text-default-500 mt-1">Active projects in this space</p>
                    </div>
                    <Button
                      color="primary"
                      variant="flat"
                      size="sm"
                      startContent={<Plus className="w-4 h-4" />}
                      onPress={onProjectOpen}
                    >
                      New Project
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {projects.slice(0, 4).map(project => (
                      <Card
                        key={project.id}
                        isPressable
                        className="hover:shadow-sm transition-shadow"
                        onPress={() => router.push(`/projects/${project.id}`)}
                      >
                        <CardBody className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div 
                                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: project.color ? `${project.color}20` : undefined }}
                              >
                                {renderProjectIcon(project.icon)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-default-400">
                                    {projectTaskCounts[project.id] || 0} tasks
                                  </span>
                                  <Chip
                                    size="sm"
                                    color={getProjectStatusColor(project.status) as any}
                                    variant="flat"
                                  >
                                    {project.status === 'on_hold' ? 'On Hold' : project.status}
                                  </Chip>
                                </div>
                              </div>
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
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownTrigger>
                              <DropdownMenu
                                aria-label="Project actions"
                                onAction={(key) => {
                                  if (key === 'edit') {
                                    setSelectedProject(project)
                                    onEditProjectOpen()
                                  } else if (key === 'delete') {
                                    setSelectedProject(project)
                                    onDeleteProjectOpen()
                                  }
                                }}
                              >
                                <DropdownItem key="edit" startContent={<Edit className="w-4 h-4" />}>
                                  Edit Project
                                </DropdownItem>
                                <DropdownItem key="delete" className="text-danger" color="danger" startContent={<Trash2 className="w-4 h-4" />}>
                                  Delete Project
                                </DropdownItem>
                              </DropdownMenu>
                            </Dropdown>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>

                  {projects.length > 4 && (
                    <div className="mt-4 pt-4 border-t border-default-200">
                      <Button
                        variant="light"
                        className="w-full"
                        onPress={() => setSelectedTab('projects')}
                        endContent={<ArrowRight className="w-4 h-4" />}
                      >
                        View All {projects.length} Projects
                      </Button>
                    </div>
                  )}
                </div>
              )}

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
                        src={m.user?.avatar_url} 
                        name={m.user?.display_name || m.user?.name} 
                      />
                    ))}
                  </AvatarGroup>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {members.slice(0, 4).map(member => (
                    <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-default-100">
                      <Avatar 
                        src={member.user?.avatar_url} 
                        name={member.user?.display_name || member.user?.name} 
                        size="sm"
                      />
                      <div>
                        <p className="font-medium text-foreground">{member.user?.display_name || member.user?.name}</p>
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
                      onPress={() => setSelectedTab('members')}
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
            key="projects"
            title={
              <div className="flex items-center gap-1.5">
                <FolderKanban className="w-4 h-4" />
                <span className="hidden sm:inline">Projects</span>
                {projects.length > 0 && (
                  <span className="text-xs bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300 px-1.5 py-0.5 rounded-full">
                    {projects.length}
                  </span>
                )}
              </div>
            }
          >
            <div className="mt-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Projects</h2>
                  <p className="text-sm text-default-500 mt-1">All projects in this space</p>
                </div>
                <Button 
                  color="primary" 
                  startContent={<Plus className="w-4 h-4" />}
                  onPress={onProjectOpen}
                >
                  New Project
                </Button>
              </div>

              {projects.length === 0 ? (
                <Card className="py-12">
                  <CardBody className="text-center text-default-400">
                    <FolderKanban className="w-12 h-12 mx-auto mb-4" />
                    <p className="mb-4">No projects in this space yet.</p>
                    <Button 
                      color="primary" 
                      variant="flat"
                      startContent={<Plus className="w-4 h-4" />}
                      onPress={onProjectOpen}
                    >
                      Create First Project
                    </Button>
                  </CardBody>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map(project => {
                    const taskCount = projectTaskCounts[project.id] || 0
                    const doneTasks = tasks.filter(t => t.project_id === project.id && t.status === 'done').length

                    return (
                      <Card
                        key={project.id}
                        isPressable
                        className="hover:shadow-md transition-shadow"
                        onPress={() => router.push(`/projects/${project.id}`)}
                      >
                        <CardBody className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div 
                                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: project.color ? `${project.color}20` : undefined }}
                              >
                                {renderProjectIcon(project.icon)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
                                <Chip
                                  size="sm"
                                  color={getProjectStatusColor(project.status) as any}
                                  variant="flat"
                                  className="mt-1"
                                >
                                  {project.status === 'on_hold' ? 'On Hold' : project.status}
                                </Chip>
                              </div>
                            </div>
                            <Dropdown>
                              <DropdownTrigger>
                                <Button
                                  isIconOnly
                                  variant="light"
                                  size="sm"
                                  className="text-default-400 hover:text-default-600 flex-shrink-0"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                  }}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownTrigger>
                              <DropdownMenu
                                aria-label="Project actions"
                                onAction={(key) => {
                                  if (key === 'edit') {
                                    setSelectedProject(project)
                                    onEditProjectOpen()
                                  } else if (key === 'delete') {
                                    setSelectedProject(project)
                                    onDeleteProjectOpen()
                                  }
                                }}
                              >
                                <DropdownItem key="edit" startContent={<Edit className="w-4 h-4" />}>
                                  Edit Project
                                </DropdownItem>
                                <DropdownItem key="delete" className="text-danger" color="danger" startContent={<Trash2 className="w-4 h-4" />}>
                                  Delete Project
                                </DropdownItem>
                              </DropdownMenu>
                            </Dropdown>
                          </div>

                          {project.description && (
                            <p className="text-sm text-default-500 mb-3 line-clamp-2">{project.description}</p>
                          )}

                          <div className="flex items-center justify-between text-xs text-default-400 pt-3 border-t border-default-100">
                            <div className="flex items-center gap-1">
                              <ListTodo className="w-3 h-3" />
                              <span>{taskCount} task{taskCount !== 1 ? 's' : ''}</span>
                            </div>
                            {taskCount > 0 && (
                              <span>{doneTasks}/{taskCount} done</span>
                            )}
                          </div>
                        </CardBody>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </Tab>
          
          <Tab 
            key="tasks" 
            title={
              <div className="flex items-center gap-1.5">
                <ListTodo className="w-4 h-4" />
                <span className="hidden sm:inline">Tasks</span>
                {tasks.length > 0 && (
                  <span className="text-xs bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300 px-1.5 py-0.5 rounded-full">
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
                  onPress={onTaskOpen}
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
                <TasksByProject 
                  tasks={tasks} 
                  projects={projects} 
                  onTaskClick={(taskId) => router.push(`/tasks?task=${taskId}`)}
                  getPriorityColor={getPriorityColor}
                />
              )}
            </div>
          </Tab>
          
          <Tab 
            key="docs" 
            title={
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Docs</span>
                {documents.length > 0 && (
                  <span className="text-xs bg-default-100 text-default-600 px-1.5 py-0.5 rounded-full">
                    {documents.length}
                  </span>
                )}
              </div>
            }
          >
            <div className="mt-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Documents</h2>
                  <p className="text-sm text-default-500 mt-1">Research and intel in this space</p>
                </div>
                <Button 
                  color="primary" 
                  startContent={<Plus className="w-4 h-4" />}
                  onPress={async () => {
                    if (!user) return toast.error('Please sign in')
                    try {
                      const { data, error } = await supabase
                        .from('documents')
                        .insert({
                          title: 'Untitled Document',
                          content: '',
                          status: 'draft',
                          created_by: user.id,
                          space_id: id,
                          doc_type: 'document',
                        })
                        .select().single()
                      if (error) throw error
                      router.push(`/docs/${data.id}/edit`)
                    } catch (error) {
                      console.error('Create doc error:', error)
                      toast.error('Failed to create document')
                    }
                  }}
                >
                  New Doc
                </Button>
              </div>

              {documents.length === 0 ? (
                <Card className="py-12">
                  <CardBody className="text-center text-default-400">
                    <FileText className="w-12 h-12 mx-auto mb-4" />
                    <p>No documents in this space yet.</p>
                  </CardBody>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {documents.map(doc => (
                    <Card key={doc.id} className="group">
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 
                            className="font-semibold text-foreground truncate cursor-pointer hover:text-primary flex-1"
                            onClick={() => router.push(`/docs/${doc.id}?from=space&spaceId=${id}&tab=docs`)}
                          >
                            {doc.title}
                          </h3>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity min-w-7 w-7 h-7"
                            onPress={async () => {
                              if (!confirm('Delete this document?')) return
                              try {
                                const { error } = await supabase.from('documents').delete().eq('id', doc.id)
                                if (error) throw error
                                setDocuments(prev => prev.filter(d => d.id !== doc.id))
                                toast.success('Document deleted')
                              } catch (err) {
                                console.error(err)
                                toast.error('Failed to delete')
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-danger" />
                          </Button>
                        </div>
                        <p 
                          className="text-xs text-default-500 cursor-pointer"
                          onClick={() => router.push(`/docs/${doc.id}?from=space&spaceId=${id}&tab=docs`)}
                        >
                          Updated {new Date(doc.updated_at).toLocaleDateString()}
                        </p>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </Tab>

          <Tab 
            key="threads" 
            title={
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Threads</span>
                {threads.length > 0 && (
                  <span className="text-xs bg-default-100 text-default-600 px-1.5 py-0.5 rounded-full">
                    {threads.length}
                  </span>
                )}
              </div>
            }
          >
            <div className="mt-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Threads</h2>
                  <p className="text-sm text-default-500 mt-1">Conversations linked to this space</p>
                </div>
                <Button 
                  color="primary" 
                  variant="flat"
                  startContent={<Plus className="w-4 h-4" />}
                  onPress={() => router.push(`/inbox?space=${id}`)}
                >
                  New Thread
                </Button>
              </div>

              {threads.length === 0 ? (
                <Card className="py-12">
                  <CardBody className="text-center text-default-400">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4" />
                    <p>No message threads linked to this space.</p>
                  </CardBody>
                </Card>
              ) : (
                <div className="space-y-3">
                  {threads.map(thread => (
                    <Card key={thread.id} isPressable onPress={() => router.push(`/inbox?thread=${thread.thread_id}`)}>
                      <CardBody className="p-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-foreground">{thread.subject || 'No Subject'}</span>
                          <span className="text-[10px] text-default-400">{new Date(thread.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-default-500 line-clamp-1">{thread.content}</p>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </Tab>

          <Tab 
            key="members" 
            title={
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Members</span>
              </div>
            }
          >
            <div className="mt-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Team Members</h2>
                  <p className="text-sm text-default-500 mt-1">Everyone in this space</p>
                </div>
                {canManageMembers && (
                  <Button 
                    variant="flat" 
                    startContent={<Plus className="w-4 h-4" />} 
                    size="sm"
                    onPress={onInviteOpen}
                  >
                    Invite Member
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map(member => (
                  <Card key={member.id}>
                    <CardBody className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar 
                            src={member.user?.avatar_url} 
                            name={member.user?.display_name || member.user?.name} 
                            size="md"
                          />
                          <div>
                            <p className="font-semibold">{member.user?.display_name || member.user?.name}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-default-400 capitalize">{member.role}</p>
                              {member.role === 'owner' && (
                                <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 px-2 py-0.5 rounded">
                                  Owner
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {canManageMembers && member.role !== 'owner' && (
                          confirmingMemberId === member.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-default-500 mr-2">Remove?</span>
                              <Button
                                size="sm"
                                variant="flat"
                                color="danger"
                                isIconOnly
                                onPress={() => removeMember(member.id)}
                                title="Yes, remove"
                              >
                                ✓
                              </Button>
                              <Button
                                size="sm"
                                variant="flat"
                                isIconOnly
                                onPress={() => setConfirmingMemberId(null)}
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="light"
                              color="danger"
                              isLoading={removingMemberId === member.id}
                              isIconOnly
                              onPress={() => setConfirmingMemberId(member.id)}
                              title="Remove member"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )
                        )}
                      </div>
                      {member.user_id === user?.id && (
                        <div className="mt-2 pt-2 border-t border-default-100">
                          <span className="text-xs text-default-500">That's you!</span>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          </Tab>
        </Tabs>
      </main>

      <AddTaskModal
        isOpen={isTaskOpen}
        onClose={onTaskClose}
        onSuccess={loadSpaceData}
        initialSpaceId={id as string}
        userId={user?.id}
      />

      <AddProjectModal
        isOpen={isProjectOpen}
        onClose={onProjectClose}
        onSuccess={loadSpaceData}
        spaceId={id as string}
        userId={user?.id}
      />

      <InviteMemberModal
        isOpen={isInviteOpen}
        onClose={onInviteClose}
        onSuccess={loadSpaceData}
        spaceId={id as string}
        currentUserId={user?.id}
      />

      <EditProjectModal
        project={selectedProject}
        isOpen={isEditProjectOpen}
        onClose={() => {
          onEditProjectClose()
          setSelectedProject(null)
        }}
        onSuccess={loadSpaceData}
      />

      {/* Delete Project Confirmation Modal */}
      <Modal isOpen={isDeleteProjectOpen} onClose={onDeleteProjectClose}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">Delete Project</ModalHeader>
          <ModalBody>
            <p className="text-default-600">
              Are you sure you want to delete <strong>"{selectedProject?.name}"</strong>?
            </p>
            <p className="text-sm text-default-400">
              This will also remove all tasks associated with this project. This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDeleteProjectClose}>
              Cancel
            </Button>
            <Button 
              color="danger" 
              onPress={handleDeleteProject}
              isLoading={deletingProjectId === selectedProject?.id}
            >
              Delete Project
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
