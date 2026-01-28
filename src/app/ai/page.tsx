'use client'

import { useState, useEffect } from 'react'
import { 
  Button, 
  Card, 
  CardBody,
  CardHeader,
  Chip,
  Tabs,
  Tab,
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import WorkLogPanel from '@/components/WorkLogPanel'
import { showErrorToast, getErrorMessage } from '@/lib/errors'
import { ErrorFallback } from '@/components/ErrorBoundary'

interface AIAgent {
  id: string
  name: string
  slug: string
  role: string
  model: string
  is_active: boolean
  settings: {
    autonomy_level?: string
    can_spawn_agents?: boolean
    daily_token_budget?: number
  }
}

interface WorkLog {
  id: string
  agent_name: string
  action: string
  task_id: string | null
  details: Record<string, unknown>
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

type ViewType = 'overview' | 'work-log' | 'agents' | 'queue'

export default function AIWorkspacePage() {
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [aiTasks, setAiTasks] = useState<any[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<ViewType>('overview')
  
  const supabase = createClient()

  useEffect(() => {
    loadData()
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

      // Get AI-flagged tasks
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
                  <div key={agent.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-lg">⚡</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-800 dark:text-slate-100 truncate">{agent.name}</h3>
                        <Chip 
                          size="sm" 
                          className={agent.is_active ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400'}
                        >
                          {agent.is_active ? 'Online' : 'Offline'}
                        </Chip>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{agent.role.replace('_', ' ')} • {agent.model}</p>
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

        {/* AI Task Queue Preview */}
        <Card className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
          <CardHeader className="px-6 pt-6 pb-2">
            <div className="flex items-center justify-between w-full">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">AI Task Queue</h2>
              <Chip size="sm" variant="flat">{aiTasks.length} tasks</Chip>
            </div>
          </CardHeader>
          <CardBody className="px-6 pb-6">
            {aiTasks.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-slate-400 dark:text-slate-500 text-sm">No tasks flagged for AI</p>
              </div>
            ) : (
              <div className="space-y-2">
                {aiTasks.slice(0, 5).map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                    <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{task.title}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 capitalize">{task.priority} • {task.status.replace('_', ' ')}</p>
                    </div>
                  </div>
                ))}
                {aiTasks.length > 5 && (
                  <Button 
                    size="sm" 
                    variant="flat" 
                    className="w-full"
                    onPress={() => setCurrentView('queue')}
                  >
                    View all {aiTasks.length} tasks →
                  </Button>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Right Column - Recent Work Log */}
      <div className="lg:col-span-2">
        <WorkLogPanel 
          workLogs={workLogs.slice(0, 50)} 
          loading={logsLoading}
          onRefresh={refreshWorkLogs}
        />
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
    <Card className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
      <CardHeader className="px-6 pt-6 pb-2">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">AI Agents</h2>
      </CardHeader>
      <CardBody className="px-6 pb-6">
        {agents.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No agents configured</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map(agent => (
              <div key={agent.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-2xl">⚡</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">{agent.name}</h3>
                    <Chip 
                      size="sm" 
                      className={agent.is_active ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400'}
                    >
                      {agent.is_active ? 'Online' : 'Offline'}
                    </Chip>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{agent.role.replace('_', ' ')} • {agent.model}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 dark:text-slate-500">
                    <span>Autonomy: {agent.settings?.autonomy_level || 'medium'}</span>
                    {agent.settings?.can_spawn_agents && <span>🤖 Can spawn</span>}
                    {agent.settings?.daily_token_budget && <span>💰 {agent.settings.daily_token_budget.toLocaleString()} tokens/day</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
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
            <div className="text-4xl mb-4">🤖</div>
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
                  🤖 AI
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
                  <span>📊</span>
                  <span>Overview</span>
                </div>
              } />
              <Tab key="work-log" title={
                <div className="flex items-center gap-2">
                  <span>📋</span>
                  <span>Work Log</span>
                  <Chip size="sm" variant="flat">
                    {workLogs.length}
                  </Chip>
                </div>
              } />
              <Tab key="agents" title={
                <div className="flex items-center gap-2">
                  <span>🤖</span>
                  <span>Agents</span>
                  <Chip size="sm" variant="flat">
                    {agents.filter(a => a.is_active).length}/{agents.length}
                  </Chip>
                </div>
              } />
              <Tab key="queue" title={
                <div className="flex items-center gap-2">
                  <span>📥</span>
                  <span>Queue</span>
                  <Chip size="sm" variant="flat" className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300">
                    {aiTasks.length}
                  </Chip>
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
    </div>
  )
}
