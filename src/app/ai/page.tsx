'use client'

import { useState, useEffect } from 'react'
import { 
  Button, 
  Card, 
  CardBody,
  CardHeader,
  Chip,
  Avatar,
  Progress,
  Divider
} from "@heroui/react"
import { createClient } from '@/lib/supabase/client'
import UserMenu from '@/components/UserMenu'

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

export default function AIWorkspacePage() {
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([])
  const [aiTasks, setAiTasks] = useState<any[]>([])
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    
    // Get user
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
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
        role: profile?.role
      })
    }

    // Get AI agents
    const { data: agentsData } = await supabase
      .from('ai_agents')
      .select('*')
      .order('created_at', { ascending: true })
    
    if (agentsData) setAgents(agentsData)

    // Get work logs
    const { data: logsData } = await supabase
      .from('ai_work_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (logsData) setWorkLogs(logsData)

    // Get AI-flagged tasks
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*')
      .eq('ai_flag', true)
      .neq('status', 'done')
      .order('priority', { ascending: true })
    
    if (tasksData) setAiTasks(tasksData)

    setLoading(false)
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  function getActionIcon(action: string) {
    const icons: Record<string, string> = {
      'task_started': '🚀',
      'task_completed': '✅',
      'agent_spawned': '🤖',
      'content_created': '📝',
      'script_written': '✍️',
      'research': '🔍',
      'analysis': '📊',
      'default': '⚡'
    }
    return icons[action] || icons.default
  }

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'critical': return 'bg-red-500'
      case 'high': return 'bg-orange-500'
      case 'medium': return 'bg-yellow-500'
      default: return 'bg-slate-400'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <span className="font-semibold text-slate-800 text-lg">Mise</span>
              </a>
            </div>
            <h1 className="text-xl font-semibold text-slate-800">AI Workspace</h1>
            <div className="flex items-center gap-2">
              {user && <UserMenu user={user} />}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading AI workspace...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Agents & Queue */}
            <div className="lg:col-span-2 space-y-6">
              {/* AI Agents */}
              <Card className="bg-white shadow-sm">
                <CardHeader className="px-6 pt-6 pb-2">
                  <h2 className="text-lg font-semibold text-slate-800">AI Agents</h2>
                </CardHeader>
                <CardBody className="px-6 pb-6">
                  {agents.length === 0 ? (
                    <p className="text-slate-400 text-center py-4">No agents configured</p>
                  ) : (
                    <div className="space-y-4">
                      {agents.map(agent => (
                        <div key={agent.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <span className="text-white text-xl">⚡</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-800">{agent.name}</h3>
                              <Chip 
                                size="sm" 
                                className={agent.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}
                              >
                                {agent.is_active ? 'Online' : 'Offline'}
                              </Chip>
                            </div>
                            <p className="text-sm text-slate-500">{agent.role.replace('_', ' ')} • {agent.model}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                              <span>Autonomy: {agent.settings?.autonomy_level || 'medium'}</span>
                              {agent.settings?.can_spawn_agents && <span>Can spawn agents</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* AI Task Queue */}
              <Card className="bg-white shadow-sm">
                <CardHeader className="px-6 pt-6 pb-2">
                  <div className="flex items-center justify-between w-full">
                    <h2 className="text-lg font-semibold text-slate-800">AI Task Queue</h2>
                    <Chip size="sm" variant="flat">{aiTasks.length} tasks</Chip>
                  </div>
                </CardHeader>
                <CardBody className="px-6 pb-6">
                  {aiTasks.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-slate-400 mb-2">No tasks flagged for AI</p>
                      <p className="text-sm text-slate-400">
                        Enable "AI Flag" on tasks to add them to the queue
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {aiTasks.map(task => (
                        <div key={task.id} className="flex items-center gap-4 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                          <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-700 truncate">{task.title}</p>
                            <p className="text-xs text-slate-400 capitalize">{task.priority} priority • {task.status.replace('_', ' ')}</p>
                          </div>
                          <Chip size="sm" className="bg-violet-100 text-violet-700">🤖 AI</Chip>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>

            {/* Right Column - Work Log */}
            <div className="space-y-6">
              <Card className="bg-white shadow-sm">
                <CardHeader className="px-6 pt-6 pb-2">
                  <div className="flex items-center justify-between w-full">
                    <h2 className="text-lg font-semibold text-slate-800">Work Log</h2>
                    <Chip size="sm" className="bg-emerald-100 text-emerald-700">Live</Chip>
                  </div>
                </CardHeader>
                <CardBody className="px-6 pb-6">
                  {workLogs.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">No activity logged yet</p>
                  ) : (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto">
                      {workLogs.map(log => (
                        <div key={log.id} className="flex gap-3">
                          <span className="text-lg">{getActionIcon(log.action)}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700">{log.action.replace(/_/g, ' ')}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <span>{log.agent_name}</span>
                              <span>•</span>
                              <span>{formatTime(log.created_at)}</span>
                              {log.tokens_used && (
                                <>
                                  <span>•</span>
                                  <span>{log.tokens_used.toLocaleString()} tokens</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Quick Stats */}
              <Card className="bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
                <CardBody className="p-6">
                  <h3 className="font-semibold mb-4">Today's Activity</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-violet-200">Tasks Completed</span>
                      <span className="font-semibold">{workLogs.filter(l => l.action === 'task_completed').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-violet-200">Total Actions</span>
                      <span className="font-semibold">{workLogs.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-violet-200">Active Agents</span>
                      <span className="font-semibold">{agents.filter(a => a.is_active).length}</span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
