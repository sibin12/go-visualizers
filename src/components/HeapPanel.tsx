import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { HeapObject, StackFrame } from '../types'
import { cn, copyText, formatInt } from '../utils'
import { isReachable } from '../runtime'

type HeapFilter = 'all' | 'live' | 'pending' | 'roots'

export function HeapPanel({
  objects,
  frames,
  refs,
  selectedHeapId,
  gcActive,
  pulse,
  onSelect,
}: {
  objects: HeapObject[]
  frames: StackFrame[]
  refs: Map<string, string[]>
  selectedHeapId: string | null
  gcActive: boolean
  pulse: boolean
  onSelect: (heapId: string, analysis: HeapObject['analysis']) => void
}) {
  const [filter, setFilter] = useState<HeapFilter>('all')
  const [query, setQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedHeapId) return
    document.getElementById(`heap-${selectedHeapId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedHeapId])

  const resident = objects.reduce((sum, obj) => sum + obj.bytes, 0)
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return objects.filter((obj) => {
      const reachable = isReachable(obj, frames)
      if (filter === 'live' && !(obj.status === 'live' && reachable)) return false
      if (filter === 'pending' && obj.status !== 'collecting' && reachable) return false
      if (filter === 'roots' && !obj.globalRoot) return false
      if (!needle) return true
      return `${obj.address} ${obj.name} ${obj.type} ${obj.escapedFrom}`.toLowerCase().includes(needle)
    })
  }, [objects, frames, filter, query])

  async function copyAddress(id: string, address: string) {
    const ok = await copyText(address)
    if (!ok) return
    setCopiedId(id)
    window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1200)
  }

  return (
    <section
      className={cn(
        'relative flex min-h-[34rem] min-w-0 flex-col overflow-hidden rounded-2xl border bg-zinc-900/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-shadow duration-500 xl:min-h-0 xl:h-full',
        pulse || gcActive
          ? 'border-amber-400/70 shadow-[0_0_32px_rgba(251,191,36,0.12)]'
          : 'border-zinc-800',
        gcActive && 'border-rose-400/50 shadow-[0_0_32px_rgba(251,113,133,0.12)]',
      )}
    >
      <header className="shrink-0 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-400/80">Right panel</p>
            <h2 className="text-sm font-semibold text-zinc-100">The Heap</h2>
          </div>
          <div className="text-right font-mono text-[11px] text-amber-200/80">
            <div>{objects.length} resident</div>
            <div className="text-zinc-500">{formatInt(resident)} B</div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {(
            [
              ['all', 'All'],
              ['live', 'Live'],
              ['pending', 'Pending GC'],
              ['roots', 'GC roots'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                'rounded-md px-2 py-0.5 text-[11px]',
                filter === id ? 'bg-amber-400/15 text-amber-100' : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="mt-2 block">
          <span className="sr-only">Search heap objects</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search address, type, or frame"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-amber-500/40"
          />
        </label>
      </header>

      <div className="panel-scroll relative min-h-0 flex-1 overflow-auto p-3">
        {gcActive && (
          <div className="pointer-events-none absolute inset-x-3 z-10 h-16 bg-gradient-to-b from-rose-400/0 via-rose-300/25 to-amber-200/0 gc-sweep-line" />
        )}
        {objects.length === 0 ? (
          <EmptyHeap />
        ) : shown.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-zinc-500">Nothing in this view. Try All, or run an escape that matches the filter.</p>
        ) : (
          <div className="space-y-3">
            {shown.map((obj) => (
              <HeapCard
                key={obj.id}
                obj={obj}
                reachable={isReachable(obj, frames)}
                selected={obj.id === selectedHeapId}
                gcActive={gcActive}
                copied={copiedId === obj.id}
                labels={refs.get(obj.id) ?? []}
                onSelect={onSelect}
                onCopy={() => void copyAddress(obj.id, obj.address)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function HeapCard({
  obj,
  reachable,
  selected,
  gcActive,
  copied,
  labels,
  onSelect,
  onCopy,
}: {
  obj: HeapObject
  reachable: boolean
  selected: boolean
  gcActive: boolean
  copied: boolean
  labels: string[]
  onSelect: (heapId: string, analysis: HeapObject['analysis']) => void
  onCopy: () => void
}) {
  const sweeping = obj.status === 'collecting'
  return (
    <article
      id={`heap-${obj.id}`}
      className={cn(
        'heap-in rounded-xl border px-3 py-3',
        sweeping && 'sweep-out border-rose-400/50 bg-rose-400/10',
        !sweeping && reachable && 'border-amber-400/40 bg-amber-400/[0.06]',
        !sweeping && !reachable && 'border-dashed border-rose-400/40 bg-rose-400/[0.04]',
        selected && 'ring-2 ring-amber-300/80',
        gcActive && reachable && !sweeping && 'mark-glow',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => onSelect(obj.id, obj.analysis)} className="min-w-0 text-left">
          <span className="font-mono text-[12px] text-amber-200">{obj.address}</span>
          <h3 className="mt-0.5 font-mono text-sm text-zinc-100">{obj.name}</h3>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-[11px] text-amber-100/80">{obj.bytes} B</span>
          <button type="button" onClick={onCopy} className="font-mono text-[10px] text-zinc-500 hover:text-amber-100">
            {copied ? 'copied' : 'copy addr'}
          </button>
        </div>
      </div>
      <button type="button" onClick={() => onSelect(obj.id, obj.analysis)} className="w-full text-left">
        <p className="mt-2 font-mono text-[12px] text-amber-100/80">{obj.value}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Tag className="border-amber-400/30 text-amber-200">{obj.kind}</Tag>
          <Tag className="border-zinc-700 text-zinc-400">from {obj.escapedFrom}</Tag>
          {sweeping ? (
            <Tag className="border-rose-400/40 bg-rose-400/10 text-rose-200">sweeping</Tag>
          ) : reachable ? (
            <Tag className="border-emerald-400/30 text-emerald-300">{obj.globalRoot ? 'GC root' : 'reachable'}</Tag>
          ) : (
            <Tag className="border-rose-400/40 text-rose-300">pending GC</Tag>
          )}
          <Tag className="border-zinc-700 text-zinc-300">{obj.fate}</Tag>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">{obj.reason}</p>
        <p className="mt-2 font-mono text-[11px] text-zinc-500">
          {labels.length > 0 ? `← ${labels.join(', ')}` : obj.globalRoot ? `← package var ${obj.rootName}` : '← no stack pointer'}
        </p>
      </button>
    </article>
  )
}

function Tag({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide', className)}>
      {children}
    </span>
  )
}

function EmptyHeap() {
  return (
    <div className="flex h-full min-h-56 items-center justify-center rounded-xl border border-dashed border-amber-500/25 bg-amber-400/[0.03] p-6 text-center">
      <div>
        <p className="font-mono text-sm text-amber-200">no escaped objects</p>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-400">
          Pointers, slice backings, closures, and interface boxes that outlive their frame land here.
        </p>
      </div>
    </div>
  )
}
