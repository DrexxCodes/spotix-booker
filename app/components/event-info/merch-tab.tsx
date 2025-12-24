"use client"

import { useState, useEffect, useMemo } from "react"
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
import { Trash2, Plus, Search, X } from "lucide-react"

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
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  // Format price in Naira with commas
  const formatPrice = (price: number): string => {
    const formatted = new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price)
    
    return formatted.replace('NGN', '₦').trim()
  }

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

  // Filter available listings (exclude already added ones)
  const availableListings = useMemo(() => {
    const addedIds = new Set(addedListings.map((listing) => listing.id))
    return userListings.filter((listing) => !addedIds.has(listing.id))
  }, [userListings, addedListings])

  // Filter listings based on search query
  const filteredAvailableListings = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableListings
    }

    const query = searchQuery.toLowerCase()
    return availableListings.filter(
      (listing) =>
        listing.productName.toLowerCase().includes(query) ||
        listing.description.toLowerCase().includes(query) ||
        listing.price.toString().includes(query)
    )
  }, [availableListings, searchQuery])

  const handleAddListing = async () => {
    if (!selectedListingId) {
      alert("Please select a listing to add")
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
      setSearchQuery("")
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

  const clearSearch = () => {
    setSearchQuery("")
  }

  return (
    <div className="space-y-6">
      {/* Add Listing Section */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-4">Add Merchandise</h3>
        
        {/* Search Field */}
        {availableListings.length > 0 && (
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, description, or price..."
                className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6b2fa5] focus:border-transparent transition-all"
                disabled={loading}
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              )}
            </div>
            {searchQuery && (
              <p className="text-xs text-slate-500 mt-2">
                {filteredAvailableListings.length} result{filteredAvailableListings.length !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
        )}

        {/* Select and Add Button */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedListingId}
            onChange={(e) => setSelectedListingId(e.target.value)}
            className="w-full sm:flex-1 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#6b2fa5] focus:border-transparent transition-all"
            disabled={loading || availableListings.length === 0}
          >
            <option value="">
              {availableListings.length === 0 
                ? "No available listings" 
                : "Select a listing"}
            </option>
            {filteredAvailableListings.map((listing) => (
              <option key={listing.id} value={listing.id}>
                {listing.productName} - {formatPrice(listing.price)}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddListing}
            disabled={loading || !selectedListingId || availableListings.length === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-[#6b2fa5] text-white rounded-lg hover:bg-[#5a2589] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 font-medium shadow-md hover:shadow-lg"
          >
            <Plus size={18} />
            <span>Add Listing</span>
          </button>
        </div>

        {/* Info Messages */}
        {userListings.length === 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-700 text-sm">
              No listings found. Create a listing first to add it to your event.
            </p>
          </div>
        )}
        
        {userListings.length > 0 && availableListings.length === 0 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 text-sm font-medium">
              ✓ All your listings have been added to this event!
            </p>
          </div>
        )}

        {searchQuery && filteredAvailableListings.length === 0 && availableListings.length > 0 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-700 text-sm">
              No listings match your search. Try a different search term.
            </p>
          </div>
        )}
      </div>

      {/* Added Listings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">Event Merchandise</h3>
          {addedListings.length > 0 && (
            <span className="px-3 py-1 bg-[#6b2fa5] text-white text-sm font-semibold rounded-full">
              {addedListings.length} {addedListings.length === 1 ? 'Item' : 'Items'}
            </span>
          )}
        </div>

        {fetching ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#6b2fa5] border-r-transparent mb-4"></div>
            <p className="text-slate-600">Loading merchandise...</p>
          </div>
        ) : addedListings.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus size={32} className="text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">No merchandise added yet</p>
            <p className="text-slate-500 text-sm mt-2">Add your first listing to this event</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {addedListings.map((listing) => (
              <div 
                key={listing.id} 
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
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
                  <h4 className="font-bold text-base sm:text-lg text-slate-900 mb-2 truncate" title={listing.productName}>
                    {listing.productName}
                  </h4>
                  <p className="text-sm text-slate-600 mb-3 line-clamp-2">{listing.description}</p>
                  
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xl sm:text-2xl font-bold text-[#6b2fa5]">{formatPrice(listing.price)}</p>
                  </div>

                  <div className="text-xs text-slate-500 mb-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <strong className="text-slate-700">ID:</strong> <span className="font-mono">{listing.id}</span>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveListing(listing)}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 font-medium shadow-sm hover:shadow"
                  >
                    <Trash2 size={16} />
                    <span>Remove from Event</span>
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