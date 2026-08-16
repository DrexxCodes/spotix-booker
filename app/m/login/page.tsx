"use client"

import type React from "react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Mail, Lock, AlertCircle, Eye, EyeOff, ChevronRight } from "lucide-react"
import {
  storeAccessToken,
  getDeviceId,
  collectDeviceMeta,
  scheduleProactiveRefresh,
} from "@/lib/auth-client"
import { triggerAuthRefresh, useAuth } from "@/hooks/useAuth"

function validateRedirect(url: string): string {
  if (!url || url === "/" || !url.startsWith("/")) return "/m/dashboard"
  return url
}

export default function PwaLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [errorVisible, setErrorVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const rawRedirect = searchParams.get("redirect") || ""
  const redirect = validateRedirect(rawRedirect)

  useEffect(() => {
    if (authLoading || !user) return
    if (!user.isBooker) {
      window.location.href = "/not-booker"
    } else {
      window.location.href = redirect
    }
  }, [user, authLoading, redirect])

  useEffect(() => () => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
  }, [])

  const showError = (msg: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
    setError(msg)
    setErrorVisible(false)
    requestAnimationFrame(() => requestAnimationFrame(() => setErrorVisible(true)))
    errorTimerRef.current = setTimeout(() => setErrorVisible(false), 5000)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorVisible(false)
    setLoading(true)

    try {
      const deviceId = getDeviceId()
      const deviceMeta = collectDeviceMeta()

      const sessionResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, deviceId, deviceMeta }),
      })

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json()
        throw new Error(errorData.message || "Failed to login")
      }

      const sessionData = await sessionResponse.json()
      storeAccessToken(sessionData.accessToken)
      scheduleProactiveRefresh(sessionData.accessToken)
      const isBooker = sessionData?.user?.isBooker || false
      triggerAuthRefresh()

      if (!isBooker) {
        window.location.href = "/not-booker"
        return
      }
      window.location.href = redirect
    } catch (err: any) {
      let msg = err.message || "Failed to login. Please try again."
      if (msg.includes("Incorrect email") || msg.includes("password")) {
        msg = "Incorrect email or password"
      } else if (msg.includes("too many") || msg.includes("attempts")) {
        msg = "Too many failed login attempts. Please try again later"
      } else if (msg.includes("disabled")) {
        msg = "This account has been disabled"
      }
      showError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-10">
      <div className="relative mb-6 h-14 w-40">
        <Image src="/logo-full.png" alt="Spotix Booker" fill className="object-contain" unoptimized />
      </div>

      <form onSubmit={handleLogin} className="pwa-glass-strong w-full max-w-sm rounded-3xl p-6">
        <p className="mb-1 text-center text-lg font-semibold text-[#1e1330]">Welcome back</p>
        <p className="mb-6 text-center text-xs text-[#1e1330]/50">
          Sign in to manage your events on the go
        </p>

        <div
          className={`mb-4 flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 transition-opacity duration-300 ${
            errorVisible ? "opacity-100" : "pointer-events-none h-0 overflow-hidden p-0 opacity-0"
          }`}
        >
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block text-xs font-medium text-[#1e1330]/60">Email</span>
          <div className="pwa-glass flex items-center gap-2 rounded-xl px-3 py-2.5">
            <Mail size={16} className="text-[#1e1330]/35" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-transparent text-sm text-[#1e1330] placeholder:text-[#1e1330]/30 outline-none"
            />
          </div>
        </label>

        <label className="mb-5 block">
          <span className="mb-1 block text-xs font-medium text-[#1e1330]/60">Password</span>
          <div className="pwa-glass flex items-center gap-2 rounded-xl px-3 py-2.5">
            <Lock size={16} className="text-[#1e1330]/35" />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-transparent text-sm text-[#1e1330] placeholder:text-[#1e1330]/30 outline-none"
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? (
                <EyeOff size={16} className="text-[#1e1330]/35" />
              ) : (
                <Eye size={16} className="text-[#1e1330]/35" />
              )}
            </button>
          </div>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-purple-700 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-900/40 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
          {!loading && <ChevronRight size={16} />}
        </button>
      </form>
    </div>
  )
}
