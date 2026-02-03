'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  Bot, 
  LayoutDashboard, 
  Activity, 
  FileText,
  Users,
  Zap,
  ArrowRight,
  Clock,
  X
} from 'lucide-react'
import { 
  Tabs,
  Tab,
  Chip,
  Card,
  CardHeader,
  CardBody,
  Button,
  Avatar,
  ScrollShadow,
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast } from '@/lib/errors'

// Types
interface AIAgent {
  id: string
  name: string
  slug: string
  role: string
  model: string
  is_active: boolean
  capabilities?: string[]
  system_prompt?: string
  settings: {
    autonomy_level?: string
    can_spawn_agents?: boolean
    daily_token_budget?: number
    personality?: string
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

type ViewType = 'dashboard' | 'activity' | 'debriefs'

export default function AIWorkspacePage() {
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<ViewType>('dashboard')
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null)
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      const [
        { data: agentsData },
        { data: logsData },
        { data: collabData }
      ] = await Promise.all([
        supabase.from('ai_agents').select('*').order('created_at', { ascending: true }),
        supabase.from('ai_work_log').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('agent_tasks').select('*').order('created_at', { ascending: false })
      ])

      setAgents(agentsData || [])
      setWorkLogs(logsData || [])
      setAgentTasks(collabData || [])
    } catch (error) {
      console.error('Load AI workspace error:', error)
      showErrorToast(error, 'Failed to load AI workspace')
    } finally {
      setLoading(false)
    }
  }

  // Stats calculation
  const stats = useMemo(() => {
    const today = new Date().toDateString()
    const todayLogs = workLogs.filter(l => new Date(l.created_at).toDateString() === today)
    const todayCollab = agentTasks.filter(t => new Date(t.created_at).toDateString() === today)

    return {
      tasksDone: todayLogs.filter(l => l.action === 'task_completed').length,
      tokens: todayLogs.reduce((sum, l) => sum + (l.tokens_used || 0), 0),
      agentsOnline: agents.filter(a => a.is_active).length,
      handoffs: todayCollab.length
    }
  }, [workLogs, agentTasks, agents])

  // Unified activity feed (work logs + collab tasks)
  const unifiedActivity = useMemo(() => {
    const activities = [
      ...workLogs.map(l => ({
        id: `log-${l.id}`,
        type: 'log' as const,
        agent: l.agent_name,
        action: l.action.replace(/_/g, ' '),
        timestamp: l.created_at,
        tokens: l.tokens_used,
        details: l.details
      })),
      ...agentTasks.map(t => ({
        id: `task-${t.id}`,
        type: 'handoff' as const,
        agent: t.from_agent,
        action: `→ ${t.to_agent}: ${t.task.substring(0, 60)}${t.task.length > 60 ? '...' : ''}`,
        timestamp: t.created_at,
        status: t.status,
        task: t
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    return activities
  }, [workLogs, agentTasks])

  const timeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const getAgentCurrentTask = (slug: string) => {
    return agentTasks.find(t => t.to_agent.toLowerCase() === slug.toLowerCase() && t.status === 'in_progress')
  }

  const getAgentStats = (slug: string) => {
    const agentLogs = workLogs.filter(l => l.agent_name.toLowerCase() === slug.toLowerCase())
    return {
      tasks: agentLogs.filter(l => l.action === 'task_completed').length,
      tokens: agentLogs.reduce((sum, l) => sum + (l.tokens_used || 0), 0)
    }
  }

  // ============ DASHBOARD TAB ============
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 lg:gap-4">
        {[
          { label: 'Tasks Done', value: stats.tasksDone, color: 'text-emerald-600' },
          { label: 'Agents Online', value: `${stats.agentsOnline}/${agents.length}`, color: 'text-violet-600' },
          { label: 'Agent Tasks', value: stats.handoffs, color: 'text-amber-600' },
        ].map((stat, i) => (
          <Card key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <CardBody className="p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wide">{stat.label}</p>
              <p className={`text-2xl lg:text-3xl font-black ${stat.color}`}>{stat.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agents Column */}
        <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <CardHeader className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between w-full">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 flex items-center gap-2">
                <Users className="w-4 h-4" /> Agents
              </h2>
              <Chip size="sm" variant="flat">{agents.length}</Chip>
            </div>
          </CardHeader>
          <CardBody className="px-4 pb-4 space-y-3">
            {agents.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No agents configured</p>
            ) : agents.map(agent => {
              const currentTask = getAgentCurrentTask(agent.slug)
              return (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                >
                  <Avatar
                    name={agent.name}
                    size="sm"
                    classNames={{
                      base: "bg-gradient-to-br from-violet-500 to-purple-600",
                      name: "text-white font-bold"
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{agent.name}</span>
                      <div className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {currentTask ? currentTask.task.substring(0, 40) + '...' : agent.role.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                </button>
              )
            })}
          </CardBody>
        </Card>

        {/* Recent Activity Column */}
        <Card className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <CardHeader className="px-4 pt-4 pb-2">
            <div className="flex items-center justify-between w-full">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Recent Activity
              </h2>
              <Button size="sm" variant="light" onPress={() => setCurrentView('activity')}>View All</Button>
            </div>
          </CardHeader>
          <CardBody className="px-4 pb-4">
            <ScrollShadow className="max-h-[400px]">
              <div className="space-y-2">
                {unifiedActivity.slice(0, 15).map(item => (
                  <div
                    key={item.id}
                    onClick={() => item.type === 'handoff' && setSelectedTask((item as any).task)}
                    className={`flex items-start gap-3 p-2 rounded-lg ${item.type === 'handoff' ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.type === 'handoff' ? 'bg-violet-100 dark:bg-violet-900/30' : 'bg-slate-100 dark:bg-slate-700'
                    }`}>
                      {item.type === 'handoff' ? (
                        <Zap className="w-4 h-4 text-violet-600" />
                      ) : (
                        <Activity className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">{item.agent}</span>
                        <span className="text-slate-500 dark:text-slate-400"> {item.action}</span>
                      </p>
                      <p className="text-xs text-slate-400">{timeAgo(item.timestamp)}</p>
                    </div>
                    {item.type === 'handoff' && (
                      <Chip size="sm" variant="flat" color={(item as any).status === 'done' ? 'success' : 'warning'} className="text-xs">
                        {(item as any).status}
                      </Chip>
                    )}
                  </div>
                ))}
              </div>
            </ScrollShadow>
          </CardBody>
        </Card>
      </div>
    </div>
  )

  // ============ ACTIVITY TAB ============
  const renderActivity = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)] min-h-[500px]">
      {/* Activity Feed - Left */}
      <Card className="lg:col-span-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
        <CardHeader className="px-4 pt-4 pb-2 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Activity Feed</h2>
        </CardHeader>
        <ScrollShadow className="h-full">
          <div className="p-2 space-y-1">
            {unifiedActivity.map(item => (
              <button
                key={item.id}
                onClick={() => item.type === 'handoff' && setSelectedTask((item as any).task)}
                className={`w-full text-left p-3 rounded-xl transition-colors ${
                  selectedTask?.id === (item as any).task?.id 
                    ? 'bg-violet-100 dark:bg-violet-900/30' 
                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase text-violet-600">{item.agent}</span>
                  <span className="text-xs text-slate-400">{timeAgo(item.timestamp)}</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{item.action}</p>
                {item.type === 'handoff' && (
                  <Chip size="sm" variant="flat" color={(item as any).status === 'done' ? 'success' : 'warning'} className="mt-2 text-xs">
                    {(item as any).status}
                  </Chip>
                )}
              </button>
            ))}
          </div>
        </ScrollShadow>
      </Card>

      {/* Thread Detail - Right */}
      <Card className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
        {selectedTask ? (
          <>
            <CardHeader className="px-4 pt-4 pb-2 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between w-full">
                <div>
                  <h2 className="font-bold text-slate-800 dark:text-slate-100">{selectedTask.from_agent} → {selectedTask.to_agent}</h2>
                  <p className="text-xs text-slate-500">{new Date(selectedTask.created_at).toLocaleString()}</p>
                </div>
                <Chip color={selectedTask.status === 'done' ? 'success' : selectedTask.status === 'in_progress' ? 'warning' : 'default'}>
                  {selectedTask.status}
                </Chip>
              </div>
            </CardHeader>
            <ScrollShadow className="h-full p-4">
              <div className="space-y-4">
                {/* Task */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <p className="text-xs font-bold uppercase text-slate-500 mb-2">Task</p>
                  <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{selectedTask.task}</p>
                </div>

                {/* Context */}
                {selectedTask.context && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                    <p className="text-xs font-bold uppercase text-slate-500 mb-2">Context</p>
                    <p className="text-slate-700 dark:text-slate-200">{selectedTask.context}</p>
                  </div>
                )}

                {/* Result */}
                {selectedTask.result && (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                    <p className="text-xs font-bold uppercase text-emerald-600 mb-2">Result</p>
                    <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{selectedTask.result}</p>
                  </div>
                )}

                {/* Error */}
                {selectedTask.error && (
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20">
                    <p className="text-xs font-bold uppercase text-red-600 mb-2">Error</p>
                    <p className="text-red-700 dark:text-red-300">{selectedTask.error}</p>
                  </div>
                )}
              </div>
            </ScrollShadow>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Activity className="w-12 h-12 mb-4" />
            <p className="font-medium">Select an activity to view details</p>
          </div>
        )}
      </Card>
    </div>
  )

  // ============ DEBRIEFS TAB ============
  const renderDebriefs = () => (
    <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <CardHeader className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Agent Debriefs
        </h2>
      </CardHeader>
      <CardBody className="p-4">
        <div className="text-center py-12 text-slate-400">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-semibold mb-2">Daily debriefs coming soon</p>
          <p className="text-sm max-w-md mx-auto">
            Agents will write daily reflections at 2 AM — what they learned, mistakes made, and suggestions for improvement.
          </p>
        </div>
      </CardBody>
    </Card>
  )

  // ============ AGENT SLIDE PANEL ============
  const renderAgentPanel = () => {
    if (!selectedAgent) return null
    
    const agentStats = getAgentStats(selectedAgent.slug)
    const currentTask = getAgentCurrentTask(selectedAgent.slug)
    const pendingTasks = agentTasks.filter(t => t.to_agent.toLowerCase() === selectedAgent.slug.toLowerCase() && t.status === 'pending')
    const completedTasks = agentTasks.filter(t => t.to_agent.toLowerCase() === selectedAgent.slug.toLowerCase() && t.status === 'done').slice(0, 5)

    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSelectedAgent(null)}
        />
        
        {/* Panel */}
        <div className="fixed right-0 top-0 h-full w-full sm:w-[400px] bg-white dark:bg-slate-800 shadow-2xl z-50 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between">
            <h2 className="font-bold text-lg">Agent Profile</h2>
            <Button isIconOnly variant="light" onPress={() => setSelectedAgent(null)}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="p-4 space-y-6">
            {/* Profile Header */}
            <div className="flex items-center gap-4">
              <Avatar
                name={selectedAgent.name}
                size="lg"
                classNames={{
                  base: "bg-gradient-to-br from-violet-500 to-purple-600 w-16 h-16",
                  name: "text-white font-bold text-xl"
                }}
              />
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{selectedAgent.name}</h3>
                <p className="text-sm text-slate-500">{selectedAgent.role.replace(/_/g, ' ')}</p>
                <p className="text-xs text-slate-400">{selectedAgent.model}</p>
              </div>
              <div className={`ml-auto w-3 h-3 rounded-full ${selectedAgent.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            </div>

            {/* Current Task */}
            {currentTask && (
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Currently Working On</h4>
                <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                  <p className="text-sm text-slate-700 dark:text-slate-200">{currentTask.task}</p>
                  <p className="text-xs text-slate-500 mt-1">From: {currentTask.from_agent}</p>
                </div>
              </div>
            )}

            {/* Queue */}
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Queue ({pendingTasks.length})</h4>
              {pendingTasks.length === 0 ? (
                <p className="text-sm text-slate-400">No pending tasks</p>
              ) : (
                <div className="space-y-2">
                  {pendingTasks.map(task => (
                    <div key={task.id} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                      <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-1">{task.task}</p>
                      <p className="text-xs text-slate-400">From: {task.from_agent}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Completed */}
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Recently Completed</h4>
              {completedTasks.length === 0 ? (
                <p className="text-sm text-slate-400">No completed tasks yet</p>
              ) : (
                <div className="space-y-2">
                  {completedTasks.map(task => (
                    <div key={task.id} className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                      <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-1">{task.task}</p>
                      <p className="text-xs text-slate-400">{timeAgo(task.completed_at || task.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stats */}
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Stats (All Time)</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-center">
                  <p className="text-2xl font-bold text-violet-600">{agentStats.tasks}</p>
                  <p className="text-xs text-slate-500">Tasks Done</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-center">
                  <p className="text-2xl font-bold text-blue-600">{agentStats.tokens.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Tokens Used</p>
                </div>
              </div>
            </div>

            {/* Capabilities */}
            {selectedAgent.capabilities && selectedAgent.capabilities.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Capabilities</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedAgent.capabilities.map((cap, i) => (
                    <Chip key={i} size="sm" variant="flat">{cap}</Chip>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    )
  }

  // ============ MAIN RENDER ============
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">AI Workspace</h1>
              <p className="text-xs text-slate-500">Manage your AI team</p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs 
            selectedKey={currentView} 
            onSelectionChange={(key) => setCurrentView(key as ViewType)}
            color="primary"
            variant="solid"
            size="sm"
            classNames={{
              tabList: "bg-slate-200 dark:bg-slate-800",
              cursor: "bg-violet-600 shadow-md",
              tab: "px-4 data-[selected=true]:text-white",
              tabContent: "group-data-[selected=true]:text-white"
            }}
          >
            <Tab key="dashboard" title={<LayoutDashboard className="w-4 h-4" />} />
            <Tab key="activity" title={
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">Activity</span>
              </span>
            } />
            <Tab key="debriefs" title={
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Debriefs</span>
              </span>
            } />
          </Tabs>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-96 text-slate-400">
            <Bot className="w-12 h-12 animate-pulse mb-4 text-violet-500" />
            <p className="text-sm">Loading...</p>
          </div>
        ) : (
          <>
            {currentView === 'dashboard' && renderDashboard()}
            {currentView === 'activity' && renderActivity()}
            {currentView === 'debriefs' && renderDebriefs()}
          </>
        )}
      </main>

      {/* Agent Slide Panel */}
      {selectedAgent && renderAgentPanel()}
    </div>
  )
}
