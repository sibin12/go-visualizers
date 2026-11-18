import { useEffect, useReducer } from 'react'
import {
  FRAME_OVERHEAD,
  MAIN_ANALYSIS,
  MAX_FRAMES,
  mainVariables,
  nextHeapScenario,
  nextStackScenario,
  type HeapObjectSpec,
} from './scenarios'
import type {
  Analysis,
  HeapObject,
  LogLine,
  LogTone,
  Phase,
  Pulse,
  RuntimeState,
  StackFrame,
  StackVariable,
  Toast,
  ToastTone,
} from './types'

const MAX_LOGS = 120
const POP_MS = 520
const GC_MS = 980

interface Ids {
  id: (prefix: string) => string
  address: () => string
  commit: () => Pick<RuntimeState, 'seq' | 'addr'>
}

function idsFrom(state: RuntimeState): Ids {
  let seq = state.seq
  let addr = state.addr
  return {
    id(prefix) {
      seq += 1
      return `${prefix}-${seq}`
    },
    address() {
      addr += 0x40
      return `0x${addr.toString(16)}`
    },
    commit() {
      return { seq, addr }
    },
  }
}

function tickClock(ms: number, seq: number) {
  return ms + 5 + (seq % 7)
}

function commandLogs(ids: Ids, clockMs: number): LogLine[] {
  return [
    { id: ids.id('log'), tone: 'cmd', text: `$ go build -gcflags="-m"    t=${(clockMs / 1000).toFixed(3)}s` },
    { id: ids.id('log'), tone: 'info', text: '# example.com/runtimeviz' },
  ]
}

function analysisLogs(ids: Ids, analysis: Analysis): LogLine[] {
  return analysis.logs.map((line) => ({
    id: ids.id('log'),
    tone: line.tone,
    text: line.text,
  }))
}

function appendLogs(logs: LogLine[], extra: LogLine[]) {
  return [...logs, ...extra].slice(-MAX_LOGS)
}

function pushToast(toasts: Toast[], ids: Ids, message: string, tone: ToastTone) {
  return [...toasts, { id: ids.id('toast'), message, tone }].slice(-3)
}

function makeVariable(ids: Ids, spec: Omit<StackVariable, 'id'>): StackVariable {
  return { id: ids.id('var'), ...spec }
}

function makeMain(ids: Ids): StackFrame {
  return {
    id: ids.id('frame'),
    name: 'main',
    signature: 'main()',
    overhead: FRAME_OVERHEAD,
    status: 'active',
    variables: mainVariables().map((spec) =>
      makeVariable(ids, { ...spec, retainOnReturn: false }),
    ),
    analysis: MAIN_ANALYSIS,
  }
}

function uniqueName(existing: string[], name: string) {
  if (!existing.includes(name)) return name
  let n = 2
  while (existing.includes(`${name}${n}`)) n += 1
  return `${name}${n}`
}

export function isReachable(obj: HeapObject, frames: StackFrame[]) {
  if (obj.globalRoot) return true
  return frames.some((frame) => frame.variables.some((variable) => variable.heapId === obj.id))
}

export function variableBytes(frame: StackFrame) {
  return frame.variables.reduce((sum, variable) => sum + variable.bytes, 0)
}

export function stackBytes(frames: StackFrame[]) {
  return frames.reduce((sum, frame) => sum + frame.overhead + variableBytes(frame), 0)
}

export function computeStats(state: RuntimeState) {
  const stack = stackBytes(state.frames)
  const heap = state.heap.reduce((sum, obj) => sum + obj.bytes, 0)
  const live = state.heap.filter((obj) => obj.status === 'live' && isReachable(obj, state.frames))
  const pending = state.heap.filter((obj) => obj.status === 'collecting' || !isReachable(obj, state.frames))
  return {
    totalBytes: stack + heap,
    stackBytes: stack,
    heapBytes: heap,
    reachableHeapBytes: live.reduce((sum, obj) => sum + obj.bytes, 0),
    garbageBytes: pending.reduce((sum, obj) => sum + obj.bytes, 0),
    liveHeap: live.length,
    pending: pending.length,
    gcCycles: state.gcCycles,
  }
}

