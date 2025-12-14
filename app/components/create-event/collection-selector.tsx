"use client"

import { useState, useEffect } from "react"
import { auth, db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"
import { ArrowLeft, Search } from "lucide-react"
import Image from "next/image"
import { Preloader } from "@/components/preloader"

interface EventCollection {
  id: string
  name: string
  image: string
  description: string
}

interface CollectionSelectorProps {
  onSelect: (collection: EventCollection) => void
  onBack: () => void
}

export function CollectionSelector({ onSelect, onBack }: CollectionSelectorProps) {
  const [collections, setCollections] = useState<EventCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const user = auth.currentUser
        if (!user) return

        const collectionsRef = collection(db, "EventCollection", user.uid, "collections")
        const snapshot = await getDocs(collectionsRef)

        const fetchedCollections: EventCollection[] = []
        snapshot.forEach((doc) => {
          const data = doc.data()
          fetchedCollections.push({
            id: doc.id,
            name: data.name || doc.id,
            image: data.image || "",
            description: data.description || "",
          })
        })

        setCollections(fetchedCollections)
      } catch (error) {
        console.error("Error fetching collections:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCollections()
  }, [])

  const filteredCollections = collections.filter(
    (col) =>
      col.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      col.description.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <>
      <Preloader isLoading={loading} />

      <div className="space-y-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground hover:text-[#6b2fa5] transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Event Group Options
        </button>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground">Select a Collection</h1>
          <p className="text-lg text-muted-foreground">Choose which event collection to add this event to</p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search collections..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#6b2fa5]"
            />
          </div>
        </div>

        {/* Collections Grid */}
        {filteredCollections.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">
              {collections.length === 0
                ? "No collections found. Create one first."
                : "No collections match your search."}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {filteredCollections.map((collection) => (
              <button
                key={collection.id}
                onClick={() => onSelect(collection)}
                className="group relative overflow-hidden rounded-lg border-2 border-border bg-card hover:border-[#6b2fa5] hover:shadow-lg hover:shadow-[#6b2fa5]/20 transition-all duration-300"
              >
                {collection.image && (
                  <div className="relative h-40 w-full overflow-hidden bg-muted">
                    <Image
                      src={collection.image || "/placeholder.svg"}
                      alt={collection.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}

                <div className="p-4 space-y-2">
                  <h3 className="font-semibold text-foreground group-hover:text-[#6b2fa5] transition-colors">
                    {collection.name}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{collection.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
