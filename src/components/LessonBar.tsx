import { cn } from '../utils'

const STEPS = [
  {
    id: 'stack',
    label: 'Stack',
    title: 'Prove a local stays in the frame',
    detail: 'processData uses an int and a fixed array only inside the function. The compiler prints “does not escape”.',
    simple: 'The function only needs its values while it runs, so they live on its notepad (the stack) and vanish when it returns.',
    action: 'Run processData',
    tone: 'stack' as const,
  },
  {
    id: 'escape',
    label: 'Escape',
    title: 'Return a pointer',
    detail: 'newUser returns &u. The User cannot live in a frame that is about to disappear, so it moves to the heap.',
    simple: 'The function hands back the address of its value. The value has to outlive the function, so Go keeps it in the storage room (the heap).',
    action: 'Run newUser',
    tone: 'heap' as const,
  },
  {
    id: 'return',
    label: 'Return',
    title: 'Watch the pointer move to the caller',
    detail: 'Returning the frame does not free the heap object. The pointer is stored in the caller and stays reachable.',
    simple: 'The function is done and its notepad is gone, but the heap value stays, because the caller still holds its address.',
    action: 'Return frame',
    tone: 'pop' as const,
  },
  {
    id: 'spill',
    label: 'Drop',
    title: 'Escape, then drop the only pointer',
    detail: 'spill passes &x to an unknown function. After return, nothing references it — it waits for GC.',
    simple: 'The address is handed to another function, so the value goes to the heap. After the return, nobody holds that address any more.',
    action: 'Run spill',
    tone: 'heap' as const,
  },
  {
    id: 'gc',
    label: 'Sweep',
    title: 'Collect unreachable objects',
    detail: 'Mark-sweep frees objects with no stack pointer and no package root. A sink leak is a GC root and survives.',
    simple: 'The cleaner walks the heap and frees every value nobody points to. Values a package variable still points to are kept.',
    action: 'Run GC',
    tone: 'gc' as const,
  },
]

export function LessonBar({
  step,
  onStep,
  onRun,
  onHide,
}: {
  step: number
  onStep: (step: number) => void
  onRun: (id: string) => void
  onHide: () => void
}) {
  const current = STEPS[step] ?? STEPS[0]
  return (
    <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Walkthrough</span>
        {STEPS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onStep(index)}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[11px] font-medium',
              index === step
                ? 'border-zinc-500 bg-zinc-800 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300',
            )}
          >
            {index + 1} {item.label}
          </button>
        ))}
        <button type="button" onClick={onHide} className="ml-auto text-[11px] text-zinc-500 hover:text-zinc-300">
          Hide
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 max-w-3xl">
          <p className="text-sm font-medium text-zinc-100">{current.title}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-zinc-400">{current.detail}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-emerald-200/90">
            <span className="font-medium text-emerald-300">In simple words: </span>
            {current.simple}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRun(current.id)}
          className={cn(
            'shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium',
            current.tone === 'stack' && 'border-cyan-400/40 text-cyan-100 hover:bg-cyan-400/10',
            current.tone === 'heap' && 'border-amber-400/40 text-amber-100 hover:bg-amber-400/10',
            current.tone === 'pop' && 'border-zinc-600 text-zinc-100 hover:bg-zinc-800',
            current.tone === 'gc' && 'border-rose-400/40 text-rose-100 hover:bg-rose-400/10',
          )}
        >
          {current.action}
        </button>
      </div>
    </div>
  )
}
