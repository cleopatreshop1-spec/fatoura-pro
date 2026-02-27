import { cn } from '@/lib/utils/cn'

interface SkeletonProps { className?: string }

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-lg bg-[#1a1b22]', className)} />
}

export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full')} />
      ))}
    </div>
  )
}

export function SkeletonTableRow({ cols = 6 }: { cols?: number }) {
  const widths = ['w-24','w-full','w-20','w-20','w-16','w-8']
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[#1a1b22]">
      <Skeleton className="w-3.5 h-3.5 rounded shrink-0" />
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', widths[i] ?? 'w-16')} />
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-[#0f1118] border border-[#1a1b22] rounded-2xl overflow-hidden">
      {/* Header shimmer */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-[#1a1b22] bg-[#161b27]/50">
        <Skeleton className="w-3.5 h-3 rounded shrink-0" />
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 w-16" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} cols={cols} />
      ))}
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-[#0f1118] border border-[#1a1b22] rounded-2xl p-5 space-y-3', className)}>
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-2.5 w-16" />
    </div>
  )
}

export function SkeletonKPIRow() {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  )
}

export function SkeletonInvoiceDetail() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
      <div className="xl:col-span-3 bg-white rounded-2xl p-8 space-y-6">
        <div className="flex justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40 bg-gray-200" />
            <Skeleton className="h-3 w-24 bg-gray-200" />
            <Skeleton className="h-3 w-32 bg-gray-200" />
          </div>
          <div className="space-y-2 items-end flex flex-col">
            <Skeleton className="h-8 w-32 bg-gray-200" />
            <Skeleton className="h-3 w-20 bg-gray-200" />
          </div>
        </div>
        <Skeleton className="h-1 w-full bg-gray-200" />
        <SkeletonTable rows={4} cols={5} />
      </div>
      <div className="xl:col-span-2 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}
