import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BasicsDialog } from './components/BasicsDialog'
import { CallPicker } from './components/CallPicker'
import { HeapPanel } from './components/HeapPanel'
import { HelpDialog } from './components/HelpDialog'
import { Inspector } from './components/Inspector'
import { Kbd } from './components/Kbd'
import { LessonBar } from './components/LessonBar'
import { StackPanel } from './components/StackPanel'
import { MAX_FRAMES, nextHeapScenario, nextStackScenario } from './scenarios'
import { backrefs, useRuntime } from './runtime'
import type { Pulse, ToastTone } from './types'
import { cn, formatInt, formatKB } from './utils'

const BASICS_SEEN = 'gomem.basics-seen'

/** First-time visitors get the plain-language primer before the simulator. */
function firstVisit() {
  try {
    return localStorage.getItem(BASICS_SEEN) !== '1'
  } catch {
    return false
  }
}

export default function App() {
  const { state, stats, allocate, escape, popFrame, collect, reset, clearLogs, select, showAnalysis, dismissToast } = useRuntime()
  const refs = useMemo(() => backrefs(state.frames), [state.frames])
  const busy = state.phase !== 'idle'
  const [basicsOpen, setBasicsOpen] = useState(firstVisit)
  const [helpOpen, setHelpOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [lessonOpen, setLessonOpen] = useState(false)
  const [lessonStep, setLessonStep] = useState(0)
  const nextStack = nextStackScenario(state.stackCursor)
  const nextHeap = nextHeapScenario(state.heapCursor)
  const overlayOpen = basicsOpen || helpOpen || pickerOpen

  function closeBasics() {
    setBasicsOpen(false)
    try {
      localStorage.setItem(BASICS_SEEN, '1')
    } catch {
      // private mode: the primer simply shows again next visit
    }
  }

  function startWalkthrough() {
    closeBasics()
    setLessonStep(0)
    setLessonOpen(true)
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select')) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'Escape') {
        if (basicsOpen) closeBasics()
        setHelpOpen(false)
        setPickerOpen(false)
        select(null)
        return
      }
      if (event.key === '?') {
        setPickerOpen(false)
        setHelpOpen((open) => !open)
        return
      }
      if (event.key.toLowerCase() === 'b' && !helpOpen && !pickerOpen) {
        if (basicsOpen) closeBasics()
        else setBasicsOpen(true)
        return
      }
      if (overlayOpen || busy) return
      const key = event.key.toLowerCase()
      if (key === 'a') allocate()
      else if (key === 'e') escape()
      else if (key === 'r') popFrame()
      else if (key === 'g') collect()
      else if (key === 'c') setPickerOpen(true)
      else if (key === 'w') setLessonOpen((open) => !open)
      else if (key === '0') reset()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [allocate, basicsOpen, busy, collect, escape, helpOpen, overlayOpen, pickerOpen, popFrame, reset, select])

  function runLesson(id: string) {
    if (busy) return
    if (id === 'stack') allocate(0)
    else if (id === 'escape') escape(0)
    else if (id === 'return') popFrame()
    else if (id === 'spill') escape(3)
    else if (id === 'gc') collect()
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 xl:h-screen xl:overflow-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.09),transparent_42%),radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.08),transparent_36%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-40 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]" />

      <div className="relative flex min-h-screen flex-col xl:h-full">
        <header className="shrink-0 border-b border-zinc-800/80 bg-zinc-950/70 px-4 py-4 backdrop-blur-md lg:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-500">Go runtime · simulated</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
                Go Memory Allocator & Escape Analysis Visualizer
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip phase={state.phase} depth={state.frames.length} clockMs={state.clockMs} />
              <SecondaryButton label="Basics" shortcut="B" onClick={() => setBasicsOpen(true)} />
              <SecondaryButton label="Walkthrough" shortcut="W" onClick={() => setLessonOpen((open) => !open)} />
              <SecondaryButton label="Choose call" shortcut="C" onClick={() => setPickerOpen(true)} disabled={busy} />
              <SecondaryButton label="Shortcuts" shortcut="?" onClick={() => setHelpOpen(true)} />
              <SecondaryButton label="Reset" shortcut="0" onClick={reset} disabled={busy} />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton
              label="Allocate Local Var (Stack)"
              hint={state.frames.length === 0 ? 'starts main()' : state.frames.length >= MAX_FRAMES ? 'return a frame first' : `next: ${nextStack.name}`}
              shortcut="A"
              tone="stack"
              disabled={busy}
              onClick={() => allocate()}
              icon={<StackIcon />}
            />
            <ActionButton
              label="Escape Pointer (Heap)"
              hint={state.frames.length >= MAX_FRAMES ? 'return a frame first' : `next: ${nextHeap.name}`}
              shortcut="E"
              tone="heap"
              disabled={busy}
              onClick={() => escape()}
              icon={<HeapIcon />}
            />
            <ActionButton
              label="Return Frame (Pop Stack)"
              hint={state.frames[0] ? `pop ${state.frames[0].name}` : 'stack is empty'}
              shortcut="R"
              tone="pop"
              disabled={busy || state.frames.length === 0}
              onClick={popFrame}
              icon={<PopIcon />}
            />
            <ActionButton
              label="Trigger Garbage Collection"
              hint={stats.pending > 0 ? `${stats.pending} waiting` : 'heap is clean'}
              shortcut="G"
              tone="gc"
              disabled={busy}
              onClick={collect}
              icon={<GcIcon />}
            />
          </div>

          {state.frames.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1 font-mono text-[12px] text-zinc-500">
              <span className="mr-1 text-[10px] uppercase tracking-[0.16em]">call stack</span>
              {[...state.frames].reverse().map((frame, index, all) => (
                <span key={frame.id} className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => showAnalysis(frame.analysis)}
                    className={cn('hover:text-cyan-200', index === all.length - 1 ? 'text-cyan-300' : 'text-zinc-400')}
                  >
                    {frame.name}
                  </button>
                  {index < all.length - 1 && <span className="text-zinc-600">›</span>}
                </span>
              ))}
            </div>
          )}

          {lessonOpen ? (
            <LessonBar
              step={lessonStep}
              onStep={setLessonStep}
              onRun={runLesson}
              onHide={() => setLessonOpen(false)}
            />
          ) : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Total Allocated Bytes"
              value={formatInt(stats.totalBytes)}
              unit="B"
              hint="stack + heap still resident"
              tone="zinc"
            />
            <Metric
              label="Stack Size (KB)"
              value={formatKB(stats.stackBytes)}
              unit="KB"
              hint={`${formatInt(stats.stackBytes)} bytes in frames`}
              tone="cyan"
            />
            <Metric
              label="Heap Live Objects"
              value={String(stats.liveHeap)}
              unit=""
              hint={stats.pending > 0 ? `${stats.pending} pending sweep` : 'reachable objects'}
              tone={stats.pending > 0 ? 'rose' : 'amber'}
            />
            <Metric
              label="GC Cycle Count"
              value={String(stats.gcCycles)}
              unit=""
              hint="mark-sweep cycles"
              tone="rose"
            />
          </div>

          <MixBar
            stack={stats.stackBytes}
            heap={stats.reachableHeapBytes}
            garbage={stats.garbageBytes}
            active={state.phase}
          />
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.15fr)_minmax(320px,0.95fr)] lg:px-6">
          <StackPanel
            frames={state.frames}
            selectedHeapId={state.selectedHeapId}
            pulse={state.pulse === 'stack' || state.pulse === 'pop'}
            onSelect={(heapId, analysis) => {
              select(heapId)
              const linked = heapId ? state.heap.find((obj) => obj.id === heapId) : undefined
              showAnalysis(linked?.analysis ?? analysis)
            }}
            onInspect={showAnalysis}
          />
          <HeapPanel
            objects={state.heap}
            frames={state.frames}
            refs={refs}
            selectedHeapId={state.selectedHeapId}
            gcActive={state.phase === 'gc'}
            pulse={state.pulse === 'heap'}
            onSelect={(heapId, analysis) => {
              select(heapId)
              showAnalysis(analysis)
            }}
          />
          <Inspector
            snippet={state.snippet}
            logs={state.logs}
            clockMs={state.clockMs}
            phase={state.phase}
            onClear={clearLogs}
          />
        </main>
      </div>

      {basicsOpen && <BasicsDialog onClose={closeBasics} onWalkthrough={startWalkthrough} />}
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      {pickerOpen && (
        <CallPicker
          onClose={() => setPickerOpen(false)}
          onStack={(index) => {
            setPickerOpen(false)
            allocate(index)
          }}
          onHeap={(index) => {
            setPickerOpen(false)
            escape(index)
          }}
        />
      )}

      <div className="pointer-events-none fixed bottom-4 right-4 z-30 flex w-[min(100%-2rem,22rem)] flex-col gap-2">
        {state.toasts.map((toast) => (
          <ToastCard key={toast.id} id={toast.id} message={toast.message} tone={toast.tone} onDone={dismissToast} />
        ))}
      </div>
    </div>
  )
}

