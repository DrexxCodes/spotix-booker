"use client"

import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import { ParticlesBackground } from "@/components/particles-background"
import { Nav } from "@/components/nav"
import { CheckCircle } from "lucide-react"

export default function SuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const eventId = searchParams.get("eventId")
  const payId = searchParams.get("payId")
  const type = searchParams.get("type")
  const eventName = searchParams.get("eventName")

  const handleGoHome = () => {
    router.push("/dashboard")
  }

  return (
    <>
      <ParticlesBackground />
      <div className="min-h-screen bg-background">
        <Nav />

        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center space-y-8">
            <div className="flex justify-center">
              <div className="relative w-24 h-24">
                <Image src="/success-checkmark.jpg" alt="Success" fill className="object-contain" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
                <CheckCircle size={32} className="text-green-600" />
              </div>

              <h1 className="text-4xl font-bold text-foreground">Congratulations!</h1>

              <p className="text-lg text-muted-foreground max-w-lg mx-auto">
                {type === "event-group"
                  ? "You have successfully created an event group. Your event series is now ready to add individual events."
                  : "You have successfully created an event. Your event details are now live and ready for attendees to purchase tickets."}
              </p>
            </div>

            {type !== "event-group" && (
              <div className="grid md:grid-cols-2 gap-4 max-w-lg mx-auto">
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-sm text-muted-foreground mb-1">Event ID</p>
                  <p className="text-lg font-bold text-[#6b2fa5] break-all">{eventId}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-sm text-muted-foreground mb-1">Payment ID</p>
                  <p className="text-lg font-bold text-[#6b2fa5] break-all">{payId}</p>
                </div>
              </div>
            )}

            {type === "event-group" && (
              <div className="rounded-lg border border-border bg-card p-4 max-w-lg mx-auto">
                <p className="text-sm text-muted-foreground mb-1">Event Group Name</p>
                <p className="text-lg font-bold text-[#6b2fa5] break-all">{eventName}</p>
              </div>
            )}

            <div className="flex gap-4 justify-center pt-4">
              <button
                onClick={handleGoHome}
                className="px-8 py-3 bg-[#6b2fa5] text-white font-semibold rounded-lg hover:bg-[#5a26a3] transition-colors"
              >
                Go to Dashboard
              </button>

              <button
                onClick={() => router.push("/events")}
                className="px-8 py-3 border-2 border-[#6b2fa5] text-[#6b2fa5] font-semibold rounded-lg hover:bg-[#6b2fa5] hover:text-white transition-colors"
              >
                View My Events
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
