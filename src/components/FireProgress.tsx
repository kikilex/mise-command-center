'use client'

import { useMemo } from 'react'
import { Card, CardBody, CardHeader } from '@heroui/react'
import { Flame } from 'lucide-react'

interface FireProgressProps {
  completedCount: number
  goal?: number
}

export default function FireProgress({ completedCount, goal = 8 }: FireProgressProps) {
  const percent = Math.min((completedCount / goal) * 100, 100)
  const exceeded = completedCount > goal
  const exceededBy = completedCount - goal

  const { cardStyle, headerStyle, progressStyle, trackStyle, iconStyle, textColor, subColor, subtitle } = useMemo(() => {
    if (completedCount === 0) {
      return {
        cardStyle: { background: '#f8fafc', borderColor: '#e2e8f0', boxShadow: 'none' },
        headerStyle: { background: '#f8fafc', borderColor: '#e2e8f0' },
        progressStyle: { background: '#cbd5e1' },
        trackStyle: { background: '#e2e8f0' },
        iconStyle: { background: 'linear-gradient(135deg, #94a3b8, #64748b)' },
        textColor: '#1e293b',
        subColor: '#64748b',
        subtitle: 'Light your first fire!'
      }
    } else if (completedCount <= 2) {
      return {
        cardStyle: { background: '#fff7ed', borderColor: '#fdba74', boxShadow: '0 0 15px rgba(251, 146, 60, 0.2)' },
        headerStyle: { background: '#ffedd5', borderColor: '#fdba74' },
        progressStyle: { background: 'linear-gradient(90deg, #fdba74, #fb923c)' },
        trackStyle: { background: '#fed7aa' },
        iconStyle: { background: 'linear-gradient(135deg, #fb923c, #f97316)' },
        textColor: '#c2410c',
        subColor: '#ea580c',
        subtitle: 'Getting warmed up...'
      }
    } else if (completedCount <= 4) {
      return {
        cardStyle: { background: '#fff1e6', borderColor: '#f97316', boxShadow: '0 0 20px rgba(249, 115, 22, 0.3)' },
        headerStyle: { background: '#ffe4cc', borderColor: '#f97316' },
        progressStyle: { background: 'linear-gradient(90deg, #fb923c, #f97316, #ea580c)' },
        trackStyle: { background: '#fed7aa' },
        iconStyle: { background: 'linear-gradient(135deg, #f97316, #ea580c)' },
        textColor: '#9a3412',
        subColor: '#c2410c',
        subtitle: 'Good momentum! 🔥'
      }
    } else if (completedCount <= 6) {
      return {
        cardStyle: { background: '#fef2e8', borderColor: '#ea580c', boxShadow: '0 0 25px rgba(234, 88, 12, 0.4)' },
        headerStyle: { background: '#fde1ce', borderColor: '#ea580c' },
        progressStyle: { background: 'linear-gradient(90deg, #f97316, #ea580c, #dc2626)' },
        trackStyle: { background: '#fdba74' },
        iconStyle: { background: 'linear-gradient(135deg, #ea580c, #dc2626)' },
        textColor: '#7c2d12',
        subColor: '#9a3412',
        subtitle: 'ON FIRE! Keep pushing! 🔥🔥'
      }
    } else if (completedCount <= goal) {
      return {
        cardStyle: { background: '#fef0e6', borderColor: '#dc2626', boxShadow: '0 0 30px rgba(220, 38, 38, 0.5)' },
        headerStyle: { background: '#fdded3', borderColor: '#dc2626' },
        progressStyle: { background: 'linear-gradient(90deg, #ea580c, #dc2626, #b91c1c)' },
        trackStyle: { background: '#fca5a5' },
        iconStyle: { background: 'linear-gradient(135deg, #dc2626, #b91c1c)' },
        textColor: '#7f1d1d',
        subColor: '#991b1b',
        subtitle: completedCount === goal ? 'Goal reached! 🎯' : 'Almost there! 🔥🔥🔥'
      }
    } else {
      return {
        cardStyle: { 
          background: 'linear-gradient(135deg, #fefce8, #fef9c3, #fef08a)', 
          borderColor: '#eab308', 
          boxShadow: '0 0 50px rgba(245, 158, 11, 0.6)' 
        },
        headerStyle: { background: 'linear-gradient(135deg, #fef08a, #fde047)', borderColor: '#eab308' },
        progressStyle: { background: 'linear-gradient(90deg, #fbbf24, #f59e0b, #d97706, #f59e0b, #fbbf24)' },
        trackStyle: { background: '#fde68a' },
        iconStyle: { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' },
        textColor: '#713f12',
        subColor: '#a16207',
        subtitle: 'LEGENDARY STATUS! 👑🔥👑'
      }
    }
  }, [completedCount, goal])

  const showFlames = completedCount >= 5
  const flameCount = completedCount > goal ? 12 : completedCount >= 7 ? 8 : 5

  return (
    <Card 
      className={`overflow-hidden transition-all duration-700 border-2 ${exceeded ? 'fire-legendary-card' : completedCount >= 7 ? 'fire-pulse-border' : ''}`}
      style={cardStyle}
    >
      <CardHeader 
        className="px-6 py-4 border-b flex items-center justify-between transition-all duration-500"
        style={headerStyle}
      >
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500"
            style={iconStyle}
          >
            <span className="text-2xl">🔥</span>
          </div>
          <div>
            <h2 className="font-bold transition-colors duration-500" style={{ color: textColor }}>
              Today's Progress
            </h2>
            <p className="text-xs transition-colors duration-500" style={{ color: subColor }}>
              {subtitle}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black transition-colors duration-500">
            <span style={{ color: completedCount === 0 ? '#cbd5e1' : exceeded ? '#d97706' : '#ea580c' }}>
              {completedCount}
            </span>
            <span style={{ color: '#94a3b8' }}> / {goal}</span>
          </div>
        </div>
      </CardHeader>
      
      <CardBody className="px-6 py-5 transition-all duration-500">
        {/* Progress bar */}
        <div className="relative">
          <div 
            className="h-14 rounded-xl overflow-hidden relative transition-all duration-500"
            style={trackStyle}
          >
            <div 
              className="h-full transition-all duration-700 ease-out rounded-xl"
              style={{ width: `${percent}%`, ...progressStyle }}
            />
          </div>
          
          {/* Fire emojis */}
          <div className="absolute inset-0 flex items-center justify-between px-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex-1 flex items-center justify-center">
                {i < Math.min(completedCount, 10) ? (
                  <span 
                    className={`text-2xl transition-all ${
                      exceeded ? 'fire-legendary-emoji' : 
                      completedCount >= 6 ? 'fire-float' : ''
                    }`}
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    🔥
                  </span>
                ) : (
                  <div 
                    className="w-2.5 h-2.5 rounded-full transition-colors duration-500"
                    style={{ background: completedCount === 0 ? '#cbd5e1' : '#fdba74' }}
                  />
                )}
              </div>
            ))}
          </div>
          
          {/* Exceeded badge */}
          {exceeded && (
            <div className="absolute -right-2 -top-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg animate-pulse">
              +{exceededBy} 💎
            </div>
          )}
        </div>
        
        {/* Dancing flames */}
        {showFlames && (
          <div className="flex justify-center gap-2 mt-3 h-8 overflow-hidden">
            {Array.from({ length: flameCount }).map((_, i) => (
              <span 
                key={i} 
                className={`text-${exceeded ? '3xl' : '2xl'} fire-dance ${exceeded ? 'fire-legendary-emoji' : ''}`}
                style={{ animationDelay: `${i * (exceeded ? 0.08 : 0.15)}s` }}
              >
                {exceeded && i % 3 === 0 ? '👑' : '🔥'}
              </span>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