function buildHeap(
  ids: Ids,
  spec: HeapObjectSpec,
  frameName: string,
  analysis: Analysis,
): { object: HeapObject; variable: StackVariable } {
  const address = ids.address()
  const object: HeapObject = {
    id: ids.id('heap'),
    name: spec.name,
    type: spec.type,
    kind: spec.kind,
    value: spec.value,
    bytes: spec.bytes,
    address,
    escapedFrom: frameName,
    reason: spec.reason,
    status: 'live',
    globalRoot: spec.globalRoot,
    rootName: spec.rootName,
    retainOnReturn: spec.retainOnReturn,
    fate: spec.fate,
    analysis,
  }
  const variable = makeVariable(ids, {
    name: spec.pointerName,
    type: spec.pointerType,
    kind: spec.pointerKind,
    value: spec.pointerValue(address),
    bytes: spec.pointerBytes,
    heapId: object.id,
    retainOnReturn: spec.retainOnReturn,
  })
  return { object, variable }
}

function busy(state: RuntimeState) {
  return state.phase !== 'idle'
}

type Action =
  | { type: 'ALLOCATE'; index?: number }
  | { type: 'ESCAPE'; index?: number }
  | { type: 'BEGIN_POP' }
  | { type: 'FINISH_POP' }
  | { type: 'BEGIN_GC' }
  | { type: 'FINISH_GC' }
  | { type: 'RESET' }
  | { type: 'CLEAR_LOGS' }
  | { type: 'SELECT'; heapId: string | null }
  | { type: 'SHOW_ANALYSIS'; analysis: Analysis }
  | { type: 'PULSE'; pulse: Pulse }
  | { type: 'DISMISS_TOAST'; id: string }

