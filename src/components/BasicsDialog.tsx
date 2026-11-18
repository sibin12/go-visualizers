import { Kbd } from './Kbd'

const IDEAS = [
  {
    term: 'Stack',
    dot: 'bg-cyan-400',
    text: 'Every function call gets its own small notepad, called a frame. Its local values are written there. When the function returns, the whole page is thrown away at once, so it is very fast and needs no cleaning.',
    like: 'Like a sticky note on your desk: when the task is done, the note goes in the bin.',
  },
  {
    term: 'Heap',
    dot: 'bg-amber-400',
    text: 'A shared storage room for values that must stay around after the function that made them has finished. Putting things here is slower, and someone has to clean it up later.',
    like: 'Like a storage room in an office: things stay until someone clears them out.',
  },
  {
    term: 'Pointer',
    dot: 'bg-zinc-400',
    text: 'An address that says where a value lives, instead of the value itself. In Go you get one with &x.',
    like: 'Like a note that says “the box is on shelf 3”.',
  },
  {
    term: 'Escape',
    dot: 'bg-amber-400',
    text: 'If a value could still be used after its function returns, for example because the function returns a pointer to it, it cannot stay on the notepad. Go moves it to the heap. That move is called escaping.',
    like: 'You cannot leave something on a sticky note you are about to throw away, so it goes to the storage room.',
  },
  {
    term: 'Escape analysis',
    dot: 'bg-violet-400',
    text: 'The Go compiler decides stack or heap before the program even runs. You can see its decisions with go build -gcflags=-m, which prints “does not escape” or “escapes to heap”.',
    like: 'Like a planner checking, before work starts, which notes will be needed later.',
  },
  {
    term: 'Garbage collector (GC)',
    dot: 'bg-rose-400',
    text: 'Go’s automatic cleaner. It finds heap values that nothing points to any more and frees them. Anything a running function or a package variable still points to (a “GC root”) is kept.',
    like: 'Like a cleaner who removes boxes that no note points to any more.',
  },
]

const STEPS: [string, string, string][] = [
  ['A', 'Allocate', 'a function runs and its local values land on the stack (cyan).'],
  ['E', 'Escape', 'a function returns a pointer, so its value moves to the heap (amber).'],
  ['R', 'Return', 'the top function finishes and its stack frame disappears. Heap values stay.'],
  ['G', 'GC', 'the cleaner frees heap values that nothing points to (rose).'],
]

/** A plain-language primer for people who have never heard of stacks, heaps or escape analysis. */
export function BasicsDialog({ onClose, onWalkthrough }: { onClose: () => void; onWalkthrough: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-auto bg-black/60 p-4 pt-[6vh] backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="basics-title"
        className="w-full max-w-3xl rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/50"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">New here? Start with this</p>
            <h2 id="basics-title" className="mt-1 text-lg font-semibold text-zinc-50">
              Where does Go keep your values?
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-zinc-400">
              While a Go program runs, every value needs a place in memory. Go uses two places: the fast, short-lived
              <span className="text-cyan-300"> stack</span> and the longer-lived <span className="text-amber-300">heap</span>.
              This page lets you watch which one each value goes to, and why.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
            Close
          </button>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {IDEAS.map((idea) => (
            <section key={idea.term} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <span className={`h-2 w-2 rounded-full ${idea.dot}`} />
                {idea.term}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">{idea.text}</p>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">{idea.like}</p>
            </section>
          ))}

          <section className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4 sm:col-span-2">
            <h3 className="text-sm font-semibold text-emerald-200">Why it matters</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-300">
              Stack memory is almost free. Heap memory costs time twice: once to set it aside and again when the garbage
              collector cleans it up. Keeping values on the stack is one of the easiest ways to make Go code faster.
            </p>
          </section>

          <section className="sm:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">How to use this page</h3>
            <ol className="mt-2 space-y-2">
              {STEPS.map(([key, label, text], index) => (
                <li key={key} className="flex items-start gap-3 text-sm text-zinc-300">
                  <span className="mt-0.5 w-4 shrink-0 text-right font-mono text-xs text-zinc-500">{index + 1}</span>
                  <Kbd>{key}</Kbd>
                  <span>
                    <span className="font-medium text-zinc-100">{label}:</span> {text}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              Click any value or box to see the real Go code and the compiler’s reason in the inspector on the right.
            </p>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-800 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
            Explore on my own
          </button>
          <button
            type="button"
            onClick={onWalkthrough}
            className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-sm font-medium text-cyan-100 hover:bg-cyan-400/20"
          >
            Start the guided walkthrough
          </button>
        </div>
      </div>
    </div>
  )
}
