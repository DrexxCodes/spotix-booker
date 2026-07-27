/**
 * Builds a URL for the self-hosted Dicebear avatar route
 * (backend/v1/dicebear.js — see backend/README-dicebear.md).
 *
 * Always seeded from the person's email so the same person gets the same
 * avatar everywhere in Spotix without ever storing an image.
 */
export function dicebearAvatarUrl(
  seed: string,
  opts?: { style?: "avataaars" | "micah" | "identicon"; size?: number }
) {
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || ""
  const style = opts?.style || "micah"
  const size = opts?.size || 128
  const cleanSeed = (seed || "unknown").trim().toLowerCase()
  return `${backend}/v1/dicebear/${encodeURIComponent(cleanSeed)}?style=${style}&size=${size}`
}
