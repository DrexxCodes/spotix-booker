/**
 * app/lib/payout-export.ts
 *
 * Client-side, compute-and-download export for the Payouts tab — unlike
 * the Attendee Post Mortem, nothing is generated or stored server-side.
 * Both formats are built entirely in the browser from data the Payouts
 * tab already has (Transaction Days + payout status map) plus one fresh
 * fetch of the merged payout log timeline (see payout-log-data.ts).
 *
 * Covers exactly what was asked for:
 *   - every transaction day, with the amount realized that day
 *   - the payout logs for the event and each one's status
 */

import type { DisplayRecord } from "./payout-log-data"
import { formatStatusLabel } from "./payout-log-data"

export interface PayoutExportTxn {
  date: string
  ticketCount: number
  ticketSales: number
}

export interface PayoutExportTotals {
  totalRevenue: number
  availableRevenue: number
  paidAmount: number
}

export interface PayoutExportMeta {
  eventName: string
  eventId: string
  generatedByName: string
}

// Brand purple, used throughout spotix-booker (buttons, active tab
// underline, the post-mortem PDF's header band, etc).
const BRAND_HEX = "#6b2fa5"

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function naira(n: number): string {
  // jsPDF's built-in fonts don't carry the ₦ glyph (same reason the post
  // mortem PDF had to vendor a custom font for it) — "N" reads fine in a
  // report context and avoids shipping a font just for this.
  return `N${Math.round(Number(n) || 0).toLocaleString()}`
}

// ── CSV ──────────────────────────────────────────────────────────────────

function csvCell(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",")
}

export function buildPayoutCsv(
  transactions: PayoutExportTxn[],
  payoutStatusByDate: Record<string, string>,
  records: DisplayRecord[],
  totals: PayoutExportTotals,
  meta: PayoutExportMeta
): string {
  const lines: string[] = []

  lines.push(csvRow([`Spotix Payout Report - ${meta.eventName}`]))
  lines.push(csvRow([`Generated ${new Date().toLocaleString()} by ${meta.generatedByName}`]))
  lines.push("")
  lines.push(csvRow(["Total Revenue", "Available", "Paid Out"]))
  lines.push(csvRow([totals.totalRevenue, totals.availableRevenue, totals.paidAmount]))
  lines.push("")

  lines.push(csvRow(["Transaction Days"]))
  lines.push(csvRow(["Date", "Tickets Sold", "Sales", "Payout Status"]))
  transactions.forEach((t) => {
    lines.push(csvRow([t.date, t.ticketCount, t.ticketSales, formatStatusLabel(payoutStatusByDate[t.date])]))
  })
  const totalTickets = transactions.reduce((s, t) => s + (t.ticketCount || 0), 0)
  const totalSales = transactions.reduce((s, t) => s + Number(t.ticketSales || 0), 0)
  lines.push(csvRow(["Total", totalTickets, totalSales, ""]))
  lines.push("")

  lines.push(csvRow(["Payout Logs"]))
  lines.push(csvRow(["Date", "Amount", "Bank", "Account Name", "Account Number", "Status", "Reference", "Submitted", "Resolved"]))
  records.forEach((r) => {
    lines.push(
      csvRow([
        r.date,
        r.amount,
        r.bankName,
        r.accountName,
        r.accountNumber,
        formatStatusLabel(r.status),
        r.id,
        r.createdAt ? new Date(r.createdAt).toLocaleString() : "",
        r.resolvedAt ? new Date(r.resolvedAt).toLocaleString() : "",
      ])
    )
  })

  // Leading BOM so Excel (which otherwise guesses the system ANSI codepage
  // for a plain-text .csv, rather than assuming UTF-8) opens this straight
  // away instead of mis-decoding it — a bare non-ASCII byte with no BOM is
  // exactly what makes Excel show an apparently blank sheet instead of an
  // error.
  return "\uFEFF" + lines.join("\n")
}

// ── PDF ──────────────────────────────────────────────────────────────────

