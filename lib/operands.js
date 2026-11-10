'use strict';

// Operand rules shared by the JS decoder (lib/decode.js) and the C++
// generator (lib/dasm-cpp.js). Every rule has a `js` form (value -> text)
// and a `cpp` form (C++ expression of a variable -> stream expression), side
// by side, so the two disassemblers can not drift apart
// (test/dasm-cpp.js compares them).

const fieldEnums = require('./field-enums.js');

// --- UDB variables ------------------------------------------------------------

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

// '12|4-3' -> [[12, 12], [4, 3]]
const locationRanges = (loc) => String(loc).split('|').map(part => {
  const [hi, lo = hi] = part.split('-').map(Number);
  return [hi, lo];
});

// encoded width of a variable incl. left shift
const varWidth = (v) => parseLocation(v.location).length + (v.left_shift || 0);

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

const hex = (x) => '0x' + (x >>> 0).toString(16);

// UDB variable -> C++ int64_t expression of `inst` (without `map`)
const varCpp = (v) => {
  const parts = locationRanges(v.location);
  let pos = parts.reduce((w, [hi, lo]) => w + hi - lo + 1, 0);
  const terms = parts.map(([hi, lo]) => {
    const w = hi - lo + 1;
    pos -= w;
    const field = '((inst >> ' + lo + ') & ' + hex(2 ** w - 1) + ')';
    return pos ? '(' + field + ' << ' + pos + ')' : field;
  });
  let x = '(int64_t)(' + terms.join(' | ') + ')';
  if (v.left_shift) x = '(' + x + ' << ' + v.left_shift + ')';
  if (v.sign_extend) x = 'sext(' + x + ', ' + varWidth(v) + ')';
  if (v.add) x = '(' + x + ' + ' + v.add + ')';
  return x;
};

const notList = (v) => (v.not === undefined) ? [] : [].concat(v.not);

// `not` applies to every variable but aq / rl
const checksNot = (v) => v.name !== 'aq' && v.name !== 'rl' && v.not !== undefined;

// --- value tables ------------------------------------------------------------

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

const twiden = [0, 1, 2, 4];

// --- templates ---------------------------------------------------------------

// token of an asm template -> register class
const regClass = (name) => {
  if (/^x(d|s\d)$/.test(name)) return 'x';
  if (/^f(d|s\d)$/.test(name)) return 'f';
  if (/^v(d|s\d)$/.test(name)) return 'v';
  return null;
};

// template token without variable -> operand
const literal = (tok) => {
  const m = tok.match(/^x(\d+)$/);
  if (m) return {kind: 'xreg', text: fieldEnums.xabi[Number(m[1])]};
  return {kind: (tok === 'sp') ? 'xreg' : (tok === 'v0') ? 'vreg' : 'literal', text: tok};
};

// asm template -> list of tokens {raw} | {neg, name, base}
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

// --- variable formatters -------------------------------------------------------
//
// js:  (tok, x = {v, value}, ctx) -> {kind, text}
// cpp: (tok, x = {v, id},    ctx) -> C++ stream expression
//   ctx: {xlen, name, fli, vars, csrName (js)}
// first matching rule wins

// register number: compressed fields (3 bit) -> x8..x15, 2 bit vector
// register group (vfbdota vs2) -> multiple of 8
const regNumJs = (cls, v, value) => {
  const width = varWidth(v);
  if (cls !== 'v' && width === 3) return value + 8;
  if (cls === 'v' && width < 5 && !v.left_shift) return value << (5 - width);
  return value;
};

const regNumCpp = (cls, v, id) => {
  const width = varWidth(v);
  if (cls !== 'v' && width === 3) return '(' + id + ' + 8)';
  if (cls === 'v' && width < 5 && !v.left_shift) return '(' + id + ' << ' + (5 - width) + ')';
  return id;
};

