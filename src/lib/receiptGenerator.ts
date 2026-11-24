import { formatFullDate, formatISTDateTime } from '@/lib/formatters'

export interface TreasuryReceiptData {
  receiptNumber: string
  entryDate: string
  createdAtIso: string
  donorName: string
  categoryDisplay: string
  amount: number
  paymentMode: string
  referenceNo?: string | null
  note?: string | null
  loggedByName: string
  associationName?: string
  bankSummary?: string
  upiId?: string
}

function escapePdfText(raw: string): string {
  return raw
    .replace(/₹/g, 'Rs. ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function wrapLine(text: string, maxChars = 72): string[] {
  const clean = text.trim()
  if (!clean) return []
  const words = clean.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const w of words) {
    if (!current) {
      current = w
    } else if (current.length + 1 + w.length <= maxChars) {
      current += ' ' + w
    } else {
      lines.push(current)
      current = w
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * Generates a valid A4 PDF receipt Blob in the browser with zero external dependencies.
 */
export function generateReceiptPdfBlob(data: TreasuryReceiptData): Blob {
  const assocName = data.associationName?.trim() || 'Fenestrians Alumni Association'
  const formattedAmount = `Rs. ${Number(data.amount || 0).toLocaleString('en-IN')}/-`
  const receiptDateStr = formatFullDate(data.entryDate)
  const loggedAtIst = formatISTDateTime(data.createdAtIso)

  const commands: string[] = []

  const drawText = (
    text: string,
    x: number,
    y: number,
    font: 'F1' | 'F2' = 'F1',
    size = 11
  ) => {
    commands.push(
      `BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`
    )
  }

  const drawLine = (x1: number, y1: number, x2: number, y2: number, width = 1) => {
    commands.push(`${width} w ${x1} ${y1} m ${x2} ${y2} l S`)
  }

  const drawRect = (x: number, y: number, w: number, h: number, width = 1) => {
    commands.push(`${width} w ${x} ${y} ${w} ${h} re S`)
  }

  // Outer Border
  drawRect(36, 48, 523, 750, 1.5)
  drawRect(42, 54, 511, 738, 0.5)

  // Header
  drawText(assocName.toUpperCase(), 60, 755, 'F2', 16)
  drawText('OFFICIAL FUND RECEIPT / ACKNOWLEDGEMENT', 60, 735, 'F2', 11)
  drawLine(55, 722, 540, 722, 1.2)

  // Receipt No & Date
  drawText(`Receipt No: ${data.receiptNumber}`, 60, 698, 'F2', 11)
  drawText(`Receipt Date: ${receiptDateStr}`, 350, 698, 'F1', 11)
  drawLine(55, 685, 540, 685, 0.6)

  // Body Fields
  let y = 655
  const rowGap = 32

  drawText('Received With Thanks From:', 60, y, 'F2', 11)
  drawText(data.donorName, 235, y, 'F2', 12)
  y -= rowGap

  drawText('Sum of Rupees:', 60, y, 'F2', 11)
  drawText(formattedAmount, 235, y, 'F2', 13)
  y -= rowGap

  drawText('Towards / Category:', 60, y, 'F2', 11)
  drawText(data.categoryDisplay, 235, y, 'F1', 11)
  y -= rowGap

  drawText('Payment Mode:', 60, y, 'F2', 11)
  drawText(data.paymentMode || 'UPI / Bank Transfer', 235, y, 'F1', 11)
  y -= rowGap

  drawText('UPI / Bank Reference No.:', 60, y, 'F2', 11)
  drawText(data.referenceNo?.trim() || 'N/A', 235, y, 'F1', 11)
  y -= rowGap

  if (data.note && data.note.trim()) {
    drawText('Particulars / Note:', 60, y, 'F2', 11)
    const wrapped = wrapLine(data.note.trim(), 48)
    wrapped.slice(0, 3).forEach((line, idx) => {
      drawText(line, 235, y - idx * 16, 'F1', 10)
    })
    y -= rowGap + (Math.min(3, wrapped.length) - 1) * 16
  }

  // Amount Highlight Box
  y -= 12
  drawRect(60, y - 28, 475, 42, 1)
  drawText('TOTAL AMOUNT RECEIVED:', 75, y - 12, 'F2', 12)
  drawText(formattedAmount, 360, y - 12, 'F2', 14)

  // Account & Audit Footer
  y -= 68
  drawLine(55, y + 18, 540, y + 18, 0.6)

  if (data.bankSummary || data.upiId) {
    const acctLine = [data.bankSummary, data.upiId ? `UPI: ${data.upiId}` : '']
      .filter(Boolean)
      .join(' | ')
    drawText(`Association Account: ${acctLine}`, 60, y, 'F1', 9)
    y -= 20
  }

  drawText(`Logged By: ${data.loggedByName}`, 60, y, 'F2', 10)
  y -= 18
  drawText(`Recorded Timestamp: ${loggedAtIst}`, 60, y, 'F1', 10)

  drawText('Authorized Signatory', 405, 115, 'F2', 10)
  drawText('Treasurer / Office Bearer', 392, 100, 'F1', 9)
  drawLine(55, 85, 540, 85, 0.6)
  drawText(
    'This is a system-generated official receipt from Fenestrians Alumni Association.',
    60,
    68,
    'F1',
    9
  )

  const contentStream = commands.join('\n')
  const encoder = new TextEncoder()
  const streamBytes = encoder.encode(contentStream)

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
    `6 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
  ]

  const header = '%PDF-1.4\n'
  let offset = encoder.encode(header).length
  const offsets: number[] = [0]

  for (const obj of objects) {
    offsets.push(offset)
    offset += encoder.encode(obj).length
  }

  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`
  const fullPdfString = header + objects.join('') + xref + trailer

  return new Blob([encoder.encode(fullPdfString)], { type: 'application/pdf' })
}

export function triggerPdfDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
