'use client'

import { useCallback, useRef } from 'react'

type CelebrationType = 'confetti' | 'money' | 'fireworks' | 'trophy' | 'legendary'

const hypeMessages = [
  "FUCK YEAH 🔥",
  "HELL YEAH 💪",
  "LET'S FUCKING GO 🚀",
  "MONEY IN THE BANK 💰",
  "KEEP GOING KING 👑",
  "UNSTOPPABLE 💥",
  "GET THAT BAG 💵",
  "CRUSHING IT 🔨",
  "NO STOPPING NOW ⚡",
  "THAT'S HOW WE DO IT 🙌"
]

const legendaryMessages = [
  "YOU'RE A FUCKING BEAST 🦁",
  "ABSOLUTE LEGEND 👑",
  "BUILT DIFFERENT 💎",
  "KING SHIT ONLY 🔥",
  "UNSTOPPABLE FORCE 💪"
]

export function useCelebrations() {
  const audioCtxRef = useRef<AudioContext | null>(null)
  
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioCtxRef.current
  }, [])

  const playSound = useCallback((type: CelebrationType) => {
    const ctx = initAudio()
    if (!ctx) return

    if (type === 'confetti') {
      // Pop sound
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(600, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
      osc.start()
      osc.stop(ctx.currentTime + 0.1)
    } else if (type === 'money') {
      // Cha-ching sound
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(1200, ctx.currentTime)
      osc.frequency.setValueAtTime(1600, ctx.currentTime + 0.1)
      osc.frequency.setValueAtTime(2000, ctx.currentTime + 0.2)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } else if (type === 'fireworks') {
      // Boom sound
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(150, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3)
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } else if (type === 'trophy' || type === 'legendary') {
      // Victory fanfare
      const notes = type === 'legendary' 
        ? [523, 659, 784, 880, 1047, 1319, 1568] 
        : [523, 659, 784, 1047]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        if (type === 'legendary') osc.type = 'square'
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        const delay = i * (type === 'legendary' ? 0.08 : 0.1)
        gain.gain.setValueAtTime(type === 'legendary' ? 0.15 : 0.2, ctx.currentTime + delay)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + (type === 'legendary' ? 0.3 : 0.2))
        osc.start(ctx.currentTime + delay)
        osc.stop(ctx.currentTime + delay + (type === 'legendary' ? 0.3 : 0.2))
      })
    }
  }, [initAudio])

  const screenShake = useCallback(() => {
    document.body.classList.add('celebration-shake')
    setTimeout(() => document.body.classList.remove('celebration-shake'), 500)
  }, [])

  const createConfetti = useCallback((container: HTMLElement, count = 80) => {
    const colors = ['#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444']
    for (let i = 0; i < count; i++) {
      const confetti = document.createElement('div')
      confetti.className = 'celebration-confetti'
      confetti.style.left = Math.random() * 100 + 'vw'
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
      confetti.style.animationDelay = Math.random() * 0.5 + 's'
      confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0'
      container.appendChild(confetti)
      setTimeout(() => confetti.remove(), 3500)
    }
  }, [])

  const createMoney = useCallback((container: HTMLElement, count = 25) => {
    for (let i = 0; i < count; i++) {
      const money = document.createElement('div')
      money.className = 'celebration-money'
      money.textContent = Math.random() > 0.5 ? '💰' : '💵'
      money.style.left = Math.random() * 100 + 'vw'
      money.style.animationDelay = Math.random() * 0.8 + 's'
      container.appendChild(money)
      setTimeout(() => money.remove(), 3500)
    }
  }, [])

  const createFireworks = useCallback((container: HTMLElement) => {
    const emojis = ['🎆', '✨', '💥', '🌟', '⭐']
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        const fw = document.createElement('div')
        fw.className = 'celebration-firework'
        fw.textContent = emojis[Math.floor(Math.random() * emojis.length)]
        fw.style.left = (15 + Math.random() * 70) + 'vw'
        fw.style.top = (15 + Math.random() * 50) + 'vh'
        container.appendChild(fw)
        setTimeout(() => fw.remove(), 1500)
      }, i * 120)
    }
  }, [])

  const getRandomHype = useCallback((isLegendary = false) => {
    const messages = isLegendary ? legendaryMessages : hypeMessages
    return messages[Math.floor(Math.random() * messages.length)]
  }, [])

  const celebrate = useCallback((type?: CelebrationType) => {
    // Random selection if not specified
    if (!type) {
      const rand = Math.random()
      if (rand < 0.05) type = 'legendary'
      else if (rand < 0.25) type = 'fireworks'
      else if (rand < 0.45) type = 'money'
      else if (rand < 0.70) type = 'trophy'
      else type = 'confetti'
    }

    // Get or create container
    let container = document.getElementById('celebration-container')
    if (!container) {
      container = document.createElement('div')
      container.id = 'celebration-container'
      container.className = 'fixed inset-0 pointer-events-none z-[9999]'
      document.body.appendChild(container)
    }

    // Play sound and shake for all
    playSound(type)
    screenShake()

    // Create effects based on type
    const hypeMessage = getRandomHype(type === 'legendary')

    if (type === 'confetti') {
      createConfetti(container)
    } else if (type === 'money') {
      createMoney(container)
      createConfetti(container, 40)
    } else if (type === 'fireworks') {
      createFireworks(container)
      createConfetti(container, 40)
    } else if (type === 'trophy') {
      createConfetti(container)
    } else if (type === 'legendary') {
      createConfetti(container)
      setTimeout(() => createMoney(container), 300)
      setTimeout(() => createFireworks(container), 600)
    }

    return { type, hypeMessage }
  }, [playSound, screenShake, createConfetti, createMoney, createFireworks, getRandomHype])

  return { celebrate, playSound, screenShake, getRandomHype }
}
