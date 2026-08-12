"use client"

/**
 * app/polls/[pollId]/settings/components/PollTeamPanel.tsx
 *
 * Team management for a single poll. Imported into the Poll Settings page
 * — visible to the poll creator AND to any active team member (see
 * app/polls/[pollId]/settings/page.tsx), which passes down `isOwner` and
 * `canAddAdmin` so this panel can gate itself:
 *
 *   - Everyone on the team can see the member list.
 *   - "Add" is only shown to the creator, or to a member the creator has
 *     granted the canAddAdmin privilege.
 *   - Dismissing a team member, and granting/revoking canAddAdmin on a
 *     member's card, stay creator-only regardless of canAddAdmin — a
 *     member can never escalate themselves or anyone else.
 *
 * Being on the team grants the same read/edit surface as the creator —
 * command center, edit page, vote stats/entries, and this Settings page —
 * minus initiating a payout (creator-only, always) and minus adding new
 * team members (creator, or a member with canAddAdmin).
 *
 * Mirrors the lookup → confirm → add flow in app/teams/page.tsx
 * (AddCollaboratorPanel), simplified for the poll team model.
 */

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Users, UserPlus, Search, Loader2, X, Check, AlertCircle,
  RefreshCw, ShieldOff, Plus, ShieldCheck, Shield,
} from "lucide-react"
import { authFetch } from "@/lib/auth-client"

interface PollTeamMember {
  collaborationId: string
  collaboratorId: string
  collaboratorEmail: string
  displayName: string
  addedAt: string | null
  canAddAdmin: boolean
  isYou: boolean
}

interface LookedUpUser {
  userId: string
  email: string
  fullName: string
  username: string
}

