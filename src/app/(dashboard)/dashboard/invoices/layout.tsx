import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Mes factures' }
export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</> }
