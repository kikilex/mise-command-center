'use client'

import { Avatar } from "@heroui/react"

interface ActivityItemProps {
  agentName: string
  action: string
  timestamp: string
  onClick: () => void
}

export default function ActivityItem({ agentName, action, timestamp, onClick }: ActivityItemProps) {
  const timeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div 
      className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <Avatar 
        name={agentName}
        className="w-8 h-8 text-[10px] bg-slate-100 dark:bg-slate-800"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-700 dark:text-slate-300 truncate">
          <span className="font-bold uppercase tracking-tight mr-1">{agentName}</span>
          <span className="opacity-70">{action}</span>
        </p>
        <p className="text-[10px] text-slate-400">{timeAgo(timestamp)}</p>
      </div>
      <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-violet-500 transition-colors" />
    </div>
  )
}
