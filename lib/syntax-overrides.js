'use strict';

/* eslint camelcase: 0 */

// Hand-written assembly syntax, merged over riscv-unified-db data into
// lib/syntax.json by bin/build-extensions.js.
//
//   key:   '<riscv-opcodes file>::<name>'  or  '<name>' (all files)
//   value: {reason, asm?, vars?, ...}, same shape as lib/syntax.json entries;
//          given fields replace UDB data, a function (udbValue, op) -> value
//          edits UDB data
//   rules: [{reason, file?, name?, gen: op -> {asm, vars}}] for opcodes
//          without UDB definition (P, Zvt, ...); file / name: string or RegExp
//
// Variable extensions understood by lib/decode.js (on top of UDB):
//   not    list of values that make the encoding reserved / another instruction
//   xlen   variable (its `not`) applies to this XLEN only
//   add    constant added to the value
//   map    {value: printed value}
//   omit   operand not printed for this value
//
// The build warns about stale (no such opcode) and redundant (same as UDB)
// overrides.

const fromArgs = require('./args-syntax.js');

const range = (lo, hi) => Array.from({length: hi - lo + 1}, (_, i) => lo + i);
const nonZero = range(1, 31);
const odd = range(0, 15).map(i => 2 * i + 1);

// drop `not` of variables: value is a HINT, decoded as the instruction (LLVM)
const hint = (...names) => (vars) => vars.map(v => {
  if (!names.includes(v.name)) return v;
  const {not, ...rest} = v; // eslint-disable-line no-unused-vars
  return rest;
});

// edit one variable
const editVar = (name, delta) => (vars) => vars.map(v => (v.name === name) ? {...v, ...delta} : v);

// extra constraint-only variables (not in the template)
const plus = (...extra) => (vars) => [...vars, ...extra];

// register pair: even register only (on RV32 if xlen = 32)
const pair = (name, location, xlen) => ({name: name + '_pair', location, not: odd, ...(xlen ? {xlen} : {})});

const hintShamt = {reason: 'shamt = 0 is a HINT (decoded by LLVM)', vars: hint('shamt')};
const hintXd = {reason: 'xd = x0 is a HINT (decoded by LLVM)', vars: hint('xd')};

const overrides = {
  // --- HINT encodings, decoded as the instruction ----------------------------
  'rv32_c::c.srli': hintShamt,
  'rv32_c::c.srai': hintShamt,
  'rv32_c::c.slli': hintShamt,
  'rv64_c::c.srli': hintShamt,
  'rv64_c::c.srai': hintShamt,
  'rv64_c::c.slli': hintShamt,
  'rv_c::c.addi': {reason: 'xd = x0 or imm = 0 is a HINT (decoded by LLVM)', vars: hint('xd', 'imm')},
  'rv_c::c.li': hintXd,
  'rv_c::c.lui': {reason: 'xd = x0 is a HINT; xd = x2 is c.addi16sp (more specific); imm = 0 reserved',
    vars: (vars) => hint('xd')(vars).map(v => (v.name === 'imm') ? {...v, not: 0} : v)},
  'rv_c::c.mv': hintXd,
  'rv_c::c.nop': {reason: 'LLVM prints c.nop without operand for imm = 0 (imm != 0 is a HINT)',
    vars: editVar('imm', {omit: 0})},
  'rv_c::c.add': hintXd,

  // --- reserved fields that LLVM does not decode ------------------------------
  'rv_i::fence': {reason: 'fm != 0 (other than fence.tso), rs1, rd != 0 reserved',
    vars: vars => vars.map(v => ['fm', 'xs1', 'xd'].includes(v.name) ? {...v, not: range(1, 31)} : v)},
  'rv_i::fence.tso': {reason: 'rs1, rd != 0 reserved',
    vars: vars => vars.map(v => ['xs1', 'xd'].includes(v.name) ? {...v, not: nonZero} : v)},
  'rv_zifencei::fence.i': {reason: 'imm, rs1, rd != 0 reserved',
    vars: vars => vars.map(v => ['imm', 'xs1', 'xd'].includes(v.name) ? {...v, not: range(1, 4095)} : v)},
  'rv64_c::c.ldsp': {reason: 'xd = x0 reserved', vars: editVar('xd', {not: 0})},
  'rv_zacas::amocas.d': {reason: 'RV32: xd, xs2 are register pairs (even)',
    vars: plus(pair('xd', '11-7', 32), pair('xs2', '24-20', 32))},
  'rv64_zacas::amocas.q': {reason: 'xd, xs2 are register pairs (even)',
    vars: plus(pair('xd', '11-7'), pair('xs2', '24-20'))},

  // --- operand values ------------------------------------------------------------
  'rv_zibi::beqi': {reason: 'cimm = 0 encodes -1', vars: editVar('cimm', {map: {0: -1}})},
  'rv_zibi::bnei': {reason: 'cimm = 0 encodes -1', vars: editVar('cimm', {map: {0: -1}})},

  // --- not in UDB ----------------------------------------------------------------
  'rv_zvabd::vabs.v': {reason: 'Zvabd v0.7 (lib/patches.js), not in UDB',
    asm: 'vd, vs2, vm', vars: [{name: 'vm', location: '25'}, {name: 'vs2', location: '24-20'},
      {name: 'vd', location: '11-7'}]}
};

