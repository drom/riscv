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

  An instruction matches when `(inst & mask) === valu`. Optional opcode
  fields added by local patches (`lib/patches.js`): `alias: true` (assembler
  alias, not disassembled), `xlen` (only valid for this XLEN), `requires`
  (list of alternative extensions also needed, e.g. `c.mul`: `['m', 'zmmul']`).

* `syntax` -- assembly syntax per opcode (`lib/syntax.json`), keyed
  `'<file>::<name>'`: `{udb, asm: 'xd, imm(xs1)', vars: [{name, location,
  left_shift?, sign_extend?, not?}], ...}`.

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
* `csrs` -- CSR names keyed by address: `csrs[0x300] === 'mstatus'`
  (hand-written, 1.x). The disassembler uses `lib/csr-names.json`, built from
  `riscv-opcodes` `csrs.csv` / `csrs32.csv`.

### Disassembler

Table driven, output format of `llvm-mc --disassemble -M no-aliases`
(no pseudo instructions / aliases).

`dasm(inst, {xlen, isa})` -- disassemble one instruction word. `xlen`
default: from the ISA string (`rv32...`), else 64.

* `isa` -- ISA string (`'rv64gc_zba'`), list of extension names
  (`['m', 'zba']`) or `'all'`. Default: base `I` (plus privileged
  `ecall`, `mret`, `sfence.vma`, ...). Extension implications (`g`, `d` -> `f`,
  `zk` -> `zkn` ..., `c` -> `zca` / `zcf` / `zcd`) are applied.
* unknown or reserved encodings -> `.insn 0x...`

```js
riscv.dasm(0x00a00513);                     // 'addi a0, zero, 10'
riscv.dasm(0x4501, {isa: 'rv32gc'});        // 'c.li a0, 0'
riscv.dasm(0xc00495d3, {isa: 'rv64g'});     // 'fcvt.w.s a1, fs1, rtz'
riscv.dasm(0x02b54557, {isa: 'rv64gcv'});   // 'vadd.vx v10, v11, a0'
riscv.dasm(0x7605e013, {isa: 'rv64i_zicbop'}); // 'prefetch.i 1888(a1)'
riscv.dasm(0x0000000b);                     // '.insn 0x0000000b'
```

`decode(inst, {xlen, isa})` -- the same as data:

```js
riscv.decode(0x00a00513);
// {name: 'addi', ext: 'rv_i', len: 4, raw: 10487059,
//  ops: [{kind: 'xreg', name: 'xd', text: 'a0', value: 10}, ...], op, syntax}
```

`instLength(inst)` -- instruction length in bytes from the low bits
(2, 4, 6, 8; 0 for reserved >= 80 bit encodings).

How it works:

* candidates: opcodes of the enabled `riscv-opcodes` files, assembler
  aliases (`mv`, `csrr`, `j`, ...) skipped, more specific encodings (mask
  popcount) first
