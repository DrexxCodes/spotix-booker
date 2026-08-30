"use client"

import { useEffect, useState, useCallback } from "react"
import { authFetch } from "@/lib/auth-client"
import { useAuth } from "@/hooks/useAuth"

/**
 * Shared "does this booker have a completed KYC/BVT verification" check.
 * Backs both the global KYC banner (components/kyc-banner.tsx) and the
 * withdrawal gate reused across event, poll, and election payouts — one
 * source of truth so every surface agrees on what "verified" means.
 */
export function useBVTStatus() {
  const { user } = useAuth()
  const [isVerified, setIsVerified] = useState(false)
  const [loading, setLoading]       = useState(true)
  const [checked, setChecked]       = useState(false)

  const refresh = useCallback(async () => {
    if (!user?.uid) { setLoading(false); return }
    setLoading(true)
    try {
      const res = await authFetch(`/api/profile/bvt?userId=${user.uid}`)
      if (res.ok) {
        const data = await res.json()
        setIsVerified(!!data.isVerified)
      }
    } catch (err) {
      console.error("BVT status check failed:", err)
    } finally {
      setLoading(false)
      setChecked(true)
    }
  }, [user?.uid])

  useEffect(() => { refresh() }, [refresh])

  return { isVerified, loading, checked, refresh }
}
