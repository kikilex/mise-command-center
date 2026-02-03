'use client'

import { Chip } from "@heroui/react"
import { AgentTask } from "../page"

interface CollaborationFeedProps {
  tasks: AgentTask[]
  selectedTaskId: string | null
  onSelectTask: (task: AgentTask) => void
}

export default function CollaborationFeed({ tasks, selectedTaskId, onSelectTask }: CollaborationFeedProps) {
  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Activity Feed</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm italic">No activity recorded</div>
        ) : (
          tasks.map((task) => (
            <div 
              key={task.id}
              onClick={() => onSelectTask(task)}
              className={`p-4 cursor-pointer border-b border-slate-100 dark:border-slate-700/50 transition-colors ${
                selectedTaskId === task.id 
                  ? 'bg-violet-50 dark:bg-violet-900/20 border-l-4 border-l-violet-500' 
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase text-violet-600 dark:text-violet-400">{task.from_agent}</span>
                <span className="text-[10px] text-slate-400">→</span>
                <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">{task.to_agent}</span>
                <span className="text-[10px] text-slate-400 ml-auto">
                  {new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 line-clamp-1">{task.task}</p>
              <div className="mt-2 flex items-center justify-between">
                <Chip 
                  size="sm" 
                  variant="flat" 
                  color={task.status === 'done' ? 'success' : task.status === 'failed' ? 'danger' : 'warning'} 
                  className="h-5 text-[10px] uppercase font-bold"
                >
                  {task.status}
                </Chip>
                <span className="text-[10px] text-slate-400">
                  {new Date(task.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
