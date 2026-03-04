'use client'

import { useEffect, useRef } from 'react'

type Particle = {
  x: number; y: number
  vx: number; vy: number
  color: string; size: number
  rotation: number; rotationSpeed: number
  opacity: number; life: number
}

const COLORS = ['#d4a843', '#f0c060', '#2dd4a0', '#4a9eff', '#a78bfa', '#f87171', '#fbbf24']

export function ConfettiCelebration({ onDone }: { onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    const particles: Particle[] = []

    for (let i = 0; i < 160; i++) {
      particles.push({
        x:             Math.random() * canvas.width,
        y:             -20 - Math.random() * 200,
        vx:            (Math.random() - 0.5) * 6,
        vy:            2 + Math.random() * 5,
        color:         COLORS[Math.floor(Math.random() * COLORS.length)],
        size:          4 + Math.random() * 8,
        rotation:      Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        opacity:       1,
        life:          1,
      })
    }

    let raf: number
    let startTime: number | null = null
    const DURATION = 3200

    function draw(timestamp: number) {
      if (!startTime) startTime = timestamp
      const elapsed = timestamp - startTime

      ctx.clearRect(0, 0, canvas!.width, canvas!.height)

      for (const p of particles) {
        p.x  += p.vx
        p.y  += p.vy
        p.vy += 0.08
        p.vx *= 0.99
        p.rotation += p.rotationSpeed
        p.life = Math.max(0, 1 - elapsed / DURATION)
        p.opacity = p.life

        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }

      if (elapsed < DURATION) {
        raf = requestAnimationFrame(draw)
      } else {
        ctx.clearRect(0, 0, canvas!.width, canvas!.height)
        onDone?.()
      }
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [onDone])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9998] pointer-events-none"
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}
