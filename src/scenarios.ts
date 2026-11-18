import type { Analysis, HeapKind, VarKind } from './types'

export const FRAME_OVERHEAD = 16
export const MAX_FRAMES = 6

export interface VarSpec {
  name: string
  type: string
  kind: VarKind
  value: string
  bytes: number
}

export interface StackScenario {
  name: string
  signature: string
  analysis: Analysis
  variables: VarSpec[]
}

export interface HeapObjectSpec {
  pointerName: string
  pointerType: string
  pointerKind: VarKind
  pointerBytes: number
  pointerValue: (address: string) => string
  name: string
  type: string
  kind: HeapKind
  value: string
  bytes: number
  reason: string
  globalRoot: boolean
  rootName?: string
  retainOnReturn: boolean
  fate: string
}

export interface HeapScenario {
  name: string
  signature: string
  analysis: Analysis
  objects: HeapObjectSpec[]
}

const USERS = ['ada', 'lin', 'ken', 'rob', 'grace', 'russ'] as const

function pick<T>(items: readonly T[], tick: number) {
  return items[tick % items.length]
}

export const MAIN_ANALYSIS: Analysis = {
  title: 'main.go · main',
  code: `func main() {
    ready := true
}`,
  explanation:
    'ready is a stack boolean. Nothing takes its address, and it is not stored in an interface, so its lifetime ends with main.',
  logs: [
    { tone: 'info', text: './main.go:1:6: can inline main' },
    { tone: 'ok', text: './main.go:2:5: ready does not escape' },
  ],
  contrast: {
    title: 'Take the address of ready',
    verdict: 'heap',
    code: `var leaked *bool

func main() {
    ready := true
    leaked = &ready
}`,
    note: 'Storing &ready in a package variable makes it outlive main. Escape analysis would move it to the heap.',
  },
}

export function mainVariables(): VarSpec[] {
  return [
    {
      name: 'ready',
      type: 'bool',
      kind: 'bool',
      value: 'true',
      bytes: 1,
    },
  ]
}

export function nextStackScenario(tick: number): StackScenario {
  const n = [64, 7, 128, 3, 42, 256][tick % 6]
  const seed = [0xa1, 0x3c, 0x90, 0x17][tick % 4]
  const x = [-4, 12, 0, 80][tick % 4]
  const y = [9, -2, 15, 4][tick % 4]
  const port = [8080, 443, 3000, 9090][tick % 4]

  const scenarios: StackScenario[] = [
    {
      name: 'processData',
      signature: 'processData(n int) int',
      variables: [
        { name: 'count', type: 'int', kind: 'int', value: String(n * 2), bytes: 8 },
        {
          name: 'coords',
          type: '[2]int',
          kind: 'array',
          value: `[${n}, ${n + 14}]`,
          bytes: 16,
        },
      ],
      analysis: {
        title: 'main.go · processData',
        code: `func processData(n int) int {
    count := ${n * 2}
    coords := [2]int{${n}, ${n + 14}}
    return count + coords[0]
}`,
        explanation:
          'count and coords are used only inside processData and the result is returned by value. The compiler can prove both die with the frame, so neither escapes.',
        logs: [
          { tone: 'info', text: './main.go:1:6: can inline processData' },
          { tone: 'ok', text: './main.go:2:5: count does not escape' },
          { tone: 'ok', text: './main.go:3:5: coords does not escape' },
        ],
      },
    },
    {
      name: 'checksum',
      signature: 'checksum(seed uint32) uint32',
      variables: [
        {
          name: 'buf',
          type: '[8]byte',
          kind: 'array',
          value: `[${seed}, ${seed + 1}, ${seed + 2}, …]`,
          bytes: 8,
        },
        { name: 'sum', type: 'uint32', kind: 'int', value: String(seed), bytes: 4 },
      ],
      analysis: {
        title: 'main.go · checksum',
        code: `func checksum(seed uint32) uint32 {
    buf := [8]byte{0x${seed.toString(16)}, 0x${(seed + 1).toString(16)}}
    sum := seed
    return sum + uint32(buf[0])
}`,
        explanation:
          'buf is a fixed-size array. Its size is known at compile time and its address never leaves checksum, so the whole array is allocated in the stack frame.',
        logs: [
          { tone: 'ok', text: './main.go:2:5: buf does not escape' },
          { tone: 'ok', text: './main.go:3:5: sum does not escape' },
        ],
      },
    },
    {
      name: 'clampPoint',
      signature: 'clampPoint(x, y int) Point',
      variables: [
        {
          name: 'p',
          type: 'Point',
          kind: 'struct',
          value: `{X: ${Math.max(0, x)}, Y: ${y}}`,
          bytes: 16,
        },
      ],
      analysis: {
        title: 'main.go · clampPoint',
        code: `func clampPoint(x, y int) Point {
    p := Point{X: ${x}, Y: ${y}}
    if p.X < 0 {
        p.X = 0
    }
    return p
}`,
        explanation:
          'p is returned by value, so the caller receives a copy. Escape analysis keeps the original struct in clampPoint’s stack frame.',
        logs: [
          { tone: 'info', text: './main.go:1:6: can inline clampPoint' },
          { tone: 'ok', text: './main.go:2:5: p does not escape' },
        ],
      },
    },
    {
      name: 'loadConfig',
      signature: 'loadConfig() (port int, ok bool)',
      variables: [
        { name: 'port', type: 'int', kind: 'int', value: String(port), bytes: 8 },
        { name: 'ok', type: 'bool', kind: 'bool', value: 'true', bytes: 1 },
      ],
      analysis: {
        title: 'main.go · loadConfig',
        code: `func loadConfig() (port int, ok bool) {
    port = ${port}
    ok = true
    return
}`,
        explanation:
          'Named result parameters are still stack slots. Returning port and ok by value does not allocate on the heap.',
        logs: [
          { tone: 'ok', text: './main.go:2:5: port does not escape' },
          { tone: 'ok', text: './main.go:3:5: ok does not escape' },
        ],
      },
    },
  ]

  const scenario = scenarios[tick % scenarios.length]
  return { ...scenario, analysis: { ...scenario.analysis, contrast: STACK_CONTRAST[scenario.name] } }
}

