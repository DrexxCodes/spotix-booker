/**
 * app/lib/poll-payout-export.ts
 *
 * Client-side, compute-and-download export for a poll's payout page
 * (app/polls/[pollId]/payout/page.tsx) — same "computed and downloaded
 * immediately, nothing stored" model as app/lib/payout-export.ts (the
 * event Payouts tab's export), just built from a poll's simpler payout
 * shape (no Vault, so no vaultHold records to merge in — see
 * poll-payout-log-data.ts).
 *
 * Covers the same two things as the event version:
 *   - every transaction day, with the amount realized that day
 *   - the poll's payout logs and each one's status
 */

import type { PollPayoutRecord } from "./poll-payout-log-data"
import { formatPollPayoutStatusLabel } from "./poll-payout-log-data"
import { BRAND_HEX, hexToRgb, naira, csvRow } from "./pdf-report-kit"

export interface PollPayoutExportTxn {
  date: string
  voteCount: number
  voteSales: number
}

export interface PollPayoutExportTotals {
  totalRevenue: number
  availableRevenue: number
  paidAmount: number
}

export interface PollPayoutExportMeta {
  pollName: string
  pollId: string
  generatedByName: string
}

// ── CSV ──────────────────────────────────────────────────────────────────

export function buildPollPayoutCsv(
  transactions: PollPayoutExportTxn[],
  payoutStatusByDate: Record<string, string>,
  records: PollPayoutRecord[],
  totals: PollPayoutExportTotals,
  meta: PollPayoutExportMeta
): string {
  const lines: string[] = []

  lines.push(csvRow([`Spotix Poll Payout Report - ${meta.pollName}`]))
  lines.push(csvRow([`Generated ${new Date().toLocaleString()} by ${meta.generatedByName}`]))
  lines.push("")
  lines.push(csvRow(["Total Revenue", "Available", "Paid Out"]))
  lines.push(csvRow([totals.totalRevenue, totals.availableRevenue, totals.paidAmount]))
  lines.push("")

  lines.push(csvRow(["Transaction Days"]))
  lines.push(csvRow(["Date", "Votes Sold", "Sales", "Payout Status"]))
  transactions.forEach((t) => {
    lines.push(csvRow([t.date, t.voteCount, t.voteSales, formatPollPayoutStatusLabel(payoutStatusByDate[t.date])]))
  })
  const totalVotes = transactions.reduce((s, t) => s + (t.voteCount || 0), 0)
  const totalSales = transactions.reduce((s, t) => s + Number(t.voteSales || 0), 0)
  lines.push(csvRow(["Total", totalVotes, totalSales, ""]))
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
        formatPollPayoutStatusLabel(r.status),
        r.id,
        r.createdAt ? new Date(r.createdAt).toLocaleString() : "",
        r.resolvedAt ? new Date(r.resolvedAt).toLocaleString() : "",
      ])
    )
  })

  // Same leading BOM as the event payout export — without it Excel guesses
  // the system ANSI codepage for a plain .csv instead of UTF-8 and can
  // render an apparently blank sheet.
  return "\uFEFF" + lines.join("\n")
}

// ── PDF ──────────────────────────────────────────────────────────────────

export async function buildPollPayoutPdfBlob(
  transactions: PollPayoutExportTxn[],
  payoutStatusByDate: Record<string, string>,
  records: PollPayoutRecord[],
  totals: PollPayoutExportTotals,
  meta: PollPayoutExportMeta
): Promise<Blob> {
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
  doc.text("Poll Payout Report", margin, 40)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10.5)
  doc.text(meta.pollName, margin, 59)
  doc.setFontSize(8)
  doc.setTextColor(230, 220, 245)
  doc.text(`Generated ${new Date().toLocaleString()} by ${meta.generatedByName}`, margin, 74)

  let y = 120

  // ── Summary stat cards — mirrors the 3 stat blocks on the poll payout page ──
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
  const totalVotes = transactions.reduce((s, t) => s + (t.voteCount || 0), 0)
  const totalSales = transactions.reduce((s, t) => s + Number(t.voteSales || 0), 0)

  if (transactions.length === 0) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...muted)
    doc.text("No transaction days recorded for this poll yet.", margin, y + 4)
    y += 26
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Date", "Votes Sold", "Sales", "Payout Status"]],
      body: transactions.map((t) => [
        t.date,
        String(t.voteCount),
        naira(t.voteSales),
        formatPollPayoutStatusLabel(payoutStatusByDate[t.date]),
      ]),
      foot: [["Total", String(totalVotes), naira(totalSales), ""]],
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
    doc.text("No payout requests have been made for this poll yet.", margin, y + 4)
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
        formatPollPayoutStatusLabel(r.status),
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
    doc.text(`Spotix • Poll Payout Report • Page ${i} of ${pageCount}`, margin, pageHeight - 22)
    doc.text(meta.pollName, pageWidth - margin, pageHeight - 22, { align: "right" })
  }

  return doc.output("blob")
}
