'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, LayoutDashboard, Activity, ListTodo, BookOpen, Zap } from 'lucide-react'
import { 
  Button, 
  Card, 
  CardBody,
  CardHeader,
  Chip,
  Tabs,
  Tab,
  Spinner,
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  useDisclosure,
  Avatar,
  Divider,
  Tooltip,
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import WorkLogPanel from '@/components/WorkLogPanel'
import { showErrorToast, getErrorMessage } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'
import JournalView from '@/components/JournalView'

interface AIAgent {
  id: string
  name: string
  slug: string
  role: string
  model: string
  is_active: boolean
  capabilities?: string[]
  business_id?: string | null
  system_prompt?: string
  settings: {
    autonomy_level?: string
    can_spawn_agents?: boolean
    daily_token_budget?: number
    personality_description?: string
  }
}

interface AgentTask {
  id: string
  from_agent: string
  to_agent: string
  task: string
  context: string
  priority: string
  status: string
  result: string | null
  error: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
}

interface WorkLog {
  id: string
  agent_name: string
  action: string
  task_id: string | null
  details: Record<string, any>
  tokens_used: number | null
  duration_ms: number | null
  created_at: string
}

interface UserData {
  id: string
  email: string
  name?: string
  avatar_url?: string
  role?: string
}

type ViewType = 'overview' | 'work-log' | 'agents' | 'queue' | 'journal'

export default function AIWorkspacePage() {
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [aiTasks, setAiTasks] = useState<any[]>([])
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([])
  const [businesses, setBusinesses] = useState<any[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<ViewType>('overview')
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null)
  
  const {isOpen, onOpen, onOpenChange} = useDisclosure()
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    loadData()
  }, [])

  // Auto-refresh work logs every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshWorkLogs()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadData() {
    setLoading(true)
    setLoadError(null)
    
    try {
      // Get user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError) {
        console.error('Auth error:', authError)
      }
      
      if (authUser) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single()
          
          if (profileError) {
            console.error('Profile fetch error:', profileError)
          }
          
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            name: profile?.name || authUser.email?.split('@')[0],
            avatar_url: profile?.avatar_url,
            role: profile?.role
          })
        } catch (err) {
          console.error('Failed to fetch profile:', err)
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            name: authUser.email?.split('@')[0],
          })
        }
      }

      // Get AI agents
      const { data: agentsData, error: agentsError } = await supabase
        .from('ai_agents')
        .select('*')
        .order('created_at', { ascending: true })
      
      if (agentsError) {
        console.error('Agents fetch error:', agentsError)
        throw agentsError
      }
      
      setAgents(agentsData || [])

      // Get work logs (larger limit for the full panel)
      const { data: logsData, error: logsError } = await supabase
        .from('ai_work_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      
      if (logsError) {
        console.error('Work logs fetch error:', logsError)
        // Non-fatal - we can still show agents
      }
      
      setWorkLogs(logsData || [])

      // Get AI-flagged tasks (exclude done tasks)
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('ai_flag', true)
        .neq('status', 'done')
        .order('priority', { ascending: true })
      
      if (tasksError) {
        console.error('AI tasks fetch error:', tasksError)
        // Non-fatal - we can still show agents and logs
      }
      
      setAiTasks(tasksData || [])

      // Get Agent-to-Agent tasks
      const { data: collabData, error: collabError } = await supabase
        .from('agent_tasks')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (collabError) {
        console.error('Agent tasks fetch error:', collabError)
      }
      setAgentTasks(collabData || [])

      // Get Businesses for mapping
      const { data: bizData, error: bizError } = await supabase
        .from('businesses')
        .select('id, name')
      
      if (bizError) {
        console.error('Businesses fetch error:', bizError)
      }
      setBusinesses(bizData || [])

    } catch (error) {
      console.error('Load AI workspace error:', error)
      setLoadError(getErrorMessage(error))
      showErrorToast(error, 'Failed to load AI workspace')
    } finally {
      setLoading(false)
    }
  }

  async function refreshWorkLogs() {
    setLogsLoading(true)
    try {
      const { data: logsData, error: logsError } = await supabase
        .from('ai_work_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      
      if (logsError) {
        throw logsError
      }
      
      setWorkLogs(logsData || [])
    } catch (error) {
      console.error('Refresh work logs error:', error)
      showErrorToast(error, 'Failed to refresh work logs')
    } finally {
      setLogsLoading(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'critical': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      default: return 'bg-slate-400'
    }
  }

  // Calculate stats
  const todayLogs = workLogs.filter(log => {
    const logDate = new Date(log.created_at)
    const today = new Date()
    return logDate.toDateString() === today.toDateString()
  })

  const totalTokensToday = todayLogs.reduce((sum, log) => sum + (log.tokens_used || 0), 0)
  const tasksCompletedToday = todayLogs.filter(log => log.action === 'task_completed').length

  const getAgentStats = (agentSlug: string) => {
    const agentLogs = workLogs.filter(l => l.agent_name.toLowerCase() === agentSlug.toLowerCase())
    const agentTasksCount = agentLogs.filter(l => l.action === 'task_completed').length
    const totalTokens = agentLogs.reduce((sum, l) => sum + (l.tokens_used || 0), 0)
    
    return {
      tasksCompleted: agentTasksCount,
      tokensUsed: totalTokens,
      actions: agentLogs.length
    }
  }

  const handleAgentClick = (agent: AIAgent) => {
    setSelectedAgent(agent)
    onOpen()
  }

  // Render Collaboration Feed
  const renderCollabFeed = () => (
    <Card className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
      <CardHeader className="px-6 pt-6 pb-2">
        <div className="flex items-center justify-between w-full">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Collaboration Feed</h2>
          <Chip size="sm" variant="flat" color="secondary">{agentTasks.length} exchanges</Chip>
        </div>
      </CardHeader>
      <CardBody className="px-6 pb-6">
        {agentTasks.length === 0 ? (
          <p className="text-slate-400 text-center py-4 text-sm">No agent collaboration recorded</p>
        ) : (
          <div className="space-y-4">
            {agentTasks.slice(0, 5).map(task => (
              <div key={task.id} className="relative pl-6 border-l-2 border-slate-100 dark:border-slate-700 pb-2">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-violet-500 border-2 border-white dark:border-slate-800" />
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase text-violet-600 dark:text-violet-400">{task.from_agent}</span>
                  <span className="text-xs text-slate-400">→</span>
                  <span className="text-xs font-bold uppercase text-blue-600 dark:text-blue-400">{task.to_agent}</span>
                  <span className="text-[10px] text-slate-400 ml-auto">
                    {new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{task.task}</p>
                <div className="mt-2">
                  <Chip size="sm" variant="flat" color={task.status === 'done' ? 'success' : 'warning'} className="h-5 text-[10px]">
                    {task.status}
                  </Chip>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )

  // Render Overview Tab
  const renderOverview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column - Stats & Quick Info */}
      <div className="space-y-6">
        {/* Today's Stats Card */}
        <Card className="bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
          <CardBody className="p-6">
            <h3 className="font-semibold mb-4">Today's Activity</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-violet-200">Tasks Completed</span>
                <span className="font-semibold">{tasksCompletedToday}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-violet-200">Total Actions</span>
                <span className="font-semibold">{todayLogs.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-violet-200">Tokens Used</span>
                <span className="font-semibold">{totalTokensToday.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-violet-200">Active Agents</span>
                <span className="font-semibold">{agents.filter(a => a.is_active).length}</span>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* AI Agents Card */}
        <Card className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
          <CardHeader className="px-6 pt-6 pb-2">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">AI Agents</h2>
          </CardHeader>
          <CardBody className="px-6 pb-6">
            {agents.length === 0 ? (
              <p className="text-slate-400 text-center py-4">No agents configured</p>
            ) : (
              <div className="space-y-3">
                {agents.slice(0, 4).map(agent => (
                  <div 
                    key={agent.id} 
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                    onClick={() => handleAgentClick(agent)}
                  >
                    <Avatar 
                      name={agent.name}
                      className="bg-gradient-to-br from-violet-500 to-purple-600 text-white"
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-800 dark:text-slate-100 truncate">{agent.name}</h3>
                        <div className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{agent.role.replace('_', ' ')}</p>
                    </div>
                  </div>
                ))}
                {agents.length > 4 && (
                  <Button 
                    size="sm" 
                    variant="flat" 
                    className="w-full"
                    onPress={() => setCurrentView('agents')}
                  >
                    View all {agents.length} agents →
                  </Button>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Middle Column - Collaboration & Work */}
      <div className="lg:col-span-2 space-y-6">
        {renderCollabFeed()}

        {/* AI Task Queue Preview */}
        <Card className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
          <CardHeader className="px-6 pt-6 pb-2">
            <div className="flex items-center justify-between w-full">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Active Task Queue</h2>
              <Chip size="sm" variant="flat">{aiTasks.length} tasks</Chip>
            </div>
          </CardHeader>
          <CardBody className="px-6 pb-6">
            {aiTasks.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-slate-400 dark:text-slate-500 text-sm">No tasks flagged for AI</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aiTasks.slice(0, 6).map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600">
                    <div className={`w-2 h-2 flex-shrink-0 rounded-full ${getPriorityColor(task.priority)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{task.title}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 capitalize">{task.priority} • {task.status.replace('_', ' ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {aiTasks.length > 6 && (
              <Button 
                size="sm" 
                variant="flat" 
                className="w-full mt-4"
                onPress={() => setCurrentView('queue')}
              >
                View full queue →
              </Button>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )

  // Render Full Work Log Tab
  const renderWorkLogTab = () => (
    <WorkLogPanel 
      workLogs={workLogs} 
      loading={logsLoading}
      onRefresh={refreshWorkLogs}
    />
  )

  // Render Agents Tab
  const renderAgentsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map(agent => {
          const stats = getAgentStats(agent.slug)
          const currentTask = agentTasks.find(t => t.to_agent === agent.slug && t.status === 'pending')
          const biz = businesses.find(b => b.id === agent.business_id)

          return (
            <Card 
              key={agent.id} 
              isPressable
              onPress={() => handleAgentClick(agent)}
              className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:border-violet-500 dark:hover:border-violet-500 transition-all overflow-visible"
            >
              <CardHeader className="p-6 pb-0 flex flex-col items-center">
                <div className="relative">
                  <Avatar 
                    name={agent.name}
                    className="w-24 h-24 text-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-xl"
                  />
                  <div className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-white dark:border-slate-800 ${agent.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                </div>
                <h3 className="text-xl font-bold mt-4 text-slate-800 dark:text-slate-100">{agent.name}</h3>
                <Chip size="sm" variant="flat" className="mt-1">{agent.role.replace('_', ' ')}</Chip>
              </CardHeader>
              <CardBody className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                    <p className="text-[10px] uppercase text-slate-400 font-bold">Tasks</p>
                    <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{stats.tasksCompleted}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                    <p className="text-[10px] uppercase text-slate-400 font-bold">Actions</p>
                    <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{stats.actions}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Model</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{agent.model}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Business</span>
                    <span className="font-medium text-violet-600 dark:text-violet-400">{biz?.name || 'Global'}</span>
                  </div>
                </div>

                <Divider className="my-4" />

                <div className="min-h-[60px]">
                  <p className="text-[10px] uppercase text-slate-400 font-bold mb-2">Current Focus</p>
                  {currentTask ? (
                    <div className="flex items-start gap-2">
                      <Zap className="w-3 h-3 text-amber-500 mt-1 flex-shrink-0" />
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 italic">
                        "{currentTask.task}"
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Idle / Waiting for task</p>
                  )}
                </div>
              </CardBody>
              <div className="px-6 pb-6 pt-0 flex gap-2">
                <Button size="sm" color="primary" variant="flat" className="flex-1" onPress={() => handleAgentClick(agent)}>
                  Profile
                </Button>
                <Button size="sm" variant="flat" isIconOnly>
                  <Activity className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )

  // Render Queue Tab
  const renderQueueTab = () => (
    <Card className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
      <CardHeader className="px-6 pt-6 pb-2">
        <div className="flex items-center justify-between w-full">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">AI Task Queue</h2>
          <Chip size="sm" className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300">
            {aiTasks.length} tasks
          </Chip>
        </div>
      </CardHeader>
      <CardBody className="px-6 pb-6">
        {aiTasks.length === 0 ? (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <p className="text-slate-400 dark:text-slate-500 mb-2">No tasks flagged for AI</p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Enable "AI Flag" on tasks to add them to the queue
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {aiTasks.map(task => (
              <div key={task.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-600">
                <div className={`w-3 h-3 rounded-full ${getPriorityColor(task.priority)}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-slate-700 dark:text-slate-200">{task.title}</p>
                  </div>
                  {task.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mb-1">{task.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
                    <span className="capitalize">{task.priority} priority</span>
                    <span>•</span>
                    <span className="capitalize">{task.status.replace('_', ' ')}</span>
                    {task.due_date && (
                      <>
                        <span>•</span>
                        <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
                <Chip size="sm" className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 flex-shrink-0">
                  <Bot className="w-3 h-3" />
                </Chip>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )

  // Render current view
  const renderCurrentView = () => {
    switch (currentView) {
      case 'overview':
        return renderOverview()
      case 'work-log':
        return renderWorkLogTab()
      case 'agents':
        return renderAgentsTab()
      case 'queue':
        return renderQueueTab()
      case 'journal':
        return <JournalView />
      default:
        return renderOverview()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-purple-950/20">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* View Tabs */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
          <div className="w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
            <Tabs 
              selectedKey={currentView} 
              onSelectionChange={(key) => setCurrentView(key as ViewType)}
              color="primary"
              variant="solid"
              size="md"
              classNames={{
                tabList: "flex-nowrap",
                tab: "whitespace-nowrap",
              }}
            >
              <Tab key="overview" title={
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Overview</span>
                </div>
              } />
              <Tab key="work-log" title={
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  <span>Work Log</span>
                  <Chip size="sm" variant="flat">
                    {workLogs.length}
                  </Chip>
                </div>
              } />
              <Tab key="agents" title={
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  <span>Agents</span>
                  <Chip size="sm" variant="flat">
                    {agents.filter(a => a.is_active).length}/{agents.length}
                  </Chip>
                </div>
              } />
              <Tab key="queue" title={
                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4" />
                  <span>Queue</span>
                  <Chip size="sm" variant="flat" className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300">
                    {aiTasks.length}
                  </Chip>
                </div>
              } />
              <Tab key="journal" title={
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  <span>Journal</span>
                </div>
              } />
            </Tabs>
          </div>
        </div>

        {/* Error State */}
        {loadError && !loading && (
          <div className="mb-6">
            <ErrorFallback error={loadError} resetError={loadData} />
          </div>
        )}
        
        {loading ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">Loading AI workspace...</div>
        ) : !loadError && (
          renderCurrentView()
        )}
      </main>

      {/* Agent Profile Modal */}
      <Modal 
        isOpen={isOpen} 
        onOpenChange={onOpenChange}
        size="3xl"
        scrollBehavior="inside"
        backdrop="blur"
      >
        <ModalContent>
          {(onClose) => (
            <>
              {selectedAgent && (
                <>
                  <ModalHeader className="flex gap-4 items-center border-b dark:border-slate-700 pb-4">
                    <Avatar 
                      name={selectedAgent.name}
                      className="bg-gradient-to-br from-violet-500 to-purple-600 text-white"
                    />
                    <div className="flex flex-col">
                      <p className="text-xl font-bold">{selectedAgent.name}</p>
                      <p className="text-sm text-slate-500">{selectedAgent.role.replace('_', ' ')}</p>
                    </div>
                    <Chip 
                      size="sm" 
                      color={selectedAgent.is_active ? 'success' : 'default'}
                      variant="flat"
                      className="ml-auto"
                    >
                      {selectedAgent.is_active ? 'Online' : 'Offline'}
                    </Chip>
                  </ModalHeader>
                  <ModalBody className="py-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-2 space-y-6">
                        {/* Personality / Description */}
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <Bot className="w-4 h-4 text-violet-500" />
                            Identity & Personality
                          </h4>
                          <Card className="bg-slate-50 dark:bg-slate-800/50 border-none">
                            <CardBody className="text-sm text-slate-600 dark:text-slate-300">
                              {selectedAgent.settings?.personality_description || 
                               selectedAgent.system_prompt || 
                               "No detailed personality description available for this agent."}
                            </CardBody>
                          </Card>
                        </div>

                        {/* Capabilities & Permissions */}
                        <div>
                          <h4 className="font-semibold mb-2">Capabilities & Permissions</h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedAgent.capabilities?.map(cap => (
                              <Chip key={cap} size="sm" variant="dot" color="primary">{cap}</Chip>
                            )) || <span className="text-xs text-slate-400">Standard AI capabilities</span>}
                            <Chip size="sm" variant="dot" color="secondary">Access: {businesses.find(b => b.id === selectedAgent.business_id)?.name || 'All Businesses'}</Chip>
                            {selectedAgent.settings?.can_spawn_agents && (
                              <Chip size="sm" variant="dot" color="success">Can spawn sub-agents</Chip>
                            )}
                          </div>
                        </div>

                        {/* Recent Activity */}
                        <div>
                          <h4 className="font-semibold mb-2">Recent Activity</h4>
                          <div className="space-y-2">
                            {workLogs
                              .filter(l => l.agent_name.toLowerCase() === selectedAgent.slug.toLowerCase())
                              .slice(0, 5)
                              .map(log => (
                                <div key={log.id} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 text-xs">
                                  <span className="font-medium text-slate-700 dark:text-slate-200">{log.action.replace('_', ' ')}</span>
                                  <span className="text-slate-400">{new Date(log.created_at).toLocaleDateString()}</span>
                                </div>
                              ))
                            }
                          </div>
                        </div>
                      </div>

                      <div className="space-y-6">
                        {/* Stats Panel */}
                        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white">
                          <CardBody className="p-4 space-y-4">
                            <div>
                              <p className="text-[10px] uppercase text-slate-400 font-bold">Total Tokens (Lifetime)</p>
                              <p className="text-xl font-bold">{getAgentStats(selectedAgent.slug).tokensUsed.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase text-slate-400 font-bold">Tasks Completed</p>
                              <p className="text-xl font-bold">{getAgentStats(selectedAgent.slug).tasksCompleted}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase text-slate-400 font-bold">Uptime</p>
                              <p className="text-xl font-bold text-emerald-400">99.9%</p>
                            </div>
                          </CardBody>
                        </Card>

                        {/* Config Info */}
                        <div className="space-y-3">
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-slate-400 font-bold">Model Architecture</span>
                            <span className="text-sm font-medium">{selectedAgent.model}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-slate-400 font-bold">Autonomy Level</span>
                            <span className="text-sm font-medium capitalize">{selectedAgent.settings?.autonomy_level || 'medium'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-slate-400 font-bold">Daily Budget</span>
                            <span className="text-sm font-medium">💰 {selectedAgent.settings?.daily_token_budget?.toLocaleString() || 'Unlimited'} tokens</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </ModalBody>
                  <ModalFooter className="border-t dark:border-slate-700">
                    <Button variant="light" onPress={onClose}>
                      Close
                    </Button>
                    <Button color="primary" onPress={() => {
                      onClose()
                      setCurrentView('work-log')
                    }}>
                      View Logs
                    </Button>
                  </ModalFooter>
                </>
              )}
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
