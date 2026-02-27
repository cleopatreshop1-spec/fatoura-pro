import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface InvoicePdfData {
  companyName: string
  companyMf: string | null
  clientName: string
  clientMf: string | null
  invoiceNumber: string
  issueDate: string | null
  dueDate: string | null
  reference: string | null
  notes: string | null
  lineItems: {
    description: string
    quantity: number
    unit_price: number
    tva_rate: number
  }[]
  htAmount: number
  tvaAmount: number
  stampAmount: number
  ttcAmount: number
}

// ── Colors ──
const GOLD: [number, number, number] = [212, 168, 67]
const DARK: [number, number, number] = [15, 16, 22]
const GRAY: [number, number, number] = [120, 120, 130]
const LIGHT_BG: [number, number, number] = [248, 248, 250]
const WHITE: [number, number, number] = [255, 255, 255]

const fmtTND = (n: number) =>
  new Intl.NumberFormat('fr-TN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n) + ' TND'

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function generateInvoicePdf(data: InvoicePdfData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 20

  // ── Gold accent bar at top ──
  doc.setFillColor(...GOLD)
  doc.rect(0, 0, pageW, 4, 'F')

  // ── Company name (top-left) ──
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(data.companyName, margin, 22)

  if (data.companyMf) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(`MF : ${data.companyMf}`, margin, 28)
  }

  // ── FACTURE badge (top-right) ──
  const badgeW = 50
  const badgeH = 12
  const badgeX = pageW - margin - badgeW
  const badgeY = 12
  doc.setFillColor(...DARK)
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2, 2, 'F')
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text('FACTURE', badgeX + badgeW / 2, badgeY + 8.5, { align: 'center' })

  // ── Invoice number below badge ──
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text(`N° ${data.invoiceNumber}`, pageW - margin, badgeY + badgeH + 6, {
    align: 'right',
  })

  // ── Separator line ──
  const sepY = 38
  doc.setDrawColor(230, 230, 235)
  doc.setLineWidth(0.3)
  doc.line(margin, sepY, pageW - margin, sepY)

  // ── Client box (left) ──
  let y = 46
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GOLD)
  doc.text('FACTURER À', margin, y)

  y += 6
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(data.clientName, margin, y)

  if (data.clientMf) {
    y += 5
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(`MF : ${data.clientMf}`, margin, y)
  }

  // ── Date box (right) ──
  const rightCol = pageW - margin
  let metaY = 46

  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GOLD)
  doc.text('DÉTAILS', rightCol, metaY, { align: 'right' })

  metaY += 6
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text("Date d'émission", rightCol - 50, metaY)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(fmtDate(data.issueDate), rightCol, metaY, { align: 'right' })

  if (data.dueDate) {
    metaY += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text('Échéance', rightCol - 50, metaY)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(fmtDate(data.dueDate), rightCol, metaY, { align: 'right' })
  }

  if (data.reference) {
    metaY += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text('Référence', rightCol - 50, metaY)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(data.reference, rightCol, metaY, { align: 'right' })
  }

  // ── Line items table ──
  const tableY = Math.max(y, metaY) + 14

  const tableRows = data.lineItems.map((li) => {
    const lineHT = li.quantity * li.unit_price
    return [
      li.description,
      String(li.quantity),
      fmtTND(li.unit_price),
      `${li.tva_rate}%`,
      fmtTND(lineHT),
    ]
  })

  autoTable(doc, {
    startY: tableY,
    margin: { left: margin, right: margin },
    head: [['Description', 'Qté', 'Prix unitaire', 'TVA', 'Montant HT']],
    body: tableRows,
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      textColor: DARK,
      lineColor: [230, 230, 235],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: DARK,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
    },
    alternateRowStyles: { fillColor: LIGHT_BG },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'right', cellWidth: 32 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 32 },
    },
  })

  // ── Totals box (bottom-right) ──
  const finalY = (doc as any).lastAutoTable?.finalY ?? tableY + 30
  const boxW = 75
  const boxX = pageW - margin - boxW
  let totY = finalY + 8

  // Background box
  const boxLines = data.stampAmount > 0 ? 4 : 3
  const boxH = boxLines * 8 + 14
  doc.setFillColor(250, 250, 252)
  doc.setDrawColor(230, 230, 235)
  doc.roundedRect(boxX, totY - 4, boxW, boxH, 2, 2, 'FD')

  const labelX = boxX + 6
  const valX = boxX + boxW - 6

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text('Total HT', labelX, totY + 2)
  doc.setTextColor(...DARK)
  doc.text(fmtTND(data.htAmount), valX, totY + 2, { align: 'right' })

  totY += 8
  doc.setTextColor(...GRAY)
  doc.text('TVA', labelX, totY + 2)
  doc.setTextColor(...DARK)
  doc.text(fmtTND(data.tvaAmount), valX, totY + 2, { align: 'right' })

  if (data.stampAmount > 0) {
    totY += 8
    doc.setTextColor(...GRAY)
    doc.text('Timbre fiscal', labelX, totY + 2)
    doc.setTextColor(...DARK)
    doc.text(fmtTND(data.stampAmount), valX, totY + 2, { align: 'right' })
  }

  // Gold divider
  totY += 8
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.5)
  doc.line(labelX, totY - 2, valX, totY - 2)

  // TTC total
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text('Total TTC', labelX, totY + 3)
  doc.setTextColor(...GOLD)
  doc.text(fmtTND(data.ttcAmount), valX, totY + 3, { align: 'right' })

  // ── Notes ──
  if (data.notes) {
    const notesY = totY + 20
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...GOLD)
    doc.text('NOTES', margin, notesY)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    const noteLines = doc.splitTextToSize(data.notes, pageW / 2)
    doc.text(noteLines, margin, notesY + 5)
  }

  // ── Footer bar ──
  doc.setFillColor(...DARK)
  doc.rect(0, pageH - 10, pageW, 10, 'F')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 185)
  doc.text(
    `${data.companyName}  •  Facture ${data.invoiceNumber}  •  Généré par Fatoura Pro`,
    pageW / 2,
    pageH - 4,
    { align: 'center' }
  )

  return doc
}
