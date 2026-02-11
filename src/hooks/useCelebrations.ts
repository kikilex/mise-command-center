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
  "THAT'S HOW WE DO IT 🙌",
  "ABSOLUTE BEAST MODE 🦁",
  "WINNER WINNER 🏆",
  "CAN'T BE STOPPED 🛡️",
  "MOMENTUM BABY 🌊",
  "STACK THAT PAPER 📈"
]

const legendaryMessages = [
  "YOU'RE A FUCKING BEAST 🦁",
  "ABSOLUTE LEGEND 👑",
  "BUILT DIFFERENT 💎",
  "KING SHIT ONLY 🔥",
  "UNSTOPPABLE FORCE 💪",
  "GODMODE ACTIVATED 🎮",
  "ELITE STATUS ACHIEVED 🏅",
  "LEGENDARY PERFORMANCE 🌟"
]

const secondaryMessages = [
  "KEEP THAT ENERGY ⚡",
  "ONE MORE DOWN 📋",
  "ON A ROLL 🎲",
  "FEELING GOOD 😎",
  "PRODUCTIVE AF 💯"
]

export function useCelebrations() {
  const audioCtxRef = useRef<AudioContext | null>(null)
  
  const initAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioCtxRef.current
  }, [])

  // Multiple sound types for variety
  const playSoundEffect = useCallback((effect: 'pop' | 'ding' | 'chime' | 'whoosh' | 'boom' | 'fanfare' | 'coin' | 'levelup') => {
    const ctx = initAudio()
    if (!ctx) return

    if (effect === 'pop') {
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
    } else if (effect === 'ding') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(1800, ctx.currentTime)
      gain.gain.setValueAtTime(0.25, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
      osc.start()
      osc.stop(ctx.currentTime + 0.4)
    } else if (effect === 'chime') {
      [1200, 1500, 1800].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.1)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.3)
        osc.start(ctx.currentTime + i * 0.1)
        osc.stop(ctx.currentTime + i * 0.1 + 0.3)
      })
    } else if (effect === 'whoosh') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(100, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15)
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } else if (effect === 'boom') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(150, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.5)
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      osc.start()
      osc.stop(ctx.currentTime + 0.5)
    } else if (effect === 'fanfare') {
      const notes = [523, 659, 784, 880, 1047, 1319, 1568]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'square'
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        const delay = i * 0.08
        gain.gain.setValueAtTime(0.12, ctx.currentTime + delay)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.25)
        osc.start(ctx.currentTime + delay)
        osc.stop(ctx.currentTime + delay + 0.25)
      })
    } else if (effect === 'coin') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(1200, ctx.currentTime)
      osc.frequency.setValueAtTime(1600, ctx.currentTime + 0.08)
      osc.frequency.setValueAtTime(2000, ctx.currentTime + 0.16)
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25)
      osc.start()
      osc.stop(ctx.currentTime + 0.25)
    } else if (effect === 'levelup') {
      const notes = [392, 494, 587, 784, 988, 1175, 1568, 1976]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        const delay = i * 0.06
        gain.gain.setValueAtTime(0.18, ctx.currentTime + delay)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.2)
        osc.start(ctx.currentTime + delay)
        osc.stop(ctx.currentTime + delay + 0.2)
      })
    }
  }, [initAudio])

  const screenShake = useCallback((intensity: 'light' | 'medium' | 'heavy' = 'medium') => {
    const className = intensity === 'heavy' ? 'celebration-shake-heavy' : 
                      intensity === 'light' ? 'celebration-shake-light' : 'celebration-shake'
    document.body.classList.add(className)
    setTimeout(() => document.body.classList.remove(className), intensity === 'heavy' ? 800 : 500)
  }, [])

  const createConfetti = useCallback((container: HTMLElement, count = 100, duration = 4000) => {
    const colors = ['#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#fbbf24', '#10b981']
    for (let i = 0; i < count; i++) {
      const confetti = document.createElement('div')
      confetti.className = 'celebration-confetti'
      confetti.style.left = Math.random() * 100 + 'vw'
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
      confetti.style.animationDelay = Math.random() * 0.8 + 's'
      confetti.style.animationDuration = (2 + Math.random() * 2) + 's'
      confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0'
      confetti.style.transform = `rotate(${Math.random() * 360}deg)`
      container.appendChild(confetti)
      setTimeout(() => confetti.remove(), duration)
    }
  }, [])

  const createMoney = useCallback((container: HTMLElement, count = 30, duration = 4000) => {
    const emojis = ['💰', '💵', '💸', '🤑', '💎', '🏆']
    for (let i = 0; i < count; i++) {
      const money = document.createElement('div')
      money.className = 'celebration-money'
      money.textContent = emojis[Math.floor(Math.random() * emojis.length)]
      money.style.left = Math.random() * 100 + 'vw'
      money.style.animationDelay = Math.random() * 1 + 's'
      money.style.fontSize = (1.5 + Math.random() * 1.5) + 'rem'
      container.appendChild(money)
      setTimeout(() => money.remove(), duration)
    }
  }, [])

  const createFireworks = useCallback((container: HTMLElement, waves = 3) => {
    const emojis = ['🎆', '✨', '💥', '🌟', '⭐', '🎇', '💫', '🔥']
    for (let wave = 0; wave < waves; wave++) {
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          const fw = document.createElement('div')
          fw.className = 'celebration-firework'
          fw.textContent = emojis[Math.floor(Math.random() * emojis.length)]
          fw.style.left = (10 + Math.random() * 80) + 'vw'
          fw.style.top = (10 + Math.random() * 60) + 'vh'
          fw.style.fontSize = (2 + Math.random() * 2) + 'rem'
          container.appendChild(fw)
          setTimeout(() => fw.remove(), 2000)
        }, wave * 1500 + i * 100)
      }
    }
  }, [])

  const createFloatingEmoji = useCallback((container: HTMLElement, emoji: string, x: number, y: number) => {
    const el = document.createElement('div')
    el.className = 'celebration-float-emoji'
    el.textContent = emoji
    el.style.left = x + 'vw'
    el.style.top = y + 'vh'
    container.appendChild(el)
    setTimeout(() => el.remove(), 2000)
  }, [])

  const getRandomHype = useCallback((isLegendary = false) => {
    const messages = isLegendary ? legendaryMessages : hypeMessages
    return messages[Math.floor(Math.random() * messages.length)]
  }, [])

  const getSecondaryMessage = useCallback(() => {
    return secondaryMessages[Math.floor(Math.random() * secondaryMessages.length)]
  }, [])

  const celebrate = useCallback((type?: CelebrationType) => {
    // Random selection if not specified
    if (!type) {
      const rand = Math.random()
      if (rand < 0.08) type = 'legendary'
      else if (rand < 0.28) type = 'fireworks'
      else if (rand < 0.50) type = 'money'
      else if (rand < 0.75) type = 'trophy'
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

    const hypeMessage = getRandomHype(type === 'legendary')
    const isLegendary = type === 'legendary'

    // === PHASE 1: Initial Impact (0-1s) ===
    screenShake(isLegendary ? 'heavy' : 'medium')
    playSoundEffect(isLegendary ? 'boom' : 'pop')
    createConfetti(container, isLegendary ? 150 : 80, 5000)

    // === PHASE 2: Build Up (1-3s) ===
    setTimeout(() => {
      playSoundEffect('chime')
      if (type === 'money' || type === 'legendary') {
        createMoney(container, 20, 4000)
      }
    }, 800)

    setTimeout(() => {
      playSoundEffect('whoosh')
      screenShake('light')
    }, 1500)

    setTimeout(() => {
      playSoundEffect('ding')
      createConfetti(container, 60, 4000)
    }, 2200)

    // === PHASE 3: Peak Celebration (3-6s) ===
    setTimeout(() => {
      playSoundEffect(isLegendary ? 'fanfare' : 'coin')
      screenShake('medium')
      if (type === 'fireworks' || type === 'legendary') {
        createFireworks(container, isLegendary ? 3 : 2)
      }
    }, 3000)

    setTimeout(() => {
      playSoundEffect('chime')
      if (type === 'money' || type === 'trophy' || type === 'legendary') {
        createMoney(container, 25, 4000)
      }
    }, 4000)

    setTimeout(() => {
      playSoundEffect('levelup')
      createConfetti(container, 100, 4000)
    }, 5000)

    // === PHASE 4: Grand Finale (6-10s) ===
    setTimeout(() => {
      playSoundEffect('boom')
      screenShake('heavy')
      createConfetti(container, 120, 4500)
      if (isLegendary) {
        createMoney(container, 40, 4500)
        createFireworks(container, 2)
      }
    }, 6500)

    setTimeout(() => {
      playSoundEffect('fanfare')
    }, 7500)

    setTimeout(() => {
      playSoundEffect('chime')
      playSoundEffect('ding')
    }, 8500)

    // Final flourish
    setTimeout(() => {
      playSoundEffect(isLegendary ? 'levelup' : 'coin')
      createConfetti(container, 50, 3000)
    }, 9500)

    return { type, hypeMessage }
  }, [screenShake, playSoundEffect, createConfetti, createMoney, createFireworks, getRandomHype])

  return { celebrate, getRandomHype, getSecondaryMessage }
}
