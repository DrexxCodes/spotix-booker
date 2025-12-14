"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { db } from "@/lib/firebase"
import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore"
import { Trash2, Plus } from "lucide-react"

interface Listing {
  id: string
  productName: string
  description: string
  price: number
  images: string[]
}

interface AddedListing extends Listing {
  firestoreId?: string
}

interface MerchTabProps {
  userId: string
  eventId: string
  eventName: string
  currentUserId: string
}

export default function MerchTab({ userId, eventId, eventName, currentUserId }: MerchTabProps) {
  const [userListings, setUserListings] = useState<Listing[]>([])
  const [addedListings, setAddedListings] = useState<AddedListing[]>([])
  const [selectedListingId, setSelectedListingId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  // Fetch user's listings
  useEffect(() => {
    const fetchUserListings = async () => {
      try {
        const listingsRef = collection(db, "listing", currentUserId, "products")
        const snapshot = await getDocs(listingsRef)
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Listing[]
        setUserListings(data)
      } catch (error) {
        console.error("Error fetching user listings:", error)
      }
    }

    if (currentUserId) {
      fetchUserListings()
    }
  }, [currentUserId])

  // Fetch added listings for this event
  useEffect(() => {
    const fetchAddedListings = async () => {
      setFetching(true)
      try {
        const listingsCollectionRef = collection(db, "events", userId, "userEvents", eventId, "listings")
        const snapshot = await getDocs(listingsCollectionRef)

        const listingsData: AddedListing[] = []
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data()
          const listingId = data.listingId
          const listingOwnerId = data.userId

          // Fetch full listing data from listing/{userId}/products/{listingId}
          const listingDocRef = doc(db, "listing", listingOwnerId, "products", listingId)
          const listingDoc = await getDoc(listingDocRef)

          if (listingDoc.exists()) {
            const listingData = listingDoc.data()
            listingsData.push({
              id: listingId,
              productName: listingData.productName || "",
              description: listingData.description || "",
              price: listingData.price || 0,
              images: listingData.images || [],
              firestoreId: docSnap.id,
            })
          }
        }

        setAddedListings(listingsData)
      } catch (error) {
        console.error("Error fetching added listings:", error)
      } finally {
        setFetching(false)
      }
    }

    fetchAddedListings()
  }, [userId, eventId, currentUserId])

  const handleAddListing = async () => {
    if (!selectedListingId) {
      alert("Please select a listing to add")
      return
    }

    // Check if listing is already added
    if (addedListings.some((listing) => listing.id === selectedListingId)) {
      alert("This listing is already added to this event")
      return
    }

    setLoading(true)
    try {
      // Add to event's listings collection
      const listingsCollectionRef = collection(db, "events", userId, "userEvents", eventId, "listings")
      const newListingRef = doc(listingsCollectionRef)
      await setDoc(newListingRef, {
        listingId: selectedListingId,
        userId: currentUserId,
        addedAt: new Date(),
      })

      // Update the listing to add this event to addedEvents array
      const listingDocRef = doc(db, "listing", currentUserId, "products", selectedListingId)
      const listingDoc = await getDoc(listingDocRef)

      if (listingDoc.exists()) {
        await updateDoc(listingDocRef, {
          addedEvents: arrayUnion(eventName),
        })
      }

      // Fetch the listing details and add to state
      const listingData = listingDoc.data()
      if (listingData) {
        setAddedListings([
          ...addedListings,
          {
            id: selectedListingId,
            productName: listingData.productName || "",
            description: listingData.description || "",
            price: listingData.price || 0,
            images: listingData.images || [],
            firestoreId: newListingRef.id,
          },
        ])
      }

      setSelectedListingId("")
      alert("Listing added successfully!")
    } catch (error) {
      console.error("Error adding listing:", error)
      alert("Failed to add listing. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveListing = async (listing: AddedListing) => {
    if (!confirm("Are you sure you want to remove this listing from the event?")) {
      return
    }

    setLoading(true)
    try {
      // Remove from event's listings collection
      if (listing.firestoreId) {
        const listingDocRef = doc(db, "events", userId, "userEvents", eventId, "listings", listing.firestoreId)
        await deleteDoc(listingDocRef)
      }

      // Remove event from the listing's addedEvents array
      const listingDocRef = doc(db, "listing", currentUserId, "products", listing.id)
      await updateDoc(listingDocRef, {
        addedEvents: arrayRemove(eventName),
      })

      // Update state
      setAddedListings(addedListings.filter((l) => l.id !== listing.id))

      alert("Listing removed successfully!")
    } catch (error) {
      console.error("Error removing listing:", error)
      alert("Failed to remove listing. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add Listing Section */}
      <div className="bg-slate-50 rounded-lg border border-slate-200 p-6">
        <h3 className="text-xl font-bold text-slate-900 mb-4">Add Merchandise</h3>
        <div className="flex gap-3">
          <select
            value={selectedListingId}
            onChange={(e) => setSelectedListingId(e.target.value)}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6b2fa5] focus:border-transparent"
            disabled={loading}
          >
            <option value="">Select a listing</option>
            {userListings.map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listing.productName} - ${listing.price.toFixed(2)}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddListing}
            disabled={loading || !selectedListingId}
            className="flex items-center gap-2 px-6 py-2 bg-[#6b2fa5] text-white rounded-lg hover:bg-[#5a2589] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={18} />
            Add Listing
          </button>
        </div>
        {userListings.length === 0 && (
          <p className="text-slate-600 text-sm mt-3">
            No listings found. Create a listing first to add it to your event.
          </p>
        )}
      </div>

      {/* Added Listings */}
      <div>
        <h3 className="text-xl font-bold text-slate-900 mb-4">Event Merchandise</h3>
        {fetching ? (
          <div className="text-center py-8">
            <p className="text-slate-600">Loading merchandise...</p>
          </div>
        ) : addedListings.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <p className="text-slate-600">No merchandise added to this event yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {addedListings.map((listing) => (
              <div key={listing.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                {/* Image */}
                {listing.images && listing.images.length > 0 && (
                  <div className="relative w-full h-48 bg-slate-100">
                    <Image
                      src={listing.images[0] || "/placeholder.svg"}
                      alt={listing.productName}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="p-4">
                  <h4 className="font-bold text-lg text-slate-900 mb-2 truncate">{listing.productName}</h4>
                  <p className="text-sm text-slate-600 mb-3 line-clamp-2">{listing.description}</p>
                  <p className="text-xl font-bold text-[#6b2fa5] mb-4">${listing.price.toFixed(2)}</p>

                  <div className="text-xs text-slate-500 mb-3 p-2 bg-slate-50 rounded">
                    <strong>Listing ID:</strong> {listing.id}
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveListing(listing)}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={16} />
                    Remove from Event
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
