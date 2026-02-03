'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Bot, 
  LayoutDashboard, 
  Activity, 
  ListTodo, 
  BookOpen, 
  Users, 
  ArrowLeftRight,
  TrendingUp
} from 'lucide-react'
import { 
  Tabs,
  Tab,
  Chip,
  Card,
  CardHeader,
  CardBody,
  Button,
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import WorkLogPanel from '@/components/WorkLogPanel'
import JournalView from '@/components/JournalView'
import { showErrorToast, getErrorMessage } from '@/lib/errors'

// Components
import AgentCard from './components/AgentCard'
import AgentSlidePanel from './components/AgentSlidePanel'
import CollaborationFeed from './components/CollaborationFeed'
import ThreadDetail from './components/ThreadDetail'
import StatsRow from './components/StatsRow'
import ActivityItem from './components/ActivityItem'

export interface AIAgent {
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

export interface AgentTask {
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

export interface WorkLog {
  id: string
  agent_name: string
  action: string
  task_id: string | null
  details: Record<string, any>
  tokens_used: number | null
  duration_ms: number | null
  created_at: string
}

type ViewType = 'overview' | 'agents' | 'collaboration' | 'work-log' | 'queue' | 'journal'

export default function AIWorkspacePage() {
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [aiTasks, setAiTasks] = useState<any[]>([])
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<ViewType>('overview')
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null)
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  
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
        { data: tasksData },
        { data: collabData }
      ] = await Promise.all([
        supabase.from('ai_agents').select('*').order('created_at', { ascending: true }),
        supabase.from('ai_work_log').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('tasks').select('*').eq('ai_flag', true).neq('status', 'done').order('priority', { ascending: true }),
        supabase.from('agent_tasks').select('*').order('created_at', { ascending: false })
      ])

      setAgents(agentsData || [])
      setWorkLogs(logsData || [])
      setAiTasks(tasksData || [])
      setAgentTasks(collabData || [])
    } catch (error) {
      console.error('Load AI workspace error:', error)
      showErrorToast(error, 'Failed to load AI workspace')
    } finally {
      setLoading(false)
    }
  }

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

  const recentActivity = useMemo(() => {
    const activities = [
      ...workLogs.map(l => ({
        id: l.id,
        agent: l.agent_name,
        action: l.action.replace('_', ' '),
        timestamp: l.created_at,
        type: 'log'
      })),
      ...agentTasks.map(t => ({
        id: t.id,
        agent: t.from_agent,
        action: `assigned task to ${t.to_agent}`,
        timestamp: t.created_at,
        type: 'task',
        original: t
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    
    return activities.slice(0, 10)
  }, [workLogs, agentTasks])

  const handleAgentClick = (agent: AIAgent) => {
    setSelectedAgent(agent)
    setIsPanelOpen(true)
  }

  const handleActivityClick = (item: any) => {
    if (item.type === 'task') {
      setSelectedTask(item.original)
      setCurrentView('collaboration')
    }
  }

  // --- RENDERING FUNCTIONS ---

  const renderOverview = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <StatsRow 
        tasksDone={stats.tasksDone} 
        tokensUsed={stats.tokens} 
        agentsOnline={stats.agentsOnline} 
        handoffsToday={stats.handoffs} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Agents List */}
        <Card className="lg:col-span-4 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
          <CardHeader className="px-6 pt-6 pb-2 flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Agents
            </h2>
            <Chip size="sm" variant="flat" color="primary">{agents.length}</Chip>
          </CardHeader>
          <CardBody className="px-6 pb-6 space-y-4">
            {agents.map(agent => (
              <AgentCard 
                key={agent.id} 
                agent={agent} 
                currentTask={agentTasks.find(t => t.to_agent === agent.slug && t.status === 'in_progress')?.task}
                onClick={handleAgentClick}
              />
            ))}
          </CardBody>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-8 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
          <CardHeader className="px-6 pt-6 pb-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Recent Activity
            </h2>
          </CardHeader>
          <CardBody className="px-6 pb-6">
            <div className="space-y-1">
              {recentActivity.map(item => (
                <ActivityItem 
                  key={item.id} 
                  agentName={item.agent} 
                  action={item.action} 
                  timestamp={item.timestamp}
                  onClick={() => handleActivityClick(item)}
                />
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Task Queue */}
        <Card className="lg:col-span-12 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
          <CardHeader className="px-6 pt-6 pb-2 flex justify-between items-center">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <ListTodo className="w-4 h-4" />
              Task Queue (Flagged for AI)
            </h2>
            <Button size="sm" variant="light" onPress={() => setCurrentView('queue')}>View All</Button>
          </CardHeader>
          <CardBody className="px-6 pb-6">
            <div className="space-y-2">
              {aiTasks.slice(0, 5).map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      task.priority === 'critical' ? 'bg-red-500' : 
                      task.priority === 'high' ? 'bg-orange-500' : 
                      'bg-blue-500'
                    }`} />
                    <span className="text-sm font-medium">{task.title}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-400 uppercase font-bold tracking-tight">
                      Assigned: {task.assigned_to_agent || '--'}
                    </span>
                    <Chip size="sm" variant="flat" className="uppercase text-[10px] font-bold">{task.priority}</Chip>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )

  const renderAgents = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {agents.map(agent => (
        <AgentCard 
          key={agent.id} 
          agent={agent} 
          isExpanded
          currentTask={agentTasks.find(t => t.to_agent === agent.slug && t.status === 'in_progress')?.task}
          stats={{
            tasksCompleted: workLogs.filter(l => l.agent_name.toLowerCase() === agent.slug.toLowerCase() && l.action === 'task_completed').length,
            tokensUsed: workLogs.filter(l => l.agent_name.toLowerCase() === agent.slug.toLowerCase()).reduce((sum, l) => sum + (l.tokens_used || 0), 0)
          }}
          onClick={handleAgentClick}
        />
      ))}
    </div>
  )

  const renderCollaboration = () => (
    <div className="h-[calc(100vh-280px)] min-h-[600px] flex rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-80 flex-shrink-0">
        <CollaborationFeed 
          tasks={agentTasks} 
          selectedTaskId={selectedTask?.id || null} 
          onSelectTask={setSelectedTask} 
        />
      </div>
      <div className="flex-1">
        <ThreadDetail task={selectedTask} />
      </div>
    </div>
  )

  const renderQueue = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {aiTasks.map(task => (
        <Card key={task.id} className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
          <CardBody className="p-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-3 h-3 rounded-full ${
                task.priority === 'critical' ? 'bg-red-500' : 
                task.priority === 'high' ? 'bg-orange-500' : 
                'bg-blue-500'
              }`} />
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100">{task.title}</h3>
                <p className="text-xs text-slate-500">{task.description || 'No description'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Chip size="sm" variant="flat" className="uppercase font-bold">{task.status}</Chip>
              <Chip size="sm" color={task.priority === 'critical' || task.priority === 'high' ? 'danger' : 'default'} variant="flat" className="uppercase font-bold">
                {task.priority}
              </Chip>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar user={user} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col gap-8">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
                <Bot className="w-10 h-10 text-violet-500" />
                AI Command Center
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Manage, monitor, and coordinate your AI empire.</p>
            </div>

            <Tabs 
              selectedKey={currentView} 
              onSelectionChange={(key) => setCurrentView(key as ViewType)}
              color="primary"
              variant="underlined"
              classNames={{
                tabList: "gap-6",
                cursor: "w-full bg-violet-500",
                tab: "max-w-fit px-0 h-12 text-sm font-bold uppercase tracking-widest",
                tabContent: "group-data-[selected=true]:text-violet-500"
              }}
            >
              <Tab key="overview" title={
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Overview</span>
                </div>
              } />
              <Tab key="agents" title={
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Agents</span>
                </div>
              } />
              <Tab key="collaboration" title={
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Collaboration</span>
                  <Chip size="sm" variant="flat" className="h-5 min-w-5">{agentTasks.length}</Chip>
                </div>
              } />
              <Tab key="work-log" title={
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  <span>Work Log</span>
                </div>
              } />
              <Tab key="queue" title={
                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4" />
                  <span>Queue</span>
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

          <Divider className="bg-slate-200 dark:bg-slate-800" />

          {/* Main Content Area */}
          <div className="min-h-[600px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                <Bot className="w-12 h-12 animate-bounce mb-4 text-violet-500" />
                <p className="font-bold uppercase tracking-widest text-xs">Accessing Command Center...</p>
              </div>
            ) : (
              <>
                {currentView === 'overview' && renderOverview()}
                {currentView === 'agents' && renderAgents()}
                {currentView === 'collaboration' && renderCollaboration()}
                {currentView === 'work-log' && <WorkLogPanel workLogs={workLogs} loading={false} onRefresh={loadData} />}
                {currentView === 'queue' && renderQueue()}
                {currentView === 'journal' && <JournalView />}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Slide-out Panel */}
      <AgentSlidePanel 
        agent={selectedAgent}
        tasks={agentTasks}
        workLogs={workLogs}
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
      />
    </div>
  )
}

function Divider({ className }: { className?: string }) {
  return <div className={`h-[1px] w-full ${className}`} />
}
