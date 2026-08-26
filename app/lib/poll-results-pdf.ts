/**
 * app/lib/poll-results-pdf.ts
 *
 * Generates the "Download Result" PDF report for a poll — see the
 * Download Result button on app/polls/[pollId]/page.tsx and the route
 * that calls this, app/api/polls/[pollId]/results/route.ts.
 *
 * Built with `pdf-lib` (pure JS, no native deps — safe to run inside a
 * Next.js server route / serverless function). Install with:
 *
 *   npm install pdf-lib @pdf-lib/fontkit
 *
 * Font: the standard Helvetica font (WinAnsi encoding) can't render the
 * Naira sign "₦" (U+20A6) — pdf-lib throws "WinAnsi cannot encode ₦" the
 * moment a price line tries to draw it. We embed DejaVu Sans instead (via
 * @pdf-lib/fontkit), which has full glyph coverage for ₦ and everything
 * else this report needs. The two .ttf files live in ./fonts alongside
 * this module (DejaVu Fonts license included there) and are read with a
 * plain fs.readFileSync — deliberately NOT via require.resolve()/a
 * node_modules font package, because Turbopack/webpack try to treat a
 * require.resolve()'d path as a module to bundle and choke on ".ttf"
 * with "Unknown module type". Reading a static asset that ships inside
 * the app/ tree at runtime avoids that entirely and traces cleanly into
 * serverless output.
 *
 * Layout:
 *   - Page 1 gets a full purple (#6b2fa5) banner: poll name, "Poll
 *     Results Report", generated date, and a summary strip (categories /
 *     contestants / total votes).
 *   - One section per LEAF category (or a single "Results" section for a
 *     single-type poll), each with:
 *       - A winner banner, OR
 *       - A tie banner listing every tied contestant, OR
 *       - A "no votes were cast" banner — never a fabricated winner.
 *     followed by a full standings table (rank, name, votes, share of
 *     vote, and a simple bar).
 *   - Every page gets a "Generated from Spotix Booker · {year}" footer
 *     with page numbers.
 *
 * Contestant data is read via @/lib/contestants' toContestantArray /
 * computeStandings, so this works whether contestants are stored as an
 * array or a map keyed by contestantId — see that file for why.
 *
 * No contestant images are drawn — names and votes only, per spec.
 */

import fs from "node:fs"
import path from "node:path"
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import { computeStandings, type ContestantsField, type StandingsResult } from "@/lib/contestants"

// Vendored DejaVu Sans TTFs — see app/lib/fonts/DEJAVU-LICENSE.txt.
// Plain fs paths on purpose (see file header note above re: Turbopack).
const REGULAR_FONT_PATH = path.join(process.cwd(), "app", "lib", "fonts", "DejaVuSans.ttf")
const BOLD_FONT_PATH = path.join(process.cwd(), "app", "lib", "fonts", "DejaVuSans-Bold.ttf")

// ─── Theme ──────────────────────────────────────────────────────────────────

const PURPLE: RGB       = rgb(0x6b / 255, 0x2f / 255, 0xa5 / 255) // Spotix brand — #6b2fa5
const PURPLE_DARK: RGB  = rgb(0x4a / 255, 0x1f / 255, 0x73 / 255)
const PURPLE_TINT: RGB  = rgb(0xf3 / 255, 0xea / 255, 0xfb / 255)
const GOLD_TINT: RGB    = rgb(0xff / 255, 0xf7 / 255, 0xe0 / 255)
const GOLD_LINE: RGB    = rgb(0xd9 / 255, 0xa7 / 255, 0x1a / 255)
const AMBER_TINT: RGB   = rgb(0xff / 255, 0xf5 / 255, 0xe6 / 255)
const AMBER_LINE: RGB   = rgb(0xc9 / 255, 0x86 / 255, 0x0d / 255)
const GRAY_TINT: RGB    = rgb(0xf5 / 255, 0xf5 / 255, 0xf6 / 255)
const GRAY_LINE: RGB    = rgb(0xe1 / 255, 0xe1 / 255, 0xe4 / 255)
const TEXT_DARK: RGB    = rgb(0x1f / 255, 0x1f / 255, 0x26 / 255)
const TEXT_MED: RGB     = rgb(0x55 / 255, 0x55 / 255, 0x5f / 255)
const TEXT_LIGHT: RGB   = rgb(0x8a / 255, 0x8a / 255, 0x95 / 255)
const WHITE: RGB        = rgb(1, 1, 1)
const TRACK_BG: RGB     = rgb(0xe9 / 255, 0xe9 / 255, 0xee / 255)

