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
  Plus,
  CheckCircle2,
  Settings,
  MessageCircle
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

type ViewType = 'dashboard' | 'activity' | 'debriefs'

interface AIAgent {
  id: string
  name: string
  slug: string
  role: string
  model: string
  is_active: boolean
  capabilities?: string[]
  settings: {
    personality?: string
  }
}

interface AgentTask {
  id: string
  from_agent: string
  to_agent: string
  task: string
  status: string
  result: string | null
  created_at: string
}

export default function AIWorkspacePage() {
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([])
  const [workLogs, setWorkLogs] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<ViewType>('dashboard')
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

      const [agentsRes, tasksRes, logsRes] = await Promise.all([
        supabase.from('ai_agents').select('*').order('created_at', { ascending: true }),
        supabase.from('agent_tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('ai_work_log').select('*').order('created_at', { ascending: false }).limit(50)
      ])

      setAgents(agentsRes.data || [])
      setAgentTasks(tasksRes.data || [])
      setWorkLogs(logsRes.data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    return {
      done: workLogs.filter(l => l.action === 'task_completed').length,
      tokens: workLogs.reduce((sum, l) => sum + (l.tokens_used || 0), 0),
      online: agents.filter(a => a.is_active).length,
      active: agentTasks.filter(t => t.status === 'in_progress').length
    }
  }, [workLogs, agentTasks, agents])

  const timeAgo = (ts: string) => {
    const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s/60)}m`
    return `${Math.floor(s/3600)}h`
  }

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* 4 Cards at top */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Completed', value: stats.done, color: 'text-emerald-500', icon: CheckCircle2 },
          { label: 'Tokens', value: stats.tokens.toLocaleString(), color: 'text-blue-500', icon: Zap },
          { label: 'Online', value: `${stats.online}/${agents.length}`, color: 'text-violet-500', icon: Bot },
          { label: 'Active', value: stats.active, color: 'text-amber-500', icon: Activity },
        ].map((s, i) => (
          <Card key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <CardBody className="p-4 flex flex-row items-center gap-3">
              <div className={`p-2 rounded-xl bg-slate-50 dark:bg-slate-800 ${s.color}`}><s.icon className="w-5 h-5" /></div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter leading-none mb-1">{s.label}</p>
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Team + Actions */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="px-4 pt-4 pb-0 font-black uppercase text-[10px] text-slate-400 tracking-widest">Agent Team</CardHeader>
            <CardBody className="p-2 space-y-1">
              {agents.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                  <Avatar name={a.name} size="sm" className="bg-gradient-to-br from-violet-600 to-purple-800 text-white font-black" />
                  <div className="min-w-0">
                    <p className="font-bold text-sm leading-none mb-1">{a.name} <span className={`inline-block w-1.5 h-1.5 rounded-full ${a.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} /></p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{a.role.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="px-4 pt-4 pb-0 font-black uppercase text-[10px] text-slate-400 tracking-widest">Actions</CardHeader>
            <CardBody className="p-4 flex flex-col gap-2">
              <Button color="primary" variant="flat" className="font-bold justify-start h-12" startContent={<Plus className="w-5 h-5" />} onPress={onTaskOpen}>Assign Hit</Button>
            </CardBody>
          </Card>
        </div>

        {/* Center: Integrated Chat */}
        <div className="lg:col-span-2 h-[650px]">
          <AgentChat />
        </div>

        {/* Right: Activity */}
        <Card className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardHeader className="px-4 pt-4 pb-2 border-b border-slate-200 dark:border-slate-800 font-black uppercase text-[10px] text-slate-400 tracking-widest">Live Activity</CardHeader>
          <CardBody className="px-0 py-2">
            <ScrollShadow className="h-[580px]">
              <div className="px-2 space-y-4">
                {workLogs.map(l => (
                  <div key={l.id} className="p-2">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-[10px] font-black uppercase text-violet-500">{l.agent_name}</span>
                      <span className="text-[9px] text-slate-400 uppercase">{timeAgo(l.created_at)}</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-tight">{l.action.replace(/_/g, ' ')}</p>
                  </div>
                ))}
              </div>
            </ScrollShadow>
          </CardBody>
        </Card>
      </div>
    </div>
  )

  const renderActivity = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        <CardHeader className="px-4 pt-4 pb-2 border-b border-slate-200 dark:border-slate-800 font-black uppercase text-[10px] text-slate-400 tracking-widest">Handoffs</CardHeader>
        <ScrollShadow className="h-full">
          <div className="p-2 space-y-1">
            {agentTasks.map(t => (
              <button key={t.id} onClick={() => setSelectedTask(t)} className={`w-full text-left p-3 rounded-xl transition-all ${selectedTask?.id === t.id ? 'bg-violet-600 text-white' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] font-black uppercase">{t.from_agent}</span>
                  <span className="text-[9px] opacity-60 uppercase">{timeAgo(t.created_at)}</span>
                </div>
                <p className="text-xs font-bold line-clamp-2">{t.task}</p>
              </button>
            ))}
          </div>
        </ScrollShadow>
      </Card>
      <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
        {selectedTask ? (
          <ScrollShadow className="h-full p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase">{selectedTask.from_agent} → {selectedTask.to_agent}</h2>
              <Chip color={selectedTask.status === 'done' ? 'success' : 'warning'} variant="flat">{selectedTask.status}</Chip>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] uppercase font-black text-slate-400 mb-2">The Hit</p>
              <p className="text-sm leading-relaxed">{selectedTask.task}</p>
            </div>
            <div className="h-[400px]">
              <TaskThread agentTaskId={selectedTask.id} className="h-full" />
            </div>
          </ScrollShadow>
        ) : (
          <div className="h-full flex items-center justify-center opacity-30 font-black uppercase tracking-widest">Select an operation</div>
        )}
      </Card>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-900 shadow-xl shadow-violet-900/40"><Bot className="w-8 h-8 text-white" /></div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">AI Palace</h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-1">Command & Control</p>
            </div>
          </div>
          <Tabs selectedKey={currentView} onSelectionChange={(k) => setCurrentView(k as ViewType)} color="primary" variant="solid" classNames={{ tabList: "bg-slate-200 dark:bg-slate-800", cursor: "bg-violet-600 shadow-lg" }}>
            <Tab key="dashboard" title={<LayoutDashboard className="w-4 h-4" />} />
            <Tab key="activity" title={<Activity className="w-4 h-4" />} />
            <Tab key="debriefs" title={<FileText className="w-4 h-4" />} />
          </Tabs>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-96"><Bot className="w-12 h-12 animate-pulse text-violet-600" /></div>
        ) : (
          <>
            {currentView === 'dashboard' && renderDashboard()}
            {currentView === 'activity' && renderActivity()}
            {currentView === 'debriefs' && (
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-20 text-center text-slate-500 font-black uppercase tracking-widest">Daily Intelligence Reports Under Prep</Card>
            )}
          </>
        )}
      </main>
      <AddTaskModal isOpen={isTaskOpen} onClose={onTaskClose} onSuccess={loadData} userId={user?.id} />
    </div>
  )
}
