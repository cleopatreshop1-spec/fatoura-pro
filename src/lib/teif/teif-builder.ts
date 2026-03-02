// src/lib/teif/teif-builder.ts
// Builds TEIF-compliant XML from Fatoura Pro invoice data
// Required before signing and submission to ElFatoora (TTN)
// Per: Guide Adhésion TTN 2025

export interface TeifLine {
  id: string
  description: string
  quantity: number
  unit_price: number
  tva_rate: number
  line_ht: number
  line_tva: number
  line_ttc: number
  sort_order?: number
}

export interface TeifCompany {
  name: string
  matricule_fiscal?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  tva_regime?: string | null
}

export interface TeifClient {
  name: string
  matricule_fiscal?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  type?: string | null
}

export interface TeifInvoice {
  id: string
  number: string
  issue_date: string | null
  due_date?: string | null
  ht_amount: number
  tva_amount: number
  ttc_amount: number
  stamp_amount?: number
  total_in_words?: string | null
  notes?: string | null
  payment_status?: string | null
  invoice_line_items?: TeifLine[]
}

function escapeXml(val: string | null | undefined): string {
  if (!val) return ''
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function fmt3(n: number): string {
  return Number(n ?? 0).toFixed(3)
}

function isoDate(d: string | null | undefined): string {
  if (!d) return new Date().toISOString().slice(0, 10)
  return d.slice(0, 10)
}

export function buildTEIF(
  invoice: TeifInvoice,
  company: TeifCompany,
  client: TeifClient | null,
): string {
  const lines: TeifLine[] = ((invoice.invoice_line_items ?? []) as TeifLine[])
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const stampDuty = Number(invoice.stamp_amount ?? 0.6)

  const linesXml = lines.map((l, idx) => `
    <InvoiceLine>
      <LineID>${idx + 1}</LineID>
      <Description>${escapeXml(l.description)}</Description>
      <Quantity>${Number(l.quantity).toFixed(3)}</Quantity>
      <UnitPrice>${fmt3(l.unit_price)}</UnitPrice>
      <TaxRate>${Number(l.tva_rate ?? 19)}</TaxRate>
      <LineTotalHT>${fmt3(l.line_ht)}</LineTotalHT>
      <LineTVA>${fmt3(l.line_tva)}</LineTVA>
      <LineTotalTTC>${fmt3(l.line_ttc)}</LineTotalTTC>
    </InvoiceLine>`).join('')

  const clientXml = client ? `
  <Buyer>
    <Name>${escapeXml(client.name)}</Name>
    <MatriculeFiscal>${escapeXml(client.matricule_fiscal)}</MatriculeFiscal>
    <Address>${escapeXml(client.address)}</Address>
    <Phone>${escapeXml(client.phone)}</Phone>
    <Email>${escapeXml(client.email)}</Email>
    <Type>${escapeXml(client.type ?? 'B2C')}</Type>
  </Buyer>` : `
  <Buyer>
    <Name>Particulier</Name>
    <Type>B2C</Type>
  </Buyer>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="teif-schema-v1.xsd">

  <Header>
    <InvoiceNumber>${escapeXml(invoice.number)}</InvoiceNumber>
    <IssueDate>${isoDate(invoice.issue_date)}</IssueDate>
    <DueDate>${isoDate(invoice.due_date)}</DueDate>
    <Currency>TND</Currency>
    <InvoiceType>commercial</InvoiceType>
  </Header>

  <Seller>
    <Name>${escapeXml(company.name)}</Name>
    <MatriculeFiscal>${escapeXml(company.matricule_fiscal)}</MatriculeFiscal>
    <Address>${escapeXml(company.address)}</Address>
    <Phone>${escapeXml(company.phone)}</Phone>
    <Email>${escapeXml(company.email)}</Email>
    <TVARegime>${escapeXml(company.tva_regime ?? 'reel')}</TVARegime>
  </Seller>
${clientXml}

  <Lines>${linesXml}
  </Lines>

  <Totals>
    <TotalHT>${fmt3(invoice.ht_amount)}</TotalHT>
    <TotalTVA>${fmt3(invoice.tva_amount)}</TotalTVA>
    <DroitDeTimbre>${fmt3(stampDuty)}</DroitDeTimbre>
    <TotalTTC>${fmt3(invoice.ttc_amount)}</TotalTTC>
    <TotalInWords>${escapeXml(invoice.total_in_words)}</TotalInWords>
  </Totals>

  <!-- XAdES signature will be appended here by xades-signer -->

</Invoice>`
}