export function nextHeapScenario(tick: number): HeapScenario {
  const id = 100 + tick * 17
  const name = pick(USERS, tick)
  const n = [4, 8, 3, 16][tick % 4]
  const boxed = [42, 7, 99, 1][tick % 4]
  const leaked = [42, 13, 255, 8][tick % 4]
  const spilled = [19, 64, 3, 128][tick % 4]

  const scenarios: HeapScenario[] = [
    {
      name: 'newUser',
      signature: 'newUser(id int) *User',
      objects: [
        {
          pointerName: 'u',
          pointerType: '*User',
          pointerKind: 'pointer',
          pointerBytes: 8,
          pointerValue: (address) => address,
          name: 'User',
          type: 'User',
          kind: 'struct',
          value: `{ID: ${id}, Name: "${name}"}`,
          bytes: 24,
          reason: 'returned pointer outlives newUser',
          globalRoot: false,
          retainOnReturn: true,
          fate: 'Returns to caller',
        },
      ],
      analysis: {
        title: 'main.go · newUser',
        code: `func newUser(id int) *User {
    u := User{ID: ${id}, Name: "${name}"}
    return &u
}`,
        explanation:
          'Returning &u makes the User live longer than newUser. The compiler moves u to the heap and hands the caller a pointer. Returning User by value would have stayed on the stack.',
        logs: [
          { tone: 'heap', text: './main.go:2:5: moved to heap: u' },
          { tone: 'heap', text: './main.go:3:12: &u escapes to heap' },
          { tone: 'info', text: './main.go:3:12:   from return &u (return) at ./main.go:3:5' },
        ],
      },
    },
    {
      name: 'scores',
      signature: 'scores(n int) []int',
      objects: [
        {
          pointerName: 's',
          pointerType: '[]int',
          pointerKind: 'slice',
          pointerBytes: 24,
          pointerValue: (address) => `len:${n} cap:${n} → ${address}`,
          name: '[]int backing',
          type: '[]int',
          kind: 'slice',
          value: `[${n}, 0, 0${n > 3 ? ', …' : ''}]`,
          bytes: n * 8,
          reason: 'make size is dynamic',
          globalRoot: false,
          retainOnReturn: true,
          fate: 'Returns to caller',
        },
      ],
      analysis: {
        title: 'main.go · scores',
        code: `func scores(n int) []int {
    s := make([]int, ${n})
    return s
}`,
        explanation:
          'The slice header can sit on the stack (pointer, len, cap). make([]int, n) has a size unknown at compile time, so the backing array is allocated on the heap and escapes with the returned slice.',
        logs: [
          { tone: 'heap', text: `./main.go:2:10: make([]int, n) escapes to heap` },
          { tone: 'info', text: './main.go:2:10:   from make([]int, n) (non-constant size) at ./main.go:2:10' },
          { tone: 'info', text: './main.go:3:5:   from return s (return) at ./main.go:3:5' },
        ],
      },
    },
    {
      name: 'box',
      signature: 'box(n int) any',
      objects: [
        {
          pointerName: 'v',
          pointerType: 'any',
          pointerKind: 'interface',
          pointerBytes: 16,
          pointerValue: () => `int(${boxed})`,
          name: 'boxed int',
          type: 'int',
          kind: 'interface',
          value: String(boxed),
          bytes: 8,
          reason: 'stored in an interface',
          globalRoot: false,
          retainOnReturn: true,
          fate: 'Returns to caller',
        },
      ],
      analysis: {
        title: 'main.go · box',
        code: `func box(n int) any {
    return ${boxed}
}`,
        explanation:
          'An interface value is a (type, data) pair. The concrete int must be boxed on the heap so it can outlive the call. That is why n escapes even though the source looks like a plain number.',
        logs: [
          { tone: 'heap', text: './main.go:2:12: n escapes to heap' },
          { tone: 'info', text: './main.go:2:12:   from n (passed to interface-converted argument) at ./main.go:2:12' },
          { tone: 'info', text: './main.go:2:5:   from return n (return) at ./main.go:2:5' },
        ],
      },
    },
    {
      name: 'spill',
      signature: 'spill(n int)',
      objects: [
        {
          pointerName: 'p',
          pointerType: '*int',
          pointerKind: 'pointer',
          pointerBytes: 8,
          pointerValue: (address) => address,
          name: 'int',
          type: 'int',
          kind: 'scalar',
          value: String(spilled),
          bytes: 8,
          reason: 'address passed to an unknown function',
          globalRoot: false,
          retainOnReturn: false,
          fate: 'Dies with frame',
        },
      ],
      analysis: {
        title: 'main.go · spill',
        code: `func spill(n int) {
    x := ${spilled}
    external.Observe(&x)
}`,
        explanation:
          'external.Observe is outside this package, so the compiler cannot prove it drops the pointer. x is moved to the heap. If Observe does not retain it, the object becomes unreachable when spill returns and waits for GC.',
        logs: [
          { tone: 'heap', text: './main.go:2:5: moved to heap: x' },
          { tone: 'heap', text: './main.go:3:22: &x escapes to heap' },
          { tone: 'info', text: './main.go:3:22:   from &x (passed to call[argument]) at ./main.go:3:22' },
        ],
      },
    },
    {
      name: 'leak',
      signature: 'leak()',
      objects: [
        {
          pointerName: 'x',
          pointerType: '*int',
          pointerKind: 'pointer',
          pointerBytes: 8,
          pointerValue: (address) => address,
          name: 'int',
          type: 'int',
          kind: 'scalar',
          value: String(leaked),
          bytes: 8,
          reason: 'stored in package-level sink',
          globalRoot: true,
          rootName: 'sink',
          retainOnReturn: false,
          fate: 'GC root · var sink',
        },
      ],
      analysis: {
        title: 'main.go · leak',
        code: `var sink *int

func leak() {
    x := ${leaked}
    sink = &x
}`,
        explanation:
          'Assigning &x to package-level sink leaks x onto the heap. The package variable is a GC root, so the object stays reachable after leak returns. A later assignment to sink drops the previous object.',
        logs: [
          { tone: 'heap', text: './main.go:4:5: moved to heap: x' },
          { tone: 'heap', text: './main.go:5:12: &x escapes to heap' },
          { tone: 'info', text: './main.go:5:12:   from sink (assigned) at ./main.go:5:5' },
        ],
      },
    },
    {
      name: 'counter',
      signature: 'counter() func() int',
      objects: [
        {
          pointerName: 'next',
          pointerType: 'func() int',
          pointerKind: 'pointer',
          pointerBytes: 8,
          pointerValue: (address) => address,
          name: 'closure',
          type: 'func() int',
          kind: 'closure',
          value: '{ n: 0 }',
          bytes: 24,
          reason: 'captured by a returned closure',
          globalRoot: false,
          retainOnReturn: true,
          fate: 'Returns to caller',
        },
      ],
      analysis: {
        title: 'main.go · counter',
        code: `func counter() func() int {
    n := 0
    return func() int {
        n++
        return n
    }
}`,
        explanation:
          'The function literal captures n and is returned. Both the closure and n must outlive counter, so the compiler moves them to the heap together.',
        logs: [
          { tone: 'heap', text: './main.go:3:12: func literal escapes to heap' },
          { tone: 'heap', text: './main.go:2:5: moved to heap: n' },
          { tone: 'info', text: './main.go:2:5:   from n (captured by a closure) at ./main.go:4:9' },
          { tone: 'info', text: './main.go:3:5:   from return func literal (return) at ./main.go:3:5' },
        ],
      },
    },
  ]

  const scenario = scenarios[tick % scenarios.length]
  return { ...scenario, analysis: { ...scenario.analysis, contrast: HEAP_CONTRAST[scenario.name] } }
}

