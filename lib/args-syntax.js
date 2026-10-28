'use strict';

/* eslint camelcase: 0 */

// riscv-opcodes `args` -> syntax entry {asm, vars} (UDB style), for
// instructions riscv-unified-db does not describe (used by
// lib/syntax-overrides.js rules at build time).

const fieldo = require('./fieldo.js');

// field -> [UDB variable name, location, left_shift]
const regs = {
  rd: ['xd', '11-7'],
  rs1: ['xs1', '19-15'],
  rs2: ['xs2', '24-20'],
  rs3: ['xs3', '31-27'],
  // P extension register pairs: even register number
  p_rd_p: ['xd', '11-8', 1],
  p_rs1_p: ['xs1', '19-16', 1],
  p_rs2_p: ['xs2', '24-21', 1],
  vd: ['vd', '11-7'],
  vs1: ['vs1', '19-15'],
  vs2: ['vs2', '24-20'],
  vs3: ['vs3', '11-7'],
  vs2x8: ['vs2', '24-23'], // register group of 8: v0, v8, v16, v24
  // matrix tiles (Zvt)
  zvt_mtd8: ['mtd', '11-9', 1],
  zvt_mtd16: ['mtd', '11-8']
};

// fieldo fields with `bits` (value bit per instruction bit, msb first)
// -> one UDB location + shift ('31|7|30-25|11-8', 1)
const location = (fields) => {
  const pairs = fields.flatMap(f => f.bits.map((b, i) => ({b, inst: f.msb - i})))
    .sort((x, y) => y.b - x.b);
  const shl = pairs[pairs.length - 1].b;
  const parts = [];
  for (const p of pairs) {
    const last = parts[parts.length - 1];
    if (last && last.lo === p.inst + 1 && last.b === p.b + 1) {
      last.lo = p.inst;
      last.b = p.b;
    } else {
      parts.push({hi: p.inst, lo: p.inst, b: p.b});
    }
  }
  return {location: parts.map(r => (r.hi === r.lo) ? String(r.hi) : r.hi + '-' + r.lo).join('|'),
    ...(shl ? {left_shift: shl} : {})};
};

const isDest = (name) => /^(xd|vd|mtd)$/.test(name);

const flags = {
  vm: {name: 'vm', location: '25'},
  aq: {name: 'aq', location: '26'},
  rl: {name: 'rl', location: '25'}
};

// immediate field -> variable; fields with `bits` are merged into one
const immVar = (arg, f, scattered, name) => {
  const v = {name, ...(f.bits ? location(scattered) : {location: f.msb + '-' + f.lsb})};
  if ((f.bits ? scattered : [f]).some(x => x.kind === 'sext')) v.sign_extend = true;
  return v;
};

const fromArgs = (op) => {
  const args = op.args || [];
  const vars = [];
  const dst = [];
  const src = [];
  const imm = [];
  const scattered = args.map(a => fieldo[a]).filter(f => f && f.bits);
  for (const arg of args) {
    const r = regs[arg];
    if (r) {
      vars.push({name: r[0], location: r[1], ...(r[2] ? {left_shift: r[2]} : {})});
      (isDest(r[0]) ? dst : src).push(r[0]);
      continue;
    }
    if (flags[arg]) {
      vars.push({...flags[arg]});
      continue;
    }
    const f = fieldo[arg];
    if (!f) throw new Error('fromArgs: unknown field ' + arg + ' in ' + op.name);
    if (f.bits && f !== scattered[0]) continue; // merged into the first one
    const name = (arg === 'ci') ? 'ci' : imm.length ? 'imm' + (imm.length + 1) : 'imm';
    vars.push(immVar(arg, f, scattered, name));
    imm.push(name);
  }
  // vector: vd, vs2, vs1 / xs1, imm, vm (LLVM order)
  if ([...dst, ...src].some(n => n[0] === 'v')) src.sort((a, b) => (b === 'vs2') - (a === 'vs2'));
  const asm = [...dst, ...src, ...imm, ...(args.includes('vm') ? ['vm'] : [])].join(', ');
  return {asm, vars};
};

module.exports = fromArgs;
module.exports.location = location;
