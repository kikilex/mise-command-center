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
  ShieldCheck,
  Edit,
  ListTodo,
  Pencil,
  Trash2,
  ClipboardList
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
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  Select,
  SelectItem,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import { showErrorToast, showSuccessToast } from '@/lib/errors'
import TaskThread from '@/components/TaskThread'
import AgentChat from '@/components/AgentChat'
import AddTaskModal from '@/components/AddTaskModal'
import EditAgentModal from '@/components/EditAgentModal'
import Navbar from '@/components/Navbar'

export type ViewType = 'dashboard' | 'activity' | 'debriefs' | 'tasks'

type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'review' | 'done'

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  due_date: string | null
  created_at: string
  assignee_id: string | null
  ai_agent: string | null
  space_id: string | null
  project_id: string | null
}

interface UserMapping {
  id: string
  slug: string
}

export interface AIAgent {
  id: string
  name: string
  slug: string
  role: string
  model: string
  is_active: boolean
  system_prompt: string
  capabilities?: string[]
  settings: {
    personality?: string
  }
  avatar_url?: string
  last_action?: string
  last_action_at?: string
}

export interface AgentTask {
  id: string
  from_agent: string
  to_agent: string
  task: string
  status: string
  result: string | null
  created_at: string
  started_at?: string | null
  completed_at?: string | null
  priority?: string
  context?: any
  error?: string | null
}