function reducer(state: RuntimeState, action: Action): RuntimeState {
  switch (action.type) {
    case 'ALLOCATE': {
      if (busy(state)) return state
      const ids = idsFrom(state)
      const clockMs = tickClock(state.clockMs, state.seq)
      let frames = state.frames
      const prelude: LogLine[] = []
      if (frames.length === 0) {
        frames = [makeMain(ids)]
        prelude.push(...commandLogs(ids, clockMs), ...analysisLogs(ids, MAIN_ANALYSIS))
        if (action.index === undefined) {
          return {
            ...state,
            ...ids.commit(),
            clockMs,
            frames,
            logs: appendLogs(state.logs, prelude),
            snippet: MAIN_ANALYSIS,
            pulse: 'stack',
            toasts: pushToast(state.toasts, ids, 'Started main() · 1 B local on the stack', 'stack'),
          }
        }
      }
      if (frames.length >= MAX_FRAMES) {
        return {
          ...state,
          ...ids.commit(),
          toasts: pushToast(
            state.toasts,
            ids,
            `Stack depth guard (${MAX_FRAMES}) — return a frame first`,
            'warn',
          ),
        }
      }
      const index = action.index ?? state.stackCursor
      const scenario = nextStackScenario(index)
      const frame: StackFrame = {
        id: ids.id('frame'),
        name: scenario.name,
        signature: scenario.signature,
        overhead: FRAME_OVERHEAD,
        status: 'active',
        variables: scenario.variables.map((spec) =>
          makeVariable(ids, { ...spec, retainOnReturn: false }),
        ),
        analysis: scenario.analysis,
      }
      const localBytes = scenario.variables.reduce((sum, spec) => sum + spec.bytes, 0)
      const logs = [...prelude, ...commandLogs(ids, clockMs), ...analysisLogs(ids, scenario.analysis)]
      return {
        ...state,
        ...ids.commit(),
        clockMs,
        stackCursor: index + 1,
        frames: [frame, ...frames],
        logs: appendLogs(state.logs, logs),
        snippet: scenario.analysis,
        pulse: 'stack',
        toasts: pushToast(
          state.toasts,
          ids,
          `Pushed ${scenario.name} · ${localBytes} B locals stayed on the stack`,
          'stack',
        ),
      }
    }
    case 'ESCAPE': {
      if (busy(state)) return state
      const ids = idsFrom(state)
      const clockMs = tickClock(state.clockMs, state.seq)
      let frames = state.frames
      let logs: LogLine[] = []
      let bootstrapped = false
      if (frames.length === 0) {
        frames = [makeMain(ids)]
        logs = [...commandLogs(ids, clockMs), ...analysisLogs(ids, MAIN_ANALYSIS)]
        bootstrapped = true
      }
      if (frames.length >= MAX_FRAMES) {
        return {
          ...state,
          ...ids.commit(),
          toasts: pushToast(
            state.toasts,
            ids,
            `Stack depth guard (${MAX_FRAMES}) — return a frame first`,
            'warn',
          ),
        }
      }
      const index = action.index ?? state.heapCursor
      const scenario = nextHeapScenario(index)
      let heap = state.heap
      const built = scenario.objects.map((spec) => {
        if (spec.rootName) {
          heap = heap.map((obj) =>
            obj.rootName === spec.rootName && obj.globalRoot ? { ...obj, globalRoot: false } : obj,
          )
        }
        return buildHeap(ids, spec, scenario.name, scenario.analysis)
      })
      const frame: StackFrame = {
        id: ids.id('frame'),
        name: scenario.name,
        signature: scenario.signature,
        overhead: FRAME_OVERHEAD,
        status: 'active',
        variables: built.map((item) => item.variable),
        analysis: scenario.analysis,
      }
      const dropped = built.some((item) => item.object.rootName) && state.heap.some((obj) => obj.globalRoot && obj.rootName === 'sink')
      const escaped = built.map((item) => item.object)
      const heapBytes = escaped.reduce((sum, obj) => sum + obj.bytes, 0)
      const extra: LogLine[] = [
        ...(bootstrapped ? [] : commandLogs(ids, clockMs)),
        ...analysisLogs(ids, scenario.analysis),
      ]
      if (dropped) {
        extra.push({
          id: ids.id('log'),
          tone: 'warn',
          text: 'runtime: previous sink target is no longer a GC root',
        })
      }
      const address = escaped[0]?.address ?? 'heap'
      return {
        ...state,
        ...ids.commit(),
        clockMs,
        heapCursor: index + 1,
        frames: [frame, ...frames],
        heap: [...heap, ...escaped],
        logs: appendLogs(state.logs, [...logs, ...extra]),
        snippet: scenario.analysis,
        selectedHeapId: escaped[0]?.id ?? state.selectedHeapId,
        pulse: 'heap',
        toasts: pushToast(
          state.toasts,
          ids,
          `${scenario.name}: ${escaped[0]?.name ?? 'object'} escaped to ${address} · ${heapBytes} B`,
          'heap',
        ),
      }
    }
    case 'BEGIN_POP': {
      if (busy(state) || state.frames.length === 0) return state
      const [top, ...rest] = state.frames
      return {
        ...state,
        phase: 'popping',
        pulse: 'pop',
        frames: [{ ...top, status: 'popping' }, ...rest],
      }
    }
    case 'FINISH_POP': {
      if (state.phase !== 'popping' || state.frames.length === 0) return state
      const ids = idsFrom(state)
      const clockMs = tickClock(state.clockMs, state.seq)
      const [top, ...rest] = state.frames
      const parent = rest[0]
      const freed = top.overhead + variableBytes(top)
      const logs: LogLine[] = [
        { id: ids.id('log'), tone: 'cmd', text: `runtime: ${top.name} returned    t=${(clockMs / 1000).toFixed(3)}s` },
        { id: ids.id('log'), tone: 'stack', text: `runtime: stack frame freed (${freed} B including return PC)` },
      ]
      let frames = rest
      const retained = top.variables.filter((variable) => variable.heapId && variable.retainOnReturn)
      if (parent && retained.length > 0) {
        const names = parent.variables.map((variable) => variable.name)
        const moved = retained.map((variable) => {
          const name = uniqueName(names, variable.name)
          names.push(name)
          return makeVariable(ids, {
            name,
            type: variable.type,
            kind: variable.kind,
            value: variable.value,
            bytes: variable.bytes,
            heapId: variable.heapId,
            retainOnReturn: variable.retainOnReturn,
          })
        })
        frames = [{ ...parent, variables: [...moved, ...parent.variables] }, ...rest.slice(1)]
        for (const variable of moved) {
          logs.push({
            id: ids.id('log'),
            tone: 'heap',
            text: `runtime: ${variable.name} ${variable.type} stored in ${parent.name} — heap object still live`,
          })
        }
      } else if (!parent && retained.length > 0) {
        logs.push({
          id: ids.id('log'),
          tone: 'warn',
          text: 'runtime: process exited — returned pointers dropped with main',
        })
      }
      for (const obj of state.heap) {
        const heldByFrame = top.variables.some((variable) => variable.heapId === obj.id)
        if (!heldByFrame || !obj.globalRoot || isReachable(obj, frames) === false) continue
        if (frames.some((frame) => frame.variables.some((variable) => variable.heapId === obj.id))) continue
        logs.push({
          id: ids.id('log'),
          tone: 'heap',
          text: `runtime: ${obj.address} ${obj.name} retained by GC root ${obj.rootName ?? 'package var'}`,
        })
      }
      const unreachable = state.heap.filter((obj) => obj.status === 'live' && !isReachable(obj, frames))
      for (const obj of unreachable) {
        logs.push({
          id: ids.id('log'),
          tone: 'warn',
          text: `runtime: ${obj.address} ${obj.name} now unreachable — waiting for GC`,
        })
      }
      const note =
        retained.length > 0 && parent
          ? ` · pointer kept by ${parent.name}`
          : unreachable.length > 0
            ? ` · ${unreachable.length} heap object${unreachable.length === 1 ? '' : 's'} waiting for GC`
            : ''
      return {
        ...state,
        ...ids.commit(),
        clockMs,
        phase: 'idle',
        frames,
        logs: appendLogs(state.logs, logs),
        snippet: parent?.analysis ?? MAIN_ANALYSIS,
        toasts: pushToast(
          state.toasts,
          ids,
          parent
            ? `Returned ${top.name} · reclaimed ${freed} B of stack${note}`
            : `main returned · process exited · reclaimed ${freed} B of stack${note}`,
          'pop',
        ),
      }
    }
    case 'BEGIN_GC': {
      if (busy(state)) return state
      const heap = state.heap.map((obj) =>
        obj.status === 'live' && !isReachable(obj, state.frames) ? { ...obj, status: 'collecting' as const } : obj,
      )
      return { ...state, phase: 'gc', pulse: 'gc', heap }
    }
    case 'FINISH_GC': {
      if (state.phase !== 'gc') return state
      const ids = idsFrom(state)
      const clockMs = tickClock(state.clockMs, state.seq)
      const swept = state.heap.filter((obj) => obj.status === 'collecting')
      const reclaimed = swept.reduce((sum, obj) => sum + obj.bytes, 0)
      const cycle = state.gcCycles + 1
      const mark = (0.16 + (cycle % 5) * 0.03).toFixed(2)
      const sweep = (0.04 + (cycle % 3) * 0.01).toFixed(2)
      const logs: LogLine[] = [
        {
          id: ids.id('log'),
          tone: 'gc',
          text: `gc ${cycle} @${(clockMs / 1000).toFixed(3)}s 1%: 0.12+${mark}+${sweep} ms clock, 0->0->0 MB, 4 MB goal, 8 P`,
        },
      ]
      if (swept.length === 0) {
        logs.push({
          id: ids.id('log'),
          tone: 'ok',
          text: 'runtime: mark found no unreachable objects',
        })
      } else {
        for (const obj of swept) {
          logs.push({
            id: ids.id('log'),
            tone: 'gc',
            text: `runtime: freed ${obj.address} ${obj.name} (${obj.bytes} B) — unreachable`,
          })
        }
        logs.push({
          id: ids.id('log'),
          tone: 'gc',
          text: `runtime: swept ${swept.length} object${swept.length === 1 ? '' : 's'}, ${reclaimed} B reclaimed`,
        })
      }
      const stillSelected = swept.some((obj) => obj.id === state.selectedHeapId)
      return {
        ...state,
        ...ids.commit(),
        clockMs,
        phase: 'idle',
        gcCycles: cycle,
        heap: state.heap.filter((obj) => obj.status !== 'collecting'),
        logs: appendLogs(state.logs, logs),
        selectedHeapId: stillSelected ? null : state.selectedHeapId,
        toasts: pushToast(
          state.toasts,
          ids,
          swept.length === 0
            ? `GC cycle ${cycle} · heap is clean · 0 B reclaimed`
            : `GC cycle ${cycle} · reclaimed ${reclaimed} B from ${swept.length} object${swept.length === 1 ? '' : 's'}`,
          'gc',
        ),
      }
    }
    case 'RESET': {
      const next = initialState()
      return {
        ...next,
        toasts: [{ id: `toast-reset-${next.seq}`, message: 'Runtime reset · only main() is on the stack', tone: 'stack' }],
      }
    }
    case 'CLEAR_LOGS': {
      const ids = idsFrom(state)
      return {
        ...state,
        ...ids.commit(),
        logs: [{ id: ids.id('log'), tone: 'cmd', text: '$ # compiler log cleared' }],
      }
    }
    case 'SELECT':
      return { ...state, selectedHeapId: action.heapId }
    case 'SHOW_ANALYSIS':
      return { ...state, snippet: action.analysis }
    case 'PULSE':
      return { ...state, pulse: action.pulse }
    case 'DISMISS_TOAST':
      return { ...state, toasts: state.toasts.filter((toast) => toast.id !== action.id) }
    default:
      return state
  }
}

