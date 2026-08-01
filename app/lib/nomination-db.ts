/**
 * lib/nomination-db.ts
 *
 * Supabase query helpers for the open-nomination system (owner/booker
 * side — create, list-mine, edit, delete, and the "Import from
 * Nominees" dialog's nominee listing). Every function here returns the
 * SAME shape the old Firestore-backed route code returned, so
 * ImportNomineesDialog.tsx and nominationDetailClient.tsx didn't need
 * to change at all — only the API routes underneath them did.
 *
 * See /supabase/schema.sql for table definitions.
 */

import { supabaseAdmin } from "./supabase"
import { adminDb } from "./firebase-admin"
import type { NominationCategory } from "./nomination-config"

/** Mirrors the random-id shape Firestore's collection().doc() auto-id
 *  used to produce closely enough that pollId-shaped URLs don't change
 *  character. */
export function genNominationPollId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let id = ""
  for (let i = 0; i < 20; i++) id += chars.charAt(Math.floor(Math.random() * chars.length))
  return id
}

export interface OwnedNominationPoll {
  pollId: string
  pollName: string
  pollImage: string
  pollDescription: string
  categories: NominationCategory[]
  status: "active" | "closed"
  createdAt: string
}

export interface NominationPollWithOwner extends OwnedNominationPoll {
  creatorId: string
  /** Nomination Threshold — null means unlimited. See lib/nomination-config.ts. */
  nominationThreshold: number | null
  linkedVotingPollId: string | null
  linkedVotingPollName: string | null
  /** ISO string — snapshot of the linked voting poll's start date/time. */
  votingStartsAt: string | null
}

export async function createNominationPoll(params: {
  creatorId: string
  pollName: string
  pollImage: string
  pollDescription: string
  categories: NominationCategory[]
}): Promise<string> {
  const pollId = genNominationPollId()
  const { error } = await supabaseAdmin.from("nomination_polls").insert({
    id: pollId,
    creator_id: params.creatorId,
    poll_name: params.pollName,
    poll_image: params.pollImage,
    poll_description: params.pollDescription,
    categories: params.categories,
    status: "active",
  })
  if (error) throw error
  return pollId
}

export async function listNominationPollsByCreator(creatorId: string): Promise<OwnedNominationPoll[]> {
  const { data, error } = await supabaseAdmin
    .from("nomination_polls")
    .select("id, poll_name, poll_image, poll_description, categories, status, created_at")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    pollId: row.id,
    pollName: row.poll_name ?? "",
    pollImage: row.poll_image ?? "",
    pollDescription: row.poll_description ?? "",
    categories: row.categories ?? [],
    status: (row.status as "active" | "closed") ?? "active",
    createdAt: row.created_at ?? "",
  }))
}

/** Owner-scoped fetch — includes creatorId so the route can do its own
 *  "is this actually your poll?" check, same as the old
 *  `d.creatorId !== userId` check against the Firestore doc. */
export async function getNominationPollById(pollId: string): Promise<NominationPollWithOwner | null> {
  const { data, error } = await supabaseAdmin
    .from("nomination_polls")
    .select(
      "id, creator_id, poll_name, poll_image, poll_description, categories, status, created_at, nomination_threshold, linked_voting_poll_id, linked_voting_poll_name, voting_starts_at"
    )
    .eq("id", pollId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    pollId: data.id,
    creatorId: data.creator_id,
    pollName: data.poll_name ?? "",
    pollImage: data.poll_image ?? "",
    pollDescription: data.poll_description ?? "",
    categories: data.categories ?? [],
    status: (data.status as "active" | "closed") ?? "active",
    createdAt: data.created_at ?? "",
    nominationThreshold: data.nomination_threshold ?? null,
    linkedVotingPollId: data.linked_voting_poll_id ?? null,
    linkedVotingPollName: data.linked_voting_poll_name ?? null,
    votingStartsAt: data.voting_starts_at ?? null,
  }
}

