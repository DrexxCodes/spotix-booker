"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { auth } from "@/lib/firebase"
import { signInWithEmailAndPassword } from "firebase/auth"
import { Preloader } from "@/components/preloader"
import { ParticlesBackground } from "@/components/particles-background"
import { useRouter } from "next/navigation"
import { Mail, Lock, AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react"
import Image from "next/image"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      router.push(`/`)
    } catch (err: any) {
      console.error("Login error:", err)
      setError(err.message || "Failed to login. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Preloader isLoading={loading} />
      <ParticlesBackground />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-slate-100 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in-95 duration-700">
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
            
            <div className="space-y-2">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-[#6b2fa5] via-[#8b3fc5] to-[#6b2fa5] bg-clip-text text-transparent">
                Spotix Booker
              </h1>
              <p className="text-lg text-slate-600">Sign in to your booker dashboard</p>
            </div>
          </div>

          {/* Login Form Card */}
          <div className="bg-white rounded-2xl shadow-xl border-2 border-slate-200 p-8 space-y-6">
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-12 pr-4 py-3 rounded-lg border-2 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-3 rounded-lg border-2 border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6b2fa5] focus:border-[#6b2fa5] transition-all duration-200"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#6b2fa5] transition-colors p-1 rounded-md hover:bg-slate-100"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <div className="relative w-5 h-5">
                      <Eye 
                        className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${
                          showPassword 
                            ? 'opacity-0 scale-0 rotate-180' 
                            : 'opacity-100 scale-100 rotate-0'
                        }`}
                      />
                      <EyeOff 
                        className={`absolute inset-0 w-5 h-5 transition-all duration-300 ${
                          showPassword 
                            ? 'opacity-100 scale-100 rotate-0' 
                            : 'opacity-0 scale-0 -rotate-180'
                        }`}
                      />
                    </div>
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-800 text-sm animate-in slide-in-from-top-2 duration-300">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Login Failed</p>
                    <p>{error}</p>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="group w-full inline-flex items-center justify-center gap-3 bg-gradient-to-r from-[#6b2fa5] to-purple-600 hover:from-[#5a2589] hover:to-[#6b2fa5] text-white font-bold py-3.5 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#6b2fa5]/30 hover:shadow-xl hover:shadow-[#6b2fa5]/40 hover:-translate-y-0.5 active:translate-y-0"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer Note */}
          <p className="text-center text-xs text-slate-500">
            By signing in, you agree to our{" "}
            <Link href="/terms" className="text-[#6b2fa5] hover:underline font-semibold">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-[#6b2fa5] hover:underline font-semibold">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}