// ─── Layout constants ───────────────────────────────────────────────────────

const PAGE_W = 595.28 // A4
const PAGE_H = 841.89
const MARGIN_X = 48
const CONTENT_W = PAGE_W - MARGIN_X * 2
const FOOTER_ZONE = 46
const BANNER_H = 118
const CONT_HEADER_H = 44

//Report data shapes

export interface ReportSection {
  /** Leaf category name, or "Results" for a single-type poll. */
  title: string
  /** Ancestor category names for a nested leaf, e.g. ["Male", "Under 18"]. Empty for a single poll. */
  breadcrumb: string[]
  pollPrice: number
  standings: StandingsResult
}

export interface CategoryTreeNodeForReport {
  categoryId: string
  name: string
  pollPrice: number
  contestants: ContestantsField
  subcategories: CategoryTreeNodeForReport[]
}

export interface PollResultsReportInput {
  pollId: string
  pollName: string
  pollType: "single" | "group"
  generatedAt: Date
  sections: ReportSection[]
}

/** Walks a group poll's category tree and produces one report section per LEAF category. */
export function buildGroupPollSections(categories: CategoryTreeNodeForReport[]): ReportSection[] {
  const sections: ReportSection[] = []
  function walk(nodes: CategoryTreeNodeForReport[], breadcrumb: string[]) {
    for (const node of nodes) {
      const hasSubs = Array.isArray(node.subcategories) && node.subcategories.length > 0
      if (hasSubs) {
        walk(node.subcategories, [...breadcrumb, node.name])
      } else {
        sections.push({
          title: node.name,
          breadcrumb,
          pollPrice: node.pollPrice ?? 0,
          standings: computeStandings(node.contestants),
        })
      }
    }
  }
  walk(categories, [])
  return sections
}

/** Single-type poll → one section covering the whole poll. */
export function buildSinglePollSections(contestants: ContestantsField, pollPrice: number): ReportSection[] {
  return [
    {
      title: "Results",
      breadcrumb: [],
      pollPrice,
      standings: computeStandings(contestants),
    },
  ]
}

// ─── Text wrapping ──────────────────────────────────────────────────────────

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = (text ?? "").split(/\s+/).filter(Boolean)
  if (words.length === 0) return [""]
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US")
}

// ─── Main generator ─────────────────────────────────────────────────────────

