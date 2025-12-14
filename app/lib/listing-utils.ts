import { db } from "@/lib/firebase"
import { doc, deleteDoc } from "firebase/firestore"
import { deleteImageFromStorage } from "./image-uploader"

export async function deleteListing(userId: string, listingId: string, images: string[]) {
  try {
    // Delete images from Firebase Storage
    for (const imageUrl of images) {
      try {
        await deleteImageFromStorage(imageUrl)
      } catch (error) {
        console.error("Error deleting image:", error)
      }
    }

    // Delete listing document from Firestore
    const listingRef = doc(db, "listing", userId, "products", listingId)
    await deleteDoc(listingRef)
  } catch (error) {
    console.error("Error deleting listing:", error)
    throw error
  }
}