export async function buildPayoutPdfBlob(
  transactions: PayoutExportTxn[],
  payoutStatusByDate: Record<string, string>,
  records: DisplayRecord[],
  totals: PayoutExportTotals,
  meta: PayoutExportMeta
): Promise<Blob> {
  // Dynamically imported so jsPDF/autotable never land in the main bundle
  // for people who never open this menu.
  const { jsPDF } = await import("jspdf")
  const autoTableModule = await import("jspdf-autotable")
  const autoTable = autoTableModule.default

  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  const contentWidth = pageWidth - margin * 2
  const brand = hexToRgb(BRAND_HEX)
  const ink: [number, number, number] = [17, 24, 39]
  const muted: [number, number, number] = [107, 114, 128]
  const border: [number, number, number] = [229, 231, 235]

  // ── Header band ──
  doc.setFillColor(...brand)
  doc.rect(0, 0, pageWidth, 92, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.text("Payout Report", margin, 40)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10.5)
  doc.text(meta.eventName, margin, 59)
  doc.setFontSize(8)
  doc.setTextColor(230, 220, 245)
  doc.text(`Generated ${new Date().toLocaleString()} by ${meta.generatedByName}`, margin, 74)

  let y = 120

  // ── Summary stat cards — mirrors the 3 stat blocks on the Payouts tab ──
  const cardGap = 12
  const cardWidth = (contentWidth - cardGap * 2) / 3
  const cards: { label: string; value: number; color: [number, number, number] }[] = [
    { label: "TOTAL REVENUE", value: totals.totalRevenue, color: [37, 99, 235] },
    { label: "AVAILABLE", value: totals.availableRevenue, color: brand },
    { label: "PAID OUT", value: totals.paidAmount, color: [22, 163, 74] },
  ]
  cards.forEach((c, i) => {
    const x = margin + i * (cardWidth + cardGap)
    doc.setDrawColor(...border)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(x, y, cardWidth, 56, 6, 6, "FD")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.5)
    doc.setTextColor(...muted)
    doc.text(c.label, x + 12, y + 20)
    doc.setFontSize(14)
    doc.setTextColor(...c.color)
    doc.text(naira(c.value), x + 12, y + 41)
  })
  y += 56 + 30

  const sectionTitle = (title: string) => {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.setTextColor(...ink)
    doc.text(title, margin, y)
    y += 6
    doc.setDrawColor(...brand)
    doc.setLineWidth(1.2)
    doc.line(margin, y + 4, margin + contentWidth, y + 4)
    y += 18
  }

  // ── Transaction Days ──
  sectionTitle("Transaction Days")
  const totalTickets = transactions.reduce((s, t) => s + (t.ticketCount || 0), 0)
  const totalSales = transactions.reduce((s, t) => s + Number(t.ticketSales || 0), 0)

  if (transactions.length === 0) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...muted)
    doc.text("No transaction days recorded for this event yet.", margin, y + 4)
    y += 26
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Date", "Tickets Sold", "Sales", "Payout Status"]],
      body: transactions.map((t) => [
        t.date,
        String(t.ticketCount),
        naira(t.ticketSales),
        formatStatusLabel(payoutStatusByDate[t.date]),
      ]),
      foot: [["Total", String(totalTickets), naira(totalSales), ""]],
      theme: "striped",
      headStyles: { fillColor: brand, textColor: 255, fontStyle: "bold", fontSize: 8.5 },
      footStyles: { fillColor: [243, 244, 246], textColor: ink, fontStyle: "bold", fontSize: 8.5 },
      bodyStyles: { fontSize: 8, textColor: [31, 41, 55] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { cellPadding: 6, lineColor: border, lineWidth: 0.5 },
    })
    y = (doc as any).lastAutoTable.finalY + 32
  }

  // ── Payout Logs ──
  if (y > pageHeight - 160) {
    doc.addPage()
    y = 50
  }
  sectionTitle("Payout Logs")

  if (records.length === 0) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...muted)
    doc.text("No payout requests have been made for this event yet.", margin, y + 4)
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Date", "Amount", "Bank", "Account", "Status", "Reference", "Submitted"]],
      body: records.map((r) => [
        r.date,
        naira(r.amount),
        r.bankName || "-",
        `${r.accountName || "-"} (••••${(r.accountNumber || "").slice(-4)})`,
        formatStatusLabel(r.status),
        r.id,
        r.createdAt ? new Date(r.createdAt).toLocaleString() : "-",
      ]),
      theme: "striped",
      headStyles: { fillColor: brand, textColor: 255, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 7, textColor: [31, 41, 55] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { cellPadding: 5, lineColor: border, lineWidth: 0.5, overflow: "ellipsize" },
      columnStyles: { 5: { cellWidth: 92 } },
    })
  }

  // ── Footer on every page ──
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(...border)
    doc.setLineWidth(0.5)
    doc.line(margin, pageHeight - 36, pageWidth - margin, pageHeight - 36)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(156, 163, 175)
    doc.text(`Spotix • Payout Report • Page ${i} of ${pageCount}`, margin, pageHeight - 22)
    doc.text(meta.eventName, pageWidth - margin, pageHeight - 22, { align: "right" })
  }

  return doc.output("blob")
}
