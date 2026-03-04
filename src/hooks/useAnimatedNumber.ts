'use client'

import { useEffect, useRef, useState } from 'react'

export function useAnimatedNumber(target: number, duration = 900) {
  const [value, setValue] = useState(target)
  const prev = useRef(target)
  const raf  = useRef<number | null>(null)

  useEffect(() => {
    const from  = prev.current
    const start = Date.now()

    if (raf.current) cancelAnimationFrame(raf.current)

    function tick() {
      const elapsed  = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased    = 1 - Math.pow(1 - progress, 3)
      setValue(from + (target - from) * eased)
      if (progress < 1) raf.current = requestAnimationFrame(tick)
      else { setValue(target); prev.current = target }
    }

    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, duration])

  return value
}
