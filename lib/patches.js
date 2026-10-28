'use strict';

/* eslint camelcase: 0 */

// Local fixes for riscv-opcodes data, applied by bin/build-extensions.js
// before imports are resolved. Format: see lib/apply-patches.js.
//
// Lifecycle (class U):
//   1. add patch with `upstream: null`, build warns until a link is added
//   2. file issue / PR upstream, put the URL into `upstream`
//   3. after merge: npm run opcodes -- --ref <commit> --pin
//      build reports the patch as stale -> delete it
//
// Class N patches are permanent: riscv-opcodes naming conventions that
// differ from assembler syntax.

// riscv-opcodes pseudo ops that are assembler aliases of another
// instruction (`mv` = `addi`, `csrr` = `csrrs`, ...). Kept in the data,
// marked `alias: true`, skipped by the disassembler (no-aliases output).
const aliases = {
  rv_i: ['mv', 'neg', 'nop', 'zext.b', 'ret', 'jr', 'j', 'scall', 'sbreak', 'pause',
    'beqz', 'bnez', 'blez', 'bgez', 'bltz', 'bgtz', 'ble', 'bleu', 'bgt', 'bgtu',
    'seqz', 'snez', 'sltz', 'sgtz'],
  rv64_i: ['sext.w'],
  rv64_zba: ['zext.w'],
  rv64_zcb: ['c.sext.w'],
  rv_f: ['fmv.s', 'fabs.s', 'fneg.s', 'fmv.x.s', 'fmv.s.x',
    'frflags', 'fsflags', 'fsflagsi', 'frrm', 'fsrm', 'fsrmi', 'frcsr', 'fscsr'],
  rv_d: ['fmv.d', 'fabs.d', 'fneg.d'],
  rv_q: ['fmv.q', 'fabs.q', 'fneg.q'],
  rv_zfh: ['fmv.h', 'fabs.h', 'fneg.h'],
  rv_zicsr: ['csrr', 'csrw', 'csrs', 'csrc', 'csrwi', 'csrsi', 'csrci'],
  rv_zicntr: ['rdcycle', 'rdtime', 'rdinstret'],
  rv32_zicntr: ['rdcycleh', 'rdtimeh', 'rdinstreth'],
  rv_zicfilp: ['lpad'],
  rv_zihintntl: ['ntl.p1', 'ntl.pall', 'ntl.s1', 'ntl.all'],
  rv_c_zihintntl: ['c.ntl.p1', 'c.ntl.pall', 'c.ntl.s1', 'c.ntl.all'],
  rv_zilx: ['lxb', 'lxbu']
};

const exactName = (names) => new RegExp('^(' + names.map(n => n.replace(/\./g, '\\.')).join('|') + ')$');

// OPMVV vector instruction: funct6 vm vs2 vs1 010 vd 1010111
const opmvv = (funct6) => ({mask: 0xfc00707f, valu: ((funct6 << 26) | 0x2057) >>> 0});

