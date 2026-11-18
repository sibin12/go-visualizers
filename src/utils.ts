export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function formatInt(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatKB(bytes: number) {
  return (bytes / 1024).toFixed(3)
}

export function formatClock(ms: number) {
  return (ms / 1000).toFixed(3)
}

export function frameBytes(overhead: number, variableBytes: number) {
  return overhead + variableBytes
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
