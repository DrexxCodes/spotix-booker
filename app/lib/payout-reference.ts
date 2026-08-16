/**
 * lib/payout-reference.ts
 *
 * SPTX-TRNS-{timestampMs}-{2 random letters}, e.g. SPTX-TRNS-1755100000000-QK
 * Mirrors spotix-backend/v1/lib/payout/reference.js exactly — this is the
 * value written as the Supabase `payouts.reference` primary key, the
 * Paystack transfer reference, and the `payoutReference` field stamped
 * onto the Firestore date doc for the day being withdrawn.
 */

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

function randomLetters(count = 2): string {
  let out = ""
  for (let i = 0; i < count; i++) {
    out += LETTERS[Math.floor(Math.random() * LETTERS.length)]
  }
  return out
}

export function generatePayoutReference(): string {
  return `SPTX-TRNS-${Date.now()}-${randomLetters(2)}`
}