export default function AIWorkspacePage() {
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([])
  const [workLogs, setWorkLogs] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<ViewType>('dashboard')
  const [selectedTask, setSelectedTask] = useState<AgentTask | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null)
  
  const { isOpen: isTaskOpen, onOpen: onTaskOpen, onClose: onTaskClose } = useDisclosure()
  const { isOpen: isEditAgentOpen, onOpen: onEditAgentOpen, onClose: onEditAgentClose } = useDisclosure()
  const { isOpen: isEditTaskOpen, onOpen: onEditTaskOpen, onClose: onEditTaskClose } = useDisclosure()
  const { isOpen: isDeleteConfirmOpen, onOpen: onDeleteConfirmOpen, onClose: onDeleteConfirmClose } = useDisclosure()
  const supabase = createClient()
  
  // Agent Tasks view state
  const [selectedTasksAgent, setSelectedTasksAgent] = useState<AIAgent | null>(null)
  const [taskStatusTab, setTaskStatusTab] = useState<TaskStatus>('todo')
  const [agentTasksList, setAgentTasksList] = useState<Task[]>([])
  const [agentWorkLogsList, setAgentWorkLogsList] = useState<any[]>([])
  const [userMappings, setUserMappings] = useState<UserMapping[]>([])
  const [agentTaskCounts, setAgentTaskCounts] = useState<Record<string, number>>({})
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
    due_date: ''
  })
  const [savingTask, setSavingTask] = useState(false)
  const [showWorkLog, setShowWorkLog] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        // Fetch full profile including avatar
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        
        setUser({
          id: authUser.id,
          email: authUser.email || '',
          name: profile?.name || authUser.email?.split('@')[0],
          avatar_url: profile?.avatar_url,
        })
      }

      const [agentsRes, tasksRes, logsRes, usersRes, allTasksRes] = await Promise.all([
        supabase.from('ai_agents').select('*').order('created_at', { ascending: true }),
        supabase.from('agent_tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('ai_work_log').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('users').select('id, slug'),
        supabase.from('tasks').select('id, ai_agent, assignee_id, status')
      ])
      
      // Build user mappings (slug -> user_id)
      const mappings = (usersRes.data || []).filter(u => u.slug).map(u => ({ id: u.id, slug: u.slug }))
      setUserMappings(mappings)
      
      // Count pending tasks per agent (tasks that are not done)
      const counts: Record<string, number> = {}
      const allTasks = allTasksRes.data || []
      for (const agent of agentsRes.data || []) {
        // Find user_id for this agent via slug match
        const userMapping = mappings.find(m => m.slug?.toLowerCase() === agent.slug?.toLowerCase())
        const pendingCount = allTasks.filter(t => 
          (t.ai_agent?.toLowerCase() === agent.slug?.toLowerCase() || 
           (userMapping && t.assignee_id === userMapping.id)) &&
          t.status !== 'done'
        ).length
        counts[agent.slug] = pendingCount
      }
      setAgentTaskCounts(counts)

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

  // Load tasks for selected agent
  async function loadAgentTasks(agent: AIAgent) {
    const userMapping = userMappings.find(m => m.slug?.toLowerCase() === agent.slug?.toLowerCase())
    
    // Query tasks where ai_agent matches slug OR assignee_id matches user_id
    let query = supabase.from('tasks').select('*')
    
    if (userMapping) {
      query = query.or(`ai_agent.ilike.${agent.slug},assignee_id.eq.${userMapping.id}`)
    } else {
      query = query.ilike('ai_agent', agent.slug)
    }
    
    const { data, error } = await query.order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error loading agent tasks:', error)
      return
    }
    
    setAgentTasksList(data || [])
    
    // Also load work logs for this agent
    const { data: logs } = await supabase
      .from('ai_work_log')
      .select('*')
      .ilike('agent_name', agent.slug)
      .order('created_at', { ascending: false })
      .limit(100)
    
    setAgentWorkLogsList(logs || [])
  }

  // Handle agent selection in tasks view
  function handleSelectTasksAgent(agent: AIAgent) {
    setSelectedTasksAgent(agent)
    setShowWorkLog(false)
    loadAgentTasks(agent)
  }

  // Update task status quickly
  async function handleQuickStatusChange(task: Task, newStatus: string) {
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus, modified_by: user?.name?.toLowerCase() || 'unknown' })
      .eq('id', task.id)
    
    if (error) {
      showErrorToast(error, 'Failed to update status')
      return
    }
    
    showSuccessToast('Status updated')
    if (selectedTasksAgent) {
      loadAgentTasks(selectedTasksAgent)
    }
    loadData()
  }

  // Open edit modal
  function handleEditTask(task: Task) {
    setEditingTask(task)
    setTaskFormData({
      title: task.title,
      description: task.description || '',
      priority: task.priority || 'medium',
      status: task.status,
      due_date: task.due_date || ''
    })
    onEditTaskOpen()
  }

  // Save edited task
  async function handleSaveTask() {
    if (!editingTask || !taskFormData.title.trim()) return
    
    setSavingTask(true)
    const { error } = await supabase
      .from('tasks')
      .update({
        title: taskFormData.title.trim(),
        description: taskFormData.description.trim() || null,
        priority: taskFormData.priority,
        status: taskFormData.status,
        due_date: taskFormData.due_date || null,
        modified_by: user?.name?.toLowerCase() || 'unknown'
      })
      .eq('id', editingTask.id)
    
    setSavingTask(false)
    
    if (error) {
      showErrorToast(error, 'Failed to update task')
      return
    }
    
    showSuccessToast('Task updated')
    onEditTaskClose()
    setEditingTask(null)
    if (selectedTasksAgent) {
      loadAgentTasks(selectedTasksAgent)
    }
    loadData()
  }

  // Delete task
  async function handleDeleteTask() {
    if (!taskToDelete) return
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskToDelete.id)
    
    if (error) {
      showErrorToast(error, 'Failed to delete task')
      return
    }
    
    showSuccessToast('Task deleted')
    onDeleteConfirmClose()
    setTaskToDelete(null)
    if (selectedTasksAgent) {
      loadAgentTasks(selectedTasksAgent)
    }
    loadData()
  }

  // Status color helper
  function getStatusColor(status: string): "default" | "primary" | "secondary" | "success" | "warning" | "danger" {
    switch (status) {
      case 'todo': return 'default'
      case 'in_progress': return 'primary'
      case 'blocked': return 'danger'
      case 'review': return 'warning'
      case 'done': return 'success'
      default: return 'default'
    }
  }

  // Priority color helper
  function getPriorityColor(priority: string): "default" | "primary" | "secondary" | "success" | "warning" | "danger" {
    switch (priority) {
      case 'critical': return 'danger'
      case 'high': return 'warning'
      case 'medium': return 'primary'
      case 'low': return 'default'
      default: return 'default'
    }
  }

  // Format date helper
  function formatDate(dateStr: string | null) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 4 Cards at top - Command Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ops Completed', value: stats.done, color: 'text-emerald-500', icon: CheckCircle2 },
          { label: 'Compute Burned', value: stats.tokens.toLocaleString(), color: 'text-blue-500', icon: Zap },
          { label: 'Agents Online', value: `${stats.online}/${agents.length}`, color: 'text-violet-500', icon: Bot },
          { label: 'Active Hits', value: stats.active, color: 'text-amber-500', icon: Activity },
        ].map((s, i) => (
          <Card key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <CardBody className="p-4 flex flex-row items-center gap-4">
              <div className={`p-2 md:p-3 rounded-xl bg-slate-50 dark:bg-slate-800 ${s.color}`}><s.icon className="w-5 h-5 md:w-6 md:h-6" /></div>
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500 leading-none mb-1.5">{s.label}</p>
                <p className={`text-xl md:text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-6">
        {/* Left: Team + Actions - Mobile: first */}
        <div className="lg:col-span-1 space-y-6 order-1 lg:order-1">
          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="px-4 pt-4 pb-0 flex items-center justify-between">
              <h2 className="font-semibold uppercase text-xs text-slate-500 flex items-center gap-2">
                <Users className="w-3 h-3" /> Agent Team
              </h2>
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
            </CardHeader>
            <CardBody className="px-2 py-3 space-y-1">
              {agents.map(a => (
                <button
                  key={a.id}
                  onClick={() => {
                    setSelectedAgent(a)
                    onEditAgentOpen()
                  }}
                  className="group relative flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-800 w-full text-left"
                >
                  <div className="relative">
                    <Avatar 
                      src={a.avatar_url || undefined}
                      name={a.name} 
                      size="sm" 
                      className="bg-gradient-to-br from-violet-600 to-purple-900 text-white font-black" 
                    />
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${a.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-400'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-sm leading-none mb-1 text-slate-800 dark:text-slate-100 uppercase tracking-tighter">{a.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase truncate tracking-tight">{a.role.replace(/_/g, ' ')}</p>
                  </div>
                  {a.last_action_at && (
                    <span className="text-[8px] font-black text-slate-300 uppercase">{timeAgo(a.last_action_at)}</span>
                  )}
                  <Edit className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </CardBody>
          </Card>

          <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="px-4 pt-4 pb-0 font-semibold uppercase text-xs text-slate-500">Command</CardHeader>
            <CardBody className="p-4 flex flex-col gap-2">
              <Button color="primary" variant="flat" className="font-medium justify-start h-12 rounded-lg text-sm" startContent={<Target className="w-4 h-4" />} onPress={onTaskOpen}>Assign Hit</Button>
            </CardBody>
          </Card>
        </div>

        {/* Center: Integrated Chat - Mobile: second */}
        <div className="lg:col-span-2 h-[500px] md:h-[680px] order-2 lg:order-2">
          <AgentChat />
        </div>

        {/* Right: Live Intelligence Feed - Mobile: third */}
        <Card className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden order-3 lg:order-3">
          <CardHeader className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold uppercase text-xs text-slate-500 flex items-center gap-2">
              <Activity className="w-3 h-3" /> Live Intel
            </h2>
            <div className="flex gap-1">
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse delay-75" />
              <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse delay-150" />
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <ScrollShadow className="h-[400px] md:h-[600px]">
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
    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 h-[calc(100vh-250px)] animate-in slide-in-from-bottom-4 duration-500">
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="px-4 pt-4 pb-2 border-b border-slate-200 dark:border-slate-800 font-semibold uppercase text-xs text-slate-500">Operations Log</CardHeader>
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
      <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
        {selectedTask ? (
          <ScrollShadow className="h-full p-4 md:p-8 space-y-6 md:space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-xs">OP</div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter leading-none">{selectedTask.from_agent} → {selectedTask.to_agent}</h2>
                  <p className="text-[10px] text-slate-400 font-black uppercase mt-1 tracking-widest">Operation Details</p>
                </div>
              </div>
              <Chip color={selectedTask.status === 'done' ? 'success' : 'warning'} variant="flat" className="font-black uppercase text-xs px-4 h-8">{selectedTask.status}</Chip>
            </div>
            <div className="p-4 md:p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <p className="text-xs uppercase font-semibold text-slate-500 mb-3">The Objective</p>
              <p className="text-base md:text-lg leading-tight font-bold text-slate-800 dark:text-slate-100">{selectedTask.task}</p>
            </div>
            <div className="h-[300px] md:h-[450px]">
              <p className="text-xs uppercase font-semibold text-slate-500 mb-4">Intelligence Thread</p>
              <TaskThread agentTaskId={selectedTask.id} className="h-full rounded-3xl" />
            </div>
          </ScrollShadow>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-20 pointer-events-none">
            <Bot className="w-24 h-24 md:w-32 md:h-32 mb-4" />
            <p className="font-bold uppercase tracking-wider text-lg md:text-xl">Select Operation</p>
          </div>
        )}
      </Card>
    </div>
  )

  const renderAgentTasks = () => {
    const filteredTasks = agentTasksList.filter(t => t.status === taskStatusTab)
    
    const statusTabs: { key: TaskStatus; label: string }[] = [
      { key: 'todo', label: 'Todo' },
      { key: 'in_progress', label: 'In Progress' },
      { key: 'blocked', label: 'Blocked' },
      { key: 'review', label: 'Review' },
      { key: 'done', label: 'Done' }
    ]

    return (
      <div className="flex flex-col lg:grid lg:grid-cols-4 gap-6 h-[calc(100vh-250px)] animate-in slide-in-from-bottom-4 duration-500">
        {/* Left Sidebar - Agent List */}
        <Card className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardHeader className="px-4 pt-4 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold uppercase text-xs text-slate-500 flex items-center gap-2">
              <Bot className="w-3 h-3" /> Agents
            </h2>
          </CardHeader>
          <ScrollShadow className="h-full">
            <div className="p-2 space-y-1">
              {agents.map(agent => {
                const pendingCount = agentTaskCounts[agent.slug] || 0
                const isSelected = selectedTasksAgent?.id === agent.id
                
                return (
                  <button
                    key={agent.id}
                    onClick={() => handleSelectTasksAgent(agent)}
                    className={`w-full text-left p-3 rounded-2xl transition-all border flex items-center gap-3 ${
                      isSelected 
                        ? 'bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-600/20' 
                        : 'bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="relative">
                      <Avatar 
                        src={agent.avatar_url || undefined}
                        name={agent.name} 
                        size="sm" 
                        className="bg-gradient-to-br from-violet-600 to-purple-900 text-white font-black" 
                      />
                      {pendingCount > 0 && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm leading-none mb-1 uppercase tracking-tight ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                        {agent.name}
                      </p>
                      <p className={`text-[10px] font-medium uppercase truncate ${isSelected ? 'text-violet-200' : 'text-slate-500'}`}>
                        {agent.role.replace(/_/g, ' ')}
                      </p>
                    </div>
                    {pendingCount > 0 && (
                      <Chip 
                        size="sm" 
                        variant={isSelected ? 'solid' : 'flat'}
                        className={`font-bold text-xs min-w-[24px] h-6 ${isSelected ? 'bg-white/20 text-white' : 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'}`}
                      >
                        {pendingCount}
                      </Chip>
                    )}
                  </button>
                )
              })}
            </div>
          </ScrollShadow>
        </Card>

        {/* Main Panel */}
        <Card className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {selectedTasksAgent ? (
            <>
              <CardHeader className="px-4 pt-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar 
                      src={selectedTasksAgent.avatar_url || undefined}
                      name={selectedTasksAgent.name} 
                      size="md" 
                      className="bg-gradient-to-br from-violet-600 to-purple-900 text-white font-black" 
                    />
                    <div>
                      <h2 className="font-bold text-lg text-slate-900 dark:text-white">{selectedTasksAgent.name}'s Tasks</h2>
                      <p className="text-xs text-slate-500">{agentTasksList.length} total tasks</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={showWorkLog ? 'flat' : 'bordered'}
                      className="font-medium"
                      startContent={<ClipboardList className="w-4 h-4" />}
                      onPress={() => setShowWorkLog(!showWorkLog)}
                    >
                      Work Log
                    </Button>
                    <Button 
                      size="sm" 
                      color="primary" 
                      className="font-medium"
                      startContent={<Plus className="w-4 h-4" />}
                      onPress={onTaskOpen}
                    >
                      Assign Task
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              {showWorkLog ? (
                /* Work Log View */
                <ScrollShadow className="h-full">
                  <div className="p-4">
                    <h3 className="font-semibold uppercase text-xs text-slate-500 mb-4 flex items-center gap-2">
                      <Activity className="w-3 h-3" /> Work Log
                    </h3>
                    {agentWorkLogsList.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">No work log entries</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {agentWorkLogsList.map(log => (
                          <div key={log.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-xs font-bold text-violet-600 uppercase">{log.action.replace(/_/g, ' ')}</span>
                              <span className="text-[10px] text-slate-400 font-medium">{formatDate(log.created_at)} • {timeAgo(log.created_at)}</span>
                            </div>
                            {log.details && (
                              <p className="text-sm text-slate-600 dark:text-slate-300">{log.details}</p>
                            )}
                            {log.tokens_used > 0 && (
                              <p className="text-[10px] text-slate-400 mt-2">Tokens: {log.tokens_used.toLocaleString()}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollShadow>
              ) : (
                /* Tasks View */
                <>
                  <div className="px-4 pt-3 border-b border-slate-200 dark:border-slate-800">
                    <Tabs 
                      selectedKey={taskStatusTab} 
                      onSelectionChange={(k) => setTaskStatusTab(k as TaskStatus)}
                      variant="underlined"
                      size="sm"
                      classNames={{
                        tabList: "gap-4",
                        tab: "h-10 px-0",
                        cursor: "bg-violet-600"
                      }}
                    >
                      {statusTabs.map(tab => (
                        <Tab 
                          key={tab.key} 
                          title={
                            <div className="flex items-center gap-2">
                              <span>{tab.label}</span>
                              <Chip size="sm" variant="flat" color={getStatusColor(tab.key)} className="font-bold text-[10px] h-5 min-w-[20px]">
                                {agentTasksList.filter(t => t.status === tab.key).length}
                              </Chip>
                            </div>
                          } 
                        />
                      ))}
                    </Tabs>
                  </div>
                  
                  <ScrollShadow className="h-full">
                    <div className="p-4">
                      {filteredTasks.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                          <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p className="font-medium">No {taskStatusTab.replace('_', ' ')} tasks</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredTasks.map(task => (
                            <div 
                              key={task.id} 
                              className="group p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-violet-200 dark:hover:border-violet-800 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-slate-900 dark:text-white mb-1 line-clamp-1">{task.title}</h4>
                                  {task.description && (
                                    <p className="text-sm text-slate-500 line-clamp-2 mb-2">{task.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Chip size="sm" variant="flat" color={getPriorityColor(task.priority)} className="font-bold text-[10px] uppercase">
                                      {task.priority}
                                    </Chip>
                                    {task.due_date && (
                                      <span className="text-xs text-slate-400 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Due {formatDate(task.due_date)}
                                      </span>
                                    )}
                                    <span className="text-xs text-slate-400">
                                      Created {formatDate(task.created_at)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Dropdown>
                                    <DropdownTrigger>
                                      <Button size="sm" variant="flat" isIconOnly className="min-w-8 h-8">
                                        <Chip size="sm" variant="flat" color={getStatusColor(task.status)} className="font-bold text-[10px] uppercase cursor-pointer">
                                          {task.status.replace('_', ' ')}
                                        </Chip>
                                      </Button>
                                    </DropdownTrigger>
                                    <DropdownMenu onAction={(key) => handleQuickStatusChange(task, key as string)}>
                                      <DropdownItem key="todo">Todo</DropdownItem>
                                      <DropdownItem key="in_progress">In Progress</DropdownItem>
                                      <DropdownItem key="blocked">Blocked</DropdownItem>
                                      <DropdownItem key="review">Review</DropdownItem>
                                      <DropdownItem key="done">Done</DropdownItem>
                                    </DropdownMenu>
                                  </Dropdown>
                                  <Button 
                                    size="sm" 
                                    variant="flat" 
                                    isIconOnly 
                                    className="min-w-8 h-8"
                                    onPress={() => handleEditTask(task)}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="flat" 
                                    color="danger" 
                                    isIconOnly 
                                    className="min-w-8 h-8"
                                    onPress={() => {
                                      setTaskToDelete(task)
                                      onDeleteConfirmOpen()
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollShadow>
                </>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-20 pointer-events-none">
              <ListTodo className="w-24 h-24 md:w-32 md:h-32 mb-4" />
              <p className="font-bold uppercase tracking-wider text-lg md:text-xl">Select an Agent</p>
            </div>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar user={user} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header - Simple & Clean */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 mt-2 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Intelligence Hub</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Monitor and manage AI operations</p>
          </div>
          <Tabs selectedKey={currentView} onSelectionChange={(k) => setCurrentView(k as ViewType)} color="primary" variant="solid" size="md" 
            classNames={{ 
              tabList: "bg-slate-200 dark:bg-slate-800 p-1 rounded-xl", 
              cursor: "bg-violet-600 rounded-lg",
              tab: "h-10 px-4"
            }}
          >
            <Tab key="dashboard" title={<LayoutDashboard className="w-4 h-4" />} />
            <Tab key="activity" title={<Activity className="w-4 h-4" />} />
            <Tab key="debriefs" title={<FileText className="w-4 h-4" />} />
            <Tab key="tasks" title={<ListTodo className="w-4 h-4" />} />
          </Tabs>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-96 gap-4">
            <div className="w-12 h-12 border-3 border-violet-600 border-t-transparent rounded-full animate-spin" />
            <p className="font-medium text-violet-600">Loading...</p>
          </div>
        ) : (
          <>
            {currentView === 'dashboard' && renderDashboard()}
            {currentView === 'activity' && renderActivity()}
            {currentView === 'debriefs' && (
              <div className="py-40 text-center animate-pulse">
                <p className="text-2xl font-bold text-slate-300 dark:text-slate-700 uppercase">Restricted Intelligence Area</p>
              </div>
            )}
            {currentView === 'tasks' && renderAgentTasks()}
          </>
        )}
      </main>
      <AddTaskModal isOpen={isTaskOpen} onClose={onTaskClose} onSuccess={() => {
        loadData()
        if (selectedTasksAgent) {
          loadAgentTasks(selectedTasksAgent)
        }
      }} userId={user?.id} />
      <EditAgentModal 
        isOpen={isEditAgentOpen} 
        onClose={() => {
          onEditAgentClose()
          setSelectedAgent(null)
        }} 
        onSuccess={loadData}
        agent={selectedAgent}
      />

      {/* Edit Task Modal */}
      <Modal isOpen={isEditTaskOpen} onClose={onEditTaskClose} size="lg">
        <ModalContent>
          <ModalHeader>Edit Task</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input
                label="Title"
                placeholder="Task title"
                value={taskFormData.title}
                onValueChange={(v) => setTaskFormData(f => ({ ...f, title: v }))}
                isRequired
                autoFocus
              />
              <Textarea
                label="Description"
                placeholder="Task details..."
                value={taskFormData.description}
                onValueChange={(v) => setTaskFormData(f => ({ ...f, description: v }))}
              />
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Priority"
                  selectedKeys={[taskFormData.priority]}
                  onChange={(e) => setTaskFormData(f => ({ ...f, priority: e.target.value }))}
                >
                  <SelectItem key="critical">Critical</SelectItem>
                  <SelectItem key="high">High</SelectItem>
                  <SelectItem key="medium">Medium</SelectItem>
                  <SelectItem key="low">Low</SelectItem>
                </Select>
                <Select
                  label="Status"
                  selectedKeys={[taskFormData.status]}
                  onChange={(e) => setTaskFormData(f => ({ ...f, status: e.target.value }))}
                >
                  <SelectItem key="todo">Todo</SelectItem>
                  <SelectItem key="in_progress">In Progress</SelectItem>
                  <SelectItem key="blocked">Blocked</SelectItem>
                  <SelectItem key="review">Review</SelectItem>
                  <SelectItem key="done">Done</SelectItem>
                </Select>
              </div>
              <Input
                label="Due Date"
                type="date"
                value={taskFormData.due_date}
                onChange={(e) => setTaskFormData(f => ({ ...f, due_date: e.target.value }))}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onEditTaskClose}>Cancel</Button>
            <Button 
              color="primary" 
              onPress={handleSaveTask}
              isLoading={savingTask}
              isDisabled={!taskFormData.title.trim()}
            >
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteConfirmOpen} onClose={onDeleteConfirmClose} size="sm">
        <ModalContent>
          <ModalHeader>Delete Task</ModalHeader>
          <ModalBody>
            <p className="text-slate-600 dark:text-slate-300">
              Are you sure you want to delete <span className="font-semibold">"{taskToDelete?.title}"</span>? This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDeleteConfirmClose}>Cancel</Button>
            <Button color="danger" onPress={handleDeleteTask}>
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
