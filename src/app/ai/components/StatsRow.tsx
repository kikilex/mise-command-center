'use client'

import { Card, CardBody } from "@heroui/react"
import { CheckCircle2, Zap, Users, ArrowLeftRight } from "lucide-react"

interface StatsRowProps {
  tasksDone: number
  tokensUsed: number
  agentsOnline: number
  handoffsToday: number
}

export default function StatsRow({ tasksDone, tokensUsed, agentsOnline, handoffsToday }: StatsRowProps) {
  const stats = [
    { label: 'Tasks Done', value: tasksDone, icon: CheckCircle2, color: 'text-emerald-500' },
    { label: 'Tokens', value: `${(tokensUsed / 1000).toFixed(1)}k`, icon: Zap, color: 'text-amber-500' },
    { label: 'Agents', value: agentsOnline, icon: Users, color: 'text-blue-500' },
    { label: 'Handoffs', value: handoffsToday, icon: ArrowLeftRight, color: 'text-violet-500' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
          <CardBody className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-slate-50 dark:bg-slate-700 ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{stat.label}</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{stat.value}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  )
}
