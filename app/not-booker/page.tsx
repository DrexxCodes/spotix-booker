"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { AlertCircle, ArrowRight, LogOut, Mail } from "lucide-react"
import { useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { ParticlesBackground } from "@/components/particles-background"

export default function NotBookerPage() {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      // Call server-side logout API
      await fetch("/api/auth/logout", {
        method: "POST",
      })

      // Sign out from Firebase client
      await signOut(auth)
      
      // Redirect to login
      router.push("/login")
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <>
      <ParticlesBackground />
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full space-y-8 animate-in fade-in zoom-in-95 duration-700">
          {/* Header */}
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center mx-auto">
              <div className="relative w-32 h-32 rounded-2xl overflow-hidden shadow-lg">
                <Image
                  src="/logo.png"
                  alt="Spotix"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
            
            <div className="space-y-3">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-[#6b2fa5] via-[#8b3fc5] to-[#6b2fa5] bg-clip-text text-transparent">
                Access Restricted
              </h1>
              <p className="text-xl text-slate-600">
                You don't have booker privileges
              </p>
            </div>
          </div>

          {/* Main Content Card */}
          <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 p-8 space-y-6">
            {/* Alert Banner */}
            <div className="flex gap-4 p-5 bg-amber-50 border-2 border-amber-200 rounded-xl">
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-bold text-amber-900 text-lg">
                  Booker Portal Access Required
                </p>
                <p className="text-amber-800 leading-relaxed">
                  This portal is exclusively for event creators and bookers. Your account doesn't currently have the necessary permissions to access this area.
                </p>
              </div>
            </div>

            {/* Information Section */}
            <div className="space-y-4 pt-2">
              <h2 className="text-xl font-bold text-slate-900">
                Want to become a booker?
              </h2>
              
              <div className="space-y-3 text-slate-700">
                <p className="leading-relaxed">
                  To gain access to the Spotix Booker Portal and start creating events, you'll need to upgrade your account to a booker account. Here's how:
                </p>
                
                <ol className="space-y-3 ml-5">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-[#6b2fa5] text-white font-bold text-sm">
                      1
                    </span>
                    <span className="pt-0.5">
                      <strong className="text-slate-900">Contact Support:</strong> Reach out to our support team to request booker access
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-[#6b2fa5] text-white font-bold text-sm">
                      2
                    </span>
                    <span className="pt-0.5">
                      <strong className="text-slate-900">Verification:</strong> Complete our verification process for event creators
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-[#6b2fa5] text-white font-bold text-sm">
                      3
                    </span>
                    <span className="pt-0.5">
                      <strong className="text-slate-900">Activation:</strong> Once approved, your account will be upgraded and you'll have full access
                    </span>
                  </li>
                </ol>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Link
                href="mailto:support@spotix.com"
                className="group flex-1 inline-flex items-center justify-center gap-3 bg-gradient-to-r from-[#6b2fa5] to-purple-600 hover:from-[#5a2589] hover:to-[#6b2fa5] text-white font-bold py-3.5 px-6 rounded-lg transition-all duration-200 shadow-lg shadow-[#6b2fa5]/30 hover:shadow-xl hover:shadow-[#6b2fa5]/40 hover:-translate-y-0.5 active:translate-y-0"
              >
                <Mail className="w-5 h-5" />
                <span>Contact Support</span>
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
              
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex-1 inline-flex items-center justify-center gap-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 px-6 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-slate-200"
              >
                {isLoggingOut ? (
                  <>
                    <div className="w-5 h-5 border-2 border-slate-400/30 border-t-slate-700 rounded-full animate-spin" />
                    <span>Logging out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-5 h-5" />
                    <span>Logout</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center space-y-3">
            <p className="text-sm text-slate-600">
              Looking for the customer app?{" "}
              <Link 
                href="https://spotix.com" 
                className="text-[#6b2fa5] hover:underline font-semibold"
              >
                Visit Spotix
              </Link>
            </p>
            
            <p className="text-xs text-slate-500">
              If you believe this is an error, please{" "}
              <Link 
                href="mailto:support@spotix.com" 
                className="text-[#6b2fa5] hover:underline font-semibold"
              >
                contact our support team
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}