const KEYWORDS = new Set([
  'func',
  'return',
  'if',
  'var',
  'make',
  'struct',
  'type',
  'package',
  'nil',
  'true',
  'false',
  'map',
  'range',
  'for',
  'else',
  'any',
])

const BUILTINS = new Set([
  'int',
  'string',
  'bool',
  'byte',
  'uint32',
  'uint64',
  'int64',
  'int32',
  'float64',
])

function highlightLine(line: string) {
  const parts = line.split(/(\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|0x[0-9a-fA-F]+|\b\d+\b|\b[A-Za-z_][A-Za-z0-9_]*\b|:=|&)/g)
  return parts.map((part, index) => {
    if (!part) return null
    let className = 'text-zinc-200'
    if (part.startsWith('//')) className = 'text-zinc-500 italic'
    else if (part.startsWith('"') || part.startsWith("'")) className = 'text-emerald-300'
    else if (part.startsWith('0x') || /^\d+$/.test(part)) className = 'text-amber-200'
    else if (part === '&' || part === ':=') className = 'text-amber-300'
    else if (KEYWORDS.has(part)) className = 'text-fuchsia-300'
    else if (BUILTINS.has(part) || /^[A-Z]/.test(part)) className = 'text-cyan-300'
    return (
      <span key={`${part}-${index}`} className={className}>
        {part}
      </span>
    )
  })
}

export function CodeBlock({ code }: { code: string }) {
  const lines = code.replace(/\n$/, '').split('\n')
  return (
    <pre className="overflow-auto rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 font-mono text-[12.5px] leading-6 text-zinc-200 panel-scroll">
      {lines.map((line, index) => (
        <div key={`${index}-${line}`} className="flex min-h-6 min-w-0">
          <span className="w-7 shrink-0 select-none pr-3 text-right text-zinc-600">{index + 1}</span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{line ? highlightLine(line) : ' '}</span>
        </div>
      ))}
    </pre>
  )
}