// ── Add member panel ──────────────────────────────────────────────────────────
function AddPollTeamMember({
  pollId,
  onAdded,
  onCancel,
}: {
  pollId: string
  onAdded: (member: PollTeamMember) => void
  onCancel: () => void
}) {
  const [email, setEmail]                 = useState("")
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookedUp, setLookedUp]           = useState<LookedUpUser | null>(null)
  const [lookupError, setLookupError]     = useState("")
  const [saving, setSaving]               = useState(false)
  const [saveError, setSaveError]         = useState("")

  async function handleLookup() {
    if (!email.trim()) return
    setLookupLoading(true)
    setLookedUp(null)
    setLookupError("")
    try {
      const res = await authFetch(
        `/api/whoru?type=email&value=${encodeURIComponent(email.trim().toLowerCase())}&limit=1`
      )
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setLookupError(d.error ?? "No Spotix account found with that email.")
        return
      }
      setLookedUp(await res.json())
    } catch {
      setLookupError("Network error. Please try again.")
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleAdd() {
    if (!lookedUp) return
    setSaving(true)
    setSaveError("")
    try {
      const res = await authFetch("/api/polls/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, collaboratorEmail: email.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error ?? "Failed to add team member."); return }
      onAdded({
        collaborationId: data.collaborationId,
        collaboratorId: data.collaboratorId,
        collaboratorEmail: email.trim().toLowerCase(),
        displayName: data.displayName,
        addedAt: new Date().toISOString(),
        canAddAdmin: false,
        isYou: false,
      })
    } catch {
      setSaveError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2 text-sm">
          <UserPlus size={16} className="text-[#6b2fa5]" />
          Add Poll Team Member
        </h3>
        <button onClick={onCancel} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
          <X size={15} />
        </button>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-700">Find by email</label>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setLookedUp(null); setLookupError("") }}
            onKeyDown={(e) => { if (e.key === "Enter") handleLookup() }}
            placeholder="teammate@example.com"
            className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]/30 focus:border-[#6b2fa5]"
          />
          <button
            onClick={handleLookup}
            disabled={!email.trim() || lookupLoading}
            className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {lookupLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Find
          </button>
        </div>
        {lookupError && (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertCircle size={13} /> {lookupError}
          </p>
        )}
      </div>

      {lookedUp && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold text-sm flex-shrink-0">
            {(lookedUp.fullName || lookedUp.username || "?").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900">{lookedUp.fullName || lookedUp.username}</p>
            <p className="text-xs text-slate-500 truncate">{lookedUp.email}</p>
          </div>
          <Check size={18} className="text-green-600 flex-shrink-0" />
        </div>
      )}

      {lookedUp && (
        <div className="rounded-xl bg-purple-50 border border-purple-200 p-3.5 text-xs text-purple-700 leading-relaxed">
          They'll get the same view as you across the command center, Edit page, Settings, and Payout page —
          updating poll info, schedule, contestants/categories, and vote-stats visibility. They can't initiate a
          payout, and can't add further team members unless you grant them that separately.
        </div>
      )}

      {saveError && (
        <p className="text-sm text-red-600 flex items-center gap-1.5">
          <AlertCircle size={13} /> {saveError}
        </p>
      )}

      {lookedUp && (
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleAdd} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#6b2fa5] text-white text-sm font-semibold hover:bg-[#5a2589] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Add to Poll Team
          </button>
        </div>
      )}
    </div>
  )
}

// ── Member card ────────────────────────────────────────────────────────────────
function PollTeamMemberCard({
  member,
  isOwner,
  onRemove,
  onToggleCanAddAdmin,
}: {
  member: PollTeamMember
  /** Only the poll creator can dismiss a member or toggle their
   *  canAddAdmin privilege — a member (even one with canAddAdmin) never
   *  sees these controls on any card, including their own. */
  isOwner: boolean
  onRemove: (collaborationId: string) => void
  onToggleCanAddAdmin: (collaborationId: string, next: boolean) => void
}) {
  const [removing, setRemoving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [togglingAdmin, setTogglingAdmin] = useState(false)

  async function handleRemove() {
    setRemoving(true)
    try {
      const res = await authFetch("/api/polls/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collaborationId: member.collaborationId }),
      })
      if (res.ok) { onRemove(member.collaborationId) }
      else {
        const d = await res.json().catch(() => ({}))
        alert(d.error ?? "Failed to remove team member.")
        setShowConfirm(false)
      }
    } catch { alert("Network error.") }
    finally { setRemoving(false) }
  }

  async function handleToggleCanAddAdmin() {
    const next = !member.canAddAdmin
    setTogglingAdmin(true)
    try {
      const res = await authFetch("/api/polls/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collaborationId: member.collaborationId, canAddAdmin: next }),
      })
      if (res.ok) { onToggleCanAddAdmin(member.collaborationId, next) }
      else {
        const d = await res.json().catch(() => ({}))
        alert(d.error ?? "Failed to update this privilege.")
      }
    } catch { alert("Network error.") }
    finally { setTogglingAdmin(false) }
  }

  if (showConfirm) {
    return (
      <div className="flex flex-col gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm flex-shrink-0">
            {(member.displayName || member.collaboratorEmail).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 text-sm truncate">{member.displayName}</p>
            <p className="text-xs text-red-600">Dismiss from this poll's team?</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowConfirm(false)}
            disabled={removing}
            className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors"
          >
            Keep
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {removing ? <Loader2 size={13} className="animate-spin" /> : <ShieldOff size={13} />}
            {removing ? "Dismissing..." : "Dismiss"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 p-3.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6b2fa5] to-purple-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {(member.displayName || member.collaboratorEmail).charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-semibold text-slate-900 text-sm truncate">{member.displayName}</p>
          {member.isYou && (
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">You</span>
          )}
          {member.canAddAdmin && (
            <span className="flex items-center gap-1 text-[10px] bg-purple-100 text-[#6b2fa5] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
              <ShieldCheck size={10} /> Can add teammates
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate">{member.collaboratorEmail}</p>
      </div>

      {isOwner && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleToggleCanAddAdmin}
            disabled={togglingAdmin}
            className={`p-1.5 rounded-lg transition-all disabled:opacity-50 ${
              member.canAddAdmin
                ? "text-[#6b2fa5] bg-[#6b2fa5]/10 hover:bg-[#6b2fa5]/20"
                : "text-slate-400 hover:text-[#6b2fa5] hover:bg-[#6b2fa5]/10"
            }`}
            title={member.canAddAdmin ? "Revoke ability to add teammates" : "Allow this member to add teammates"}
          >
            {togglingAdmin ? <Loader2 size={15} className="animate-spin" /> : member.canAddAdmin ? <ShieldCheck size={15} /> : <Shield size={15} />}
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={removing}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
            title="Dismiss from poll team"
          >
            <ShieldOff size={15} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function PollTeamPanel({
  pollId,
  isOwner,
  canAddAdmin,
}: {
  pollId: string
  /** True for the poll creator. Gates dismiss + the canAddAdmin toggle on
   *  every member card, regardless of the requester's own canAddAdmin. */
  isOwner: boolean
  /** True for the creator, or for a member the creator has granted the
   *  privilege to. Gates whether the "Add" button/panel shows at all. */
  canAddAdmin: boolean
}) {
  const [members, setMembers]   = useState<PollTeamMember[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState("")
  const [showAdd, setShowAdd]   = useState(false)

  const canAdd = isOwner || canAddAdmin

  const fetchMembers = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const res  = await authFetch(`/api/polls/team?pollId=${pollId}&action=list`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to load poll team."); return }
      setMembers(data.members ?? [])
    } catch { setError("Network error loading poll team.") }
    finally { setLoading(false) }
  }, [pollId])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  function handleAdded(member: PollTeamMember) {
    setMembers((prev) => [member, ...prev])
    setShowAdd(false)
  }

  function handleRemoved(collaborationId: string) {
    setMembers((prev) => prev.filter((m) => m.collaborationId !== collaborationId))
  }

  function handleToggleCanAddAdmin(collaborationId: string, next: boolean) {
    setMembers((prev) => prev.map((m) => m.collaborationId === collaborationId ? { ...m, canAddAdmin: next } : m))
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
          <Users className="w-4 h-4 text-[#6b2fa5]" /> Poll Team
        </h2>
        {!showAdd && (
          <div className="flex items-center gap-1.5">
            <button onClick={fetchMembers} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Refresh">
              <RefreshCw size={14} />
            </button>
            {canAdd && (
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6b2fa5] text-white rounded-lg text-xs font-semibold hover:bg-[#5a2589] transition-colors">
                <Plus size={13} /> Add
              </button>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-5">
        {isOwner
          ? "Team members get the same view as you across the command center, Edit, Settings, and Payout pages. They can't initiate a payout, and can't add teammates unless you grant that below."
          : canAdd
          ? "You've been given permission to add teammates to this poll. Only the poll creator can dismiss a member or grant/revoke that permission."
          : "You're on this poll's team. Only the poll creator can add or dismiss teammates, or grant that permission to someone else."}
      </p>

      {showAdd && canAdd && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 mb-4">
          <AddPollTeamMember pollId={pollId} onAdded={handleAdded} onCancel={() => setShowAdd(false)} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={22} className="animate-spin text-[#6b2fa5]" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Failed to load</p>
            <p className="text-sm text-red-600">{error}</p>
            {error.toLowerCase().includes("collaboration") && (
              <Link href="/profile" className="text-xs underline text-red-600 mt-1 inline-block">Go to Profile Settings</Link>
            )}
            <button onClick={fetchMembers} className="text-xs underline text-red-600 mt-1 ml-3">Retry</button>
          </div>
        </div>
      ) : members.length === 0 && !showAdd ? (
        <div className="text-center py-8 space-y-2">
          <div className="w-12 h-12 rounded-full bg-purple-50 border border-purple-200 flex items-center justify-center mx-auto">
            <Users size={20} className="text-purple-400" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No team members yet</p>
          <p className="text-xs text-slate-500">
            {canAdd ? "Add a team mate to help manage this poll." : "The poll creator hasn't added any teammates yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {members.map((m) => (
            <PollTeamMemberCard
              key={m.collaborationId}
              member={m}
              isOwner={isOwner}
              onRemove={handleRemoved}
              onToggleCanAddAdmin={handleToggleCanAddAdmin}
            />
          ))}
        </div>
      )}
    </div>
  )
}
