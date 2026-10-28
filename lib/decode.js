'use strict';

/* eslint camelcase: 0 */

// Table driven RISC-V instruction decoder.
//
//   decode(inst, {xlen = 64, isa}) ->
//     {name, ext, len, raw, ops: [{kind, name, text, value}], op, syntax}
//     or {name: '.insn', len, raw, ops: []} for unknown / reserved encodings
//
// Data: lib/extensions.json (encodings, riscv-opcodes + lib/patches.js) and
// lib/syntax.json (assembly syntax, riscv-unified-db + lib/syntax-overrides.js).

const extensions = require('./extensions.json');
const syntax = require('./syntax.json');
const csrNames = require('./csr-names.json');
const { isaFiles, isaSet } = require('./isa.js');
const fieldEnums = require('./field-enums.js');

const popcount = (x) => {
  let n = 0;
  for (let v = x >>> 0; v; v >>>= 1) n += v & 1;
  return n;
};

// instruction length in bytes from the low bits (RISC-V length encoding)
//   xx != 11 -> 2, xxx11 (xxx != 111) -> 4, 011111 -> 6, 0111111 -> 8
const instLength = (inst) => {
  if ((inst & 3) !== 3) return 2;
  if ((inst & 0x1c) !== 0x1c) return 4;
  if ((inst & 0x3f) === 0x1f) return 6;
  if ((inst & 0x7f) === 0x3f) return 8;
  return 0; // >= 80 bit, reserved
};

const byFile = Object.fromEntries(extensions.map(e => [e.name, e]));

// '12|4-3|5|2|6' -> [12, 4, 3, 5, 2, 6]
const locCache = new Map();
const parseLocation = (loc) => {
  const key = String(loc);
  let res = locCache.get(key);
  if (res === undefined) {
    res = key.split('|').flatMap(part => {
      const [hi, lo = hi] = part.split('-').map(Number);
      const bits = [];
      for (let i = hi; i >= lo; i--) bits.push(i);
      return bits;
    });
    locCache.set(key, res);
  }
  return res;
};

// UDB variable -> value (Number)
const varValue = (inst, v) => {
  const bits = parseLocation(v.location);
  let x = 0;
  for (const b of bits) x = x * 2 + ((inst >>> b) & 1);
  let width = bits.length;
  if (v.left_shift) {
    x = x * Math.pow(2, v.left_shift);
    width += v.left_shift;
  }
  if (v.sign_extend && x >= Math.pow(2, width - 1)) {
    x -= Math.pow(2, width);
  }
  if (v.add) x += v.add;
  if (v.map && v.map[x] !== undefined) x = v.map[x];
  return x;
};

const notList = (v) => (v.not === undefined) ? [] : [].concat(v.not);

// bucket = bits that select the major opcode
const bucketMask = (len) => (len === 2) ? 0xe003 : 0x7f;

const submasks = (m) => {
  const res = [];
  let s = m;
  for (;;) {
    res.push(s);
    if (s === 0) break;
    s = (s - 1) & m;
  }
  return res;
};

const opLength = (op) => instLength(op.valu);

// candidate tables per xlen + isa
const tables = new Map();

const buildTable = (xlen, isa) => {
  const files = isaFiles(isa, xlen);
  const exts = isaSet(isa, xlen);
  const seen = new Set();
  const cands = [];
  files.forEach((file, fileIdx) => {
    for (const op of byFile[file].opcodes) {
      let src = op;
      let key = file + '::' + op.name;
      if (op.kind === 'import') {
        const ext = byFile[op.ref[0]];
        src = ext && ext.opcodes.find(o => o.name === op.ref[1] && o.kind !== 'import');
        if (!src) continue;
        key = op.ref[0] + '::' + src.name;
      }
      if (src.alias) continue;
      if (src.xlen !== undefined && src.xlen !== xlen) continue;
      if (src.requires && exts && !src.requires.some(r => exts.has(r))) continue;
      const id = src.name + ':' + src.mask + ':' + src.valu;
      if (seen.has(id)) continue;
      seen.add(id);
      cands.push({
        name: src.name,
        ext: key.split('::')[0],
        key,
        op: src,
        syntax: syntax[key],
        mask: src.mask >>> 0,
        valu: src.valu >>> 0,
        len: opLength(src),
        pop: popcount(src.mask),
        fileIdx
      });
    }
  });
  cands.sort((a, b) => (b.pop - a.pop) || (a.fileIdx - b.fileIdx));
  const buckets = {2: new Map(), 4: new Map()};
  for (const c of cands) {
    const bm = bucketMask(c.len);
    const fixed = c.mask & bm;
    const free = bm & ~fixed;
    const map = buckets[c.len];
    if (!map) continue;
    for (const s of submasks(free)) {
      const k = ((c.valu & fixed) | s) >>> 0;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(c);
    }
  }
  return buckets;
};

