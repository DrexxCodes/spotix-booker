/**
 * app/lib/contestants.ts
 *
 * Normalization helpers for contestant data.
 *
 * WHY THIS EXISTS: contestants used to always be written/read as a plain
 * array — `contestants: Contestant[]` on a single poll, and
 * `category.contestants: Contestant[]` on a leaf category node. That's
 * changing: contestants can now also come back as a MAP keyed by
 * contestantId (`Record<contestantId, Contestant>`), e.g.
 *
 *   {
 *     "sp-cont-abc123": { contestantId: "sp-cont-abc123", name: "Ada", votes: 12 },
 *     "sp-cont-def456": { contestantId: "sp-cont-def456", name: "Bem", votes: 7  }
 *   }
 *
 * instead of the old
 *
 *   [
 *     { contestantId: "sp-cont-abc123", name: "Ada", votes: 12 },
 *     { contestantId: "sp-cont-def456", name: "Bem", votes: 7  }
 *   ]
 *
 * Every place that reads contestants — entrant/contestant counts, vote
 * totals, standings, winner/tie detection, the results PDF — needs to
 * work correctly no matter which shape it's handed, for BOTH single polls
 * (top-level `poll.contestants`) and group polls (`category.contestants`
 * on every leaf node). Nothing here assumes which shape it'll get; it
 * always normalizes first.
 *
 * Used by:
 *   - app/polls/page.tsx              (dashboard "Entrants" stat)
 *   - app/polls/[pollId]/page.tsx     (standings, contestant counts, the
 *                                       Download Result flow)
 *   - app/lib/poll-results-pdf.ts     (results PDF generation)
 *   - app/api/polls/[pollId]/results/route.ts
 *
 * Safe to import from both client ("use client") components and server
 * route handlers — no Node-only or browser-only APIs used here.
 */

export interface ContestantRecord {
  contestantId: string
  name: string
  image?: string
  imageType?: string
  imageSeed?: string | null
  votes: number
}

/** What a `contestants` field can look like on the wire — old array shape, new map shape, or absent. */
export type ContestantsField =
  | ContestantRecord[]
  | Record<string, Partial<ContestantRecord>>
  | null
  | undefined

/**
 * Normalizes any contestants shape into a flat array. This is the single
 * choke point every reader should go through — never read `.length`,
 * `.map`, `.reduce`, etc. directly off a raw `contestants` field.
 *
 * - Array input → returned as-is (defensively copied is NOT required since
 *   callers already treat the result as read-only, but we still guard
 *   against non-object junk entries).
 * - Object/map input → `Object.values`, falling back to the object key as
 *   `contestantId` for any entry that's missing its own id field (belt and
 *   braces — every writer should already be setting it, but a reader
 *   should never crash over it).
 * - Anything else (null/undefined/string/number) → `[]`.
 */
export function toContestantArray(input: ContestantsField): ContestantRecord[] {
  if (!input) return []

  if (Array.isArray(input)) {
    return input.filter((c): c is ContestantRecord => !!c && typeof c === "object")
  }

  if (typeof input === "object") {
    return Object.entries(input)
      .filter(([, c]) => !!c && typeof c === "object")
      .map(([key, c]) => ({
        contestantId: c!.contestantId ?? key,
        name: c!.name ?? "",
        image: c!.image,
        imageType: c!.imageType,
        imageSeed: c!.imageSeed ?? null,
        votes: c!.votes ?? 0,
      }))
  }

  return []
}

/** Number of contestants, regardless of whether `input` is an array or a map. */
export function contestantCount(input: ContestantsField): number {
  return toContestantArray(input).length
}

/** Sum of votes across every contestant, regardless of shape. */
export function sumVotes(input: ContestantsField): number {
  return toContestantArray(input).reduce((sum, c) => sum + (c.votes ?? 0), 0)
}

// ─── Standings / winner detection ──────────────────────────────────────────

export interface StandingsResult {
  /** Contestants sorted by votes descending. */
  sorted: ContestantRecord[]
  totalVotes: number
  /** True when nobody voted at all — never crown a winner off a 0-0 "lead". */
  noVotes: boolean
  /** The single winner, or null if there's no votes or a tie at the top. */
  winner: ContestantRecord | null
  /** 2+ contestants sharing the top score. Empty when there's a clear winner. */
  tied: ContestantRecord[]
  isTie: boolean
}

/**
 * Computes standings + winner/tie state for one set of contestants (a
 * single poll's contestants, or one leaf category's contestants). Mirrors
 * the logic in the booker UI's StandingsList component so the PDF and the
 * dashboard never disagree about who won.
 */
export function computeStandings(input: ContestantsField): StandingsResult {
  const list = toContestantArray(input)
  const sorted = [...list].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
  const totalVotes = sorted.reduce((s, c) => s + (c.votes ?? 0), 0)
  const noVotes = totalVotes === 0
  const topScore = sorted[0]?.votes ?? 0
  const tiedTop = !noVotes ? sorted.filter((c) => (c.votes ?? 0) === topScore) : []
  const isTie = tiedTop.length > 1

  return {
    sorted,
    totalVotes,
    noVotes,
    winner: !noVotes && !isTie ? sorted[0] ?? null : null,
    tied: isTie ? tiedTop : [],
    isTie,
  }
}
