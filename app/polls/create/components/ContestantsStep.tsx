"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { ContestantRow } from "./ContestantRow"
import { CategoryBlock } from "./CategoryBlock"
import { ImportNomineesDialog } from "./ImportNomineesDialog"
import { emptyContestant, emptyCategory, type ContestantForm, type CategoryForm } from "../lib/factories"
import { MAX_SINGLE_CONTESTANTS } from "@/lib/poll-config"

interface ContestantsStepProps {
  pollType: "single" | "group"
  contestants: ContestantForm[]
  setContestants: (c: ContestantForm[]) => void
  categories: CategoryForm[]
  setCategories: (c: CategoryForm[]) => void
}

export function ContestantsStep({ pollType, contestants, setContestants, categories, setCategories }: ContestantsStepProps) {
  // Which category (single-poll: "root", group-poll: a categoryId) is currently
  // requesting an import. null = dialog closed.
  const [importTarget, setImportTarget] = useState<string | null>(null)

  // ── Single poll ──────────────────────────────────────────────────────────
  if (pollType === "single") {
    const update = (i: number, c: ContestantForm) => {
      const next = [...contestants]; next[i] = c; setContestants(next)
    }
    const remove = (i: number) => setContestants(contestants.filter((_, idx) => idx !== i))
    const add = () => setContestants([...contestants, emptyContestant()])

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          {contestants.map((c, i) => (
            <ContestantRow key={i} contestant={c} index={i} folder="spotix/polls/contestants" onChange={(u) => update(i, u)} onRemove={() => remove(i)} removable={contestants.length > 2} />
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={add}
            disabled={contestants.length >= MAX_SINGLE_CONTESTANTS}
            className="flex items-center gap-1.5 text-sm font-medium text-[#6b2fa5] hover:bg-[#6b2fa5]/5 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" /> Add Contestant
          </button>
          <button
            onClick={() => setImportTarget("root")}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 border border-slate-300 hover:border-[#6b2fa5] hover:text-[#6b2fa5] px-3 py-1.5 rounded-lg transition-colors"
          >
            Import from Nominees
          </button>
        </div>

        {importTarget && (
          <ImportNomineesDialog
            onClose={() => setImportTarget(null)}
            onImport={(imported) => setContestants([...contestants, ...imported])}
          />
        )}
      </div>
    )
  }

  // ── Group poll ───────────────────────────────────────────────────────────
  const updateCategory = (i: number, c: CategoryForm) => {
    const next = [...categories]; next[i] = c; setCategories(next)
  }
  const removeCategory = (i: number) => setCategories(categories.filter((_, idx) => idx !== i))
  const addCategory = () => setCategories([...categories, emptyCategory()])

  // Recursively find a category by id (to append imported contestants into it)
  const injectImported = (cats: CategoryForm[], targetId: string, imported: ContestantForm[]): CategoryForm[] =>
    cats.map((cat) => {
      if (cat.categoryId === targetId) return { ...cat, contestants: [...cat.contestants, ...imported] }
      if (cat.subcategories.length > 0) return { ...cat, subcategories: injectImported(cat.subcategories, targetId, imported) }
      return cat
    })

  return (
    <div className="space-y-4">
      {categories.map((cat, i) => (
        <CategoryBlock
          key={cat.categoryId}
          category={cat}
          depth={0}
          onChange={(u) => updateCategory(i, u)}
          onRemove={() => removeCategory(i)}
          onOpenImport={(targetCategoryId) => setImportTarget(targetCategoryId)}
          eventImageFolder="spotix/polls/contestants"
        />
      ))}

      <button onClick={addCategory} className="flex items-center gap-1.5 text-sm font-medium text-[#6b2fa5] hover:bg-[#6b2fa5]/5 px-3 py-2 rounded-lg border border-dashed border-[#6b2fa5]/40 transition-colors">
        <Plus className="w-3.5 h-3.5" /> Add Category
      </button>

      {importTarget && (
        <ImportNomineesDialog
          onClose={() => setImportTarget(null)}
          onImport={(imported) => setCategories(injectImported(categories, importTarget, imported))}
        />
      )}
    </div>
  )
}