const formatters = [{
  rule: 'fli', // Zfa fli.*: xs1 field is an FP constant index
  test: (tok, ctx) => ctx.fli && tok === 'xs1',
  js: (tok, x) => ({kind: 'fimm', text: fliTable[x.value]}),
  cpp: (tok, x) => 'a_fli[' + x.id + ']'
}, {
  rule: 'reg',
  test: (tok) => regClass(tok) !== null,
  js: (tok, x) => {
    const cls = regClass(tok);
    const n = regNumJs(cls, x.v, x.value);
    if (cls === 'x') return {kind: 'xreg', text: fieldEnums.xabi[n]};
    if (cls === 'f') return {kind: 'freg', text: fieldEnums.fabi[n]};
    return {kind: 'vreg', text: 'v' + n};
  },
  cpp: (tok, x) => {
    const cls = regClass(tok);
    const n = regNumCpp(cls, x.v, x.id);
    if (cls === 'x') return 'a_xabi[' + n + ']';
    if (cls === 'f') return 'a_fabi[' + n + ']';
    return '"v" << ' + n;
  }
}, {
  rule: 'csr',
  test: (tok) => tok === 'csr',
  js: (tok, x, ctx) => ({kind: 'csr', text: ctx.csrName(x.value, ctx.xlen)}),
  cpp: (tok, x) => 'csr_name(' + x.id + ')'
}, {
  rule: 'rm',
  test: (tok) => tok === 'rm',
  js: (tok, x) => ({kind: 'rm', text: fieldEnums.rmlut[x.value]}),
  cpp: (tok, x) => 'a_rmlut[' + x.id + ']'
}, {
  rule: 'vtypei',
  test: (tok) => tok === 'vtypei',
  js: (tok, x) => ({kind: 'vtype', text: vtype(x.value)}),
  cpp: (tok, x) => 'vtype(' + x.id + ')'
}, {
  rule: 'fence',
  test: (tok) => tok === 'pred' || tok === 'succ',
  js: (tok, x) => ({kind: 'fence', text: fenceSet(x.value)}),
  cpp: (tok, x) => 'fence_set(' + x.id + ')'
}, {
  rule: 'sreg', // Zcmp s-register (r1s / r2s): 0..7 -> s0..s7
  test: (tok) => tok === 'r1s' || tok === 'r2s',
  js: (tok, x) => ({kind: 'xreg', text: 's' + x.value}),
  cpp: (tok, x) => '"s" << ' + x.id
}, {
  rule: 'mtd', // matrix tile register (Zvt)
  test: (tok) => tok === 'mtd',
  js: (tok, x) => ({kind: 'treg', text: 'mt' + x.value}),
  cpp: (tok, x) => '"mt" << ' + x.id
}, {
  rule: 'vsew', // Zvt msetmtypei: e<sew>[alt]
  test: (tok) => tok === 'vsew',
  js: (tok, x, ctx) => ({kind: 'vtype', text: 'e' + (8 << x.value) + ((ctx.vars.altfmt || {}).value ? 'alt' : '')}),
  cpp: (tok, x, ctx) => '"e" << (8 << ' + x.id + ')' +
    (ctx.vars.altfmt ? ' << (' + ctx.vars.altfmt.id + ' ? "alt" : "")' : '')
}, {
  rule: 'twiden',
  test: (tok) => tok === 'twiden',
  js: (tok, x) => ({kind: 'vtype', text: 'w' + twiden[x.value]}),
  cpp: (tok, x) => '"w" << a_twiden[' + x.id + ']'
}, {
  rule: 'imm20', // lui / auipc / c.lui print the 20 bit field
  test: (tok, ctx, v) => (v.left_shift || 0) >= 12,
  js: (tok, x) => ({kind: 'imm', text: String(((x.value / 4096) >>> 0) & 0xfffff)}),
  cpp: (tok, x) => '((uint32_t)(' + x.id + ' >> 12) & 0xfffff)'
}, {
  rule: 'imm',
  test: () => true,
  js: (tok, x) => ({kind: 'imm', text: String(x.value)}),
  cpp: (tok, x) => x.id
}];

const formatter = (tok, ctx, v) => formatters.find(f => f.test(tok, ctx, v));

// --- rounding mode -----------------------------------------------------------

// rm values 5, 6 are reserved
const rmReserved = [5, 6];

// conversions without rounding (widening): LLVM omits rm when rne (0)
const legacyRm = /^fcvt\.(d\.(w|wu|s|h)|s\.(h|bf16)|q\.\w+)$/;

// --- reserved encodings ------------------------------------------------------

// RV32: indexed vector load / store with 64 bit indices (static, per opcode)
const reservedXlen = (name, xlen) => xlen === 32 && /^v[ls][ou]x(seg\d)?ei64\.v$/.test(name);

// whole register load / store / move: register group size, else 0
const wholeRegGroup = (name) => {
  const m = name.match(/^(?:vl(\d)re\d+\.v|vs(\d)r\.v|vmv(\d)r\.v)$/);
  return m ? Number(m[1] || m[2] || m[3]) : 0;
};
const wholeRegVars = ['vd', 'vs2', 'vs3'];

// --- names -------------------------------------------------------------------

// aq / rl and vector segment (nf) name modifications
//   args: opcode args, aq, rl: 0 / 1, nf: inst[31:29]
const suffixes = (args, name, aq, rl, nf) => {
  if (args.includes('aq') && args.includes('rl')) {
    name += (aq && rl) ? '.aqrl' : aq ? '.aq' : rl ? '.rl' : '';
  } else if (args.includes('rl') && rl) {
    name = name.replace(/\.aq$/, '.aqrl'); // Zalasr lb.aq + rl
  } else if (args.includes('aq') && aq) {
    name = name.replace(/\.rl$/, '.aqrl'); // Zalasr sb.rl + aq
  }
  if (args.includes('nf') && nf) {
    name = name.replace(/^(v[ls](?:s|ux|ox)?)(e)/, '$1seg' + (nf + 1) + '$2');
  }
  return name;
};

module.exports = {
  parseLocation, locationRanges, varWidth, varValue, varCpp, notList, checksNot,
  fliTable, vtype, fenceSet, rlistName, stackBase, twiden,
  regClass, literal, parseTemplate, formatters, formatter,
  rmReserved, legacyRm, reservedXlen, wholeRegGroup, wholeRegVars, suffixes
};
