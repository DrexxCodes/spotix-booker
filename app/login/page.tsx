import { Suspense } from "react"
import LoginClient from "./client"

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#6b2fa5]/30 border-t-[#6b2fa5] rounded-full animate-spin" />
      </div>
    }>
      <LoginClient />
    </Suspense>
  )
}