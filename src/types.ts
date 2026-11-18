export type VarKind = 'bool' | 'int' | 'struct' | 'array' | 'pointer' | 'slice' | 'interface'

export type HeapKind = 'struct' | 'slice' | 'interface' | 'scalar' | 'closure'

export type LogTone = 'cmd' | 'stack' | 'heap' | 'gc' | 'info' | 'warn' | 'ok'

export type Phase = 'idle' | 'popping' | 'gc'

export type Pulse = 'stack' | 'heap' | 'pop' | 'gc' | null

export type ToastTone = 'stack' | 'heap' | 'pop' | 'gc' | 'warn'

export interface Contrast {
  title: string
  verdict: 'stack' | 'heap'
  code: string
  note: string
}

export interface Analysis {
  title: string
  code: string
  explanation: string
  logs: { tone: LogTone; text: string }[]
  contrast?: Contrast
}

export interface StackVariable {
  id: string
  name: string
  type: string
  kind: VarKind
  value: string
  bytes: number
  heapId?: string
  retainOnReturn: boolean
}

export interface StackFrame {
  id: string
  name: string
  signature: string
  overhead: number
  status: 'active' | 'popping'
  variables: StackVariable[]
  analysis: Analysis
}

export interface HeapObject {
  id: string
  name: string
  type: string
  kind: HeapKind
  value: string
  bytes: number
  address: string
  escapedFrom: string
  reason: string
  status: 'live' | 'collecting'
  globalRoot: boolean
  rootName?: string
  retainOnReturn: boolean
  fate: string
  analysis: Analysis
}

export interface LogLine {
  id: string
  text: string
  tone: LogTone
}

export interface Toast {
  id: string
  message: string
  tone: ToastTone
}

export interface RuntimeState {
  frames: StackFrame[]
  heap: HeapObject[]
  logs: LogLine[]
  snippet: Analysis
  gcCycles: number
  phase: Phase
  pulse: Pulse
  selectedHeapId: string | null
  toasts: Toast[]
  stackCursor: number
  heapCursor: number
  seq: number
  addr: number
  clockMs: number
}
