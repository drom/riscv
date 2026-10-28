[![NPM version](https://img.shields.io/npm/v/riscv.svg)](https://www.npmjs.org/package/riscv)
[![Build Status](https://github.com/drom/riscv/actions/workflows/linux.yml/badge.svg)](https://github.com/drom/riscv/actions/workflows/linux.yml)

# riscv

RISC-V ISA helpers: ISA string parser, extension database, opcode tables and
a table driven disassembler.

## Rationale

RISC-V is a modular ISA: a base integer set (`RV32I`, `RV64I`, `RV32E`, ...)
plus a growing list of single letter (`M`, `A`, `F`, `D`, `C`, `V`, ...) and
multi letter (`Zba`, `Zicsr`, `Svinval`, `Xfoo`, ...) extensions. The ISA string
(`rv64gc_zba_zbb`) is the canonical way to name a combination, but it is
hard to read, and the actual instruction encodings live in a separate
repository ([riscv/riscv-opcodes](https://github.com/riscv/riscv-opcodes)).

This package puts these pieces together in plain JavaScript:

* **One source of truth.** Instruction encodings are extracted from
  `riscv-opcodes` into `lib/extensions.json` and shipped with the package,
  so no network access is needed at runtime.
* **Data, not code.** Extensions, fields, CSRs and ABI register names are
  exposed as plain objects that can be used to build documentation,
  assemblers, disassemblers, simulators or hardware decoders.
* **Small footprint.** Node.js (>= 22.13) only, CommonJS, no runtime
  dependencies besides [onml](https://github.com/drom/onml) and
  [bit-field](https://github.com/drom/bitfield). CLI option parsing uses
  native `util.parseArgs`.

## CLI

Install globally:

```sh
npm i -g riscv
riscv --isa rv64gc_zba_zbb
```

or run without installing:

```sh
npx riscv --isa rv32g
```

Options:

| option         | description                     |
|----------------|---------------------------------|
| `--isa <type>` | RISC-V ISA string to explain    |
| `-h, --help`   | display help                    |

The ISA string is expanded into the list of extensions with version, number
of instructions for the given XLEN and description (ANSI colored output):

```
$ riscv --isa rv64gc_zba
XLEN = 64
g                         General-purpose set
i                 v2.1    52  Base Integer Instruction Set
m                 v2      13  Integer Multiplication and Division
a                 v2.1    22  Atomic Instructions
f                 v2.2    30  Single-Precision Floating-Point
d                 v2.2    32  Double-Precision Floating-Point
zicsr             v2      6   Control and Status Register (CSR) Instructions
zifencei          v2      1   Instruction-Fetch Fence
c                 v2      33  Compressed Instructions
zba                       8   Bit Manipulation; Address generation instructions
```

Parse errors are reported with the position in the string:

```
$ riscv --isa foo
XLEN = undefined
Has to start with RV at: 0
```

## Library

```sh
npm i riscv
```

```js
const riscv = require('riscv');
```

### ISA string

#### `langParser(isaLangWith())(str)`

`isaLangWith()` returns a tokenizer (CodeMirror stream mode compatible) for
the ISA string language; `langParser(lang)` turns it into a function that
parses a string into a state object.

```js
const { langParser, isaLangWith } = riscv;

const state = langParser(isaLangWith())('rv64gc_zba');
// {
//   xlen: 64,
//   body: [
//     {kind: 'b', name: 'g', start: 4, end: 5},
//     {kind: 'b', name: 'c', start: 5, end: 6},
//     {kind: 'z', name: 'zba', start: 7}
//   ],
//   ...
// }
```

`kind` is one of: `b` (single letter), `z` (`Z*` extensions),
`s` (`S*` supervisor extensions), `x` (`X*` vendor extensions).
Errors are added to `body` as `{error, start}`.

#### `renderAnsi(state, exto)`

Renders the parsed state into an ANSI colored string (used by the CLI).

```js
console.log(riscv.renderAnsi(state, riscv.exto));
```

### Extension database

* `exto` -- extension descriptions keyed by lower case name:
  `{id, kind, ver?, count?, desc, url?, items?}`. Groups like `g` list their members in `items`.

  ```js
  riscv.exto.zba;
  // {desc: 'Bit Manipulation; Address generation instructions', url: '...', id: 'zba', kind: 'z'}
  ```

* `getCount(name, xlen)` -- number of instructions in extension `name`
  for a given `xlen` (sums `rv_<name>` and `rv<xlen>_<name>` files).

  ```js
  riscv.getCount('m', 64); // 13
  ```

### Opcodes

* `extensions` -- array of all opcode files extracted from `riscv-opcodes`:

  ```js
  {
    name: 'rv_i',      // file name in riscv-opcodes/extensions
    ratified: true,
    opcodes: [
      {kind: 'leaf', name: 'add', mask: 0xfe00707f, valu: 0x33, args: ['rd', 'rs1', 'rs2']},
      {kind: 'pseudo', ref: ['rv64_c', 'c.srli'], name: 'c.srli', mask, valu, args},
      {kind: 'import', ref: [...]},
      ...
    ]
  }
  ```

  An instruction matches when `(inst & mask) === valu`.

* `opcodes` -- lists of `riscv-opcodes` file names:
  `RATIFIED_OPCODES`, `UNRATIFIED_OPCODES`, `ALL_OPCODES`.
* `filterOpcodes(extensions)` -- splits extensions by XLEN:
  `{rv32: [...], rv64: [...], rv128: [...]}`.
* `hashOpcodes(extensions)` -- groups opcodes into 35 buckets by the low
  bits (`inst[1:0]` for compressed, `inst[6:2]` for 32-bit encodings);
  used by the disassembler.
* `op2obj(fieldo)(text, name)` -- parses one `riscv-opcodes` file into the
  `opcodes` array format above.

  ```js
  riscv.op2obj({})('add rd rs1 rs2 31..25=0 14..12=0 6..2=0x0C 1..0=3');
  // [{kind: 'leaf', name: 'add', mask: 4261441663, valu: 51, args: ['rd', 'rs1', 'rs2']}]
  ```

* `extractNode(opts, path, names, fieldo, ratified)` -- async; fetches and
  parses opcode files from GitHub (`opts.url`, e.g. `'riscv/riscv-opcodes'`)
  or a local checkout (`opts.dir`). Returns a promise of `extensions` array.
* `jsonStringify(extensions)` -- compact, diff friendly JSON serializer used
  to write `lib/extensions.json`.

### Fields, registers, CSRs

* `fieldo` -- instruction fields: `{msb, lsb, kind?, bits?, prio?, src?, dst?}`.
  `bits` maps encoded bits to immediate bits.
* `kindo` -- field kind formatters, e.g. `kindo.xr(10) === 'a0'`,
  `kindo.csr(0x300) === 'mstatus'`.
* `fieldEnums` -- ABI names: `xabi`, `fabi`, `xabic`, `fabic` (compressed
  register subsets) and `rmlut` (rounding modes).
* `csrs` -- CSR names keyed by address: `csrs[0x300] === 'mstatus'`.

### Disassembler

`dasm[32](inst)` / `dasm[64](inst)` -- disassemble a single instruction word
for RV32 / RV64.

```js
riscv.dasm[32](0x00a00513); // 'addi a0,zero,10'
riscv.dasm[32](0x4501);     // 'c.li a0,0'
riscv.dasm[64](0xc00495d3); // 'fcvt.w.s a1,s1,rtz'
```

## Development

```sh
npm i --ignore-scripts
npm test                                  # eslint + mocha + c8 coverage
node bin/build-extensions.js              # regenerate lib/extensions.json from GitHub
node bin/build-extensions.js --dir ../riscv-opcodes/ -v   # ... or from local checkout
```

## License

MIT [LICENSE](LICENSE).
