import { Kbd } from './Kbd'

const SHORTCUTS = [
  ['A', 'Allocate the next stack local'],
  ['E', 'Escape the next pointer to the heap'],
  ['R', 'Return the top frame'],
  ['G', 'Trigger garbage collection'],
  ['W', 'Toggle the walkthrough'],
  ['C', 'Choose a specific call'],
  ['?', 'Toggle this reference'],
  ['0', 'Reset the simulated runtime'],
  ['Esc', 'Close dialogs and clear selection'],
]

const SIZES = [
  ['bool', '1 B', 'logical size; a stack slot is often padded'],
  ['int / *T', '8 B', 'amd64 word'],
  ['slice header', '24 B', 'pointer + len + cap — backing may be on the heap'],
  ['interface', '16 B', 'type + data; the concrete value is boxed'],
  ['string header', '16 B', 'pointer + len'],
  ['frame header', '16 B', 'saved return PC, counted in stack size'],
]

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-auto bg-black/60 p-4 pt-[8vh] backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Reference</p>
            <h2 id="help-title" className="text-base font-semibold text-zinc-50">
              How to read this runtime
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
            Close
          </button>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Shortcuts</h3>
            <ul className="mt-2 space-y-1.5">
              {SHORTCUTS.map(([key, label]) => (
                <li key={key} className="flex items-center gap-3 text-sm text-zinc-300">
                  <Kbd>{key}</Kbd>
                  {label}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Escape rules</h3>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-300">
              <li><span className="text-cyan-300">Stack</span> — the compiler can prove the value dies with the frame.</li>
              <li><span className="text-amber-300">Heap</span> — a pointer, slice, interface, or closure makes the value outlive the frame.</li>
              <li><span className="text-rose-300">Pending GC</span> — no stack pointer and no package root. Memory stays until mark-sweep.</li>
              <li><span className="text-emerald-300">GC root</span> — a package variable keeps the object alive after return.</li>
            </ul>
          </section>
          <section className="sm:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Sizes used here (logical, amd64)</h3>
            <div className="mt-2 overflow-hidden rounded-xl border border-zinc-800">
              {SIZES.map(([name, size, note]) => (
                <div key={name} className="grid grid-cols-[7rem_4rem_1fr] gap-2 border-b border-zinc-800 px-3 py-2 text-sm last:border-0">
                  <span className="font-mono text-zinc-200">{name}</span>
                  <span className="font-mono text-amber-200">{size}</span>
                  <span className="text-zinc-500">{note}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              This is a simulation of <span className="font-mono text-zinc-400">go build -gcflags="-m"</span>, not a live process. Click a pointer to jump to its heap object. Open “What if” in the inspector to see the signature change that flips the decision.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