// Zvt (riscv-isa-manual PR 2997, zvt.adoc) assembly syntax
const zvt = {
  msetmtype: 'xd, xs1, xs2',
  msettn: 'xd, xs1',
  msettm: 'xd, xs1',
  msettk: 'xd, xs1',
  msetmtypei: 'xd, vsew, twiden',
  'vtmv.v.t': 'vd, xs1',
  'vtmv.t.v': 'xs1, vs2',
  vtzero: 'mtd',
  vtdiscard: ''
};

const zvtGen = (op) => {
  const {vars} = fromArgs({...op, args: op.args.filter(a => !/^zvt_(altfmt|vsew|mtwiden)$/.test(a))});
  if (op.name === 'msetmtypei') {
    vars.push({name: 'vsew', location: '24-23'}, {name: 'altfmt', location: '28'},
      {name: 'twiden', location: '16-15'});
  }
  if (/^vt[ls]e\d+$/.test(op.name)) return {asm: 'xs2, (xs1)', vars};
  if (zvt[op.name] !== undefined) return {asm: zvt[op.name], vars};
  return {asm: 'mtd, vs2, vs1', vars}; // vtfmm.tvv, vtmmu.tvv, ...
};

// P extension
//   (p)sati print the saturation width (encoded value + 1), LLVM / spec 0.20
//   (not the RV32 pair forms psati.dh / psati.dw)
//   pli.*  imm10: inst[15] = imm[9], inst[24:16] = imm[8:0], signed
//   plui.* imm10: inst[24] = imm[0], inst[23:15] = imm[9:1], signed
//   pli.b / pli.db imm8 signed
const pGen = (op) => {
  const res = fromArgs(op);
  const imm = (delta) => {
    res.vars = res.vars.map(v => (v.name === 'imm') ? {...v, ...delta} : v);
  };
  if (/^p?sati(\.[bhw])?$/.test(op.name)) imm({add: 1});
  if (op.args.includes('p_imm10')) {
    imm({location: /^plui\./.test(op.name) ? '23-15|24' : '15|24-16', sign_extend: true});
  }
  if (op.args.includes('p_imm8')) imm({sign_extend: true});
  return res;
};

overrides.rules = [
  {reason: 'P extension (not in UDB)', file: /^rv(32|64)?_p$/, gen: pGen},
  {reason: 'Zvt matrix extension (not in UDB)', file: /^rv_zvt/, gen: zvtGen},
  {reason: 'Zabhlrsc lr.b / lr.h (not in UDB)', file: 'rv_zabhlrsc', name: /^lr\./,
    gen: op => ({asm: 'xd, (xs1)', vars: fromArgs(op).vars})},
  {reason: 'Zabhlrsc sc.b / sc.h (not in UDB)', file: 'rv_zabhlrsc', name: /^sc\./,
    gen: op => ({asm: 'xd, xs2, (xs1)', vars: fromArgs(op).vars})},
  {reason: 'other instructions without UDB definition: syntax from riscv-opcodes fields',
    gen: fromArgs}
];

module.exports = overrides;