const getTable = (xlen, isa) => {
  const key = xlen + ':' + (Array.isArray(isa) ? isa.join('_') : String(isa));
  let t = tables.get(key);
  if (t === undefined) {
    t = buildTable(xlen, isa);
    tables.set(key, t);
  }
  return t;
};

// --- operands ---------------------------------------------------------------

const xreg = (n) => fieldEnums.xabi[n];
const freg = (n) => fieldEnums.fabi[n];

// Zcmp s-register (r1s / r2s): 0..7 -> s0..s7
const sreg = (n) => 's' + n;

const fliTable = [
  '-1.0', 'min', '1.52587890625e-05', '3.0517578125e-05', '0.00390625', '0.0078125', '0.0625', '0.125',
  '0.25', '0.3125', '0.375', '0.4375', '0.5', '0.625', '0.75', '0.875',
  '1.0', '1.25', '1.5', '1.75', '2.0', '2.5', '3.0', '4.0',
  '8.0', '16.0', '128.0', '256.0', '32768.0', '65536.0', 'inf', 'nan'
];

const lmulName = ['m1', 'm2', 'm4', 'm8', null, 'mf8', 'mf4', 'mf2'];

// vtypei: e<sew>[alt], <lmul>, t[au], m[au]; reserved -> number
const vtype = (x) => {
  const lmul = lmulName[x & 7];
  const vsew = (x >> 3) & 7;
  const alt = x & 0x100;
  if (lmul === null || vsew > 3 || (x >> 9) !== 0 || (alt && vsew > 1)) return String(x);
  return 'e' + (8 << vsew) + (alt ? 'alt' : '') + ', ' + lmul
    + ', ' + ((x & 0x40) ? 'ta' : 'tu') + ', ' + ((x & 0x80) ? 'ma' : 'mu');
};

const fenceSet = (x) => (x === 0) ? '0' : ['i', 'o', 'r', 'w'].filter((c, i) => x & (8 >> i)).join('');

// Zcmp register list and stack adjustment
const rlistName = (r) => {
  if (r === 4) return '{ra}';
  if (r === 5) return '{ra, s0}';
  if (r === 15) return '{ra, s0-s11}';
  return '{ra, s0-s' + (r - 5) + '}';
};

const stackBase = (r, xlen) => {
  const regs = (r === 15) ? 13 : r - 3; // ra + s0..
  const bytes = regs * (xlen / 8);
  return Math.ceil(bytes / 16) * 16;
};

const csrName = (x, xlen) => csrNames.all[x] || ((xlen === 32) && csrNames.rv32[x]) || String(x);

// token of an asm template -> register class
const regClass = (name) => {
  if (/^x(d|s\d)$/.test(name)) return 'x';
  if (/^f(d|s\d)$/.test(name)) return 'f';
  if (/^v(d|s\d)$/.test(name)) return 'v';
  return null;
};

const literal = (tok) => {
  const m = tok.match(/^x(\d+)$/);
  if (m) return {kind: 'xreg', text: xreg(Number(m[1]))};
  return {kind: (tok === 'sp') ? 'xreg' : (tok === 'v0') ? 'vreg' : 'literal', text: tok};
};

// register number from a variable; compressed fields (3 bit) -> x8..x15,
// 2 bit vector register group (vfbdota vs2) -> multiple of 8
const regNum = (cls, v, value) => {
  const width = parseLocation(v.location).length + (v.left_shift || 0);
  if (cls !== 'v' && width === 3) return value + 8;
  if (cls === 'v' && width < 5 && !v.left_shift) return value << (5 - width);
  return value;
};

