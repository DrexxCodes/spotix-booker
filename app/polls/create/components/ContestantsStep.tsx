"use client"

import { useState } from "react"
import { Plus, Clock3, Layers } from "lucide-react"
import { ContestantRow } from "./ContestantRow"
import { CategoryBlock } from "./CategoryBlock"
import { ImportNomineesDialog } from "./ImportNomineesDialog"
import { ImportNomineesCategoryDialog } from "./ImportNomineesCategoryDialog"
import { emptyContestant, emptyCategory, type ContestantForm, type CategoryForm } from "../lib/factories"
import { MAX_SINGLE_CONTESTANTS } from "@/lib/poll-config"

interface ContestantsStepProps {
  pollType: "single" | "group"
  contestants: ContestantForm[]
  setContestants: (c: ContestantForm[]) => void
  categories: CategoryForm[]
  setCategories: (c: CategoryForm[]) => void
  contestantsTBD: boolean
  onToggleTBD: (tbd: boolean) => void
}

export function ContestantsStep({
  pollType, contestants, setContestants, categories, setCategories, contestantsTBD, onToggleTBD,
}: ContestantsStepProps) {
  // Which category (single-poll: "root", group-poll: a categoryId) is currently
  // requesting an import. null = dialog closed.
  const [importTarget, setImportTarget] = useState<string | null>(null)

  // Same idea, but for the whole-category importer (group polls only).
  // "root" = top-level category list, otherwise a categoryId whose
  // subcategories slot should receive the imported categories.
  const [importCategoriesTarget, setImportCategoriesTarget] = useState<string | null>(null)

  const tbdToggle = (
    <label className="flex items-start gap-3 bg-purple-50 border border-purple-100 rounded-xl p-4 cursor-pointer select-none mb-4">
      <input
        type="checkbox"
        checked={contestantsTBD}
        onChange={(e) => onToggleTBD(e.target.checked)}
        className="w-4 h-4 mt-0.5 accent-[#6b2fa5] flex-shrink-0"
      />
      <span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <Clock3 className="w-3.5 h-3.5 text-[#6b2fa5]" /> Contestants TBD
        </span>
        <span className="block text-xs text-slate-500 mt-0.5">
          Publish this poll now with just the name and image, and add real contestants later —
          e.g. once a linked nomination poll closes. It won't show as votable to visitors until
          you do; the public page shows "Voting Poll Coming Soon" in the meantime.
        </span>
      </span>
    </label>
  )

  if (contestantsTBD) {
    return (
      <div className="space-y-4">
        {tbdToggle}
        <div className="text-center py-10 bg-white/50 rounded-2xl border-2 border-dashed border-slate-300">
          <Clock3 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm font-medium">
            No contestants to set up right now — you're good to publish.
          </p>
          <p className="text-slate-400 text-xs mt-1">
            Come back to this poll's Edit page once you're ready to add the real lineup.
          </p>
        </div>
      </div>
    )
  }

  // ── Single poll ──────────────────────────────────────────────────────────
  if (pollType === "single") {
    const update = (i: number, c: ContestantForm) => {
      const next = [...contestants]; next[i] = c; setContestants(next)
    }
    const remove = (i: number) => setContestants(contestants.filter((_, idx) => idx !== i))
    const add = () => setContestants([...contestants, emptyContestant()])

    return (
      <div className="space-y-4">
        {tbdToggle}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
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

  // Recursively find a category by id (to append imported *categories* into
  // its subcategories slot — used for nested group-poll structures).
  const injectImportedCategories = (cats: CategoryForm[], targetId: string, imported: CategoryForm[]): CategoryForm[] =>
    cats.map((cat) => {
      if (cat.categoryId === targetId) return { ...cat, subcategories: [...cat.subcategories, ...imported] }
      if (cat.subcategories.length > 0) return { ...cat, subcategories: injectImportedCategories(cat.subcategories, targetId, imported) }
      return cat
    })

  return (
    <div className="space-y-4">
      {tbdToggle}
      {categories.map((cat, i) => (
        <CategoryBlock
          key={cat.categoryId}
          category={cat}
          depth={0}
          onChange={(u) => updateCategory(i, u)}
          onRemove={() => removeCategory(i)}
          onOpenImport={(targetCategoryId) => setImportTarget(targetCategoryId)}
          onOpenImportCategories={(targetCategoryId) => setImportCategoriesTarget(targetCategoryId)}
          eventImageFolder="spotix/polls/contestants"
        />
      ))}

      <div className="flex flex-wrap gap-2">
        <button onClick={addCategory} className="flex items-center gap-1.5 text-sm font-medium text-[#6b2fa5] hover:bg-[#6b2fa5]/5 px-3 py-2 rounded-lg border border-dashed border-[#6b2fa5]/40 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Category
        </button>
        <button
          onClick={() => setImportCategoriesTarget("root")}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#6b2fa5] px-3 py-2 rounded-lg border border-dashed border-slate-300 hover:border-[#6b2fa5] transition-colors"
        >
          <Layers className="w-3.5 h-3.5" /> Import Categories
        </button>
      </div>

      {importTarget && (
        <ImportNomineesDialog
          onClose={() => setImportTarget(null)}
          onImport={(imported) => setCategories(injectImported(categories, importTarget, imported))}
        />
      )}

      {importCategoriesTarget && (
        <ImportNomineesCategoryDialog
          onClose={() => setImportCategoriesTarget(null)}
          onImport={(imported) =>
            setCategories(
              importCategoriesTarget === "root"
                ? [...categories, ...imported]
                : injectImportedCategories(categories, importCategoriesTarget, imported)
            )
          }
        />
      )}
    </div>
  )
}
