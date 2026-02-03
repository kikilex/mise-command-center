'use client'

import { Chip, Divider, Avatar } from "@heroui/react"
import { AgentTask } from "../page"
import { AlertCircle, CheckCircle2, Clock, Play } from "lucide-react"

interface ThreadDetailProps {
  task: AgentTask | null
}

export default function ThreadDetail({ task }: ThreadDetailProps) {
  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-slate-50/50 dark:bg-slate-900/20">
        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 opacity-20" />
        </div>
        <p className="font-medium">Select a task to view details</p>
        <p className="text-sm mt-1">Agent communications will appear here</p>
      </div>
    )
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'in_progress': return <Play className="w-4 h-4 text-blue-500" />
      default: return <Clock className="w-4 h-4 text-amber-500" />
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Chip size="sm" color={task.priority === 'high' || task.priority === 'critical' ? 'danger' : 'primary'} variant="flat" className="uppercase text-[10px] font-bold">
                {task.priority} Priority
              </Chip>
              <Chip size="sm" variant="dot" color={task.status === 'done' ? 'success' : 'warning'} className="uppercase text-[10px] font-bold">
                {task.status}
              </Chip>
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">{task.task}</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 uppercase font-bold">From</span>
            <div className="flex items-center gap-1">
              <Avatar name={task.from_agent} size="sm" className="w-5 h-5 text-[10px]" />
              <span className="text-sm font-bold text-violet-600 dark:text-violet-400">{task.from_agent}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 uppercase font-bold">To</span>
            <div className="flex items-center gap-1">
              <Avatar name={task.to_agent} size="sm" className="w-5 h-5 text-[10px]" />
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{task.to_agent}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Thread Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Initial Request */}
        <div className="flex gap-4">
          <Avatar name={task.from_agent} className="flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-sm uppercase">{task.from_agent}</span>
              <span className="text-[10px] text-slate-400">{new Date(task.created_at).toLocaleString()}</span>
            </div>
            <div className="p-4 rounded-2xl rounded-tl-none bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
              <p className="text-sm whitespace-pre-wrap">{task.task}</p>
              {task.context && (
                <div className="mt-3 p-3 rounded-lg bg-white/50 dark:bg-black/20 border border-slate-200 dark:border-slate-600">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Context</p>
                  <p className="text-xs font-mono">{task.context}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Updates (Simulated based on timestamps) */}
        {task.started_at && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
              <Play className="w-3 h-3 text-blue-500" />
              <span className="text-[10px] font-bold text-blue-600 uppercase">Started work at {new Date(task.started_at).toLocaleTimeString()}</span>
            </div>
          </div>
        )}

        {/* Result/Completion */}
        {task.status === 'done' && (
          <div className="flex gap-4 flex-row-reverse">
            <Avatar name={task.to_agent} className="flex-shrink-0" />
            <div className="flex-1 text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <span className="text-[10px] text-slate-400">{task.completed_at ? new Date(task.completed_at).toLocaleString() : ''}</span>
                <span className="font-bold text-sm uppercase">{task.to_agent}</span>
              </div>
              <div className="p-4 rounded-2xl rounded-tr-none bg-emerald-500 text-white text-left">
                <p className="text-[10px] uppercase font-bold mb-2 opacity-80">Completion Result</p>
                <p className="text-sm whitespace-pre-wrap">{task.result || 'Task completed successfully.'}</p>
              </div>
            </div>
          </div>
        )}

        {task.status === 'failed' && (
          <div className="flex gap-4 flex-row-reverse">
            <Avatar name={task.to_agent} className="flex-shrink-0" />
            <div className="flex-1 text-right">
              <div className="flex items-center justify-end gap-2 mb-1">
                <span className="text-[10px] text-slate-400">{task.completed_at ? new Date(task.completed_at).toLocaleString() : ''}</span>
                <span className="font-bold text-sm uppercase">{task.to_agent}</span>
              </div>
              <div className="p-4 rounded-2xl rounded-tr-none bg-red-500 text-white text-left">
                <p className="text-[10px] uppercase font-bold mb-2 opacity-80">Execution Error</p>
                <p className="text-sm font-mono">{task.error || 'Unknown error occurred.'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
