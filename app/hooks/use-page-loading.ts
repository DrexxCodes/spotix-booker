"use client"

import { useState, useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"

export function usePageLoading() {
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Show loader on initial page load
    setIsLoading(true)
    
    // Hide loader after a short delay to ensure content is rendered
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [pathname, searchParams])

  // Also handle initial page load
  useEffect(() => {
    const handleLoad = () => {
      setIsLoading(false)
    }

    if (document.readyState === "complete") {
      setIsLoading(false)
    } else {
      window.addEventListener("load", handleLoad)
      return () => window.removeEventListener("load", handleLoad)
    }
  }, [])

  return isLoading
}