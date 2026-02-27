import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer'

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

const GOLD = '#d4a843'
const DARK = '#0f1016'
const GRAY = '#6b7280'
const LIGHT_BG = '#f8f8fa'
const WHITE = '#ffffff'

const fmtTND = (n: number) =>
  new Intl.NumberFormat('fr-TN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n) + ' TND'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return d
  }
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: WHITE,
    paddingBottom: 40,
  },
  goldBar: {
    height: 4,
    backgroundColor: GOLD,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 28,
    paddingTop: 18,
    paddingBottom: 14,
  },
  companyName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
  },
  companyMf: {
    fontSize: 8,
    color: GRAY,
    marginTop: 3,
  },
  badge: {
    backgroundColor: DARK,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    letterSpacing: 1,
  },
  invoiceNumber: {
    fontSize: 8,
    color: GRAY,
    textAlign: 'right',
    marginTop: 4,
  },
  separator: {
    height: 0.5,
    backgroundColor: '#e6e6eb',
    marginHorizontal: 28,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingTop: 14,
    paddingBottom: 14,
  },
  infoLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: GOLD,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  clientName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
  },
  clientMf: {
    fontSize: 8,
    color: GRAY,
    marginTop: 3,
  },
  metaBlock: {
    alignItems: 'flex-end',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 3,
  },
  metaKey: {
    fontSize: 8,
    color: GRAY,
    marginRight: 10,
    width: 80,
    textAlign: 'right',
  },
  metaVal: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
    width: 80,
    textAlign: 'right',
  },
  tableContainer: {
    marginHorizontal: 28,
    marginTop: 4,
    borderRadius: 3,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: DARK,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.3,
    borderBottomColor: '#e6e6eb',
  },
  tableRowAlt: {
    backgroundColor: LIGHT_BG,
  },
  thDesc: { flex: 1, fontSize: 7, fontFamily: 'Helvetica-Bold', color: WHITE },
  thNum: { width: 36, fontSize: 7, fontFamily: 'Helvetica-Bold', color: WHITE, textAlign: 'center' },
  thRight: { width: 56, fontSize: 7, fontFamily: 'Helvetica-Bold', color: WHITE, textAlign: 'right' },
  tdDesc: { flex: 1, fontSize: 8, color: DARK },
  tdNum: { width: 36, fontSize: 8, color: DARK, textAlign: 'center' },
  tdRight: { width: 56, fontSize: 8, color: DARK, textAlign: 'right' },
  totalsSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginHorizontal: 28,
    marginTop: 12,
  },
  totalsBox: {
    width: 200,
    borderWidth: 0.5,
    borderColor: '#e6e6eb',
    borderRadius: 3,
    backgroundColor: '#fafafa',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  totalsKey: { fontSize: 8, color: GRAY },
  totalsVal: { fontSize: 8, color: DARK, fontFamily: 'Helvetica-Bold' },
  totalsDivider: {
    height: 0.5,
    backgroundColor: GOLD,
    marginVertical: 6,
  },
  ttcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ttcKey: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: DARK },
  ttcVal: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: GOLD },
  notesSection: {
    marginHorizontal: 28,
    marginTop: 14,
  },
  notesLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: GOLD,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  notesText: {
    fontSize: 8,
    color: GRAY,
    lineHeight: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: DARK,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 7,
    color: '#b4b4b9',
  },
})

export function InvoicePdfDocument({ data }: { data: InvoicePdfData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Gold top bar */}
        <View style={s.goldBar} />

        {/* Header: company + badge */}
        <View style={s.header}>
          <View>
            <Text style={s.companyName}>{data.companyName}</Text>
            {data.companyMf && (
              <Text style={s.companyMf}>MF : {data.companyMf}</Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={s.badge}>
              <Text style={s.badgeText}>FACTURE</Text>
            </View>
            <Text style={s.invoiceNumber}>N° {data.invoiceNumber}</Text>
          </View>
        </View>

        <View style={s.separator} />

        {/* Client + Meta info */}
        <View style={s.infoRow}>
          <View>
            <Text style={s.infoLabel}>Facturer à</Text>
            <Text style={s.clientName}>{data.clientName}</Text>
            {data.clientMf && (
              <Text style={s.clientMf}>MF : {data.clientMf}</Text>
            )}
          </View>
          <View style={s.metaBlock}>
            <Text style={[s.infoLabel, { marginBottom: 6 }]}>Détails</Text>
            <View style={s.metaRow}>
              <Text style={s.metaKey}>Date d'émission</Text>
              <Text style={s.metaVal}>{fmtDate(data.issueDate)}</Text>
            </View>
            {data.dueDate && (
              <View style={s.metaRow}>
                <Text style={s.metaKey}>Échéance</Text>
                <Text style={s.metaVal}>{fmtDate(data.dueDate)}</Text>
              </View>
            )}
            {data.reference && (
              <View style={s.metaRow}>
                <Text style={s.metaKey}>Référence</Text>
                <Text style={s.metaVal}>{data.reference}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Line items table */}
        <View style={s.tableContainer}>
          <View style={s.tableHeader}>
            <Text style={s.thDesc}>Description</Text>
            <Text style={s.thNum}>Qté</Text>
            <Text style={s.thRight}>Prix unit.</Text>
            <Text style={s.thNum}>TVA</Text>
            <Text style={s.thRight}>Montant HT</Text>
          </View>
          {data.lineItems.map((li, idx) => (
            <View key={idx} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={s.tdDesc}>{li.description}</Text>
              <Text style={s.tdNum}>{li.quantity}</Text>
              <Text style={s.tdRight}>{fmtTND(li.unit_price)}</Text>
              <Text style={s.tdNum}>{li.tva_rate}%</Text>
              <Text style={s.tdRight}>{fmtTND(li.quantity * li.unit_price)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={s.totalsSection}>
          <View style={s.totalsBox}>
            <View style={s.totalsRow}>
              <Text style={s.totalsKey}>Total HT</Text>
              <Text style={s.totalsVal}>{fmtTND(data.htAmount)}</Text>
            </View>
            <View style={s.totalsRow}>
              <Text style={s.totalsKey}>TVA</Text>
              <Text style={s.totalsVal}>{fmtTND(data.tvaAmount)}</Text>
            </View>
            {data.stampAmount > 0 && (
              <View style={s.totalsRow}>
                <Text style={s.totalsKey}>Timbre fiscal</Text>
                <Text style={s.totalsVal}>{fmtTND(data.stampAmount)}</Text>
              </View>
            )}
            <View style={s.totalsDivider} />
            <View style={s.ttcRow}>
              <Text style={s.ttcKey}>Total TTC</Text>
              <Text style={s.ttcVal}>{fmtTND(data.ttcAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={s.notesSection}>
            <Text style={s.notesLabel}>Notes</Text>
            <Text style={s.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            {data.companyName}  •  Facture {data.invoiceNumber}  •  Généré par Fatoura Pro
          </Text>
        </View>
      </Page>
    </Document>
  )
}