function StatusChip({ phase, depth, clockMs }: { phase: 'idle' | 'popping' | 'gc'; depth: number; clockMs: number }) {
  const label = phase === 'gc' ? 'mark-sweep' : phase === 'popping' ? 'returning frame' : 'runtime idle'
  const dot = phase === 'gc' ? 'bg-rose-400' : phase === 'popping' ? 'bg-cyan-300' : 'bg-emerald-400'
  return (
    <div className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 font-mono text-[11px] text-zinc-300">
      <span className={cn('mr-2 inline-block h-1.5 w-1.5 rounded-full', dot, phase === 'idle' && 'animate-pulse')} />
      {label}
      <span className="ml-2 text-zinc-500">depth {depth}/{MAX_FRAMES}</span>
      <span className="ml-2 text-zinc-500">t={(clockMs / 1000).toFixed(3)}s</span>
    </div>
  )
}

function SecondaryButton({
  label,
  shortcut,
  onClick,
  disabled,
}: {
  label: string
  shortcut: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 hover:text-zinc-50 disabled:opacity-40"
    >
      {label}
      <Kbd>{shortcut}</Kbd>
    </button>
  )
}

function ActionButton({
  label,
  hint,
  shortcut,
  tone,
  disabled,
  onClick,
  icon,
}: {
  label: string
  hint: string
  shortcut: string
  tone: Exclude<Pulse, null> | 'pop'
  disabled: boolean
  onClick: () => void
  icon: ReactNode
}) {
  const styles = {
    stack: 'border-cyan-400/40 text-cyan-100 hover:bg-cyan-400/10 hover:border-cyan-300/70',
    heap: 'border-amber-400/40 text-amber-100 hover:bg-amber-400/10 hover:border-amber-300/70',
    pop: 'border-zinc-600 text-zinc-100 hover:bg-zinc-800 hover:border-zinc-500',
    gc: 'border-rose-400/40 text-rose-100 hover:bg-rose-400/10 hover:border-rose-300/70',
  }[tone]
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-xl border bg-zinc-900/70 px-3 py-2 text-left text-sm font-medium transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-40',
        styles,
      )}
    >
      {icon}
      <span>
        <span className="flex items-center gap-2">
          {label}
          <Kbd>{shortcut}</Kbd>
        </span>
        <span className="mt-0.5 block font-mono text-[11px] font-normal text-zinc-400">{hint}</span>
      </span>
    </button>
  )
}

