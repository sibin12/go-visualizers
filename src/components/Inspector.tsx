import { useEffect, useMemo, useRef, useState } from 'react'
import type { Analysis, LogLine, LogTone } from '../types'
import { cn, copyText, formatClock } from '../utils'
import { toneClass } from '../runtime'
import { CodeBlock } from './CodeBlock'

type LogFilter = 'all' | 'stack' | 'heap' | 'gc'

const FILTERS: { id: LogFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'stack', label: 'Stack' },
  { id: 'heap', label: 'Escapes' },
  { id: 'gc', label: 'GC' },
]

function matchesFilter(tone: LogTone, filter: LogFilter) {
  if (filter === 'all') return true
  if (filter === 'stack') return tone === 'ok' || tone === 'stack'
  if (filter === 'heap') return tone === 'heap' || tone === 'warn'
  return tone === 'gc'
}

export function Inspector({
  snippet,
  logs,
  clockMs,
  phase,
  onClear,
}: {
  snippet: Analysis
  logs: LogLine[]
  clockMs: number
  phase: 'idle' | 'popping' | 'gc'
  onClear: () => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<LogFilter>('all')
  const [showAlt, setShowAlt] = useState(false)
  const [copied, setCopied] = useState<'code' | 'log' | null>(null)
  const escaped = snippet.logs.some((line) => line.tone === 'heap')
  const visible = useMemo(() => logs.filter((line) => matchesFilter(line.tone, filter)), [logs, filter])

  useEffect(() => {
    setShowAlt(false)
  }, [snippet.title])

  useEffect(() => {
    const node = scroller.current
    if (!node) return
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [logs.length, filter])

  async function copy(kind: 'code' | 'log', text: string) {
    const ok = await copyText(text)
    if (!ok) return
    setCopied(kind)
    window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1200)
  }

  return (
    <section className="flex min-h-[34rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] xl:min-h-0 xl:h-full">
      <header className="shrink-0 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Inspector</p>
            <h2 className="text-sm font-semibold text-zinc-100">Escape Analysis</h2>
          </div>
          <span className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-[10px] text-zinc-400">
            {phase === 'gc' ? 'sweeping' : phase === 'popping' ? 'returning' : 'idle'} · t={formatClock(clockMs)}s
          </span>
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-3">
        <div
          className={cn(
            'min-w-0 shrink-0 rounded-xl border px-3 py-2.5',
            escaped ? 'border-amber-400/30 bg-amber-400/[0.06]' : 'border-cyan-400/25 bg-cyan-400/[0.05]',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{snippet.title}</p>
          <p className="mt-1 break-words text-sm leading-relaxed text-zinc-300">{snippet.explanation}</p>
        </div>

        <div className="min-w-0 shrink-0">
          <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
            <span className="font-mono text-[11px] text-zinc-500">main.go</span>
            <div className="flex items-center gap-2">
              <span className={cn('text-[10px] font-medium uppercase tracking-wider', escaped ? 'text-amber-300' : 'text-cyan-300')}>
                {escaped ? 'escapes' : 'stack'}
              </span>
              <button
                type="button"
                onClick={() => void copy('code', snippet.code)}
                className="font-mono text-[10px] text-zinc-500 hover:text-zinc-200"
              >
                {copied === 'code' ? 'copied' : 'copy'}
              </button>
            </div>
          </div>
          <CodeBlock code={snippet.code} />
        </div>

        {snippet.contrast && (
          <div className="min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => setShowAlt((open) => !open)}
              className={cn(
                'mb-1.5 flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left',
                snippet.contrast.verdict === 'heap'
                  ? 'border-amber-400/25 bg-amber-400/[0.05]'
                  : 'border-cyan-400/25 bg-cyan-400/[0.05]',
              )}
            >
              <span className="text-[11px] font-medium text-zinc-200">
                What if · {snippet.contrast.title}
              </span>
              <span className={cn('text-[10px] uppercase tracking-wider', snippet.contrast.verdict === 'heap' ? 'text-amber-300' : 'text-cyan-300')}>
                {showAlt ? 'hide' : 'show'}
              </span>
            </button>
            {showAlt && (
              <div className="space-y-2">
                <CodeBlock code={snippet.contrast.code} />
                <p className="px-1 text-xs leading-relaxed text-zinc-400">{snippet.contrast.note}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-black/50">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400/80" />
              <span className="truncate font-mono text-[11px] text-zinc-400">go build -gcflags="-m"</span>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    'rounded-md px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide',
                    filter === item.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
                  )}
                >
                  {item.label}
                </button>
              ))}
              <button type="button" onClick={() => void copy('log', visible.map((line) => line.text).join('\n'))} className="px-1 font-mono text-[10px] text-zinc-500 hover:text-zinc-200">
                {copied === 'log' ? 'copied' : 'copy'}
              </button>
              <button type="button" onClick={onClear} className="px-1 font-mono text-[10px] text-zinc-500 hover:text-zinc-200">
                clear
              </button>
            </div>
          </div>
          <div
            ref={scroller}
            role="log"
            aria-live="polite"
            className="panel-scroll min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-[12px] leading-5"
          >
            {visible.length === 0 && (
              <p className="text-zinc-600">No {filter} lines in this log yet.</p>
            )}
            {visible.map((line) => (
              <div key={line.id} className={cn('break-words whitespace-pre-wrap', toneClass(line.tone))}>
                {line.text}
              </div>
            ))}
            <div className="mt-1 flex items-center text-zinc-500">
              <span>$</span>
              <span className="term-cursor ml-1 inline-block h-3.5 w-1.5 bg-zinc-400" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
