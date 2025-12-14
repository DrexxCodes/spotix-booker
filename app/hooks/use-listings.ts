"use client"

import { useState, useCallback } from "react"
import { db } from "@/lib/firebase"
import { collection, query, getDocs } from "firebase/firestore"

export function useListings() {
  const [listings, setListings] = useState<any[]>([])

  const loadListings = useCallback(async (userId: string) => {
    try {
      const listingsRef = collection(db, "listing", userId, "products")
      const q = query(listingsRef)
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setListings(data)
    } catch (error) {
      console.error("Error loading listings:", error)
    }
  }, [])

  return { listings, loadListings }
}
