# Changelog

## 2.3.0

New:

* `dasmCpp({xlen, isa, style, namespace})` -- C++11 disassembler generator,
  same output as `dasm` (`style: 'members'` to embed into a class,
  `'header'` for a standalone namespace header);
  `test/dasm-cpp.js` compiles and compares with `dasm` (skipped without a
  C++ compiler)
* `extend(pack, {override, report})` -- vendor extension contexts: `exto`,
  `extensions`, `syntax`, `implies`, `csrNames`, `fieldo`; context API
  `dasm`, `decode`, `candidates`, `isaSet`, `isaFiles`, `dasmCpp`,
  `renderAnsi`, `getCount`, `extend`; validation (file names, encodings,
  overlaps, imports, syntax keys, bit coverage); built-in data never
  modified. `builtin` -- context of the built-in data
* `lib/operands.js` -- operand formatters (JS and C++ forms), reserved
  encoding rules and name suffixes shared by `decode` and `dasmCpp`
* factories: `createIsa`, `createDecode`, `createDasm`, `createDasmCpp`,
  `createGetCount`, `createContext`
* `renderAnsi(state, exto, {getCount})` -- optional instruction counter

Unchanged: `dasm` / `decode` output (golden test).

## 2.2.0

New:

* exports: `isaSet`, `implies`, `fileExts`, `csrNames`
  (`lib/csr-names.json`), `candidates(xlen, isa)`, `buckets(cands)`,
  `bucketMask(len)`, `varValue`, `parseLocation`, `vtype`, `fliTable` --
  building blocks for other decoders / code generators, no `riscv/lib/*`
  deep requires needed
* `decode.js`: candidate list (`candidates`) split from bucket table
  (`buckets`)
* embedded vector subsets: `zve32x`, `zve32f`, `zve64x`, `zve64f`, `zve64d`
  enable `rv_v` instructions (were `.insn`); ELEN=32: EEW=64 loads / stores
  and 64-bit indices reserved; vector FP (`vf*`, `vmf*`) requires `zve32f`
  (patch `v-fp-requires-zve32f`); `zvl*b` implications
* README: ISA section (`parseIsaString`, `isaSet`, `implies`, `isaFiles`,
  `fileExts`, Zve rules)

Changed:

* `v` implies `zve64d`, `zvl128b` (so `f`, `d`, per V spec):
  `isaFiles('rv64imacv', 64)` now includes `rv_f`, `rv_d`
* `fileExts('rv_v')` is `['zve32x']` (was `['v']`)

Fixed:

* `lib/extensions.json`: identical opcodes after renames removed
  (`rv32_i`: `slli`, `srli`, `srai`; `rv32_c`: `c.slli`, `c.srli`, `c.srai`
  were listed twice -- upstream has both `slli` and `slli_rv32`)
* `bin/build-extensions.js`: error on an instruction defined twice with the
  same encoding in one file

## 2.1.0

New:

* `exto`: added `zvfofp8min` (v0.9), `zvfofp4min` (v0.1), `zce` (v1.0) and
  `svukte` (v0.4)

Fixed:

* `exto` spec URLs follow the current riscv-isa-manual layout
  (`src/unpriv/`, `src/priv/`, `src/profiles/`): per-extension `.adoc`
  files, updated anchors. AIA links now point to `.adoc`, profile links to
  isa-manual. `zam` link pinned to the last commit that has its spec file.
  `zibi` and `smpmpmt` links updated

## 2.0.0

Breaking:

* new disassembler: `dasm(inst, {xlen, isa})` returns LLVM
  `llvm-mc -M no-aliases` style text (`'addi a0, zero, 10'`);
  `dasm[32]` / `dasm[64]` removed
* default ISA for the disassembler is base `I`; other extensions via `isa`
  (ISA string, list of names or `'all'`)
* `lib/extensions.json`: local patches (`lib/patches.js`) applied --
  `.rv32` suffixes stripped (`rev8.rv32` -> `rev8`), `sspush.x1` -> `sspush`,
  Zilsd store named `sd`, Zibi branch offset fields, Zvabd v0.7 encodings,
  `cm.jt` added; new opcode fields `alias`, `xlen`, `requires`
* `fieldEnums.rmlut[2]` is `'rdn'` (was `'rtn'`)

New:

* `decode(inst, opts)` -- structured result (`name`, `ext`, `len`, `ops`)
* `instLength(inst)`, `isaFiles(isa, xlen)`, `parseIsaString(str)`
* `syntax` (`lib/syntax.json`) -- assembly syntax from riscv-unified-db +
  `lib/syntax-overrides.js`
* `lib/csr-names.json` from riscv-opcodes `csrs.csv` / `csrs32.csv`
* `bin/dasm-audit.js` -- llvm-mc based test oracle; 99.9% of the golden
  samples match (rest: encodings unknown to / disputed with LLVM)

Fixed (`plans/bugs.md` 1.x): operand order, FP / vector register classes,
signed / scaled / scattered immediates, `vm`, `aq` / `rl`, `nf`, `vtypei`,
`fli`, CSR names, memory operand syntax, implicit `sp`, candidate
specificity, reserved encodings, unknown instructions (`.insn`),
instruction length.
