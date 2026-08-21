/**
 * app/lib/poll-results-store.ts
 *
 * Storage layer for generated "Download Result" PDF reports.
 *
 *   - The PDF bytes go to Supabase Storage, bucket `poll-results`, at
 *     path `{pollId}/{fileName}`.
 *   - Metadata about each generated report goes to the Postgres table
 *     `poll_results` (see /supabase/schema-poll-results.sql for the DDL
 *     — same Supabase project as lib/supabase.ts / the nomination
 *     tables, just a different table).
 *
 * The bucket is PRIVATE — every read here goes through a short-lived
 * signed URL generated with the service-role client (supabaseAdmin),
 * never a public URL. Only server routes touch this file.
 */

import { supabaseAdmin } from "@/lib/supabase"

export const POLL_RESULTS_BUCKET = "poll-results"
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour — plenty of time to click "Download"

export type PollResultStatus = "processing" | "ready" | "failed"

export interface PollResultRow {
  id: string
  pollId: string
  fileName: string
  storagePath: string
  storageBucket: string
  status: PollResultStatus
  fileSizeBytes: number | null
  generatedBy: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

function rowFromDb(r: any): PollResultRow {
  return {
    id: r.id,
    pollId: r.poll_id,
    fileName: r.file_name,
    storagePath: r.storage_path,
    storageBucket: r.storage_bucket,
    status: r.status,
    fileSizeBytes: r.file_size_bytes,
    generatedBy: r.generated_by,
    errorMessage: r.error_message,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

/** Builds the `spotix_{pollId}_{timestamp}.pdf` file name used for every generated report. */
export function buildResultFileName(pollId: string, at: Date = new Date()): string {
  return `spotix_${pollId}_${at.getTime()}.pdf`
}

/** Uploads the PDF bytes to Supabase Storage and returns the storage path used. */
export async function uploadPollResultPdf(pollId: string, fileName: string, bytes: Uint8Array): Promise<string> {
  const storagePath = `${pollId}/${fileName}`
  const { error } = await supabaseAdmin.storage
    .from(POLL_RESULTS_BUCKET)
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false })

  if (error) throw new Error(`Failed to upload results PDF: ${error.message}`)
  return storagePath
}

/** Inserts the metadata row for a freshly generated report. */
export async function insertPollResultRow(input: {
  pollId: string
  fileName: string
  storagePath: string
  fileSizeBytes: number
  generatedBy: string | null
}): Promise<PollResultRow> {
  const { data, error } = await supabaseAdmin
    .from("poll_results")
    .insert({
      poll_id: input.pollId,
      file_name: input.fileName,
      storage_path: input.storagePath,
      storage_bucket: POLL_RESULTS_BUCKET,
      status: "ready" as PollResultStatus,
      file_size_bytes: input.fileSizeBytes,
      generated_by: input.generatedBy,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to save results metadata: ${error.message}`)
  return rowFromDb(data)
}

/** Most recent report for a poll, regardless of status — null if none has ever been generated. */
export async function getLatestPollResult(pollId: string): Promise<PollResultRow | null> {
  const { data, error } = await supabaseAdmin
    .from("poll_results")
    .select("*")
    .eq("poll_id", pollId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch results metadata: ${error.message}`)
  return data ? rowFromDb(data) : null
}

/** Short-lived signed download URL for a stored report. */
export async function getSignedResultUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(POLL_RESULTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) throw new Error(`Failed to create download link: ${error?.message ?? "unknown error"}`)
  return data.signedUrl
}
