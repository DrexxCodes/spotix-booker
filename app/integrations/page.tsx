"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { authFetch, getAccessToken, tryRefreshTokens } from "@/lib/auth-client"
import { Puzzle, Loader } from "lucide-react"
import { TelegramIntegration } from "@/components/integrations/telegram-integration"
import { ZoomIntegration } from "@/components/integrations/zoom-integration"
import { GoogleMeetIntegration } from "@/components/integrations/google-meet-integration"
import { BankAccountsIntegration } from "@/components/integrations/bank-accounts-integration"

interface PayoutMethod {
  id: string
  accountNumber: string
  bankName: string
  bankCode: string
  accountName: string
  primary: boolean
  createdAt: string
}

export default function IntegrationsPage() {
  const router = useRouter()
  const [loading, setLoading]           = useState(true)
  const [authChecked, setAuthChecked]   = useState(false)
  const [userId, setUserId]             = useState<string | null>(null)
  const [telegramConnected, setTelegramConnected] = useState(false)
  const [methods, setMethods]           = useState<PayoutMethod[]>([])
  const [methodsLoading, setMethodsLoading] = useState(true)
  const [methodsError, setMethodsError]     = useState<string | null>(null)

  const fetchMethods = async () => {
    setMethodsLoading(true)
    setMethodsError(null)
    try {
      const res = await authFetch("/api/payout/method")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to load bank accounts")
      setMethods(data.methods ?? [])
    } catch (err: any) {
      setMethodsError(err.message ?? "Failed to load bank accounts")
    } finally {
      setMethodsLoading(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        let token = getAccessToken()
        if (!token) {
          const refreshed = await tryRefreshTokens()
          if (!refreshed) { router.push("/login"); return }
          token = getAccessToken()
        }
        if (!token) { router.push("/login"); return }

        const userResponse = await authFetch("/api/user/me")
        if (!userResponse.ok) { router.push("/login"); return }
        const userData = await userResponse.json()
        const uid = userData?.uid || userData?.id
        if (!uid) { router.push("/login"); return }
        setUserId(uid)
        setAuthChecked(true)

        const telegramRes = await authFetch(`/api/profile/telegram?userId=${uid}`)
        if (telegramRes.ok) {
          const t = await telegramRes.json()
          setTelegramConnected(!!t.connected)
        }

        await fetchMethods()
      } catch (err) {
        console.error("Integrations load error:", err)
        router.push("/login")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader className="w-7 h-7 animate-spin text-[#6b2fa5]" />
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50">
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#6b2fa5]/10 flex items-center justify-center flex-shrink-0">
              <Puzzle className="w-5 h-5 text-[#6b2fa5]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">My Integrations</h1>
              <p className="text-xs text-slate-400">Connect Spotix Booker with the tools you already use</p>
            </div>
          </div>

          <div className="space-y-4">
            {userId && <TelegramIntegration userId={userId} connected={telegramConnected} />}
            {userId && (
              <BankAccountsIntegration
                userId={userId}
                methods={methods}
                loading={methodsLoading}
                error={methodsError}
                onRefresh={fetchMethods}
                onMethodCreated={(m) => setMethods((prev) => [...prev, m])}
              />
            )}
            <ZoomIntegration />
            <GoogleMeetIntegration />
          </div>
        </main>
      </div>
    </>
  )
}
