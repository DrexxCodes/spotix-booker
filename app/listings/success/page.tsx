"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle, Plus, Settings, Sparkles } from "lucide-react"
// import { Nav } from "@/components/nav"

export default function SuccessPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-100 flex items-center justify-center p-4 overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* <Nav /> */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#6b2fa5]/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-300/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative bg-white rounded-3xl shadow-2xl p-12 max-w-lg w-full text-center animate-in zoom-in-95 fade-in duration-700">
        {/* Success Icon with Animation */}
        <div className="relative inline-flex mb-6">
          {/* Pulsing rings */}
          <div className="absolute inset-0 -m-4 rounded-full bg-green-100 animate-ping opacity-75"></div>
          <div className="absolute inset-0 -m-2 rounded-full bg-green-200 animate-pulse"></div>
          
          {/* Main icon */}
          <div className="relative w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50 animate-bounce-slow">
            <CheckCircle className="w-14 h-14 text-white" strokeWidth={3} />
          </div>
          
          {/* Sparkles */}
          <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-400 animate-pulse" />
          <Sparkles className="absolute -bottom-2 -left-2 w-6 h-6 text-yellow-300 animate-pulse delay-300" />
        </div>

        {/* Heading */}
        <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 via-[#6b2fa5] to-green-600 bg-clip-text text-transparent mb-3 animate-in slide-in-from-top-4 duration-700 delay-200">
          Product Created!
        </h1>
        
        {/* Subheading */}
        <p className="text-gray-600 text-lg mb-8 leading-relaxed animate-in slide-in-from-top-6 duration-700 delay-300">
          Your merchandise listing has been successfully created and is now live for everyone to see.
        </p>

        {/* Success Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8 animate-in slide-in-from-bottom-4 duration-700 delay-400">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
            <div className="text-2xl font-bold text-green-600">✓</div>
            <div className="text-xs text-gray-600 mt-1 font-medium">Listed</div>
          </div>
          <div className="bg-gradient-to-br from-[#6b2fa5]/10 to-[#8b3fc5]/10 rounded-xl p-4 border border-[#6b2fa5]/30">
            <div className="text-2xl font-bold text-[#6b2fa5]">🚀</div>
            <div className="text-xs text-gray-600 mt-1 font-medium">Live Now</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
            <div className="text-2xl font-bold text-blue-600">👀</div>
            <div className="text-xs text-gray-600 mt-1 font-medium">Visible</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 animate-in slide-in-from-bottom-6 duration-700 delay-500">
          <Link
            href="/listings"
            className="group block w-full px-6 py-4 bg-gradient-to-r from-[#6b2fa5] to-[#8b3fc5] hover:from-[#5a2789] hover:to-[#6b2fa5] text-white rounded-xl transition-all duration-200 font-bold shadow-lg shadow-[#6b2fa5]/30 hover:shadow-xl hover:shadow-[#6b2fa5]/40 hover:-translate-y-0.5 active:translate-y-0"
          >
            <span className="flex items-center justify-center gap-2">
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
              Create Another Product
            </span>
          </Link>
          
          <Link
            href="/listings/manage"
            className="group block w-full px-6 py-4 border-2 border-[#6b2fa5] text-[#6b2fa5] hover:bg-[#6b2fa5] hover:text-white rounded-xl transition-all duration-200 font-bold hover:shadow-lg"
          >
            <span className="flex items-center justify-center gap-2">
              <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform duration-200" />
              Manage Products
            </span>
          </Link>

          <button
            onClick={() => router.push("/dashboard")}
            className="block w-full px-6 py-3 text-gray-600 hover:text-gray-900 rounded-xl transition-all duration-200 font-medium hover:bg-gray-100"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Confetti decoration */}
        <div className="absolute top-0 left-0 right-0 flex justify-center gap-2 -mt-4 pointer-events-none">
          <div className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce delay-100"></div>
          <div className="w-3 h-3 bg-[#6b2fa5] rounded-full animate-bounce delay-200"></div>
          <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce delay-300"></div>
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }

        .delay-100 {
          animation-delay: 100ms;
        }

        .delay-200 {
          animation-delay: 200ms;
        }

        .delay-300 {
          animation-delay: 300ms;
        }

        .delay-1000 {
          animation-delay: 1000ms;
        }
      `}</style>
    </div>
  )
}