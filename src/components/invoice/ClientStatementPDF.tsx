import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Me5Q.ttf', fontWeight: 'normal' },
    { src: 'https://fonts.gstatic.com/s/roboto/v32/KFOlCnqEu92Fr1MmEU9fBBc-.ttf', fontWeight: 'bold' },
  ],
})

const s = StyleSheet.create({
  page:       { fontFamily: 'Helvetica', fontSize: 9, color: '#1a1a2e', paddingHorizontal: 40, paddingVertical: 36 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  companyName:{ fontSize: 14, fontWeight: 'bold', color: '#1a1a2e' },
  companyMeta:{ fontSize: 8, color: '#6b7280', marginTop: 2 },
  titleBlock: { alignItems: 'flex-end' },
  title:      { fontSize: 18, fontWeight: 'bold', color: '#1a1a2e', letterSpacing: 2 },
  subtitle:   { fontSize: 9, color: '#6b7280', marginTop: 2 },
  divider:    { height: 1, backgroundColor: '#e5e7eb', marginVertical: 14 },
  clientBox:  { backgroundColor: '#f9fafb', padding: 12, borderRadius: 4, marginBottom: 16 },
  clientTitle:{ fontSize: 8, fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  clientName: { fontSize: 11, fontWeight: 'bold', color: '#1a1a2e' },
  clientMeta: { fontSize: 8, color: '#6b7280', marginTop: 2 },
  tableHead:  { flexDirection: 'row', backgroundColor: '#1a1a2e', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 3 },
  tableHCell: { fontSize: 8, fontWeight: 'bold', color: '#ffffff', flex: 1 },
  tableHCellR:{ fontSize: 8, fontWeight: 'bold', color: '#ffffff', flex: 1, textAlign: 'right' },
  tableRow:   { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tableRowAlt:{ flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  cell:       { fontSize: 8, color: '#374151', flex: 1 },
  cellR:      { fontSize: 8, color: '#374151', flex: 1, textAlign: 'right' },
  cellBold:   { fontSize: 8, color: '#1a1a2e', fontWeight: 'bold', flex: 1 },
  statusPaid: { fontSize: 7, color: '#059669', fontWeight: 'bold' },
  statusUnpaid:{ fontSize: 7, color: '#d97706', fontWeight: 'bold' },
  statusOver: { fontSize: 7, color: '#dc2626', fontWeight: 'bold' },
  summaryRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  summaryBox: { backgroundColor: '#1a1a2e', padding: 12, borderRadius: 4, minWidth: 200 },
  summaryLine:{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel:{ fontSize: 8, color: '#9ca3af' },
  summaryVal: { fontSize: 8, color: '#ffffff', fontWeight: 'bold' },
  summaryValGreen:{ fontSize: 8, color: '#34d399', fontWeight: 'bold' },
  summaryValAmber:{ fontSize: 8, color: '#fbbf24', fontWeight: 'bold' },
  footer:     { marginTop: 24, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 10 },
  footerText: { fontSize: 7, color: '#9ca3af', textAlign: 'center' },
})

type InvoiceRow = {
  number: string | null
  issue_date: string | null
  due_date: string | null
  ht_amount: number
  tva_amount: number
  ttc_amount: number
  payment_status: string | null
  status: string
}

interface Props {
  company: { name: string; matricule_fiscal?: string; address?: string; phone?: string; email?: string }
  client: { name: string; matricule_fiscal?: string; email?: string; phone?: string; address?: string }
  invoices: InvoiceRow[]
  generatedAt: string
  periodLabel: string
}

const fmt = (v: number) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v)

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—'

function payLabel(inv: InvoiceRow) {
  if (inv.payment_status === 'paid') return { text: 'Payée', style: s.statusPaid }
  if (inv.due_date && inv.due_date < new Date().toISOString().slice(0, 10)) return { text: 'En retard', style: s.statusOver }
  return { text: 'Impayée', style: s.statusUnpaid }
}

export function ClientStatementPDF({ company, client, invoices, generatedAt, periodLabel }: Props) {
  const totalHT  = invoices.reduce((sum, i) => sum + Number(i.ht_amount  ?? 0), 0)
  const totalTVA = invoices.reduce((sum, i) => sum + Number(i.tva_amount ?? 0), 0)
  const totalTTC = invoices.reduce((sum, i) => sum + Number(i.ttc_amount ?? 0), 0)
  const paidTTC  = invoices.filter(i => i.payment_status === 'paid').reduce((sum, i) => sum + Number(i.ttc_amount ?? 0), 0)
  const unpaidTTC = totalTTC - paidTTC

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.companyName}>{company.name}</Text>
            {company.matricule_fiscal && <Text style={s.companyMeta}>MF: {company.matricule_fiscal}</Text>}
            {company.address && <Text style={s.companyMeta}>{company.address}</Text>}
            {company.phone  && <Text style={s.companyMeta}>{company.phone}</Text>}
          </View>
          <View style={s.titleBlock}>
            <Text style={s.title}>RELEVÉ DE COMPTE</Text>
            <Text style={s.subtitle}>{periodLabel}</Text>
            <Text style={s.subtitle}>Généré le {generatedAt}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Client block */}
        <View style={s.clientBox}>
          <Text style={s.clientTitle}>Client</Text>
          <Text style={s.clientName}>{client.name}</Text>
          {client.matricule_fiscal && <Text style={s.clientMeta}>MF: {client.matricule_fiscal}</Text>}
          {client.email   && <Text style={s.clientMeta}>{client.email}</Text>}
          {client.phone   && <Text style={s.clientMeta}>{client.phone}</Text>}
          {client.address && <Text style={s.clientMeta}>{client.address}</Text>}
        </View>

        {/* Table header */}
        <View style={s.tableHead}>
          <Text style={[s.tableHCell, { flex: 1.2 }]}>N° Facture</Text>
          <Text style={s.tableHCell}>Date</Text>
          <Text style={s.tableHCell}>Échéance</Text>
          <Text style={s.tableHCellR}>HT</Text>
          <Text style={s.tableHCellR}>TVA</Text>
          <Text style={s.tableHCellR}>TTC</Text>
          <Text style={[s.tableHCell, { textAlign: 'center' }]}>Statut</Text>
        </View>

        {/* Table rows */}
        {invoices.map((inv, idx) => {
          const pay = payLabel(inv)
          const rowStyle = idx % 2 === 0 ? s.tableRow : s.tableRowAlt
          return (
            <View key={idx} style={rowStyle}>
              <Text style={[s.cellBold, { flex: 1.2 }]}>{inv.number ?? '—'}</Text>
              <Text style={s.cell}>{fmtDate(inv.issue_date)}</Text>
              <Text style={s.cell}>{fmtDate(inv.due_date)}</Text>
              <Text style={s.cellR}>{fmt(Number(inv.ht_amount ?? 0))}</Text>
              <Text style={s.cellR}>{fmt(Number(inv.tva_amount ?? 0))}</Text>
              <Text style={s.cellR}>{fmt(Number(inv.ttc_amount ?? 0))}</Text>
              <Text style={[pay.style, { flex: 1, textAlign: 'center' }]}>{pay.text}</Text>
            </View>
          )
        })}

        {/* Summary */}
        <View style={s.summaryRow}>
          <View style={s.summaryBox}>
            <View style={s.summaryLine}>
              <Text style={s.summaryLabel}>Total HT</Text>
              <Text style={s.summaryVal}>{fmt(totalHT)} TND</Text>
            </View>
            <View style={s.summaryLine}>
              <Text style={s.summaryLabel}>Total TVA</Text>
              <Text style={s.summaryVal}>{fmt(totalTVA)} TND</Text>
            </View>
            <View style={[s.summaryLine, { borderTopWidth: 1, borderTopColor: '#374151', paddingTop: 4, marginTop: 2 }]}>
              <Text style={s.summaryLabel}>Total TTC</Text>
              <Text style={s.summaryVal}>{fmt(totalTTC)} TND</Text>
            </View>
            <View style={s.summaryLine}>
              <Text style={s.summaryLabel}>Payé</Text>
              <Text style={s.summaryValGreen}>{fmt(paidTTC)} TND</Text>
            </View>
            <View style={s.summaryLine}>
              <Text style={s.summaryLabel}>Solde dû</Text>
              <Text style={unpaidTTC > 0 ? s.summaryValAmber : s.summaryValGreen}>{fmt(unpaidTTC)} TND</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            {company.name} — {invoices.length} facture{invoices.length > 1 ? 's' : ''} — Document généré automatiquement par Fatoura Pro
          </Text>
        </View>
      </Page>
    </Document>
  )
}
