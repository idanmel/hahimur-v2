import { TEAMS } from '../../shared/groups'

/** The curated subset of the comparison we put on a single shareable image —
 *  the scoreboard, the head-to-head/agreement chips and the headline outright
 *  bets. Everything else in the compare view is intentionally left out so the
 *  result stays readable as one WhatsApp screenshot. */
export interface ShareCardData {
  aName: string
  bName: string
  aRank: number
  bRank: number
  aTotal: number
  bTotal: number
  leader: 'a' | 'b' | 'tie'
  gap: number
  leaderName: string | null
  identicalCount: number
  outcomeCount: number
  tallyA: number
  tallyB: number
  aChampion?: string
  bChampion?: string
  aGolden?: string
  bGolden?: string
}

const C = {
  paper: '#FBF8EC',
  navy: '#0B2244',
  gold: '#D4A016',
  ink: '#180F07',
  muted: '#7A6845',
  border: '#C8B87A',
}

function teamHe(team?: string): string {
  if (!team) return '—'
  return TEAMS[team]?.he ?? team
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Render the share card to a PNG blob. Pure drawing on an offscreen canvas —
 *  no flags or external images, so there's nothing to taint the canvas and the
 *  output can be exported and shared. */
export async function renderCompareCard(d: ShareCardData): Promise<Blob> {
  const scale = Math.min(3, Math.max(2, Math.round(window.devicePixelRatio || 2)))
  const W = 400
  const P = 22
  const GAP = 18

  const HEADER_H = 116
  const SB_H = 104
  const CHIP_H = 72
  const DEC_LABEL_H = 30
  const DEC_ROW_H = 44
  const FOOTER_H = 46
  const H =
    HEADER_H + GAP + SB_H + GAP + CHIP_H + GAP + DEC_LABEL_H + DEC_ROW_H * 2 + GAP + FOOTER_H

  if (document.fonts) {
    try {
      await Promise.all([
        document.fonts.load('400 40px "Bebas Neue"'),
        document.fonts.load('400 16px "Heebo"'),
        document.fonts.load('700 16px "Heebo"'),
      ])
      await document.fonts.ready
    } catch {
      /* fall back to whatever fonts are available */
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')
  ctx.scale(scale, scale)
  ctx.textBaseline = 'middle'

  const draw = (
    str: string,
    x: number,
    y: number,
    font: string,
    color: string,
    align: CanvasTextAlign,
    dir: CanvasDirection,
  ) => {
    ctx.font = font
    ctx.fillStyle = color
    ctx.textAlign = align
    ctx.direction = dir
    ctx.fillText(str, x, y)
  }

  /** Pick the largest font size (down to a floor) that keeps `str` within maxW. */
  const fitHeebo = (str: string, maxW: number, weight: number, base: number): string => {
    let size = base
    ctx.font = `${weight} ${size}px "Heebo", sans-serif`
    while (size > 9 && ctx.measureText(str).width > maxW) {
      size -= 1
      ctx.font = `${weight} ${size}px "Heebo", sans-serif`
    }
    return `${weight} ${size}px "Heebo", sans-serif`
  }

  // ── Background ──────────────────────────────────────────────
  ctx.fillStyle = C.paper
  ctx.fillRect(0, 0, W, H)

  // ── Header (poster style) ───────────────────────────────────
  ctx.fillStyle = C.navy
  ctx.fillRect(0, 0, W, 5)

  const cx = W / 2
  draw('גביע העולם FIFA', cx, 24, '600 10px "Heebo", sans-serif', C.muted, 'center', 'rtl')

  ctx.font = '400 30px "Bebas Neue", sans-serif'
  ctx.direction = 'ltr'
  const mundial = 'MUNDIAL '
  const year = '2026'
  const wM = ctx.measureText(mundial).width
  const wY = ctx.measureText(year).width
  const startX = cx - (wM + wY) / 2
  ctx.textAlign = 'left'
  ctx.fillStyle = C.navy
  ctx.fillText(mundial, startX, 54)
  ctx.fillStyle = C.gold
  ctx.fillText(year, startX + wM, 54)

  draw('השוואת טפסים', cx, 84, '700 15px "Heebo", sans-serif', C.navy, 'center', 'rtl')
  ctx.fillStyle = C.navy
  ctx.fillRect(cx - 56, 102, 112, 3)

  // ── Scoreboard (player A on the right, B on the left) ────────
  const sbY = HEADER_H + GAP
  const midW = 80
  const cardGap = 10
  const cardW = (W - 2 * P - midW - 2 * cardGap) / 2
  const aX = W - P - cardW
  const bX = P
  const midX = bX + cardW + cardGap

  const drawSbCard = (x: number, name: string, rank: number, total: number, lead: boolean) => {
    ctx.fillStyle = C.paper
    roundRect(ctx, x, sbY, cardW, SB_H, 8)
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = lead ? C.gold : C.border
    roundRect(ctx, x, sbY, cardW, SB_H, 8)
    ctx.stroke()
    const ccx = x + cardW / 2
    draw(`#${rank}`, ccx, sbY + 16, '400 12px "Bebas Neue", sans-serif', C.muted, 'center', 'ltr')
    draw(name, ccx, sbY + 38, fitHeebo(name, cardW - 12, 700, 14), C.ink, 'center', 'rtl')
    draw(
      String(total),
      ccx,
      sbY + 70,
      '400 40px "Bebas Neue", sans-serif',
      lead ? C.gold : C.navy,
      'center',
      'ltr',
    )
    draw("נק'", ccx, sbY + 93, '600 9px "Heebo", sans-serif', C.muted, 'center', 'rtl')
  }

  drawSbCard(aX, d.aName, d.aRank, d.aTotal, d.leader === 'a')
  drawSbCard(bX, d.bName, d.bRank, d.bTotal, d.leader === 'b')

  const mcx = midX + midW / 2
  draw('מול', mcx, sbY + 30, '400 13px "Bebas Neue", sans-serif', C.muted, 'center', 'rtl')
  const leadText =
    d.leader === 'tie' || !d.leaderName ? 'תיקו' : `${d.leaderName}\nמוביל ב-${d.gap}`
  leadText.split('\n').forEach((line, i) => {
    draw(
      line,
      mcx,
      sbY + 52 + i * 14,
      fitHeebo(line, midW + 6, 700, 10),
      C.navy,
      'center',
      'rtl',
    )
  })

  // ── Chips: identical / same-outcome / head-to-head ──────────
  const chipY = sbY + SB_H + GAP
  const chipGap = 10
  const chipW = (W - 2 * P - 2 * chipGap) / 3
  const chips: [string, string, CanvasDirection][] = [
    [String(d.identicalCount), 'ניחושים זהים', 'ltr'],
    [String(d.outcomeCount), 'תוצאות זהות', 'ltr'],
    [`${d.tallyA}-${d.tallyB}`, 'ראש בראש', 'ltr'],
  ]
  chips.forEach(([num, label, numDir], i) => {
    const right = W - P - i * (chipW + chipGap)
    const x = right - chipW
    ctx.fillStyle = C.paper
    roundRect(ctx, x, chipY, chipW, CHIP_H, 6)
    ctx.fill()
    ctx.lineWidth = 1
    ctx.strokeStyle = C.border
    roundRect(ctx, x, chipY, chipW, CHIP_H, 6)
    ctx.stroke()
    const ccx = x + chipW / 2
    draw(num, ccx, chipY + 27, '400 24px "Bebas Neue", sans-serif', C.navy, 'center', numDir)
    draw(label, ccx, chipY + 53, '700 10px "Heebo", sans-serif', C.muted, 'center', 'rtl')
  })

  // ── Outright bets (champion + golden boot) ──────────────────
  const decLabelY = chipY + CHIP_H + GAP
  draw(
    'הימורי הכרעה',
    W - P,
    decLabelY + DEC_LABEL_H / 2,
    '700 12px "Heebo", sans-serif',
    C.muted,
    'right',
    'rtl',
  )
  ctx.fillStyle = C.gold
  ctx.fillRect(W - P - 86, decLabelY + DEC_LABEL_H - 4, 86, 2)

  const rowY = decLabelY + DEC_LABEL_H
  const col = (W - 2 * P) / 3
  const colACx = W - P - col / 2
  const colLabelCx = W - P - col - col / 2
  const colBCx = P + col / 2
  const decRow = (label: string, aVal: string, bVal: string, idx: number) => {
    const y = rowY + idx * DEC_ROW_H
    ctx.strokeStyle = C.border
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(P, y)
    ctx.lineTo(W - P, y)
    ctx.stroke()
    const cy = y + DEC_ROW_H / 2
    draw(label, colLabelCx, cy, '700 11px "Heebo", sans-serif', C.muted, 'center', 'rtl')
    draw(aVal, colACx, cy, fitHeebo(aVal, col - 10, 600, 13), C.ink, 'center', 'rtl')
    draw(bVal, colBCx, cy, fitHeebo(bVal, col - 10, 600, 13), C.ink, 'center', 'rtl')
  }
  decRow('אלופה', teamHe(d.aChampion), teamHe(d.bChampion), 0)
  decRow('מלך השערים', d.aGolden || '—', d.bGolden || '—', 1)

  // ── Footer ──────────────────────────────────────────────────
  const footerY = rowY + 2 * DEC_ROW_H + GAP
  ctx.strokeStyle = C.border
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(P, footerY)
  ctx.lineTo(W - P, footerY)
  ctx.stroke()
  draw(
    'ההימור 2026',
    W / 2,
    footerY + FOOTER_H / 2,
    '700 12px "Heebo", sans-serif',
    C.navy,
    'center',
    'rtl',
  )

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('canvas toBlob returned null'))),
      'image/png',
    )
  })
}

export type ShareResult = 'shared' | 'cancelled' | 'downloaded'

/** Try the Web Share API with the image file (lets the user pick WhatsApp on
 *  mobile). When file sharing isn't supported (most desktops), download the
 *  PNG instead so it can be attached manually. */
export async function shareCompareImage(
  blob: Blob,
  filename: string,
  text: string,
): Promise<ShareResult> {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
    share?: (data?: ShareData) => Promise<void>
  }
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], text })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // any other failure: fall through to download
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
