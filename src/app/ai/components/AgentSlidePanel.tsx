'use client'

import { Avatar, Button, Chip, Divider, Card, CardBody } from "@heroui/react"
import { AIAgent, AgentTask, WorkLog } from "../page"
import { X, Bot, Zap, Clock, CheckCircle2, AlertCircle } from "lucide-react"

interface AgentSlidePanelProps {
  agent: AIAgent | null
  tasks: AgentTask[]
  workLogs: WorkLog[]
  isOpen: boolean
  onClose: () => void
}

export default function AgentSlidePanel({ agent, tasks, workLogs, isOpen, onClose }: AgentSlidePanelProps) {
  if (!agent) return null

  const agentTasks = tasks.filter(t => t.to_agent === agent.slug)
  const currentTask = agentTasks.find(t => t.status === 'in_progress')
  const pendingTasks = agentTasks.filter(t => t.status === 'pending')
  const completedTasks = agentTasks.filter(t => t.status === 'done').slice(0, 5)
  
  const agentLogs = workLogs.filter(l => l.agent_name.toLowerCase() === agent.slug.toLowerCase())
  const today = new Date().toDateString()
  const todayLogs = agentLogs.filter(l => new Date(l.created_at).toDateString() === today)
  
  const stats = {
    tasksDone: todayLogs.filter(l => l.action === 'task_completed').length,
    tokens: todayLogs.reduce((sum, l) => sum + (l.tokens_used || 0), 0),
    actions: todayLogs.length
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-slate-900 z-[101] shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col`}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-4">
            <Avatar 
              name={agent.name}
              className="w-12 h-12 text-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white"
            />
            <div>
              <h2 className="text-xl font-bold uppercase tracking-tight">{agent.name}</h2>
              <p className="text-xs text-slate-500 uppercase font-bold">{agent.role.replace('_', ' ')}</p>
            </div>
          </div>
          <Button isIconOnly variant="light" onPress={onClose}>
            <X className="w-6 h-6" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Status */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${agent.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className="font-bold text-sm uppercase">{agent.is_active ? 'Online & Ready' : 'Offline'}</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">{agent.model}</span>
          </div>

          {/* Current Task */}
          <section>
            <h3 className="text-[10px] uppercase font-bold text-slate-400 mb-3 tracking-widest">Current Task</h3>
            {currentTask ? (
              <Card className="bg-violet-500 text-white shadow-lg shadow-violet-500/20">
                <CardBody className="p-4">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 mt-1" />
                    <div>
                      <p className="font-medium text-sm">{currentTask.task}</p>
                      <p className="text-[10px] mt-2 opacity-80 uppercase font-bold">
                        Started {new Date(currentTask.started_at || '').toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ) : (
              <p className="text-sm text-slate-400 italic">No active task at the moment</p>
            )}
          </section>

          {/* Queue */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Queue</h3>
              <Chip size="sm" variant="flat">{pendingTasks.length} pending</Chip>
            </div>
            <div className="space-y-2">
              {pendingTasks.length > 0 ? pendingTasks.map(task => (
                <div key={task.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <p className="text-xs font-medium truncate flex-1">{task.task}</p>
                </div>
              )) : (
                <p className="text-xs text-slate-400 italic">Queue is empty</p>
              )}
            </div>
          </section>

          {/* Recent Completed */}
          <section>
            <h3 className="text-[10px] uppercase font-bold text-slate-400 mb-3 tracking-widest">Recent Completed</h3>
            <div className="space-y-3">
              {completedTasks.length > 0 ? completedTasks.map(task => (
                <div key={task.id} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{task.task}</p>
                    <p className="text-[10px] text-slate-400">{new Date(task.completed_at || '').toLocaleString()}</p>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-slate-400 italic">No tasks completed recently</p>
              )}
            </div>
          </section>

          {/* Today's Stats */}
          <section>
            <h3 className="text-[10px] uppercase font-bold text-slate-400 mb-3 tracking-widest">Stats (Today)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Tasks</p>
                <p className="text-lg font-bold">{stats.tasksDone}</p>
              </div>
              <div className="text-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Tokens</p>
                <p className="text-lg font-bold">{(stats.tokens / 1000).toFixed(1)}k</p>
              </div>
              <div className="text-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800">
                <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Actions</p>
                <p className="text-lg font-bold">{stats.actions}</p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800">
          <Button color="primary" variant="flat" className="w-full font-bold uppercase tracking-wider" onPress={onClose}>
            Back to Hub
          </Button>
        </div>
      </div>
    </>
  )
}