function initialState(): RuntimeState {
  const seed: RuntimeState = {
    frames: [],
    heap: [],
    logs: [],
    snippet: MAIN_ANALYSIS,
    gcCycles: 0,
    phase: 'idle' as Phase,
    pulse: null,
    selectedHeapId: null,
    toasts: [],
    stackCursor: 0,
    heapCursor: 0,
    seq: 1,
    addr: 0xc000100000,
    clockMs: 8,
  }
  const ids = idsFrom(seed)
  const frame = makeMain(ids)
  const logs = [
    ...commandLogs(ids, seed.clockMs),
    ...analysisLogs(ids, MAIN_ANALYSIS),
  ]
  return {
    ...seed,
    ...ids.commit(),
    frames: [frame],
    logs,
  }
}

export function useRuntime() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  useEffect(() => {
    if (state.phase === 'popping') {
      const timer = window.setTimeout(() => dispatch({ type: 'FINISH_POP' }), POP_MS)
      return () => window.clearTimeout(timer)
    }
    if (state.phase === 'gc') {
      const timer = window.setTimeout(() => dispatch({ type: 'FINISH_GC' }), GC_MS)
      return () => window.clearTimeout(timer)
    }
    return
  }, [state.phase])

  useEffect(() => {
    if (!state.pulse) return
    const timer = window.setTimeout(() => dispatch({ type: 'PULSE', pulse: null }), 700)
    return () => window.clearTimeout(timer)
  }, [state.pulse, state.seq, state.gcCycles])

  return {
    state,
    stats: computeStats(state),
    allocate: (index?: number) => dispatch({ type: 'ALLOCATE', index }),
    escape: (index?: number) => dispatch({ type: 'ESCAPE', index }),
    popFrame: () => dispatch({ type: 'BEGIN_POP' }),
    collect: () => dispatch({ type: 'BEGIN_GC' }),
    reset: () => dispatch({ type: 'RESET' }),
    clearLogs: () => dispatch({ type: 'CLEAR_LOGS' }),
    select: (heapId: string | null) => dispatch({ type: 'SELECT', heapId }),
    showAnalysis: (analysis: Analysis) => dispatch({ type: 'SHOW_ANALYSIS', analysis }),
    dismissToast: (id: string) => dispatch({ type: 'DISMISS_TOAST', id }),
  }
}

export function backrefs(frames: StackFrame[]) {
  const map = new Map<string, string[]>()
  for (const frame of frames) {
    for (const variable of frame.variables) {
      if (!variable.heapId) continue
      const list = map.get(variable.heapId) ?? []
      list.push(`${variable.name} in ${frame.name}`)
      map.set(variable.heapId, list)
    }
  }
  return map
}

export function toneClass(tone: LogTone) {
  switch (tone) {
    case 'cmd':
      return 'text-zinc-500'
    case 'stack':
      return 'text-cyan-300'
    case 'heap':
      return 'text-amber-300'
    case 'gc':
      return 'text-rose-300'
    case 'ok':
      return 'text-emerald-300'
    case 'warn':
      return 'text-orange-300'
    default:
      return 'text-zinc-400'
  }
}