export async function generatePollResultsPdf(input: PollResultsReportInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(`${input.pollName} — Results`)
  pdfDoc.setSubject("Spotix poll results report")
  pdfDoc.setProducer("Spotix Booker")
  pdfDoc.setCreator("Spotix Booker")

  pdfDoc.registerFontkit(fontkit)
  const font     = await pdfDoc.embedFont(fs.readFileSync(REGULAR_FONT_PATH))
  const fontBold = await pdfDoc.embedFont(fs.readFileSync(BOLD_FONT_PATH))

  let page: PDFPage = pdfDoc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H

  const drawContinuationHeader = () => {
    page.drawRectangle({ x: 0, y: PAGE_H - CONT_HEADER_H, width: PAGE_W, height: CONT_HEADER_H, color: PURPLE })
    page.drawText(input.pollName, {
      x: MARGIN_X, y: PAGE_H - CONT_HEADER_H / 2 - 4, size: 11, font: fontBold, color: WHITE,
    })
    const label = "Poll Results Report (cont'd)"
    const w = font.widthOfTextAtSize(label, 9)
    page.drawText(label, { x: PAGE_W - MARGIN_X - w, y: PAGE_H - CONT_HEADER_H / 2 - 3, size: 9, font, color: PURPLE_TINT })
    y = PAGE_H - CONT_HEADER_H - 24
  }

  const newPage = () => {
    page = pdfDoc.addPage([PAGE_W, PAGE_H])
    drawContinuationHeader()
  }

  /** Ensures at least `needed` points of vertical room remain above the footer zone, paging if not. */
  const ensureSpace = (needed: number) => {
    if (y - needed < FOOTER_ZONE) newPage()
  }

  // ── Page 1 banner ─────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: PAGE_H - BANNER_H, width: PAGE_W, height: BANNER_H, color: PURPLE })
  page.drawRectangle({ x: 0, y: PAGE_H - BANNER_H - 4, width: PAGE_W, height: 4, color: PURPLE_DARK })

  page.drawText(input.pollName, {
    x: MARGIN_X, y: PAGE_H - 46, size: 22, font: fontBold, color: WHITE, maxWidth: CONTENT_W,
  })
  page.drawText("Poll Results Report", {
    x: MARGIN_X, y: PAGE_H - 68, size: 12, font, color: PURPLE_TINT,
  })
  const genLabel = `Generated ${input.generatedAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}`
  page.drawText(genLabel, { x: MARGIN_X, y: PAGE_H - 88, size: 9, font, color: PURPLE_TINT })
  const idLabel = `Poll ID: ${input.pollId}`
  const idW = font.widthOfTextAtSize(idLabel, 9)
  page.drawText(idLabel, { x: PAGE_W - MARGIN_X - idW, y: PAGE_H - 88, size: 9, font, color: PURPLE_TINT })

  y = PAGE_H - BANNER_H - 30

  // ── Summary strip ─────────────────────────────────────────────────────────
  const totalContestants = input.sections.reduce((s, sec) => s + sec.standings.sorted.length, 0)
  const totalVotes       = input.sections.reduce((s, sec) => s + sec.standings.totalVotes, 0)
  const summaryItems: Array<[string, string]> =
    input.pollType === "group"
      ? [
          ["Categories", fmtInt(input.sections.length)],
          ["Contestants", fmtInt(totalContestants)],
          ["Total Votes", fmtInt(totalVotes)],
        ]
      : [
          ["Contestants", fmtInt(totalContestants)],
          ["Total Votes", fmtInt(totalVotes)],
        ]

  const cardGap = 12
  const cardW = (CONTENT_W - cardGap * (summaryItems.length - 1)) / summaryItems.length
  const cardH = 52
  summaryItems.forEach(([label, value], i) => {
    const x = MARGIN_X + i * (cardW + cardGap)
    page.drawRectangle({ x, y: y - cardH, width: cardW, height: cardH, color: GRAY_TINT, borderColor: GRAY_LINE, borderWidth: 1 })
    const valW = fontBold.widthOfTextAtSize(value, 16)
    page.drawText(value, { x: x + (cardW - valW) / 2, y: y - 24, size: 16, font: fontBold, color: PURPLE })
    const labW = font.widthOfTextAtSize(label, 8)
    page.drawText(label, { x: x + (cardW - labW) / 2, y: y - 40, size: 8, font, color: TEXT_LIGHT })
  })
  y -= cardH + 28

  // ── Sections ───────────────────────────────────────────────────────────────
  for (const section of input.sections) {
    renderSection(section)
  }

  function renderSection(section: ReportSection) {
    ensureSpace(70)

    if (section.breadcrumb.length > 0) {
      const crumb = section.breadcrumb.join(" › ")
      page.drawText(crumb, { x: MARGIN_X, y, size: 8.5, font, color: TEXT_LIGHT })
      y -= 14
    }

    page.drawText(section.title, { x: MARGIN_X, y, size: 14, font: fontBold, color: TEXT_DARK, maxWidth: CONTENT_W })
    y -= 18

    const { sorted, totalVotes: secVotes, noVotes, winner, tied, isTie } = section.standings
    const priceLabel = section.pollPrice > 0 ? `₦${section.pollPrice.toLocaleString()} / vote` : "Free"
    const metaLine = `${sorted.length} contestant${sorted.length === 1 ? "" : "s"} · ${priceLabel} · ${fmtInt(secVotes)} vote${secVotes === 1 ? "" : "s"}`
    page.drawText(metaLine, { x: MARGIN_X, y, size: 9, font, color: TEXT_MED })
    y -= 10
    page.drawLine({ start: { x: MARGIN_X, y }, end: { x: PAGE_W - MARGIN_X, y }, thickness: 1, color: GRAY_LINE })
    y -= 16

    // ── Empty leaf (defensive — shouldn't normally happen) ──────────────────
    if (sorted.length === 0) {
      ensureSpace(30)
      drawBanner("No contestants have been added to this category.", GRAY_TINT, GRAY_LINE, TEXT_MED)
      y -= 26
      return
    }

    // ── Winner / tie / no-votes banner ───────────────────────────────────────
    ensureSpace(40)
    if (noVotes) {
      drawBanner("No votes were cast in this category — no winner.", GRAY_TINT, GRAY_LINE, TEXT_MED)
      y -= 30
    } else if (isTie) {
      const names = tied.map((c) => c.name).join(", ")
      const headline = `${tied.length}-way tie at ${fmtInt(tied[0]?.votes ?? 0)} vote${(tied[0]?.votes ?? 0) === 1 ? "" : "s"} — no winner declared.`
      const lines = wrapText(`Tied contestants: ${names}`, font, 9, CONTENT_W - 32)
      const bannerH = 22 + lines.length * 12
      ensureSpace(bannerH + 10)
      page.drawRectangle({ x: MARGIN_X, y: y - bannerH, width: CONTENT_W, height: bannerH, color: AMBER_TINT, borderColor: AMBER_LINE, borderWidth: 1 })
      page.drawText("TIE", { x: MARGIN_X + 12, y: y - 16, size: 9, font: fontBold, color: AMBER_LINE })
      page.drawText(headline, { x: MARGIN_X + 48, y: y - 16, size: 9.5, font: fontBold, color: rgb(0x66/255, 0x45/255, 0x05/255), maxWidth: CONTENT_W - 60 })
      let ly = y - 30
      for (const line of lines) {
        page.drawText(line, { x: MARGIN_X + 48, y: ly, size: 8.5, font, color: rgb(0x66/255, 0x45/255, 0x05/255) })
        ly -= 12
      }
      y -= bannerH + 10
    } else if (winner) {
      const pct = secVotes > 0 ? Math.round((winner.votes / secVotes) * 100) : 0
      const bannerH = 34
      ensureSpace(bannerH + 10)
      page.drawRectangle({ x: MARGIN_X, y: y - bannerH, width: CONTENT_W, height: bannerH, color: GOLD_TINT, borderColor: GOLD_LINE, borderWidth: 1 })
      page.drawRectangle({ x: MARGIN_X + 12, y: y - bannerH + 9, width: 46, height: 16, color: GOLD_LINE })
      const wLabel = "WINNER"
      const wLabelW = fontBold.widthOfTextAtSize(wLabel, 8)
      page.drawText(wLabel, { x: MARGIN_X + 12 + (46 - wLabelW) / 2, y: y - bannerH + 13, size: 8, font: fontBold, color: WHITE })
      const winnerLine = `${winner.name} — ${fmtInt(winner.votes)} vote${winner.votes === 1 ? "" : "s"} (${pct}% of the vote)`
      page.drawText(winnerLine, { x: MARGIN_X + 68, y: y - bannerH + 13, size: 10.5, font: fontBold, color: rgb(0x5c/255, 0x44/255, 0x02/255), maxWidth: CONTENT_W - 90 })
      y -= bannerH + 10
    }

    // ── Standings table 
    const colRank = MARGIN_X
    const colName = MARGIN_X + 28
    const colBar  = MARGIN_X + 240
    const barW    = 150
    const colVotes = colBar + barW + 14

    ensureSpace(24)
    page.drawText("#", { x: colRank, y, size: 8, font: fontBold, color: TEXT_LIGHT })
    page.drawText("Contestant", { x: colName, y, size: 8, font: fontBold, color: TEXT_LIGHT })
    page.drawText("Share of vote", { x: colBar, y, size: 8, font: fontBold, color: TEXT_LIGHT })
    page.drawText("Votes", { x: colVotes, y, size: 8, font: fontBold, color: TEXT_LIGHT })
    y -= 8
    page.drawLine({ start: { x: MARGIN_X, y }, end: { x: PAGE_W - MARGIN_X, y }, thickness: 0.5, color: GRAY_LINE })
    y -= 16

    sorted.forEach((c, idx) => {
      ensureSpace(24)
      const isWinnerRow = winner?.contestantId === c.contestantId
      const isTiedRow = isTie && tied.some((t) => t.contestantId === c.contestantId)
      const pct = secVotes > 0 ? (c.votes ?? 0) / secVotes : 0

      if (isWinnerRow || isTiedRow) {
        page.drawRectangle({
          x: MARGIN_X - 6, y: y - 6, width: CONTENT_W + 12, height: 20,
          color: isWinnerRow ? GOLD_TINT : AMBER_TINT,
        })
      }

      page.drawText(String(idx + 1), { x: colRank, y, size: 9.5, font, color: TEXT_MED })

      const nameLines = wrapText(c.name || "Unnamed contestant", fontBold, 9.5, colBar - colName - 10)
      page.drawText(nameLines[0], { x: colName, y, size: 9.5, font: fontBold, color: TEXT_DARK })

      // Track + fill bar
      page.drawRectangle({ x: colBar, y: y - 2, width: barW, height: 8, color: TRACK_BG })
      page.drawRectangle({ x: colBar, y: y - 2, width: Math.max(2, barW * pct), height: 8, color: isWinnerRow ? GOLD_LINE : PURPLE })

      const votesLabel = `${fmtInt(c.votes ?? 0)}  (${Math.round(pct * 100)}%)`
      page.drawText(votesLabel, { x: colVotes, y, size: 9, font, color: TEXT_MED })

      y -= 20
    })

    y -= 18
  }

  function drawBanner(text: string, bg: RGB, border: RGB, textColor: RGB) {
    const bannerH = 26
    page.drawRectangle({ x: MARGIN_X, y: y - bannerH, width: CONTENT_W, height: bannerH, color: bg, borderColor: border, borderWidth: 1 })
    page.drawText(text, { x: MARGIN_X + 12, y: y - bannerH / 2 - 3, size: 9.5, font, color: textColor })
  }

  // ── Footer on every page ─────────────────────────────────────────────────
  const pages = pdfDoc.getPages()
  const footerLabel = `Generated from Spotix Booker · ${input.generatedAt.getFullYear()}`
  pages.forEach((p, idx) => {
    p.drawLine({ start: { x: MARGIN_X, y: 34 }, end: { x: PAGE_W - MARGIN_X, y: 34 }, thickness: 0.5, color: GRAY_LINE })
    p.drawText(footerLabel, { x: MARGIN_X, y: 20, size: 8, font, color: TEXT_LIGHT })
    const pageLabel = `Page ${idx + 1} of ${pages.length}`
    const pageLabelW = font.widthOfTextAtSize(pageLabel, 8)
    p.drawText(pageLabel, { x: PAGE_W - MARGIN_X - pageLabelW, y: 20, size: 8, font, color: TEXT_LIGHT })
  })

  return pdfDoc.save()
}
