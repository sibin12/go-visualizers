import { cn } from '../utils'

export function Kbd({ children, className }: { children: string; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded border border-white/10 bg-black/40 px-1 font-mono text-[10px] font-medium text-zinc-400',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