const patches = [
  // --- class N: naming -----------------------------------------------------
  {
    id: 'strip-rv32-suffix',
    class: 'N',
    reason: 'RV32 variants named `slli_rv32`, `rev8.rv32`, ...; assembler name has no suffix',
    match: {name: /[._]rv32$/},
    rename: [/[._]rv32$/, '']
  },
  {
    id: 'strip-register-suffix',
    class: 'N',
    reason: 'register-specialized names `sspush.x1`, `c.sspopchk.x5`; register is an operand',
    match: {name: /^(c\.)?ss(push|popchk)\.x\d+$/},
    rename: [/\.x\d+$/, '']
  },
  ...Object.entries(aliases).map(([file, names]) => ({
    id: 'alias-' + file,
    class: 'N',
    reason: 'assembler alias of another instruction, not decoded',
    file,
    match: {name: exactName(names)},
    set: {alias: true}
  })),
  // rv_zicbo holds three extensions
  ...[[/^cbo\.(clean|flush|inval)$/, 'zicbom'], [/^cbo\.zero$/, 'zicboz'], [/^prefetch\./, 'zicbop']]
    .map(([name, ext]) => ({
      id: 'zicbo-requires-' + ext,
      class: 'N',
      reason: 'rv_zicbo file holds Zicbom, Zicboz and Zicbop',
      file: 'rv_zicbo',
      match: {name},
      set: {requires: [ext]}
    })),
  {
    id: 'alias-rv_v_aliases',
    class: 'N',
    reason: 'old vector mnemonics (vle1.v, vpopc.m, ...), aliases of rv_v instructions',
    file: 'rv_v_aliases',
    set: {alias: true}
  },

  // --- class U: upstream data bugs ------------------------------------------
  {
    id: 'zilsd-sd-name',
    class: 'U',
    upstream: null,
    reason: 'bugs.md 4.1: Zilsd store pair named `ld`, should be `sd` (UDB joins it with I/sd)',
    file: 'rv32_zilsd',
    match: {name: 'ld', args: ['rs1', 'rs2_e', 'imm12hi', 'imm12lo']},
    set: {name: 'sd', ref: ['rv64_i', 'sd']}
  },
  {
    id: 'zibi-branch-offset',
    class: 'U',
    upstream: null,
    reason: 'bugs.md 4.5: beqi / bnei use store immediate layout (imm12hi / imm12lo), '
      + 'should be branch offset (bimm12hi / bimm12lo); UDB and LLVM agree',
    file: 'rv_zibi',
    match: {args: ['rs1', 'imm12hi', 'imm5', 'imm12lo']},
    set: {args: ['rs1', 'bimm12hi', 'imm5', 'bimm12lo']}
  },
  {
    id: 'zvtbase-msetmtypei-imm',
    class: 'U',
    upstream: null,
    reason: 'bugs.md 4.3: msetmtypei leaves bits 28, 24..23, 16..15 undefined; Zvt draft '
      + '(riscv-isa-manual PR 2997): altfmt 28, vsew 24..23, mtwiden 16..15',
    file: 'rv_zvtbase',
    match: {name: 'msetmtypei', args: ['rd']},
    set: {args: ['rd', 'zvt_altfmt', 'zvt_vsew', 'zvt_mtwiden']}
  },
  // bugs.md 4.4: rv_zvabd is an old draft; Zvabd v0.7 (frozen, RISC-V ISA
  // explorer) and LLVM 23 have OPMVV .vv forms only, plus vabs.v
  ...[['vabd.vv', 0x11], ['vabdu.vv', 0x13], ['vwabda.vv', 0x15], ['vwabdau.vv', 0x16]].map(([name, funct6]) => ({
    id: 'zvabd-v0.7-' + name,
    class: 'U',
    upstream: null,
    reason: 'bugs.md 4.4: Zvabd v0.7 encoding (funct6 ' + funct6 + ', OPMVV)',
    file: 'rv_zvabd',
    match: {name},
    set: {...opmvv(funct6), args: ['vd', 'vs2', 'vs1', 'vm']}
  })),
  {
    id: 'zvabd-v0.7-no-vx',
    class: 'U',
    upstream: null,
    reason: 'bugs.md 4.4: Zvabd v0.7 has no .vx forms',
    file: 'rv_zvabd',
    match: {name: /\.vx$/},
    remove: true
  },
  {
    id: 'zcmt-cm.jt',
    class: 'U',
    upstream: null,
    reason: 'cm.jt missing (index < 32 of the cm.jalt encoding); UDB and LLVM have it',
    file: 'rv_zcmt',
    add: {name: 'cm.jt', mask: 0xff83, valu: 0xa002, args: ['c_index5']}
  },
  {
    id: 'zalasr-rv64-only',
    class: 'U',
    upstream: null,
    reason: 'ld.aq / sd.rl are RV64 only, listed in rv_zalasr',
    file: 'rv_zalasr',
    match: {name: /^(ld\.aq|sd\.rl)$/},
    set: {xlen: 64}
  },
  {
    id: 'zicfiss-rv64-only',
    class: 'U',
    upstream: null,
    reason: 'ssamoswap.d is RV64 only, listed in rv_zicfiss',
    file: 'rv_zicfiss',
    match: {name: 'ssamoswap.d'},
    set: {xlen: 64}
  },
  // Zcb instructions that need another extension (riscv-opcodes would need
  // rv_zcb_zbb, rv_zcb_zba, rv_zcb_zmmul files); `requires`: list of
  // alternatives
  ...[['rv_zcb', /^c\.(sext\.b|zext\.h|sext\.h)$/, ['zbb']],
    ['rv64_zcb', /^c\.zext\.w$/, ['zba']],
    ['rv_zcb', /^c\.mul$/, ['m', 'zmmul']]].map(([file, name, requires]) => ({
    id: 'zcb-requires-' + requires.join('-'),
    class: 'U',
    upstream: null,
    reason: 'Zcb ' + name.source + ' requires ' + requires.join(' or '),
    file,
    match: {name},
    set: {requires}
  })),
  {
    id: 'zicfiss-c-requires-zcmop',
    class: 'U',
    upstream: null,
    reason: 'c.sspush / c.sspopchk are Zcmop encodings (need Zcmop, as LLVM)',
    file: 'rv_c_zicfiss',
    set: {requires: ['zcmop']}
  },
  {
    id: 'zvabd-v0.7-vabs',
    class: 'U',
    upstream: null,
    reason: 'bugs.md 4.4: Zvabd v0.7 vabs.v (funct6 0x12, vs1 = 0x10, OPMVV)',
    file: 'rv_zvabd',
    add: {name: 'vabs.v', mask: 0xfc0ff07f, valu: 0x48082057, args: ['vd', 'vs2', 'vm']}
  }
];

// riscv-opcodes csrs.csv (all XLEN) / csrs32.csv (RV32 only) fixes
//   move: [numbers], from / to: 'all' | 'rv32'
patches.csrs = [
  {
    id: 'csr-smrnmi-all-xlen',
    class: 'U',
    upstream: null,
    reason: 'Smrnmi mnscratch, mnepc, mncause, mnstatus listed in csrs32.csv (RV32 only)',
    move: [0x740, 0x741, 0x742, 0x744],
    from: 'rv32',
    to: 'all'
  },
  {
    id: 'csr-pmpcfg-odd-rv32',
    class: 'U',
    upstream: null,
    reason: 'odd pmpcfg1..15 are RV32 only, listed in csrs.csv',
    move: [1, 3, 5, 7, 9, 11, 13, 15].map(i => 0x3a0 + i),
    from: 'all',
    to: 'rv32'
  }
];

module.exports = patches;
