'use client'

import { Card, CardBody, Avatar, Chip } from "@heroui/react"
import { AIAgent } from "../page"

interface AgentCardProps {
  agent: AIAgent
  currentTask?: string
  onClick: (agent: AIAgent) => void
  isExpanded?: boolean
  stats?: {
    tasksCompleted: number
    tokensUsed: number
  }
}

export default function AgentCard({ agent, currentTask, onClick, isExpanded, stats }: AgentCardProps) {
  if (isExpanded) {
    return (
      <Card 
        isPressable
        onPress={() => onClick(agent)}
        className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:border-violet-500 dark:hover:border-violet-500 transition-all"
      >
        <CardBody className="p-6">
          <div className="flex gap-4">
            <div className="relative">
              <Avatar 
                name={agent.name}
                className="w-16 h-16 text-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg"
              />
              <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${agent.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">{agent.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{agent.role.replace('_', ' ')}</p>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">{agent.model}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${agent.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span className="text-xs font-medium">{agent.is_active ? 'Online' : 'Offline'}</span>
            </div>
            <div className="min-h-[32px]">
              <p className="text-[10px] uppercase text-slate-400 font-bold">Current</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1 italic">
                {currentTask ? `"${currentTask}"` : 'Idle'}
              </p>
            </div>
          </div>

          {stats && (
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
              <p className="text-[10px] uppercase text-slate-400 font-bold mb-2">Today</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-slate-500">Tasks</p>
                  <p className="text-lg font-bold">{stats.tasksCompleted}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Tokens</p>
                  <p className="text-lg font-bold">{(stats.tokensUsed / 1000).toFixed(1)}k</p>
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    )
  }

  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
      onClick={() => onClick(agent)}
    >
      <div className="relative">
        <Avatar 
          name={agent.name}
          className="bg-gradient-to-br from-violet-500 to-purple-600 text-white"
          size="md"
        />
        <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-800 ${agent.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate uppercase tracking-tighter">{agent.name}</h3>
        </div>
        <p className="text-[10px] text-slate-400 font-bold uppercase truncate mb-1">Working on:</p>
        <p className="text-xs text-slate-600 dark:text-slate-400 truncate italic">
          {currentTask || 'Idle'}
        </p>
      </div>
    </div>
  )
}
