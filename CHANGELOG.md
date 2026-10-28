# Changelog

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
