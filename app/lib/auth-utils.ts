import { auth, db } from "./firebase"
import { onAuthStateChanged, type User } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"

export interface BookerCheckResult {
  isAuthenticated: boolean
  user: User | null
  isBooker: boolean
  bookerData?: any
  error?: string
}

/**
 * Check if the current user is logged in and if they have a booker role
 */
export async function checkBookerStatus(): Promise<BookerCheckResult> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe()

      if (!user) {
        resolve({
          isAuthenticated: false,
          user: null,
          isBooker: false,
        })
        return
      }

      try {
        const userDocRef = doc(db, "users", user.uid)
        const userDoc = await getDoc(userDocRef)

        if (!userDoc.exists()) {
          resolve({
            isAuthenticated: true,
            user,
            isBooker: false,
            error: "User profile not found",
          })
          return
        }

        const userData = userDoc.data()
        const isBooker = userData?.role === "booker" || userData?.isBooker === true

        resolve({
          isAuthenticated: true,
          user,
          isBooker,
          bookerData: userData,
        })
      } catch (error) {
        console.error("Error checking booker status:", error)
        resolve({
          isAuthenticated: true,
          user,
          isBooker: false,
          error: "Failed to verify booker status",
        })
      }
    })
  })
}

/**
 * Get the current authenticated user
 */
export function getCurrentUser(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe()
      resolve(user)
    })
  })
}