function Metric({
  label,
  value,
  unit,
  hint,
  tone,
}: {
  label: string
  value: string
  unit: string
  hint: string
  tone: 'zinc' | 'cyan' | 'amber' | 'rose'
}) {
  const [pop, setPop] = useState(false)
  const prev = useRef(value)
  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    setPop(true)
    const timer = window.setTimeout(() => setPop(false), 360)
    return () => window.clearTimeout(timer)
  }, [value])

  const valueColor = {
    zinc: 'text-zinc-50',
    cyan: 'text-cyan-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
  }[tone]

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className={cn('mt-1 font-mono text-2xl tabular-nums tracking-tight', valueColor, pop && 'stat-pop')}>
        {value}
        {unit && <span className="ml-1 text-sm text-zinc-500">{unit}</span>}
      </p>
      <p className={cn('mt-0.5 text-xs', tone === 'rose' && hint.includes('pending') ? 'text-rose-300/80' : 'text-zinc-500')}>
        {hint}
      </p>
    </div>
  )
}

function MixBar({
  stack,
  heap,
  garbage,
  active,
}: {
  stack: number
  heap: number
  garbage: number
  active: 'idle' | 'popping' | 'gc'
}) {
  const total = stack + heap + garbage
  const width = (n: number) => (total === 0 ? 0 : (n / total) * 100)
  return (
    <div className="mt-3">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div className="bg-cyan-400 transition-all duration-500" style={{ width: `${width(stack)}%` }} />
        <div className="bg-amber-400 transition-all duration-500" style={{ width: `${width(heap)}%` }} />
        <div className={cn('bg-rose-400 transition-all duration-500', active === 'gc' && 'animate-pulse')} style={{ width: `${width(garbage)}%` }} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
        <span className="text-cyan-300/90">stack</span>
        <span className="text-amber-300/90">live heap</span>
        <span className="text-rose-300/90">pending GC</span>
      </div>
    </div>
  )
}

function ToastCard({
  id,
  message,
  tone,
  onDone,
}: {
  id: string
  message: string
  tone: ToastTone
  onDone: (id: string) => void
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDone(id), 3400)
    return () => window.clearTimeout(timer)
  }, [id, onDone])

  const styles = {
    stack: 'border-cyan-400/40 bg-zinc-950/95 text-cyan-100',
    heap: 'border-amber-400/40 bg-zinc-950/95 text-amber-100',
    pop: 'border-zinc-600 bg-zinc-950/95 text-zinc-100',
    gc: 'border-rose-400/40 bg-zinc-950/95 text-rose-100',
    warn: 'border-orange-400/40 bg-zinc-950/95 text-orange-100',
  }[tone]

  return (
    <div className={cn('pointer-events-auto toast-in rounded-xl border px-3 py-2.5 text-sm shadow-2xl shadow-black/40 backdrop-blur', styles)}>
      {message}
    </div>
  )
}

function StackIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden="true">
      <rect x="2" y="2" width="12" height="3" rx="0.6" fill="currentColor" />
      <rect x="2" y="6.5" width="12" height="3" rx="0.6" fill="currentColor" opacity="0.7" />
      <rect x="2" y="11" width="12" height="3" rx="0.6" fill="currentColor" opacity="0.4" />
    </svg>
  )
}

function HeapIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M8 1.5 13.5 4.5 8 7.5 2.5 4.5 8 1.5Z" fill="currentColor" />
      <path d="M2.5 6.8 8 9.8 13.5 6.8 13.5 11.2 8 14.2 2.5 11.2Z" fill="currentColor" opacity="0.55" />
    </svg>
  )
}

function PopIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M3 11.5h10M8 3v6.5M5.5 6.5 8 4l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function GcIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path d="M3 8a5 5 0 1 0 1.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M3 2.8v2.4h2.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
