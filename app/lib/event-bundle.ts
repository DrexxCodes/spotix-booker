// app/lib/event-bundle.ts
//
// Shapes the full event-info payload (eventData, attendees, discounts,
// payout log, chart data, financial figures) exactly once. Previously
// app/api/event/list/[eventId]/route.ts (owner path) and app/api/teams
// route.ts's `myAccess` (collaborator path) each hand-rolled their own
// version — the collaborator path only building attendees + a slim
// eventData and hardcoding discounts/payouts/chart data to empty/zero.
// That's the root cause of Admin (and other collaborators) not seeing
// "everything the Creator sees". Both routes now call this.

import { adminDb } from "@/lib/firebase-admin"

function tsToDateString(ts: FirebaseFirestore.Timestamp | string | null | undefined): string {
  if (!ts) return "Unknown"
  if (typeof ts === "string") return ts
  try { return ts.toDate().toLocaleDateString() } catch { return "Unknown" }
}

function tsToTimeString(ts: FirebaseFirestore.Timestamp | null | undefined): string {
  if (!ts) return ""
  try { return ts.toDate().toLocaleTimeString() } catch { return "" }
}

export async function buildEventBundle(
  eventRef: FirebaseFirestore.DocumentReference,
  eventSnap: FirebaseFirestore.DocumentSnapshot,
  organizerId: string
) {
  const ev = eventSnap.data()!

  // ── bookerBVT always comes from the actual organizer, not the caller —
  // so an Admin viewing the event sees the same value the Creator does. ──
  let bookerBVT = ""
  try {
    const userSnap = await adminDb.collection("users").doc(organizerId).get()
    if (userSnap.exists) bookerBVT = userSnap.data()?.bvt ?? ""
  } catch (e) {
    console.error("[event-bundle] organizer fetch failed", e)
  }

  const [attendeesSnap, discountsSnap, payoutsSnap] = await Promise.all([
    eventRef.collection("attendees").get(),
    eventRef.collection("discounts").get(),
    eventRef.collection("payouts").orderBy("createdAt", "desc").get(),
  ])

  const attendees = attendeesSnap.docs.map((d) => {
    const a = d.data()
    return {
      id: d.id,
      fullName: a.fullName ?? "Unknown",
      email: a.email ?? "no-email@example.com",
      ticketType: a.ticketType ?? "Standard",
      verified: a.verified ?? false,
      purchaseDate: tsToDateString(a.purchaseDate),
      purchaseTime: a.purchaseTime ?? tsToTimeString(a.purchaseDate),
      ticketReference: a.ticketReference ?? "Unknown",
      facialEnroll: a.faceEmbedding ? "enrolled" : "unenrolled",
      faceEmbedding: a.faceEmbedding ?? null,
    }
  })

  const discounts = discountsSnap.docs.map((d) => {
    const dc = d.data()
    return {
      id: d.id,
      code: dc.code ?? "",
      type: dc.type ?? "percentage",
      value: dc.value ?? 0,
      maxUses: dc.maxUses ?? 1,
      usedCount: dc.usedCount ?? 0,
      active: dc.active !== false,
    }
  })

  let calculatedTotalPaidOut = 0
  const payouts = payoutsSnap.docs.map((d) => {
    const p = d.data()
    const payoutAmount = p.payoutAmount ?? 0
    if (p.status === "Confirmed") calculatedTotalPaidOut += payoutAmount
    return {
      id: d.id,
      date: tsToDateString(p.createdAt),
      amount: payoutAmount,
      status: p.status ?? "Pending",
      actionCode: p.actionCode ?? "",
      reference: p.reference ?? "",
      payoutAmount,
      payableAmount: p.payableAmount ?? 0,
      agentName: p.agentName ?? "",
      transactionTime: p.transactionTime ?? tsToTimeString(p.createdAt),
    }
  })

  let calculatedRevenue = 0
  if (attendees.length > 0 && ev.ticketPrices && ev.ticketPrices.length > 0) {
    for (const attendee of attendees) {
      const ticketType = ev.ticketPrices.find((t: any) => t.policy === attendee.ticketType)
      if (ticketType) calculatedRevenue += Number(ticketType.price)
    }
  }

  const totalRevenue = ev.totalRevenue ?? ev.revenue ?? calculatedRevenue ?? 0
  const totalPaidOut = ev.totalPaidOut ?? calculatedTotalPaidOut
  const availableRevenue = ev.availableRevenue ?? (totalRevenue - totalPaidOut)

  const eventDate: Date = ev.eventDate?.toDate?.() ?? new Date(ev.eventDate)

  const eventData = {
    id: eventSnap.id,
    eventName: ev.eventName ?? "",
    eventImage: ev.eventImage ?? "/placeholder.svg",
    eventImages: ev.eventImages ?? [],
    eventDate: eventDate.toISOString(),
    eventType: ev.eventType ?? "",
    eventDescription: ev.eventDescription ?? "",
    isFree: ev.isFree ?? false,
    ticketPrices: ev.ticketPrices ?? [],
    createdBy: ev.organizerId ?? organizerId,
    eventVenue: ev.eventVenue ?? "",
    totalCapacity: ev.enableMaxSize ? parseInt(ev.maxSize, 10) : 100,
    ticketsSold: ev.ticketsSold ?? 0,
    totalRevenue,
    eventEndDate: ev.eventEndDate ?? "",
    eventStart: ev.eventStart ?? "",
    eventEnd: ev.eventEnd ?? "",
    enableMaxSize: ev.enableMaxSize ?? false,
    maxSize: ev.maxSize ?? "",
    enableColorCode: ev.enableColorCode ?? false,
    colorCode: ev.colorCode ?? "",
    enableStopDate: ev.enableStopDate ?? ev.hasStopDate ?? false,
    stopDate: ev.stopDate ? (ev.stopDate.toDate?.() ?? new Date(ev.stopDate)).toISOString() : "",
    payId: ev.payId ?? "",
    availableRevenue,
    totalPaidOut,
    status: ev.status ?? "active",
    enabledCollaboration: ev.enabledCollaboration ?? false,
    allowAgents: ev.allowAgents ?? false,
    agentIncentive: ev.agentIncentive ?? null,
    votingId: ev.votingId ?? null,
    votingPollName: ev.votingPollName ?? null,
    allowAPIAccess: ev.allowAPIAccess ?? false,
    widgetLength: ev.widgetLength ?? 320,
    widgetHeight: ev.widgetHeight ?? 420,
    widgetColour: ev.widgetColour ?? "#6b2fa5",
  }

  const salesByDayMap: Record<string, { count: number; revenue: number }> = {}
  for (const doc of attendeesSnap.docs) {
    const a = doc.data()
    const purchaseDate = a.purchaseDate?.toDate?.() ?? new Date(a.purchaseDate)
    if (purchaseDate) {
      const dateStr = purchaseDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      const ticketType = ev.ticketPrices?.find((t: any) => t.policy === a.ticketType)
      const price = Number(ticketType?.price ?? 0)
      if (!salesByDayMap[dateStr]) salesByDayMap[dateStr] = { count: 0, revenue: 0 }
      salesByDayMap[dateStr].count += 1
      salesByDayMap[dateStr].revenue += price
    }
  }
  const ticketSalesByDay = Object.entries(salesByDayMap)
    .map(([date, data]) => ({ date, count: data.count, revenue: data.revenue }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const salesByTypeMap: Record<string, { count: number; revenue: number }> = {}
  for (const doc of attendeesSnap.docs) {
    const a = doc.data()
    const ticketType = a.ticketType ?? "Standard"
    const price = ev.ticketPrices?.find((t: any) => t.policy === ticketType)?.price ?? 0
    if (!salesByTypeMap[ticketType]) salesByTypeMap[ticketType] = { count: 0, revenue: 0 }
    salesByTypeMap[ticketType].count += 1
    salesByTypeMap[ticketType].revenue += Number(price)
  }
  const ticketSalesByType = Object.entries(salesByTypeMap).map(([type, data]) => ({
    type, count: data.count, revenue: data.revenue,
  }))

  return {
    eventData,
    bookerBVT,
    attendees,
    discounts,
    payouts,
    ticketSalesByDay,
    ticketSalesByType,
    ticketTypeData: ticketSalesByType,
    availableBalance: availableRevenue,
    totalPaidOut,
  }
}
