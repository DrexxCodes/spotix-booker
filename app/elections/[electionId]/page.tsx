"use client"

/**
 * app/elections/[electionId]/page.tsx
 *
 * Election dashboard shell — fetches the election + offices once, then
 * renders whichever tab is active. Each tab is its own file under
 * ./components/ (OfficesTab, VotersTab, CandidatesTab, ResultsTab,
 * PayoutTab, LiveTallyChart) per the "very modular, broken down into
 * different files" ask.
 */

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { OfficesTab } from "./components/OfficesTab"
import { VotersTab } from "./components/VotersTab"
import { CandidatesTab } from "./components/CandidatesTab"
import { ResultsTab } from "./components/ResultsTab"
import { PayoutTab } from "./components/PayoutTab"
import { EditGraceControl } from "./components/EditGraceControl"

import { Skeleton } from "../components/Skeleton"

type Tab = "offices" | "voters" | "candidates" | "results" | "payout"

export default function ElectionDashboardPage() {
  const { electionId } = useParams<{ electionId: string }>()
  const [tab, setTab] = useState<Tab>("offices")
  const [election, setElection] = useState<any>(null)
  const [offices, setOffices] = useState<any[]>([])
  const [voterCount, setVoterCount] = useState(0)
  const [loading, setLoading] = useState(true)

  function reload() {
    setLoading(true)
    fetch(`/api/elections/${electionId}`)
      .then((r) => r.json())
      .then((d) => {
        setElection(d.election)
        setOffices(d.offices ?? [])
        setVoterCount(d.voterCount ?? 0)
      })
      .finally(() => setLoading(false))
  }

  useEffect(reload, [electionId])

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl overflow-x-hidden px-6 py-10">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-40" />
        <div className="mt-6 flex gap-4 border-b border-gray-200 pb-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-5 w-20" />
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </main>
    )
  }
  if (!election) return <main className="mx-auto max-w-4xl px-6 py-10 text-sm text-red-600">Election not found.</main>

  const TABS: { id: Tab; label: string }[] = [
    { id: "offices", label: "Offices" },
    { id: "voters", label: `Voters (${voterCount})` },
    { id: "candidates", label: "Candidates" },
    { id: "results", label: "Results" },
    { id: "payout", label: "Payout" },
  ]

  return (
    <main className="mx-auto max-w-4xl overflow-x-hidden px-6 py-10">
      <h1 className="text-2xl font-semibold text-gray-900">{election.name}</h1>
      <p className="mt-1 text-sm text-gray-500 capitalize">{election.status}{election.results_published && " · Results published"}</p>

      <div className="mt-3">
        <EditGraceControl electionId={electionId} initialDays={election.edit_grace_days ?? 0} />
      </div>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium ${
              tab === t.id ? "border-b-2 border-[#6b2fa5] text-[#6b2fa5]" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "offices" && <OfficesTab electionId={electionId} offices={offices} onChanged={reload} />}
        {tab === "voters" && <VotersTab electionId={electionId} />}
        {tab === "candidates" && <CandidatesTab electionId={electionId} offices={offices} />}
        {tab === "results" && <ResultsTab electionId={electionId} offices={offices} election={election} onPublished={reload} />}
        {tab === "payout" && <PayoutTab electionId={electionId} />}
      </div>
    </main>
  )
}