* operands: assembly template and immediate layout from
  [riscv-unified-db](https://github.com/riscv/riscv-unified-db)
  (`lib/syntax.json`): register classes, `imm(xs1)`, implicit `sp`,
  sign extension, scaling, scattered bits
* reserved values (`c.addi4spn` with imm 0, odd register pairs, `rm` 5 / 6,
  misaligned vector register groups, ...) reject a candidate
* names: `.aq` / `.rl` / `.aqrl`, vector segments (`vlseg<N>e8.v`)

Verified against `llvm-mc` (see *Disassembler test oracle* below).

`dasm[32]` / `dasm[64]` (1.x) are removed.

## Development

```sh
npm i
npm test            # eslint + mocha + c8 coverage
npm run opcodes     # rebuild lib/extensions.json, lib/syntax.json, lib/csr-names.json
npm run dasm-audit  # disassembler vs llvm-mc golden data
```

### Data pipeline

```
riscv-opcodes @pin ── parse ── lib/patches.js ── imports ──> lib/extensions.json
                       csrs.csv ── patches.csrs ──────────> lib/csr-names.json
riscv-unified-db @pin ── join by encoding ── lib/syntax-overrides.js ──> lib/syntax.json
```

* `lib/patches.js` -- local fixes of `riscv-opcodes` data. Class `U`:
  upstream bug (link the upstream issue / PR in `upstream`); class `N`:
  upstream naming convention (`.rv32` suffix, aliases), permanent. A patch
  that matches nothing or changes nothing is reported as stale.
* `lib/syntax-overrides.js` -- syntax not in, or different from, UDB:
  HINT encodings, reserved fields, P / Zvt syntax generated from
  `riscv-opcodes` fields (`rules`). Stale and redundant overrides are reported.
* the build cross-checks `riscv-opcodes` against UDB (encodings, immediate
  layout, sign extension) and reports opcodes without syntax.

### Disassembler test oracle

`test/dasm/golden.json` holds random encodings of every opcode disassembled by
`llvm-mc -M no-aliases` (features from the opcode file name);
`test/dasm/known-diff.json` the accepted differences (encodings unknown to /
disputed with LLVM). `npm test` fails on a new difference and on a fixed one
still listed.

```sh
node bin/dasm-audit.js                  # statistics
node bin/dasm-audit.js --show all-diff  # list differences
node bin/dasm-audit.js --update-known   # accept current differences
node bin/dasm-audit.js --generate       # regenerate golden data (needs llvm-mc)
```

### Opcode source

`lib/extensions.json` is generated from
[riscv/riscv-opcodes](https://github.com/riscv/riscv-opcodes) and committed to
this repo, so installing the package never touches the network.

Current snapshot:

| repo | commit | date |
|------|--------|------|
| [riscv/riscv-opcodes](https://github.com/riscv/riscv-opcodes/tree/f24ac23ec9fa947011781a09cd6fd25a7c36dc45) | `f24ac23ec9fa947011781a09cd6fd25a7c36dc45` | 2026-10-14 |

The pin lives in `package.json`:

```json
"riscvOpcodes": {
  "repo": "riscv/riscv-opcodes",
  "commit": "f24ac23ec9fa947011781a09cd6fd25a7c36dc45",
  "date": "2026-10-14T19:04:55Z"
}
```

`bin/build-extensions.js` options:

| option         | description                                                  |
|----------------|--------------------------------------------------------------|
| `--ref <ref>`  | commit / branch / tag (default: pinned commit)                |
| `--url <repo>` | GitHub repo (default: pinned repo)                            |
| `--dir <dir>`  | use a local riscv-opcodes checkout instead of GitHub          |
| `--udb-ref <ref>` | riscv-unified-db commit / branch / tag (default: pinned)   |
| `--udb-url <repo>` | riscv-unified-db GitHub repo (default: pinned repo)       |
| `--udb-dir <dir>` | use a local riscv-unified-db checkout                      |
| `--skip-udb`   | do not build `lib/syntax.json`                                |
| `--pin`        | store resolved commit(s) and date(s) in `package.json`        |
| `--dry-run`    | check only, write nothing                                     |
| `--force`      | write `lib/extensions.json` even if there are errors          |
| `-v`           | verbose                                                       |

A branch or tag given to `--ref` is resolved to a full commit hash first, so
all files come from the same commit. Set `GITHUB_TOKEN` to avoid GitHub API
rate limits.

The build collects all problems and prints them together, grouped, with
`file:line instruction` locations. Errors stop the build: nothing is written
and the exit code is 1. Checks:

* **error** -- field name not in `lib/fieldo.js`; the message includes the bit
  range from upstream `arg_lut.csv` and the line to add
* **error** -- `lib/fieldo.js` bit range differs from `arg_lut.csv`
* **error** -- overlapping bit ranges, bad ranges or values, malformed or unknown
  `$` directives
* **error** -- `$import` of a missing file or instruction; duplicate file names
* **warning** -- instruction bits covered by neither fixed bits nor fields
* **warning** -- `$pseudo_op` referencing a missing file or instruction
* **warning** -- same instruction name defined twice in one file with unrelated
  encodings (likely an upstream typo)

Known warnings at the current snapshot (upstream issues, patched locally,
see `lib/patches.js`):

```
warning: unratified/rv_zvtbase:5 msetmtypei: bits 28, 24..23, 16..15 not covered by fixed bits or fields
warning: upstream bug patch without upstream issue / PR link
warning: rv_zicfiss sspopchk, sspush: instruction name defined twice with unrelated encodings (upstream typo?)
warning: rv_zvabd vabd.vv, vabdu.vv: encoding differs from UDB (both out of date vs Zvabd v0.7)
```

### Moving to a new riscv-opcodes commit

1. Dry run against the new commit (default branch is `master`):

   ```sh
   node bin/build-extensions.js --ref master --dry-run
   ```

   The output shows the resolved commit and date, the pinned commit,
   the changes compared to the current `lib/extensions.json`
   (`+` added, `-` removed, `~` changed files and instructions), and the
   diagnostics.

2. Fix the errors:
   * *unknown field* -- add the suggested entry to `lib/fieldo.js`. Pick a
     `kind` (register class: `xr`, `fr`, `vr`, ...; see `lib/kindo.js`, add
     a new one if needed), `prio` (order of `args` in `lib/extensions.json`;
     not used by the disassembler) and `src` / `dst`, or
     `bits` (+ `kind: 'sext'`) for immediates. Upstream
     `src/riscv_opcodes/constants.py` (`latex_mapping`) shows how
     immediate bits are scattered.
   * *bit range mismatch* -- upstream changed a field; update `lib/fieldo.js`.
   * anything else -- most likely an upstream problem; check the referenced
     `file:line`, report or work around it.

   Repeat step 1 until there are no errors. New warnings are worth a look.

3. Build and pin:

   ```sh
   node bin/build-extensions.js --ref <commit> --pin
   ```

   This writes `lib/extensions.json` and updates `riscvOpcodes` in
   `package.json`.

4. Review and test:

   ```sh
   git diff lib/extensions.json package.json lib/fieldo.js
   npm test
   ```

5. Update the *Current snapshot* table and the *Known warnings* list above,
   commit.

## License

MIT [LICENSE](LICENSE).
