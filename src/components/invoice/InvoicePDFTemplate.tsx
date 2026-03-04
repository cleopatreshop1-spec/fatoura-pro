import React from 'react'
import {
  Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import { STAMP_DUTY } from '@/lib/utils/tva-calculator'

const GOLD  = '#d4a843'
const DARK  = '#0f1017'
const GRAY  = '#6b7280'
const LGRAY = '#9ca3af'
const LIGHT = '#f8f9fa'
const WHITE = '#ffffff'
const RED   = '#dc2626'
const GREEN = '#16a34a'

const fmtCurrency = (n: number, currency = 'TND') =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n) + ' ' + (currency || 'TND')

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

const s = StyleSheet.create({
  page:         { fontFamily: 'Helvetica', fontSize: 9, color: DARK, paddingHorizontal: 40, paddingVertical: 36, backgroundColor: WHITE },

  /* Header */
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  logoBox:      { width: 48, height: 48, borderRadius: 8, overflow: 'hidden', marginBottom: 6 },
  logoImg:      { width: 48, height: 48, objectFit: 'contain' },
  coName:       { fontFamily: 'Helvetica-Bold', fontSize: 15, color: DARK, marginBottom: 3 },
  coLine:       { fontSize: 7.5, color: GRAY, marginBottom: 1.5 },
  invTitle:     { fontFamily: 'Helvetica-Bold', fontSize: 30, color: GOLD, textAlign: 'right', letterSpacing: 2 },
  invNum:       { fontSize: 9, fontFamily: 'Helvetica-Bold', color: DARK, textAlign: 'right', marginTop: 4 },
  invMetaRow:   { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 },
  invMetaLabel: { fontSize: 7.5, color: LGRAY, marginRight: 6 },
  invMetaVal:   { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: DARK },

  /* Separator */
  sep:          { height: 1.5, backgroundColor: GOLD, marginVertical: 12 },
  sepThin:      { height: 0.5, backgroundColor: '#e5e7eb', marginVertical: 8 },

  /* Client block */
  clientBox:    { backgroundColor: LIGHT, borderRadius: 6, padding: 10, marginBottom: 14, borderLeft: 3, borderLeftColor: GOLD },
  clientLabel:  { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: GOLD, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  clientName:   { fontFamily: 'Helvetica-Bold', fontSize: 10, color: DARK, marginBottom: 2 },
  clientDetail: { fontSize: 7.5, color: GRAY, marginBottom: 1.5 },

  /* Table */
  tableHead:    { flexDirection: 'row', backgroundColor: DARK, paddingVertical: 6, paddingHorizontal: 4 },
  thText:       { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: WHITE },
  tableRow:     { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb' },
  tableRowAlt:  { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#e5e7eb', backgroundColor: LIGHT },
  tdText:       { fontSize: 8, color: DARK },
  tdTextGray:   { fontSize: 8, color: GRAY },
  colDesc:      { flex: 3 },
  colQty:       { width: 30, textAlign: 'center' },
  colPrice:     { width: 58, textAlign: 'right' },
  colTva:       { width: 28, textAlign: 'center' },
  colHT:        { width: 58, textAlign: 'right' },
  colTTC:       { width: 58, textAlign: 'right' },

  /* Totals */
  totalsWrapper:{ alignItems: 'flex-end', marginTop: 12 },
  totalsBox:    { width: 220, borderWidth: 0.5, borderColor: '#e5e7eb', borderRadius: 6, overflow: 'hidden' },
  totRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 10 },
  totRowGold:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 10, backgroundColor: DARK },
  totLabel:     { fontSize: 8, color: GRAY },
  totValue:     { fontSize: 8, fontFamily: 'Helvetica-Bold', color: DARK },
  totLabelBig:  { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: WHITE },
  totValueBig:  { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: GOLD },
  totDivider:   { height: 1, backgroundColor: GOLD, marginHorizontal: 10 },

  /* Amount in words */
  amountWords:  { marginTop: 10, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: LIGHT, borderRadius: 4 },
  amountText:   { fontFamily: 'Helvetica-Oblique', fontSize: 8, color: GRAY, textAlign: 'center' },

  /* Notes */
  notesBox:     { marginTop: 10, paddingVertical: 6, paddingHorizontal: 10, borderLeftWidth: 2, borderLeftColor: GOLD },
  notesLabel:   { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: GOLD, letterSpacing: 1, marginBottom: 3 },
  notesText:    { fontSize: 7.5, color: GRAY },

  /* Footer */
  footer:       { marginTop: 'auto', paddingTop: 12 },
  ttnBadge:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderWidth: 0.5, borderColor: '#86efac', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 8 },
  ttnDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN, marginRight: 6 },
  ttnText:      { fontSize: 7.5, color: GREEN, fontFamily: 'Helvetica-Bold', flex: 1 },
  ttnIdText:    { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#15803d', marginLeft: 6 },
  qrRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  qrBox:        { width: 56, height: 56, borderWidth: 0.5, borderColor: '#e5e7eb', borderRadius: 3, padding: 2 },
  qrImg:        { width: '100%', height: '100%' },
  qrInfoCol:    { flex: 1 },
  ribRow:       { flexDirection: 'row', marginBottom: 2 },
  ribLabel:     { fontSize: 7, color: LGRAY, marginRight: 4 },
  ribVal:       { fontSize: 7, fontFamily: 'Helvetica-Bold', color: DARK },
  pageNum:      { fontSize: 6.5, color: LGRAY, textAlign: 'right', marginTop: 4 },
  generator:    { fontSize: 6.5, color: LGRAY, textAlign: 'center', marginTop: 3, borderTopWidth: 0.5, borderTopColor: '#e5e7eb', paddingTop: 4 },
})

