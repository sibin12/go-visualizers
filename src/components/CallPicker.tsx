import { HEAP_CATALOG, STACK_CATALOG } from '../scenarios'

export function CallPicker({
  onClose,
  onStack,
  onHeap,
}: {
  onClose: () => void
  onStack: (index: number) => void
  onHeap: (index: number) => void
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="call-picker-title"
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Choose a call</p>
            <h2 id="call-picker-title" className="text-base font-semibold text-zinc-50">
              Run a specific allocation
            </h2>
            <p className="mt-1 text-sm text-zinc-400">Pick the pattern you want to inspect. The compiler output updates immediately.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
            Close
          </button>
        </div>
        <div className="grid gap-px bg-zinc-800 sm:grid-cols-2">
          <section className="bg-zinc-950 p-3">
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Stays on the stack</p>
            <ul className="space-y-1">
              {STACK_CATALOG.map((item) => (
                <li key={item.name}>
                  <button
                    type="button"
                    onClick={() => onStack(item.index)}
                    className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-cyan-400/10"
                  >
                    <span className="font-mono text-sm text-cyan-100">{item.name}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-zinc-400">{item.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="bg-zinc-950 p-3">
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">Escapes to the heap</p>
            <ul className="space-y-1">
              {HEAP_CATALOG.map((item) => (
                <li key={item.name}>
                  <button
                    type="button"
                    onClick={() => onHeap(item.index)}
                    className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-amber-400/10"
                  >
                    <span className="font-mono text-sm text-amber-100">{item.name}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-zinc-400">{item.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
