"use client"

import { ChevronDown, ChevronUp, Plus, Trash2, FolderPlus, Download } from "lucide-react"
import { ContestantRow } from "./ContestantRow"
import { emptyContestant, emptyCategory, type CategoryForm, type ContestantForm } from "../lib/factories"

interface CategoryBlockProps {
  category: CategoryForm
  depth: number
  onChange: (updated: CategoryForm) => void
  onRemove: () => void
  onOpenImport: (targetCategoryId: string) => void
  eventImageFolder: string
}

export function CategoryBlock({ category, depth, onChange, onRemove, onOpenImport, eventImageFolder }: CategoryBlockProps) {
  const isLeaf = category.subcategories.length === 0

  const updateContestant = (i: number, updated: ContestantForm) => {
    const contestants = [...category.contestants]
    contestants[i] = updated
    onChange({ ...category, contestants })
  }

  const addContestant = () => onChange({ ...category, contestants: [...category.contestants, emptyContestant()] })
  const removeContestant = (i: number) => onChange({ ...category, contestants: category.contestants.filter((_, idx) => idx !== i) })

  const addSubcategory = () => onChange({ ...category, subcategories: [...category.subcategories, emptyCategory()] })
  const updateSubcategory = (i: number, updated: CategoryForm) => {
    const subcategories = [...category.subcategories]
    subcategories[i] = updated
    onChange({ ...category, subcategories })
  }
  const removeSubcategory = (i: number) => onChange({ ...category, subcategories: category.subcategories.filter((_, idx) => idx !== i) })

  const bgClass = depth === 0 ? "bg-white border-slate-200" : depth === 1 ? "bg-purple-50/50 border-purple-200" : "bg-blue-50/40 border-blue-200"

  return (
    <div className={`rounded-2xl border ${bgClass} p-4 sm:p-5`} style={depth > 0 ? { marginLeft: Math.min(depth * 16, 40) } : {}}>
      <div className="flex items-start gap-3 mb-4">
        <button onClick={() => onChange({ ...category, expanded: !category.expanded })} className="mt-2.5 text-slate-400 hover:text-slate-600">
          {category.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="Category name"
            value={category.name}
            onChange={(e) => onChange({ ...category, name: e.target.value })}
            className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium outline-none focus:border-[#6b2fa5]"
          />
          {isLeaf && (
            <input
              type="number"
              placeholder="Price per vote (₦)"
              value={category.pollPrice}
              onChange={(e) => onChange({ ...category, pollPrice: Number(e.target.value) })}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-[#6b2fa5]"
            />
          )}
        </div>
        <button onClick={onRemove} className="mt-1.5 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {category.expanded && (
        <div className="space-y-4">
          {/* Subcategories */}
          {category.subcategories.map((sub, i) => (
            <CategoryBlock
              key={sub.categoryId}
              category={sub}
              depth={depth + 1}
              onChange={(u) => updateSubcategory(i, u)}
              onRemove={() => removeSubcategory(i)}
              onOpenImport={onOpenImport}
              eventImageFolder={eventImageFolder}
            />
          ))}

          {/* Leaf: contestants */}
          {isLeaf && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {category.contestants.map((c, i) => (
                <ContestantRow
                  key={i}
                  contestant={c}
                  index={i}
                  folder={eventImageFolder}
                  onChange={(u) => updateContestant(i, u)}
                  onRemove={() => removeContestant(i)}
                  removable={category.contestants.length > 2}
                />
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={addContestant} className="flex items-center gap-1.5 text-sm font-medium text-[#6b2fa5] hover:bg-[#6b2fa5]/5 px-3 py-1.5 rounded-lg transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add Contestant
                </button>
                <button
                  onClick={() => onOpenImport(category.categoryId)}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-600 border border-slate-300 hover:border-[#6b2fa5] hover:text-[#6b2fa5] px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Import from Nominees
                </button>
              </div>
            </div>
          )}

          {depth < 2 && (
            <button onClick={addSubcategory} className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#6b2fa5] px-3 py-1.5 rounded-lg border border-dashed border-slate-300 hover:border-[#6b2fa5] transition-colors">
              <FolderPlus className="w-3.5 h-3.5" /> Add Sub-category
            </button>
          )}
        </div>
      )}
    </div>
  )
}