export interface InvoicePDFProps {
  invoice: {
    id: string; number: string | null; status: string
    issue_date: string | null; due_date: string | null
    ht_amount: number; tva_amount: number; ttc_amount: number
    total_in_words: string | null; notes: string | null
    ttn_id: string | null
    payment_status?: string | null
    currency?: string | null
    exchange_rate?: number | null
  }
  company: {
    name: string; matricule_fiscal: string | null; address: string | null
    phone: string | null; email: string | null; website: string | null
    bank_name: string | null; bank_rib: string | null; logo_url: string | null
    default_payment_terms: string | null; tva_regime: string | null
    invoice_footer?: string | null
  }
  client: {
    name: string; matricule_fiscal: string | null; address: string | null
    phone: string | null; email: string | null; type: string
  } | null
  lines: {
    description: string; quantity: number; unit_price: number
    tva_rate: number; line_ht: number; line_tva: number; line_ttc: number
  }[]
  qrDataUrl?: string | null
}

export function InvoicePDFTemplate({ invoice: inv, company: co, client: cl, lines, qrDataUrl }: InvoicePDFProps) {
  const currency = inv.currency && inv.currency !== 'TND' ? inv.currency : 'TND'
  const fmt = (n: number) => fmtCurrency(n, currency)
  // TVA groups from line items
  const tvaGroups: Record<number, { base: number; tva: number }> = {}
  for (const l of lines) {
    const r = Number(l.tva_rate ?? 19)
    if (!tvaGroups[r]) tvaGroups[r] = { base: 0, tva: 0 }
    tvaGroups[r].base += Number(l.line_ht ?? 0)
    tvaGroups[r].tva  += Number(l.line_tva ?? 0)
  }
  const tvaRows = [19, 13, 7, 0].filter(r => (tvaGroups[r]?.base ?? 0) > 0)
  const stampDuty = STAMP_DUTY

  const isPaid = inv.payment_status === 'paid'

  return (
    <Document title={`Facture ${inv.number ?? ''}`} author={co.name}>
      <Page size="A4" style={s.page}>

        {/* PAYEE watermark */}
        {isPaid && (
          <View style={{
            position: 'absolute',
            top: 280,
            left: 60,
            transform: 'rotate(-35deg)',
            opacity: 0.07,
          }}>
            <Text style={{
              fontSize: 110,
              fontFamily: 'Helvetica-Bold',
              color: GREEN,
              letterSpacing: 8,
            }}>PAYÉE</Text>
          </View>
        )}

        {/*  HEADER  */}
        <View style={s.header}>
          {/* Left: company info */}
          <View style={{ flex: 1, marginRight: 20 }}>
            {co.logo_url && (
              <View style={s.logoBox}>
                <Image src={co.logo_url} style={s.logoImg} />
              </View>
            )}
            <Text style={s.coName}>{co.name}</Text>
            {co.matricule_fiscal && <Text style={s.coLine}>MF : {co.matricule_fiscal}</Text>}
            {co.address && <Text style={s.coLine}>{co.address}</Text>}
            {co.phone   && <Text style={s.coLine}>Tél : {co.phone}</Text>}
            {co.email   && <Text style={s.coLine}>{co.email}</Text>}
          </View>

          {/* Right: invoice meta */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.invTitle}>FACTURE</Text>
            <Text style={s.invNum}>N° {inv.number ?? ''}</Text>
            {currency !== 'TND' && (
              <View style={{ marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: '#eff6ff', borderRadius: 3, borderWidth: 0.5, borderColor: '#93c5fd', alignSelf: 'flex-end' }}>
                <Text style={{ fontSize: 7, color: '#2563eb', fontFamily: 'Helvetica-Bold' }}>
                  Devise : {currency}{inv.exchange_rate && inv.exchange_rate !== 1 ? `  (1 ${currency} = ${inv.exchange_rate} TND)` : ''}
                </Text>
              </View>
            )}
            <View style={[s.invMetaRow, { marginTop: 6 }]}>
              <Text style={s.invMetaLabel}>Date :</Text>
              <Text style={s.invMetaVal}>{fmtDate(inv.issue_date)}</Text>
            </View>
            {inv.due_date && (
              <View style={s.invMetaRow}>
                <Text style={s.invMetaLabel}>Échéance :</Text>
                <Text style={s.invMetaVal}>{fmtDate(inv.due_date)}</Text>
              </View>
            )}
            {inv.status === 'valid' && (
              <View style={{ marginTop: 5, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#f0fdf4', borderRadius: 4, borderWidth: 0.5, borderColor: '#86efac' }}>
                <Text style={{ fontSize: 6.5, color: GREEN, fontFamily: 'Helvetica-Bold' }}> VALIDÉE TTN</Text>
              </View>
            )}
          </View>
        </View>

        {/*  SEPARATOR  */}
        <View style={s.sep} />

        {/*  CLIENT BLOCK  */}
        <View style={s.clientBox}>
          <Text style={s.clientLabel}>Facturer à</Text>
          {cl ? (
            <>
              <Text style={s.clientName}>{cl.name}</Text>
              {cl.matricule_fiscal && <Text style={s.clientDetail}>MF : {cl.matricule_fiscal}</Text>}
              {cl.address && <Text style={s.clientDetail}>{cl.address}</Text>}
              {cl.phone   && <Text style={s.clientDetail}>Tél : {cl.phone}</Text>}
              {cl.email   && <Text style={s.clientDetail}>{cl.email}</Text>}
              <Text style={{ fontSize: 6.5, color: LGRAY, marginTop: 3 }}>{cl.type}</Text>
            </>
          ) : (
            <Text style={s.clientName}>Particulier</Text>
          )}
        </View>

        {/*  LINES TABLE  */}
        {/* Header row */}
        <View style={s.tableHead}>
          <Text style={[s.thText, s.colDesc]}>Description</Text>
          <Text style={[s.thText, s.colQty,   { textAlign: 'center' }]}>Qté</Text>
          <Text style={[s.thText, s.colPrice,  { textAlign: 'right' }]}>PU HT</Text>
          <Text style={[s.thText, s.colTva,    { textAlign: 'center' }]}>TVA</Text>
          <Text style={[s.thText, s.colHT,     { textAlign: 'right' }]}>Total HT</Text>
          <Text style={[s.thText, s.colTTC,    { textAlign: 'right' }]}>Total TTC</Text>
        </View>

        {/* Data rows */}
        {lines.map((l, i) => {
          const rowStyle = i % 2 === 0 ? s.tableRow : s.tableRowAlt
          return (
            <View key={i} style={rowStyle}>
              <Text style={[s.tdText, s.colDesc]}>{l.description}</Text>
              <Text style={[s.tdTextGray, s.colQty,  { textAlign: 'center' }]}>{l.quantity}</Text>
              <Text style={[s.tdTextGray, s.colPrice, { textAlign: 'right' }]}>{fmt(l.unit_price)}</Text>
              <Text style={[s.tdTextGray, s.colTva,   { textAlign: 'center' }]}>{l.tva_rate}%</Text>
              <Text style={[s.tdTextGray, s.colHT,    { textAlign: 'right' }]}>{fmt(l.line_ht)}</Text>
              <Text style={[s.tdText,     s.colTTC,   { textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{fmt(l.line_ttc)}</Text>
            </View>
          )
        })}

        {/*  TOTALS  */}
        <View style={s.totalsWrapper}>
          <View style={s.totalsBox}>
            {/* HT */}
            <View style={s.totRow}>
              <Text style={s.totLabel}>Total HT</Text>
              <Text style={s.totValue}>{fmt(Number(inv.ht_amount))}</Text>
            </View>

            {/* TVA breakdown */}
            {tvaRows.map(rate => (
              <View key={rate} style={s.totRow}>
                <Text style={s.totLabel}>TVA {rate}% (base : {fmt(tvaGroups[rate].base)})</Text>
                <Text style={s.totValue}>{rate === 0 ? 'Exon.' : fmt(tvaGroups[rate].tva)}</Text>
              </View>
            ))}

            {/* Stamp */}
            <View style={s.totRow}>
              <Text style={s.totLabel}>Droit de timbre</Text>
              <Text style={s.totValue}>{fmt(stampDuty)}</Text>
            </View>

            {/* Divider */}
            <View style={s.totDivider} />

            {/* TTC */}
            <View style={s.totRowGold}>
              <Text style={s.totLabelBig}>TOTAL TTC</Text>
              <Text style={s.totValueBig}>{fmt(Number(inv.ttc_amount))}</Text>
            </View>
          </View>
        </View>

        {/*  AMOUNT IN WORDS  */}
        {inv.total_in_words && (
          <View style={s.amountWords}>
            <Text style={s.amountText}>Arrêté à la somme de : {inv.total_in_words}</Text>
          </View>
        )}

        {/*  NOTES  */}
        {inv.notes && (
          <View style={s.notesBox}>
            <Text style={s.notesLabel}>Notes</Text>
            <Text style={s.notesText}>{inv.notes}</Text>
          </View>
        )}

        {/*  FOOTER  */}
        <View style={s.footer}>
          <View style={s.sepThin} />

          {/* TTN validation badge + QR */}
          {inv.status === 'valid' && inv.ttn_id && (
            <View style={s.qrRow}>
              {qrDataUrl && (
                <View style={s.qrBox}>
                  <Image src={qrDataUrl} style={s.qrImg} />
                </View>
              )}
              <View style={s.qrInfoCol}>
                <View style={s.ttnBadge}>
                  <View style={s.ttnDot} />
                  <Text style={s.ttnText}>Facture électronique validée par TTN/ElFatoora</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 7, color: LGRAY, marginRight: 4 }}>TTN-ID :</Text>
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: DARK }}>{inv.ttn_id}</Text>
                </View>
              </View>
            </View>
          )}

          {/* RIB */}
          {(co.bank_name || co.bank_rib) && (
            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 6.5, color: LGRAY, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>
                Coordonnées bancaires
              </Text>
              <View style={s.ribRow}>
                {co.bank_name && <><Text style={s.ribLabel}>Banque :</Text><Text style={[s.ribVal, { marginRight: 14 }]}>{co.bank_name}</Text></>}
                {co.bank_rib  && <><Text style={s.ribLabel}>RIB :</Text><Text style={s.ribVal}>{co.bank_rib}</Text></>}
              </View>
            </View>
          )}

          {/* Payment terms */}
          {co.default_payment_terms && (
            <Text style={{ fontSize: 7, color: LGRAY, fontStyle: 'italic', marginBottom: 4 }}>
              {co.default_payment_terms}
            </Text>
          )}

          {/* Custom footer text */}
          {co.invoice_footer && (
            <Text style={{ fontSize: 7, color: LGRAY, marginBottom: 4, lineHeight: 1.4 }}>
              {co.invoice_footer}
            </Text>
          )}

          {/* Page number */}
          <Text style={s.pageNum} render={({ pageNumber, totalPages }) => `Page ${pageNumber}/${totalPages}`} fixed />

          {/* Generator note */}
          <Text style={s.generator}>Document généré par Fatoura Pro  www.fatoura.pro</Text>
        </View>
      </Page>
    </Document>
  )
}