export async function updateNominationPoll(
  pollId: string,
  updates: Partial<{
    pollName: string
    pollImage: string
    pollDescription: string
    status: "active" | "closed"
    categories: NominationCategory[]
    /** null explicitly clears the cap (unlimited). undefined leaves it untouched. */
    nominationThreshold: number | null
    /** null explicitly unlinks. undefined leaves the current link untouched.
     *  When set, linkedVotingPollName/votingStartsAt must be provided
     *  alongside it — see settings/route usage, which resolves these via
     *  getVotingPollForLinking() before calling this. */
    linkedVotingPollId: string | null
    linkedVotingPollName: string | null
    votingStartsAt: string | null
  }>
): Promise<void> {
  const row: Record<string, any> = { updated_at: new Date().toISOString() }
  if (updates.pollName !== undefined) row.poll_name = updates.pollName
  if (updates.pollImage !== undefined) row.poll_image = updates.pollImage
  if (updates.pollDescription !== undefined) row.poll_description = updates.pollDescription
  if (updates.status !== undefined) row.status = updates.status
  if (updates.categories !== undefined) row.categories = updates.categories
  if (updates.nominationThreshold !== undefined) row.nomination_threshold = updates.nominationThreshold
  if (updates.linkedVotingPollId !== undefined) row.linked_voting_poll_id = updates.linkedVotingPollId
  if (updates.linkedVotingPollName !== undefined) row.linked_voting_poll_name = updates.linkedVotingPollName
  if (updates.votingStartsAt !== undefined) row.voting_starts_at = updates.votingStartsAt

  const { error } = await supabaseAdmin.from("nomination_polls").update(row).eq("id", pollId)
  if (error) throw error
}

export interface VotingPollForLinking {
  pollId: string
  pollName: string
  pollImage: string
  /** Combined pollStartDate + pollStartTime as an ISO string, or null if
   *  either is missing/unparseable. */
  votingStartsAt: string | null
}

/**
 * Fetches one of the CALLER's OWN voting polls (Firestore voting/{pollId})
 * for the "link a voting poll" picker on the nomination settings page.
 * Returns null if the poll doesn't exist OR isn't owned by userId — the
 * settings route treats both the same way (404), so this never leaks
 * whether a poll ID that isn't yours exists.
 */
export async function getVotingPollForLinking(
  pollId: string,
  userId: string
): Promise<VotingPollForLinking | null> {
  const snap = await adminDb.collection("voting").doc(pollId).get()
  if (!snap.exists) return null

  const d = snap.data()!
  const creatorId = d.creatorId ?? d.organizerId ?? null
  if (creatorId !== userId) return null
  if (!d.pollName) return null

  let votingStartsAt: string | null = null
  if (d.pollStartDate && d.pollStartTime) {
    const parsed = new Date(`${d.pollStartDate}T${d.pollStartTime}`)
    if (!isNaN(parsed.getTime())) votingStartsAt = parsed.toISOString()
  }

  return {
    pollId: snap.id,
    pollName: d.pollName ?? "",
    pollImage: d.pollImage ?? "",
    votingStartsAt,
  }
}

/** Which of these categoryIds already have at least one nominee —
 *  used to block removing a category that would orphan nominee data,
 *  same guard the old PATCH handler had against Firestore. */
export async function categoryIdsWithNominees(pollId: string, categoryIds: string[]): Promise<string[]> {
  if (categoryIds.length === 0) return []
  const { data, error } = await supabaseAdmin
    .from("nomination_nominees")
    .select("category_id")
    .eq("poll_id", pollId)
    .in("category_id", categoryIds)

  if (error) throw error
  return [...new Set((data ?? []).map((r) => r.category_id as string))]
}

export async function pollHasAnyNominees(pollId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from("nomination_nominees")
    .select("id", { count: "exact", head: true })
    .eq("poll_id", pollId)

  if (error) throw error
  return (count ?? 0) > 0
}

export async function deleteNominationPoll(pollId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("nomination_polls").delete().eq("id", pollId)
  if (error) throw error
}

export interface OwnerNomineeRow {
  nomineeId: string
  categoryId: string
  name: string
  count: number
}

/** Owner-only nominee listing (no cap, no cache — this is the low-traffic
 *  "Import from Nominees" dialog, not the public leaderboard). */
export async function listNomineesForOwner(
  pollId: string,
  categoryId?: string | null
): Promise<OwnerNomineeRow[]> {
  let query = supabaseAdmin
    .from("nomination_nominees")
    .select("nominee_id, category_id, display_name, count")
    .eq("poll_id", pollId)
    .order("count", { ascending: false })

  if (categoryId) query = query.eq("category_id", categoryId)

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row) => ({
    nomineeId: row.nominee_id,
    categoryId: row.category_id,
    name: row.display_name ?? "",
    count: row.count ?? 0,
  }))
}
