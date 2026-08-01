import { uploadImage } from "@/lib/image-uploader"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContestantForm {
  contestantId: string
  name: string
  imagePreview: string | null
  imageUrl: string | null
  imageType: "uploaded" | "generated" | null
  uploading: boolean
}

export interface CategoryForm {
  categoryId: string
  name: string
  pollPrice: number
  contestants: ContestantForm[]
  subcategories: CategoryForm[]
  expanded: boolean // UI-only: accordion open/closed
}

export interface PollForm {
  pollName: string
  pollDescription: string
  pollStartDate: string
  pollStartTime: string
  pollEndDate: string
  pollEndTime: string
  pollPrice: number // single polls only
  pollImagePreview: string | null
  pollImageUrl: string | null
  pollType: "single" | "group"
  buyerBearsBurden: boolean
  statsVisible: boolean
  /** When true, this poll is created with name/image/schedule set but no
   *  real contestants yet — typically waiting on an open-nomination poll
   *  to close first. Public page shows "Voting Poll Coming Soon" instead
   *  of an empty contestant list. See ContestantsStep.tsx and
   *  api/polls/create/route.ts. */
  contestantsTBD: boolean
}

// ─── ID generators ────────────────────────────────────────────────────────────

export function genContestantId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let id = "sp-cont-"
  for (let i = 0; i < 10; i++) id += chars.charAt(Math.floor(Math.random() * chars.length))
  return id
}

export function genCategoryId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let id = "sp-cat-"
  for (let i = 0; i < 10; i++) id += chars.charAt(Math.floor(Math.random() * chars.length))
  return id
}

// ─── Upload helper ────────────────────────────────────────────────────────────

export async function doUpload(file: File, folder: string): Promise<string | null> {
  try {
    const { uploadPromise } = uploadImage(file, { cloudinaryFolder: folder })
    const result = await uploadPromise
    return result.url
  } catch {
    return null
  }
}

// ─── Empty factories ──────────────────────────────────────────────────────────

export function rehydrateContestant(c: ContestantForm): ContestantForm {
  return { ...c, imagePreview: c.imageUrl ?? c.imagePreview }
}

export function rehydrateCategoryTree(cats: CategoryForm[]): CategoryForm[] {
  return cats.map((cat) => ({
    ...cat,
    contestants: cat.contestants.map(rehydrateContestant),
    subcategories: rehydrateCategoryTree(cat.subcategories ?? []),
  }))
}

export function emptyContestant(): ContestantForm {
  return { contestantId: "", name: "", imagePreview: null, imageUrl: null, imageType: null, uploading: false }
}

export function emptyCategory(): CategoryForm {
  return {
    categoryId: genCategoryId(),
    name: "",
    pollPrice: 100,
    contestants: [emptyContestant(), emptyContestant()],
    subcategories: [],
    expanded: true,
  }
}