const fmtVar = (tok, v, value, ctx) => {
  const cls = regClass(tok);
  if (cls) {
    const n = regNum(cls, v, value);
    if (cls === 'x') {
      if (ctx.fli && tok === 'xs1') return {kind: 'fimm', text: fliTable[value]};
      return {kind: 'xreg', text: xreg(n)};
    }
    if (cls === 'f') return {kind: 'freg', text: freg(n)};
    return {kind: 'vreg', text: 'v' + n};
  }
  switch (tok) {
  case 'csr': return {kind: 'csr', text: csrName(value, ctx.xlen)};
  case 'rm': return {kind: 'rm', text: fieldEnums.rmlut[value]};
  case 'vtypei': return {kind: 'vtype', text: vtype(value)};
  case 'pred':
  case 'succ': return {kind: 'fence', text: fenceSet(value)};
  case 'r1s':
  case 'r2s': return {kind: 'xreg', text: sreg(value)};
  case 'mtd': return {kind: 'treg', text: 'mt' + value};
  case 'vsew': return {kind: 'vtype', text: 'e' + (8 << value) + ((ctx.vars.altfmt || {}).value ? 'alt' : '')};
  case 'twiden': return {kind: 'vtype', text: 'w' + [0, 1, 2, 4][value]};
  }
  // immediates; lui / auipc / c.lui print the 20 bit field
  if ((v.left_shift || 0) >= 12) {
    return {kind: 'imm', text: String(((value / 4096) >>> 0) & 0xfffff)};
  }
  return {kind: 'imm', text: String(value)};
};

// asm template -> list of tokens {pre, name, post}
const tplCache = new Map();
const parseTemplate = (asm) => {
  let res = tplCache.get(asm);
  if (res === undefined) {
    res = (asm || '').split(',').map(s => s.trim()).filter(Boolean).map(t => {
      const m = t.match(/^(-?)([\w.{}]*)(?:\((\w+)\))?$/);
      if (!m) return {raw: t};
      return {neg: m[1] === '-', name: m[2], base: m[3]};
    });
    tplCache.set(asm, res);
  }
  return res;
};

const RESERVED = null;
const SKIP = undefined;

// special template tokens
const specials = {
  vm: (t, ctx) => {
    const vm = ctx.vars.vm;
    return (vm && vm.value === 0) ? {kind: 'mask', name: 'vm', text: 'v0.t', value: 0} : SKIP;
  },
  '{reg_list}': (t, ctx) => {
    const r = ctx.vars.rlist.value;
    return {kind: 'rlist', name: 'rlist', text: rlistName(r), value: r};
  },
  stack_adj: (t, ctx) => {
    const sp = ctx.vars.spimm;
    const adj = stackBase(ctx.vars.rlist.value, ctx.xlen) + sp.value * ((sp.v.left_shift) ? 1 : 16);
    return {kind: 'imm', name: 'stack_adj', text: String(t.neg ? -adj : adj), value: adj};
  }
};

// one template token -> operand, SKIP (not printed) or RESERVED
const operand = (t, ctx) => {
  if (t.raw !== undefined) return {kind: 'literal', text: t.raw};
  if (specials[t.name]) return specials[t.name](t, ctx);
  let text = '';
  if (t.name !== '') {
    const x = ctx.vars[t.name];
    let f;
    if (x === undefined) {
      f = literal(t.name);
    } else {
      if (x.v.omit === x.value) return SKIP;
      f = fmtVar(t.name, x.v, x.value, ctx);
      if (f.kind === 'rm') {
        if (x.value === 5 || x.value === 6) return RESERVED;
        // exact conversions: LLVM omits the default rounding mode
        if (x.value === 0 && legacyRm.test(ctx.name)) return SKIP;
      }
    }
    if (t.base === undefined) return {...f, name: t.name, value: x && x.value};
    text = f.text;
  }
  // memory operand: imm(base) / (base)
  const b = ctx.vars[t.base];
  const bt = b ? fmtVar(t.base, b.v, b.value, ctx).text : literal(t.base).text;
  return {kind: 'mem', name: t.name + '(' + t.base + ')', text: text + '(' + bt + ')'};
};

