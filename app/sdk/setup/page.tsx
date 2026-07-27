// app/sdk/setup/page.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { KeyRound, ArrowLeft, Copy, Check, AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authFetch } from "@/lib/auth-client"

export default function SdkSetupPage() {
  const router = useRouter()
  const [label, setLabel] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleCreate() {
    if (!label.trim()) {
      setError("Give this key a label so you can recognize it later.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch("/api/sdk/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to create API key")
        return
      }
      setCreatedKey(data.apiKey)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  function copyKey() {
    if (!createdKey) return
    navigator.clipboard.writeText(createdKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-xl mx-auto px-4 py-10">
        <Link
          href="/sdk/key/manage"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#6b2fa5] mb-6"
        >
          <ArrowLeft size={15} /> Back to your keys
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-[#6b2fa5]/10 flex items-center justify-center">
            <KeyRound size={20} className="text-[#6b2fa5]" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Create a new API key</h1>
        </div>
        <p className="text-sm text-gray-500 mb-8">
          New keys default to <span className="font-medium text-gray-700">Tied access</span> — scoped only to
          events you own. You can apply for General access later from the key management page.
        </p>

        {!createdKey ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Label</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Production key, Mobile app integration"
                maxLength={60}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button onClick={handleCreate} disabled={loading} className="w-full">
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Generate API key"}
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>Copy this key now. For your security, we won&apos;t show it again.</span>
            </div>

            <div className="flex items-center gap-2 bg-gray-900 rounded-xl px-4 py-3">
              <code className="flex-1 text-sm text-green-400 font-mono break-all">{createdKey}</code>
              <button
                onClick={copyKey}
                className="shrink-0 text-gray-300 hover:text-white transition-colors"
                aria-label="Copy API key"
              >
                {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
              </button>
            </div>

            <Button onClick={() => router.push("/sdk/key/manage")} className="w-full">
              Done — go to key management
            </Button>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-6">
          Need the full API reference? See{" "}
          <Link href="/sdk/v1/docs" className="text-[#6b2fa5] hover:underline">
            the docs
          </Link>{" "}
          or try requests live in the{" "}
          <Link href="/sdk/v1/playground" className="text-[#6b2fa5] hover:underline">
            playground
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