export const STACK_CATALOG = [
  { index: 0, name: 'processData', hint: 'int and [2]int used only inside the function' },
  { index: 1, name: 'checksum', hint: 'fixed [8]byte whose address never leaves the frame' },
  { index: 2, name: 'clampPoint', hint: 'struct returned by value — caller gets a copy' },
  { index: 3, name: 'loadConfig', hint: 'named results are still stack slots' },
] as const

export const HEAP_CATALOG = [
  { index: 0, name: 'newUser', hint: 'return &u — the struct must outlive the function' },
  { index: 1, name: 'scores', hint: 'make([]int, n) — backing array size is dynamic' },
  { index: 2, name: 'box', hint: 'return n as any — interface boxing' },
  { index: 3, name: 'spill', hint: '&x passed to an unknown function, then dropped' },
  { index: 4, name: 'leak', hint: 'assigned to package-level sink — a GC root' },
  { index: 5, name: 'counter', hint: 'closure captures n and is returned' },
] as const

const STACK_CONTRAST: Record<string, Analysis['contrast']> = {
  processData: {
    title: 'Return &coords instead',
    verdict: 'heap',
    code: `func processData(n int) *[2]int {
    coords := [2]int{n, n + 14}
    return &coords
}`,
    note: 'The array now outlives the frame. The compiler moves coords to the heap and returns a pointer.',
  },
  checksum: {
    title: 'Return a slice of buf',
    verdict: 'heap',
    code: `func checksum(seed uint32) []byte {
    buf := [8]byte{}
    return buf[:]
}`,
    note: 'Slicing a local array and returning the slice shares the backing storage. buf escapes.',
  },
  clampPoint: {
    title: 'Return *Point',
    verdict: 'heap',
    code: `func clampPoint(x, y int) *Point {
    p := Point{X: x, Y: y}
    return &p
}`,
    note: 'Returning the address means p cannot live in a frame that is about to disappear.',
  },
  loadConfig: {
    title: 'Return &port',
    verdict: 'heap',
    code: `func loadConfig() *int {
    port := 8080
    return &port
}`,
    note: 'A pointer result is the classic escape. The int is allocated on the heap so the caller can keep it.',
  },
}

