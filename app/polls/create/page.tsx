"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Loader2, ChevronLeft, ChevronRight, ArrowLeft, AlertCircle } from "lucide-react"
import { PollInfoStep } from "./components/PollInfoStep"
import { ScheduleStep } from "./components/ScheduleStep"
import { ContestantsStep } from "./components/ContestantsStep"
import { DraftBar } from "./components/DraftBar"
import { LoadDraftDialog } from "./components/LoadDraftDialog"
import { validateStep1, validateStep2, validateStep3, serializeCategory } from "./lib/validators"
import {
  emptyContestant, rehydrateContestant, rehydrateCategoryTree,
  type PollForm, type ContestantForm, type CategoryForm,
} from "./lib/factories"
import { useUnsavedChangesWarning } from "@/hooks/useUnsavedChangesWarning"
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog"

const STEPS = ["Poll Info", "Schedule & Pricing", "Contestants"] as const

const initialForm: PollForm = {
  pollName: "",
  pollDescription: "",
  pollStartDate: "",
  pollStartTime: "",
  pollEndDate: "",
  pollEndTime: "",
  pollPrice: 100,
  pollImagePreview: null,
  pollImageUrl: null,
  pollType: "single",
  buyerBearsBurden: true,
  statsVisible: true,
  contestantsTBD: false,
}

interface DraftPayload {
  form: PollForm
  contestants: ContestantForm[]
  categories: CategoryForm[]
  step: number
}

function CreatePollPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState<PollForm>(initialForm)
  const [contestants, setContestants] = useState<ContestantForm[]>([emptyContestant(), emptyContestant()])
  const [categories, setCategories] = useState<CategoryForm[]>([])

  // Dirty if the form differs from its defaults, or a contestant/category
  // has been added/named — covers the "leave without saving?" warning
  // (see item 8 of the UI renovation). The draft-save system above is a
  // separate, opt-in convenience; this is the safety net for anyone who
  // hasn't saved a draft yet.
  const isDirty =
    JSON.stringify(form) !== JSON.stringify(initialForm) ||
    contestants.some((c) => c.name.trim() !== "") ||
    categories.length > 0
  const { showConfirmDialog, confirmLeave, cancelLeave, guardNavigation } = useUnsavedChangesWarning(isDirty)

  const [imageUploading, setImageUploading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Draft state ────────────────────────────────────────────────────────
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftSaving, setDraftSaving] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)

  const applyDraft = (payload: DraftPayload) => {
    setForm(payload.form)
    setContestants((payload.contestants ?? []).map(rehydrateContestant))
    setCategories(rehydrateCategoryTree(payload.categories ?? []))
    setStep(payload.step ?? 0)
  }

  const loadDraftById = async (id: string) => {
    setDraftLoading(true)
    setDraftError(null)
    try {
      const res = await fetch(`/api/polls/drafts/${id}`)
      const data = await res.json()
      if (!res.ok) { setDraftError(data.error || "Failed to load draft"); return }
      applyDraft(data.draft.data as DraftPayload)
      setDraftId(id)
      setDraftSavedAt(data.draft.updatedAt)
    } catch {
      setDraftError("An unexpected error occurred while loading the draft.")
    } finally {
      setDraftLoading(false)
    }
  }

  // Restore from ?draft=<id> on first load
  useEffect(() => {
    const fromUrl = searchParams.get("draft")
    if (fromUrl) loadDraftById(fromUrl)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const saveDraft = async () => {
    setDraftSaving(true)
    setDraftError(null)
    try {
      const res = await fetch("/api/polls/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draftId ?? undefined,
          kind: "poll",
          label: form.pollName || "Untitled poll",
          data: { form, contestants, categories, step } as DraftPayload,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setDraftError(data.error || "Failed to save draft"); return }
      setDraftId(data.draftId)
      setDraftSavedAt(data.updatedAt)
    } catch {
      setDraftError("An unexpected error occurred while saving the draft.")
    } finally {
      setDraftSaving(false)
    }
  }

  const discardDraftSilently = () => {
    if (!draftId) return
    fetch(`/api/polls/drafts/${draftId}?kind=poll`, { method: "DELETE" }).catch(() => {})
  }

  // ── Step navigation ──────────────────────────────────────────────────────
  const goNext = () => {
    const stepErrors =
      step === 0 ? validateStep1(form) :
      step === 1 ? validateStep2(form) :
      validateStep3(form, contestants, categories)

    if (stepErrors.length > 0) { setErrors(stepErrors); return }
    setErrors([])
    if (step < STEPS.length - 1) setStep(step + 1)
    else handleSubmit()
  }

  const goBack = () => {
    setErrors([])
    if (step > 0) setStep(step - 1)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)

    const payload: Record<string, any> = {
      pollName: form.pollName,
      pollImage: form.pollImageUrl,
      pollDescription: form.pollDescription,
      pollStartDate: form.pollStartDate,
      pollStartTime: form.pollStartTime,
      pollEndDate: form.pollEndDate,
      pollEndTime: form.pollEndTime,
      pollType: form.pollType,
      buyerBearsBurden: form.buyerBearsBurden,
      statsVisible: form.statsVisible,
      contestantsTBD: form.contestantsTBD,
    }

    if (form.contestantsTBD) {
      // Server also enforces this regardless of what's sent — see
      // api/polls/create/route.ts — but don't even bother serialising
      // whatever half-filled rows are sitting in local state.
      if (form.pollType === "single") { payload.pollPrice = form.pollPrice; payload.contestants = [] }
      else payload.categories = []
    } else if (form.pollType === "single") {
      payload.pollPrice = form.pollPrice
      payload.contestants = contestants.map((c) => ({
        contestantId: c.contestantId, name: c.name, image: c.imageUrl,
        imageType: c.imageType ?? "uploaded",
        imageSeed: c.imageType === "generated" ? c.contestantId : null,
      }))
    } else {
      payload.categories = categories.map(serializeCategory)
    }

    try {
      const res = await fetch("/api/polls/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) { setSubmitError(data.error || "Failed to create poll"); return }

      discardDraftSilently()
      router.push(`/polls/${data.pollId}`)
    } catch {
      setSubmitError("An unexpected error occurred. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-8">
      <UnsavedChangesDialog open={showConfirmDialog} onConfirm={confirmLeave} onCancel={cancelLeave} />
      <Link
        href="/polls"
        onClick={guardNavigation(() => router.push("/polls"))}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Polls
      </Link>

      <h1 className="text-2xl font-bold text-slate-900 mb-1">Create a Poll</h1>
      <p className="text-slate-500 text-sm mb-5">
        Looking to run open nominations first?{" "}
        <a href="/polls/create/nomination" className="text-[#6b2fa5] font-medium">Create a nomination poll →</a>
      </p>

      <DraftBar
        draftId={draftId}
        saving={draftSaving}
        lastSavedAt={draftSavedAt}
        onSave={saveDraft}
        onOpenLoadDialog={() => setShowLoadDialog(true)}
      />
      {draftError && (
        <p className="text-xs text-red-600 flex items-start gap-1.5 -mt-3 mb-4">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {draftError}
        </p>
      )}

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
              ${i === step ? "bg-[#6b2fa5] text-white" : i < step ? "bg-[#6b2fa5]/20 text-[#6b2fa5]" : "bg-slate-100 text-slate-400"}`}>
              {i + 1}
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${i < step ? "bg-[#6b2fa5]/40" : "bg-slate-200"}`} />}
          </div>
        ))}
      </div>
      <p className="text-sm font-semibold text-slate-700 mb-5">{STEPS[step]}</p>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm relative">
        {draftLoading && (
          <div className="absolute inset-0 bg-white/70 rounded-2xl flex items-center justify-center z-10">
            <Loader2 className="w-6 h-6 animate-spin text-[#6b2fa5]" />
          </div>
        )}

        {step === 0 && (
          <PollInfoStep form={form} onChange={setForm} uploading={imageUploading} setUploading={setImageUploading} />
        )}
        {step === 1 && <ScheduleStep form={form} onChange={setForm} />}
        {step === 2 && (
          <ContestantsStep
            pollType={form.pollType}
            contestants={contestants}
            setContestants={setContestants}
            contestantsTBD={form.contestantsTBD}
            onToggleTBD={(tbd) => setForm({ ...form, contestantsTBD: tbd })}
            categories={categories}
            setCategories={setCategories}
          />
        )}

        {errors.length > 0 && (
          <div className="mt-5 p-3 rounded-xl bg-red-50 border border-red-200 space-y-1">
            {errors.map((e, i) => (
              <p key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {e}
              </p>
            ))}
          </div>
        )}
        {submitError && (
          <div className="mt-5 p-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-xs text-red-600 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {submitError}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <button
          onClick={goBack}
          disabled={step === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={goNext}
          disabled={submitting || imageUploading}
          className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#6b2fa5] hover:bg-[#5a1f8a] disabled:opacity-60 transition-colors"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : step === STEPS.length - 1 ? "Create Poll" : "Next"}
          {!submitting && step < STEPS.length - 1 && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {showLoadDialog && (
        <LoadDraftDialog
          kind="poll"
          onClose={() => setShowLoadDialog(false)}
          onSelect={(id) => { setShowLoadDialog(false); loadDraftById(id) }}
        />
      )}
    </div>
  )
}

export default function CreatePollPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-[#6b2fa5]" /></div>}>
      <CreatePollPageInner />
    </Suspense>
  )
}
