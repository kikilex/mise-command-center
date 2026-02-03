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
  MessageCircle,
  X,
  Target,
  ShieldCheck
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
  useDisclosure,
  Divider
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import { showErrorToast } from '@/lib/errors'
import TaskThread from '@/components/TaskThread'
import AgentChat from '@/components/AgentChat'
import AddTaskModal from '@/components/AddTaskModal'
import Navbar from '@/components/Navbar'

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
  last_action?: string
  last_action_at?: string
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
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      const [agentsRes, tasksRes, logsRes] = await Promise.all([
        supabase.from('ai_agents').select('*').order('created_at', { ascending: true }),
        supabase.from('agent_tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('ai_work_log').select('*').order('created_at', { ascending: false }).limit(50)
      ])

      const enrichedAgents = (agentsRes.data || []).map(agent => {
        const lastLog = (logsRes.data || []).find(l => l.agent_name.toLowerCase() === agent.slug.toLowerCase());
        return {
          ...agent,
          last_action: lastLog?.action,
          last_action_at: lastLog?.created_at
        };
      });

      setAgents(enrichedAgents)
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
    if (!ts) return ''
    const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s/60)}m`
    return `${Math.floor(s/3600)}h`
  }

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 4 Cards at top - Command Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ops Completed', value: stats.done, color: 'text-emerald-500', icon: CheckCircle2, shadow: 'shadow-emerald-500/10' },
          { label: 'Compute Burned', value: stats.tokens.toLocaleString(), color: 'text-blue-500', icon: Zap, shadow: 'shadow-blue-500/10' },
          { label: 'Agents Online', value: `${stats.online}/${agents.length}`, color: 'text-violet-500', icon: Bot, shadow: 'shadow-violet-500/10' },
          { label: 'Active Hits', value: stats.active, color: 'text-amber-500', icon: Activity, shadow: 'shadow-amber-500/10' },
        ].map((s, i) => (
          <Card key={i} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 ${s.shadow}`}>
            <CardBody className="p-4 flex flex-row items-center gap-4">
              <div className={`p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 ${s.color}`}><s.icon className="w-6 h-6" /></div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.1em] leading-none mb-1.5">{s.label}</p>
                <p className={`text-2xl font-black tracking-tighter ${s.color}`}>{s.value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Team + Actions */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl shadow-black/5">
            <CardHeader className="px-4 pt-4 pb-0 flex items-center justify-between">
              <h2 className="font-black uppercase text-[10px] text-slate-400 tracking-widest flex items-center gap-2">
                <Users className="w-3 h-3" /> Agent Team
              </h2>
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
            </CardHeader>
            <CardBody className="px-2 py-3 space-y-1">
              {agents.map(a => (
                <div key={a.id} className="group relative flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800 cursor-default">
                  <div className="relative">
                    <Avatar name={a.name} size="sm" className="bg-gradient-to-br from-violet-600 to-purple-900 text-white font-black" />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${a.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-400'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-sm leading-none mb-1 text-slate-800 dark:text-slate-100 uppercase tracking-tighter">{a.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase truncate tracking-tight">{a.role.replace(/_/g, ' ')}</p>
                  </div>
                  {a.last_action_at && (
                    <span className="text-[8px] font-black text-slate-300 uppercase">{timeAgo(a.last_action_at)}</span>
                  )}
                </div>
              ))}
            </CardBody>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="px-4 pt-4 pb-0 font-black uppercase text-[10px] text-slate-400 tracking-widest">Command</CardHeader>
            <CardBody className="p-4 flex flex-col gap-2">
              <Button color="primary" variant="flat" className="font-black justify-start h-12 rounded-xl text-xs uppercase tracking-widest" startContent={<Target className="w-4 h-4" />} onPress={onTaskOpen}>Assign Hit</Button>
            </CardBody>
          </Card>
        </div>

        {/* Center: Integrated Chat */}
        <div className="lg:col-span-2 h-[680px]">
          <AgentChat />
        </div>

        {/* Right: Live Intelligence Feed */}
        <Card className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl shadow-black/5 overflow-hidden">
          <CardHeader className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-black uppercase text-[10px] text-slate-400 tracking-[0.2em] flex items-center gap-2">
              <Activity className="w-3 h-3" /> Live Intel
            </h2>
            <div className="flex gap-1">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse delay-75" />
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse delay-150" />
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <ScrollShadow className="h-[600px]">
              <div className="p-1">
                {workLogs.map(l => (
                  <div key={l.id} className="group p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] font-black uppercase text-violet-500 tracking-tighter">{l.agent_name}</span>
                      <span className="text-[8px] text-slate-300 font-black uppercase">{timeAgo(l.created_at)}</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug font-medium italic">"{l.action.replace(/_/g, ' ')}"</p>
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-250px)] animate-in slide-in-from-bottom-4 duration-500">
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
        <CardHeader className="px-4 pt-4 pb-2 border-b border-slate-200 dark:border-slate-800 font-black uppercase text-[10px] text-slate-400 tracking-widest">Operations Log</CardHeader>
        <ScrollShadow className="h-full">
          <div className="p-2 space-y-1">
            {agentTasks.map(t => (
              <button key={t.id} onClick={() => setSelectedTask(t)} className={`w-full text-left p-4 rounded-2xl transition-all border ${selectedTask?.id === t.id ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20' : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <div className="flex justify-between mb-1.5">
                  <span className={`text-[10px] font-black uppercase ${selectedTask?.id === t.id ? 'text-violet-200' : 'text-violet-600'}`}>{t.from_agent}</span>
                  <span className="text-[9px] opacity-60 font-black uppercase">{timeAgo(t.created_at)}</span>
                </div>
                <p className="text-xs font-bold leading-tight line-clamp-2 uppercase tracking-tighter">{t.task}</p>
              </button>
            ))}
          </div>
        </ScrollShadow>
      </Card>
      <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {selectedTask ? (
          <ScrollShadow className="h-full p-8 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-xs">OP</div>
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">{selectedTask.from_agent} → {selectedTask.to_agent}</h2>
                  <p className="text-[10px] text-slate-400 font-black uppercase mt-1 tracking-widest">Operation Details</p>
                </div>
              </div>
              <Chip color={selectedTask.status === 'done' ? 'success' : 'warning'} variant="flat" className="font-black uppercase text-xs px-4 h-8">{selectedTask.status}</Chip>
            </div>
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] uppercase font-black text-slate-400 mb-3 tracking-[0.2em]">The Objective</p>
              <p className="text-lg leading-tight font-bold text-slate-800 dark:text-slate-100">{selectedTask.task}</p>
            </div>
            <div className="h-[450px]">
              <p className="text-[10px] uppercase font-black text-slate-400 mb-4 tracking-[0.2em]">Intelligence Thread</p>
              <TaskThread agentTaskId={selectedTask.id} className="h-full rounded-3xl" />
            </div>
          </ScrollShadow>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-20 pointer-events-none">
            <Bot className="w-32 h-32 mb-4" />
            <p className="font-black uppercase tracking-[0.5em] text-xl">Select Operation</p>
          </div>
        )}
      </Card>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header - Palace Grade */}
        <div className="flex items-center justify-between mb-10 mt-4">
          <div className="flex items-center gap-5">
            <div className="p-4 rounded-[2rem] bg-gradient-to-br from-violet-600 to-purple-950 shadow-2xl shadow-violet-900/50 transform rotate-3">
              <Bot className="w-10 h-10 text-white transform -rotate-3" />
            </div>
            <div>
              <h1 className="text-5xl font-black tracking-[ -0.05em] text-slate-900 dark:text-white uppercase leading-none italic">The Palace</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="h-[1px] w-8 bg-violet-500" />
                <p className="text-[10px] text-violet-500 font-black uppercase tracking-[0.3em] leading-none">Command & Intelligence Hub</p>
              </div>
            </div>
          </div>
          <Tabs selectedKey={currentView} onSelectionChange={(k) => setCurrentView(k as ViewType)} color="primary" variant="solid" size="lg" 
            classNames={{ 
              tabList: "bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl shadow-inner", 
              cursor: "bg-violet-600 shadow-xl rounded-xl",
              tab: "h-12 px-8"
            }}
          >
            <Tab key="dashboard" title={<LayoutDashboard className="w-5 h-5" />} />
            <Tab key="activity" title={<Activity className="w-5 h-5" />} />
            <Tab key="debriefs" title={<FileText className="w-5 h-5" />} />
          </Tabs>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-96 gap-4">
            <div className="w-16 h-16 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
            <p className="font-black uppercase tracking-widest text-violet-500 animate-pulse">Initializing Hub...</p>
          </div>
        ) : (
          <>
            {currentView === 'dashboard' && renderDashboard()}
            {currentView === 'activity' && renderActivity()}
            {currentView === 'debriefs' && (
              <div className="py-40 text-center animate-pulse">
                <p className="text-4xl font-black text-slate-200 dark:text-slate-800 uppercase tracking-[0.2em]">Restricted Intelligence Area</p>
              </div>
            )}
          </>
        )}
      </main>
      <AddTaskModal isOpen={isTaskOpen} onClose={onTaskClose} onSuccess={loadData} userId={user?.id} />
    </div>
  )
}