// candidate + instruction -> {name, ops} or null (reserved encoding)
const operands = (cand, inst, xlen) => {
  const syn = cand.syntax;
  if (!syn) return {name: cand.name, ops: []};
  const vars = {};
  for (const v of syn.vars || []) {
    const value = varValue(inst, v);
    if (v.xlen !== undefined && v.xlen !== xlen) continue;
    if (v.name !== 'aq' && v.name !== 'rl' && notList(v).includes(value)) return null;
    vars[v.name] = {v, value};
  }
  const ctx = {xlen, vars, name: cand.name, fli: /^fli\./.test(cand.name)};
  const ops = [];
  for (const t of parseTemplate(syn.asm)) {
    const o = operand(t, ctx);
    if (o === RESERVED) return null;
    if (o !== SKIP) ops.push(o);
  }
  if (reserved(cand, inst, xlen, vars)) return null;
  return {name: suffixes(cand, inst, cand.name), ops};
};

// conversions without rounding (widening), rm printed only when not rne
const legacyRm = /^fcvt\.(d\.(w|wu|s|h)|s\.(h|bf16)|q\.\w+)$/;

// reserved encodings (spec), not expressible as single variable values
const reserved = (cand, inst, xlen, vars) => {
  const name = cand.name;
  // RV32: indexed vector load / store with 64 bit indices
  if (xlen === 32 && /^v[ls][ou]x(seg\d)?ei64\.v$/.test(name)) return true;
  // whole register load / store / move: register group alignment
  const m = name.match(/^(?:vl(\d)re\d+\.v|vs(\d)r\.v|vmv(\d)r\.v)$/);
  if (m) {
    const n = Number(m[1] || m[2] || m[3]);
    for (const r of ['vd', 'vs2', 'vs3']) {
      if (vars[r] && (vars[r].value % n)) return true;
    }
  }
  return false;
};

// name modifications: aq / rl, vector segment (nf)
const suffixes = (cand, inst, name) => {
  const args = cand.op.args || [];
  const aq = (inst >>> 26) & 1;
  const rl = (inst >>> 25) & 1;
  if (args.includes('aq') && args.includes('rl')) {
    name += (aq && rl) ? '.aqrl' : aq ? '.aq' : rl ? '.rl' : '';
  } else if (args.includes('rl') && rl) {
    name = name.replace(/\.aq$/, '.aqrl'); // Zalasr lb.aq + rl
  } else if (args.includes('aq') && aq) {
    name = name.replace(/\.rl$/, '.aqrl'); // Zalasr sb.rl + aq
  }
  if (args.includes('nf')) {
    const nf = (inst >>> 29) & 7;
    if (nf) name = name.replace(/^(v[ls](?:s|ux|ox)?)(e)/, '$1seg' + (nf + 1) + '$2');
  }
  return name;
};

const insn = (inst, len) => ({name: '.insn', len, raw: inst, ops: [{
  kind: 'imm',
  text: '0x' + (inst >>> 0).toString(16).padStart(Math.min(len || 4, 4) * 2, '0')
}]});

// xlen: opts.xlen, else from the ISA string ('rv32...'), else 64
const getXlen = (opts) => {
  if (opts.xlen) return opts.xlen;
  const m = (typeof opts.isa === 'string') && opts.isa.match(/^rv(32|64|128)/i);
  return m ? Number(m[1]) : 64;
};

const decode = (inst, opts = {}) => {
  const xlen = getXlen(opts);
  inst = Number(inst) >>> 0;
  const len = instLength(inst);
  if (len === 2) inst = inst & 0xffff;
  const table = getTable(xlen, opts.isa);
  const bucket = table[len] && table[len].get((inst & bucketMask(len)) >>> 0);
  if (bucket) {
    for (const c of bucket) {
      if (((inst & c.mask) >>> 0) !== c.valu) continue;
      const res = operands(c, inst, xlen);
      if (res === null) continue; // reserved value, try less specific
      return {name: res.name, ext: c.ext, len, raw: inst, ops: res.ops, op: c.op, syntax: c.syntax};
    }
  }
  return insn(inst, len);
};

module.exports = decode;
Object.assign(module.exports, {instLength, parseLocation, varValue, vtype, fliTable});
