"use client"

// Beta phase and if I'm being very honest, I'd probably not even use it

import { useEffect, useRef } from "react"

export function ParticlesBackground() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Create particles
    const particleCount = 30
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement("div")
      particle.className = "particle"

      const size = Math.random() * 150 + 50
      const x = Math.random() * 100
      const y = Math.random() * 100
      const duration = Math.random() * 4 + 4

      // Create the styles of the particle
      particle.style.width = `${size}px`
      particle.style.height = `${size}px`
      particle.style.left = `${x}%`
      particle.style.top = `${y}%`
      particle.style.animationDuration = `${duration}s`
      particle.style.animationDelay = `${Math.random() * 2}s`

      // Add the particles to page
      container.appendChild(particle)
    }

    return () => {
      container.innerHTML = ""
    }
  }, [])

  return <div ref={containerRef} className="particles-background" />
}
