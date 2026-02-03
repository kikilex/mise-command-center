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
  X,
  MessageCircle,
  Plus,
  CheckCircle2,
  Settings
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
  useDisclosure
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { showErrorToast } from '@/lib/errors'
import TaskThread from '@/components/TaskThread'
import AgentChat from '@/components/AgentChat'
import AddTaskModal from '@/components/AddTaskModal'

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
  
  const { isOpen: isTaskOpen, onOpen: onTaskOpen, onClose: onTaskClose } = useDisclosure()
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
    return {
      tasksDone: todayLogs.filter(l => l.action === 'task_completed').length,
      tokens: todayLogs.reduce((sum, l) => sum + (l.tokens_used || 0), 0),
      agentsOnline: agents.filter(a => a.is_active).length,
      activeTasks: agentTasks.filter(t => t.status === 'in_progress').length
    }
  }, [workLogs, agentTasks, agents])

  // Unified activity feed
  const unifiedActivity = useMemo(() => {
    return [
      ...workLogs.map(l => ({
        id: `log-${l.id}`,
        type: 'log' as const,
        agent: l.agent_name,
        action: l.action.replace(/_/g, ' '),
        timestamp: l.created_at,
      })),
      ...agentTasks.map(t => ({
        id: `task-${t.id}`,
        type: 'handoff' as const,
        agent: t.from_agent,
        action: `→ ${t.to_agent}: ${t.task}`,
        timestamp: t.created_at,
        task: t
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [workLogs, agentTasks])

  const timeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  // ============ DASHBOARD TAB ============
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Palacio Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tasks Completed', value: stats.tasksDone, color: 'text-emerald-500', icon: CheckCircle2 },
          { label: 'Tokens Burned', value: stats.tokens.toLocaleString(), color: 'text-blue-500', icon: Zap },
          { label: 'Agents Ready', value: `${stats.agentsOnline}/${agents.length}`, color: 'text-violet-500', icon: Bot },
          { label: 'Active Hits', value: stats.activeTasks, color: 'text-amber-500', icon: Activity },
        ].map((stat, i) => (
          <Card key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <CardBody className="p-4 flex flex-row items-center gap-4">
              <div className={`p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest leading-none mb-1">{stat.label}</p>
                <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Agents & Actions */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <CardHeader className="px-4 pt-4 pb-0">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Agent Team</h2>
            </CardHeader>
            <CardBody className="px-4 pb-4 pt-2 space-y-3">
              {agents.map(agent => (
                <div 
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer transition-all"
                >
                  <Avatar name={agent.name} size="sm" className="bg-gradient-to-br from-violet-600 to-purple-700 text-white font-black" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{agent.name}</span>
                      <div className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-400'}`} />
                    </div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold truncate">{agent.role.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <CardHeader className="px-4 pt-4 pb-0">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Quick Actions</h2>
            </CardHeader>
            <CardBody className="p-4 gap-2">
              <Button color="primary" variant="flat" className="w-full justify-start font-bold h-12" startContent={<Plus className="w-5 h-5" />} onPress={onTaskOpen}>
                Assign New Task
              </Button>
            </CardBody>
          </Card>
        </div>

        {/* Center: Agent Chat */}
        <div className="lg:col-span-2 h-[600px]">
          <AgentChat />
        </div>

        {/* Right: Activity Feed */}
        <Card className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardHeader className="px-4 pt-4 pb-2 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Recent Activity</h2>
          </CardHeader>
          <CardBody className="p-0">
            <ScrollShadow className="h-[550px]">
              <div className="p-2 space-y-1">
                {unifiedActivity.slice(0, 30).map(item => (
                  <div key={item.id} className="p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase text-violet-600 tracking-tighter">{item.agent}</span>
                      <span className="text-[9px] text-slate-400 uppercase">{timeAgo(item.timestamp)}</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-tight line-clamp-2">{item.action}</p>
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
      <Card className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <CardHeader className="px-4 pt-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">Activity Feed</h2>
        </CardHeader>
        <ScrollShadow className="h-full">
          <div className="p-2 space-y-1">
            {agentTasks.map(task => (
              <button
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className={`w-full text-left p-3 rounded-xl transition-all ${selectedTask?.id === task.id ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-black uppercase ${selectedTask?.id === task.id ? 'text-violet-200' : 'text-violet-600'}`}>{task.from_agent}</span>
                  <span className="text-[9px] opacity-60 uppercase">{timeAgo(task.created_at)}</span>
                </div>
                <p className="text-xs font-bold line-clamp-2">{task.task}</p>
              </button>
            ))}
          </div>
        </ScrollShadow>
      </Card>
      
      <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {selectedTask ? (
          <ScrollShadow className="h-full p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black uppercase tracking-tighter">{selectedTask.from_agent} → {selectedTask.to_agent}</h2>
                <Chip color={selectedTask.status === 'done' ? 'success' : 'warning'} variant="flat">{selectedTask.status}</Chip>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">The Task</p>
                <p className="text-sm leading-relaxed">{selectedTask.task}</p>
              </div>
              {selectedTask.result && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50">
                  <p className="text-[10px] uppercase font-black text-emerald-600 dark:text-emerald-400 mb-2 tracking-widest">Result</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedTask.result}</p>
                </div>
              )}
              <div className="h-[400px]">
                <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">Thread</p>
                <TaskThread agentTaskId={selectedTask.id} className="h-full" />
              </div>
            </div>
          </ScrollShadow>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
            <Activity className="w-16 h-16 mb-4" />
            <p className="font-black uppercase tracking-widest">Select an operation</p>
          </div>
        )}
      </Card>
    </div>
  )

  const renderDebriefs = () => (
    <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <CardBody className="py-20 text-center text-slate-400">
        <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <p className="font-black uppercase tracking-widest">Daily Debriefs Under Surveillance</p>
      </CardBody>
    </Card>
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-800 shadow-xl shadow-violet-500/20">
              <Bot className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">AI Palace</h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Command & Control</p>
            </div>
          </div>
          <Tabs 
            selectedKey={currentView} 
            onSelectionChange={(k) => setCurrentView(k as ViewType)}
            color="primary" variant="solid"
            classNames={{ tabList: "bg-slate-200 dark:bg-slate-800", cursor: "bg-violet-600 shadow-lg" }}
          >
            <Tab key="dashboard" title={<LayoutDashboard className="w-4 h-4" />} />
            <Tab key="activity" title={<Activity className="w-4 h-4" />} />
            <Tab key="debriefs" title={<FileText className="w-4 h-4" />} />
          </Tabs>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-96"><Bot className="w-12 h-12 animate-pulse text-violet-500" /></div>
        ) : (
          <>
            {currentView === 'dashboard' && renderDashboard()}
            {currentView === 'activity' && renderActivity()}
            {currentView === 'debriefs' && renderDebriefs()}
          </>
        )}
      </main>

      <AddTaskModal isOpen={isTaskOpen} onClose={onTaskClose} onSuccess={loadData} userId={user?.id} />
    </div>
  )
}
