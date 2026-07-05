/**
 * app/lib/image-uploader.ts
 *
 * Client-side upload helper — calls /api/upload only.
 * No provider credentials ever reach the browser.
 * API is backwards-compatible with the previous version.
 */

export interface UploadResult {
  url: string | null
  provider: string | null
}

export function uploadImage(
  file: File,
  options: {
    /** Cloudinary folder path, e.g. "spotix/polls/covers" */
    folder?: string
    /** @deprecated alias for folder — kept for backwards compat */
    cloudinaryFolder?: string
    /** Progress callback 0–100 while sending to /api/upload */
    onProgress?: (progress: number) => void
    /** @deprecated no-op — kept for backwards compat */
    showAlert?: boolean
  } = {},
): {
  uploadPromise: Promise<UploadResult>
  cancelUpload: () => void
} {
  const { folder, cloudinaryFolder, onProgress } = options
  const resolvedFolder = folder ?? cloudinaryFolder

  let cancelled = false
  const cancelUpload = () => { cancelled = true }

  const uploadPromise = new Promise<UploadResult>((resolve) => {
    if (cancelled) { resolve({ url: null, provider: null }); return }

    const body = new FormData()
    body.append("file", file)
    if (resolvedFolder) body.append("folder", resolvedFolder)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/upload", true)

    xhr.upload.onprogress = (e) => {
      if (cancelled || !e.lengthComputable || !onProgress) return
      onProgress(Math.round((e.loaded / e.total) * 100))
    }

    xhr.onload = () => {
      if (cancelled) { resolve({ url: null, provider: null }); return }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          if (data.success && data.url) {
            resolve({ url: data.url as string, provider: data.provider ?? null })
          } else {
            console.error("[image-uploader] server returned error:", data.error)
            resolve({ url: null, provider: null })
          }
        } catch {
          console.error("[image-uploader] failed to parse /api/upload response:", xhr.responseText)
          resolve({ url: null, provider: null })
        }
      } else {
        // Log the full body so the error is actionable
        console.error(
          `[image-uploader] /api/upload → ${xhr.status} ${xhr.statusText}`,
          "\nResponse body:", xhr.responseText,
        )
        resolve({ url: null, provider: null })
      }
    }

    xhr.onerror = () => {
      console.error("[image-uploader] network error — could not reach /api/upload")
      resolve({ url: null, provider: null })
    }

    xhr.send(body)
  })

  return { uploadPromise, cancelUpload }
}

/** Upload multiple files sequentially. Throws on first failure. */
export async function uploadImagesToStorage(files: File[], folder: string): Promise<string[]> {
  const urls: string[] = []
  for (const file of files) {
    const { uploadPromise } = uploadImage(file, { folder })
    const { url } = await uploadPromise
    if (!url) throw new Error(`Failed to upload ${file.name}`)
    urls.push(url)
  }
  return urls
}

/** Delete a Firebase Storage image by its URL. */
export async function deleteImageFromStorage(imageUrl: string): Promise<void> {
  try {
    const decoded = decodeURIComponent(imageUrl)
    const match   = decoded.match(/\/o\/(.*?)\?/)
    if (!match) return
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    await fetch(
      `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(match[1])}`,
      { method: "DELETE" },
    )
  } catch (err) {
    console.error("[image-uploader] deleteImageFromStorage:", err)
  }
}
