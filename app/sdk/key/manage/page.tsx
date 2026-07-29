// app/sdk/key/manage/page.tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  KeyRound, Plus, ArrowLeft, Trash2, Loader2, ShieldCheck, ShieldAlert,
  Globe, Lock, Edit2, X, Check, AlertTriangle, BookOpen, PlayCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { authFetch } from "@/lib/auth-client"

interface ApiKeyRow {
  keyHash: string
  label: string
  keyPreview: string
  accessType: "tied" | "general"
  status: "active" | "banned"
  orgKey: string | null
  rateLimit: { rpm: number; rpd: number }
  usage: { rpm: number; rpd: number }
  generalAccessRequest: { status: string; reason: string } | null
  createdAt: string | null
}

export default function SdkKeyManagePage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [editingOrgKey, setEditingOrgKey] = useState<string | null>(null)
  const [orgKeyDraft, setOrgKeyDraft] = useState("")
  const [requestingUpgrade, setRequestingUpgrade] = useState<string | null>(null)
  const [upgradeReason, setUpgradeReason] = useState("")

  const loadKeys = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch("/api/sdk/keys")
      const data = await res.json()
      if (data.success) setKeys(data.keys)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  async function revokeKey(keyHash: string) {
    if (!confirm("Revoke this API key? Any integration using it will stop working immediately.")) return
    setBusyKey(keyHash)
    try {
      await authFetch(`/api/sdk/keys/${keyHash}`, { method: "DELETE" })
      setKeys((prev) => prev.filter((k) => k.keyHash !== keyHash))
    } finally {
      setBusyKey(null)
    }
  }

  async function saveOrgKey(keyHash: string) {
    setBusyKey(keyHash)
    try {
      const res = await authFetch(`/api/sdk/keys/${keyHash}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgKey: orgKeyDraft.trim() || null }),
      })
      const data = await res.json()
      if (data.success) {
        setKeys((prev) => prev.map((k) => (k.keyHash === keyHash ? { ...k, orgKey: orgKeyDraft.trim() || null } : k)))
        setEditingOrgKey(null)
      }
    } finally {
      setBusyKey(null)
    }
  }

  async function submitUpgradeRequest(keyHash: string) {
    if (!upgradeReason.trim()) return
    setBusyKey(keyHash)
    try {
      const res = await authFetch(`/api/sdk/keys/${keyHash}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestGeneralAccess: { reason: upgradeReason.trim() } }),
      })
      const data = await res.json()
      if (data.success) {
        setKeys((prev) =>
          prev.map((k) =>
            k.keyHash === keyHash
              ? { ...k, generalAccessRequest: { status: "pending", reason: upgradeReason.trim() } }
              : k
          )
        )
        setRequestingUpgrade(null)
        setUpgradeReason("")
      }
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl xl:max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#6b2fa5] mb-3">
              <ArrowLeft size={15} /> Back to dashboard
            </Link>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <KeyRound size={20} className="text-[#6b2fa5]" /> API Keys
            </h1>
            <p className="text-sm text-gray-500 mt-1">500 requests/min · 1,000 requests/day per key, by default.</p>
          </div>
          <Link href="/sdk/setup">
            <Button className="inline-flex items-center gap-1.5">
              <Plus size={16} /> New key
            </Button>
          </Link>
        </div>

        {/* Docs & Playground guidance */}
        <div className="bg-[#6b2fa5]/5 rounded-2xl p-5 border-2 border-[#6b2fa5]/15 flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-[#6b2fa5]/15 shrink-0">
              <BookOpen size={18} className="text-[#6b2fa5]" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Not sure where to start?</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Read the docs to see available endpoints and auth, or jump into the playground to try live
                requests with a key before you integrate.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/sdk/v1/docs">
              <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#6b2fa5]/25 bg-white text-[#6b2fa5] text-xs font-semibold hover:bg-[#6b2fa5]/10 transition-colors">
                <BookOpen size={13} /> Read the docs
              </button>
            </Link>
            <Link href="/sdk/v1/playground">
              <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#6b2fa5] text-white text-xs font-semibold hover:bg-[#5a2589] transition-colors shadow-sm shadow-[#6b2fa5]/20">
                <PlayCircle size={13} /> Try the playground
              </button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
            <Loader2 size={22} className="animate-spin" />
            <p className="text-sm text-gray-500">We are getting information about your keys…</p>
          </div>
        ) : keys.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <KeyRound size={28} className="mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 mb-4">You haven&apos;t created any API keys yet.</p>
            <Link href="/sdk/setup">
              <Button>Create your first key</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {keys.map((key) => (
              <div key={key.keyHash} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm h-fit">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{key.label}</h3>
                      {key.status === "banned" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 rounded-full px-2 py-0.5">
                          <ShieldAlert size={11} /> Banned
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 rounded-full px-2 py-0.5">
                          <ShieldCheck size={11} /> Active
                        </span>
                      )}
                      <span
                        className={
                          "inline-flex items-center gap-1 text-xs font-medium rounded-full px-2 py-0.5 " +
                          (key.accessType === "general" ? "text-[#6b2fa5] bg-[#6b2fa5]/10" : "text-gray-600 bg-gray-100")
                        }
                      >
                        {key.accessType === "general" ? <Globe size={11} /> : <Lock size={11} />}
                        {key.accessType === "general" ? "General access" : "Tied access"}
                      </span>
                    </div>
                    <code className="text-xs text-gray-400 font-mono">spk_live_{key.keyPreview}</code>
                  </div>

                  <button
                    onClick={() => revokeKey(key.keyHash)}
                    disabled={busyKey === key.keyHash}
                    className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-40"
                    aria-label="Revoke key"
                  >
                    {busyKey === key.keyHash ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div className="bg-gray-50 rounded-xl px-3 py-2">
                    <div className="text-gray-400">This minute</div>
                    <div className="font-semibold text-gray-800">
                      {key.usage.rpm} / {key.rateLimit.rpm} rpm
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-3 py-2">
                    <div className="text-gray-400">Today</div>
                    <div className="font-semibold text-gray-800">
                      {key.usage.rpd} / {key.rateLimit.rpd} rpd
                    </div>
                  </div>
                </div>

                {/* orgKey */}
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="text-gray-400">Org key:</span>
                  {editingOrgKey === key.keyHash ? (
                    <>
                      <Input
                        value={orgKeyDraft}
                        onChange={(e) => setOrgKeyDraft(e.target.value)}
                        placeholder="e.g. main-org"
                        className="h-7 text-xs px-2 py-1 w-40"
                      />
                      <button onClick={() => saveOrgKey(key.keyHash)} className="text-green-600">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditingOrgKey(null)} className="text-gray-400">
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-gray-700 font-mono">{key.orgKey ?? "none"}</span>
                      <button
                        onClick={() => {
                          setEditingOrgKey(key.keyHash)
                          setOrgKeyDraft(key.orgKey ?? "")
                        }}
                        className="text-gray-400 hover:text-[#6b2fa5]"
                      >
                        <Edit2 size={12} />
                      </button>
                    </>
                  )}
                </div>

                {/* General access upgrade */}
                {key.accessType === "tied" && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {key.generalAccessRequest?.status === "pending" ? (
                      <div className="flex items-center gap-1.5 text-xs text-amber-600">
                        <AlertTriangle size={12} /> General access request pending admin review
                      </div>
                    ) : key.generalAccessRequest?.status === "denied" ? (
                      <div className="text-xs text-red-500">Previous General access request was denied.</div>
                    ) : requestingUpgrade === key.keyHash ? (
                      <div className="space-y-2">
                        <Textarea
                          value={upgradeReason}
                          onChange={(e) => setUpgradeReason(e.target.value)}
                          placeholder="Business reason for needing cross-event (General) access…"
                          rows={2}
                          className="text-xs"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={() => submitUpgradeRequest(key.keyHash)}
                            disabled={busyKey === key.keyHash}
                            className="text-xs px-3 py-1.5"
                          >
                            Submit request
                          </Button>
                          <Button variant="ghost" onClick={() => setRequestingUpgrade(null)} className="text-xs px-3 py-1.5">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRequestingUpgrade(key.keyHash)}
                        className="text-xs text-[#6b2fa5] hover:underline"
                      >
                        Apply for General access →
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
