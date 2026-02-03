'use client'

import { Bot, User } from 'lucide-react'
import { Chip } from '@heroui/react'

interface TaskCommentProps {
  authorType: 'human' | 'agent'
  authorName: string           // "Alex" or "Ax" or "Tony"
  message: string
  timestamp: string
  isOwn?: boolean              // true if current user posted it
}

export default function TaskComment({
  authorType,
  authorName,
  message,
  timestamp,
  isOwn = false,
}: TaskCommentProps) {
  const isAgent = authorType === 'agent'

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} mb-4`}>
      <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex items-center gap-1.5`}>
          {isAgent ? (
            <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
          )}
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {authorName}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {timestamp}
        </span>
      </div>

      <div
        className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
          isOwn
            ? 'bg-blue-600 text-white rounded-tr-none'
            : isAgent
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
            : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-tl-none'
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message}</p>
      </div>
    </div>
  )
}
