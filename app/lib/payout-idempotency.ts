/**
 * lib/payout-idempotency.ts
 *
 * Enforces: N rapid identical submissions (double-click, retried fetch,
 * two tabs) → exactly ONE 2xx, everything else 4xx. Two layers:
 *
 *   1. Idempotency-Key — the client (payout-confirmation.tsx /
 *      poll-payout-confirmation.tsx) generates one crypto-random key
 *      PER BUTTON PRESS and sends it as the `Idempotency-Key` header.
 *      The first request to successfully INSERT that key into
 *      `payout_idempotency_keys` (primary-key collision = atomic claim,
 *      same trick as the payouts table's claim-update) proceeds; every
 *      other request carrying that same key is rejected with 409
 *      immediately, before touching any business logic.
 *
 *   2. The (event/poll, date) unique index on `payouts` itself (see
 *      /supabase/payout-schema.sql) — belt-and-suspenders in case two
 *      DIFFERENT idempotency keys somehow target the same date (e.g. a
 *      user opens two tabs and clicks in both — different keys, same
 *      underlying request). That collision surfaces as a Postgres
 *      unique-violation, which callers translate to 409 too.
 *
 * Both layers return 4xx, never a silently-swallowed 200 — a duplicate
 * must be visibly rejected, not "helpfully" treated as a success.
 */

import { supabaseAdmin } from "@/lib/supabase"

const PG_UNIQUE_VIOLATION = "23505"

export class DuplicateRequestError extends Error {
  constructor(message = "This request has already been submitted.") {
    super(message)
    this.name = "DuplicateRequestError"
  }
}

/**
 * Atomically claims an Idempotency-Key. Throws DuplicateRequestError if
 * this key has been seen before (including from a request still
 * in-flight — the INSERT races correctly with itself). Callers should
 * call this BEFORE any business logic and BEFORE any Firestore reads
 * that aren't themselves idempotent.
 */
export async function claimIdempotencyKey(key: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("payout_idempotency_keys")
    .insert({ idempotency_key: key, user_id: userId })

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      throw new DuplicateRequestError()
    }
    // An infra hiccup on the dedupe table itself must fail closed for a
    // money-moving endpoint — better to ask the client to retry with a
    // fresh key than to risk a double-processed payout.
    throw new Error("Could not verify request uniqueness. Please try again.")
  }
}

/** Turns a Postgres unique-violation on the payouts table itself into the same duplicate-request signal. */
export function isPayoutUniqueViolation(err: any): boolean {
  return err?.code === PG_UNIQUE_VIOLATION
}
