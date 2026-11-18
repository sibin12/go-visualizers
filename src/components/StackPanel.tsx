import { useEffect, useMemo, useRef, useState } from 'react'
import { MAX_FRAMES } from '../scenarios'
import type { StackFrame } from '../types'
import { cn, formatInt } from '../utils'
import { variableBytes } from '../runtime'

export function StackPanel({
  frames,
  selectedHeapId,
  pulse,
  onSelect,
  onInspect,
}: {
  frames: StackFrame[]
  selectedHeapId: string | null
  pulse: boolean
  onSelect: (heapId: string | null, analysis: StackFrame['analysis']) => void
  onInspect: (analysis: StackFrame['analysis']) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return frames
    return frames.filter((frame) => {
      const blob = `${frame.name} ${frame.signature} ${frame.variables.map((variable) => `${variable.name} ${variable.type} ${variable.value}`).join(' ')}`
      return blob.toLowerCase().includes(needle)
    })
  }, [frames, query])

  useEffect(() => {
    if (!selectedHeapId) return
    document.getElementById(`stack-link-${selectedHeapId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedHeapId])

  const total = frames.reduce((sum, frame) => sum + frame.overhead + variableBytes(frame), 0)

  return (
    <section
      className={cn(
        'flex min-h-[34rem] min-w-0 flex-col overflow-hidden rounded-2xl border bg-zinc-900/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-shadow duration-500 xl:min-h-0 xl:h-full',
        pulse
          ? 'border-cyan-400/70 shadow-[0_0_32px_rgba(34,211,238,0.14)]'
          : 'border-zinc-800',
      )}
    >
      <header className="shrink-0 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-400/80">Left panel</p>
            <h2 className="text-sm font-semibold text-zinc-100">The Stack</h2>
          </div>
          <div className="text-right font-mono text-[11px] text-cyan-200/80">
            <div>{frames.length}/{MAX_FRAMES} frames</div>
            <div className="text-zinc-500">{formatInt(total)} B resident</div>
          </div>
        </div>
        <label className="mt-2 block">
          <span className="sr-only">Filter stack frames</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter frames or locals"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-cyan-500/40"
          />
        </label>
      </header>

      <div ref={scroller} className="panel-scroll relative min-h-0 flex-1 overflow-auto p-3">
        <div className="pointer-events-none absolute bottom-3 left-[1.35rem] top-3 w-px bg-gradient-to-b from-cyan-400/50 via-cyan-400/15 to-transparent" />
        {frames.length === 0 ? (
          <EmptyStack />
        ) : shown.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-zinc-500">No frames match “{query}”.</p>
        ) : (
          <div className="relative space-y-3 pl-6">
            {shown.map((frame) => (
              <FrameCard
                key={frame.id}
                frame={frame}
                top={frames[0]?.id === frame.id}
                selectedHeapId={selectedHeapId}
                onSelect={onSelect}
                onInspect={onInspect}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function FrameCard({
  frame,
  top,
  selectedHeapId,
  onSelect,
  onInspect,
}: {
  frame: StackFrame
  top: boolean
  selectedHeapId: string | null
  onSelect: (heapId: string | null, analysis: StackFrame['analysis']) => void
  onInspect: (analysis: StackFrame['analysis']) => void
}) {
  const locals = variableBytes(frame)
  const popping = frame.status === 'popping'
  return (
    <article
      className={cn(
        'relative rounded-xl border px-3 py-3',
        popping ? 'frame-out border-zinc-600 bg-zinc-900' : 'frame-in',
        !popping && top
          ? 'border-cyan-400/50 bg-cyan-400/[0.07]'
          : !popping && 'border-cyan-500/20 bg-zinc-950/60',
      )}
    >
      <span
        className={cn(
          'absolute -left-[1.55rem] top-4 h-2.5 w-2.5 rounded-full ring-4 ring-zinc-900',
          popping ? 'bg-zinc-500' : 'bg-cyan-400',
        )}
      />
      <button
        type="button"
        onClick={() => onInspect(frame.analysis)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-fuchsia-300/80">func</span>
            <span className="font-mono text-sm font-medium text-cyan-200">{frame.name}()</span>
            {top && (
              <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                {popping ? 'returning' : 'top of stack'}
              </span>
            )}
          </div>
          <p className="mt-0.5 break-words font-mono text-[11px] text-zinc-500">{frame.signature}</p>
        </div>
        <span className="shrink-0 font-mono text-[11px] text-cyan-300/80">{formatInt(locals + frame.overhead)} B</span>
      </button>

      <ul className="mt-3 space-y-1.5">
        {frame.variables.map((variable) => {
          const linked = variable.heapId && variable.heapId === selectedHeapId
          return (
            <li key={variable.id} id={variable.heapId ? `stack-link-${variable.heapId}` : undefined}>
              <button
                type="button"
                onClick={() => onSelect(variable.heapId ?? null, variable.heapId ? frame.analysis : frame.analysis)}
                className={cn(
                  'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition',
                  variable.heapId
                    ? 'border-amber-400/25 bg-amber-400/[0.05] hover:border-amber-300/50'
                    : 'border-transparent bg-black/20 hover:border-cyan-400/20',
                  linked && 'ring-2 ring-amber-300/70',
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-[13px] text-zinc-100">{variable.name}</span>
                    <span className="font-mono text-[11px] text-cyan-300/90">{variable.type}</span>
                  </div>
                  <div className="truncate font-mono text-[11px] text-zinc-400">{variable.value}</div>
                </div>
                <div className="text-right">
                  <div className={cn('font-mono text-[10px] uppercase tracking-wider', variable.heapId ? 'text-amber-300' : 'text-zinc-500')}>
                    {variable.heapId ? '→ heap' : variable.kind}
                  </div>
                  <div className="font-mono text-[11px] text-zinc-300">{variable.bytes} B</div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 font-mono text-[10px] text-zinc-600">+ {frame.overhead} B return PC / frame header</p>
    </article>
  )
}

function EmptyStack() {
  return (
    <div className="flex h-full min-h-56 items-center justify-center rounded-xl border border-dashed border-cyan-500/25 bg-cyan-400/[0.03] p-6 text-center">
      <div>
        <p className="font-mono text-sm text-cyan-200">process exited</p>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-400">
          No active frames. Allocate a local variable to schedule a new <span className="text-cyan-300">main()</span>.
        </p>
      </div>
    </div>
  )
}