const HEAP_CONTRAST: Record<string, Analysis['contrast']> = {
  newUser: {
    title: 'Return User by value',
    verdict: 'stack',
    code: `func newUser(id int) User {
    u := User{ID: id, Name: "ada"}
    return u
}`,
    note: 'The caller receives a copy. u never outlives newUser, so it stays in the stack frame.',
  },
  scores: {
    title: 'Use a fixed array',
    verdict: 'stack',
    code: `func scores() [4]int {
    var s [4]int
    return s
}`,
    note: 'A compile-time size and a value return need no heap backing array. The header-and-backing split goes away.',
  },
  box: {
    title: 'Return the int',
    verdict: 'stack',
    code: `func box(n int) int {
    return n
}`,
    note: 'Without an interface, there is nothing to box. n stays in a register or stack slot.',
  },
  spill: {
    title: 'Pass x by value',
    verdict: 'stack',
    code: `func spill(n int) {
    x := n
    external.Observe(x)
}`,
    note: 'If the callee cannot retain a pointer, the compiler can keep x on the stack.',
  },
  leak: {
    title: 'Do not publish the pointer',
    verdict: 'stack',
    code: `func leak() int {
    x := 42
    return x
}`,
    note: 'A package variable is a GC root. Returning the value instead never creates a heap object.',
  },
  counter: {
    title: 'Do not return a closure',
    verdict: 'stack',
    code: `func counter() int {
    n := 0
    n++
    return n
}`,
    note: 'Nothing captures n after return, so the compiler can keep it in the frame.',
  },
}
