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
//
// createDecode({extensions, syntax, csrNames, isa}) -> decoder bound to an
// opcode set (vendor packs: lib/context.js); module export bound to the
// built-in data. Operand rules: lib/operands.js (shared with lib/dasm-cpp.js).

const builtinExtensions = require('./extensions.json');
const builtinSyntax = require('./syntax.json');
const builtinCsrNames = require('./csr-names.json');
const isaLib = require('./isa.js');
const operands = require('./operands.js');

const {
  varValue, checksNot, notList, parseTemplate, literal, formatter,
  rmReserved, legacyRm, reservedXlen, wholeRegGroup, wholeRegVars, suffixes,
  rlistName, stackBase
} = operands;

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

// vector load / store encodings with EEW=64 (data or index): reserved
// without ELEN=64 (V spec: norm:vector_ls_ins_rsv, norm:vector_ls_eew_rsv)
const eew64 = /^(v[ls]s?e64(ff)?\.v|vl\dre64\.v|v[ls][ou]xei64\.v)$/;

// candidates -> {2: Map, 4: Map}: bucket key (major opcode bits, see
// bucketMask) -> candidates that can match, in candidate order
const buckets = (cands) => {
  const res = {2: new Map(), 4: new Map()};
  for (const c of cands) {
    const bm = bucketMask(c.len);
    const fixed = c.mask & bm;
    const free = bm & ~fixed;
    const map = res[c.len];
    if (!map) continue;
    for (const s of submasks(free)) {
      const k = ((c.valu & fixed) | s) >>> 0;
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(c);
    }
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

const fmtVar = (tok, x, ctx) => formatter(tok, ctx, x.v).js(tok, x, ctx);

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
      f = fmtVar(t.name, x, ctx);
      if (f.kind === 'rm') {
        if (rmReserved.includes(x.value)) return RESERVED;
        if (x.value === 0 && legacyRm.test(ctx.name)) return SKIP;
      }
    }
    if (t.base === undefined) return {...f, name: t.name, value: x && x.value};
    text = f.text;
  }
  // memory operand: imm(base) / (base)
  const b = ctx.vars[t.base];
  const bt = b ? fmtVar(t.base, b, ctx).text : literal(t.base).text;
  return {kind: 'mem', name: t.name + '(' + t.base + ')', text: text + '(' + bt + ')'};
};

// reserved encodings (spec), not expressible as single variable values
const reserved = (cand, inst, xlen, vars) => {
  if (reservedXlen(cand.name, xlen)) return true;
  const n = wholeRegGroup(cand.name);
  if (n) {
    for (const r of wholeRegVars) {
      if (vars[r] && (vars[r].value % n)) return true;
    }
  }
  return false;
};

const nameOf = (cand, inst) => suffixes(cand.op.args || [], cand.name,
  (inst >>> 26) & 1, (inst >>> 25) & 1, (inst >>> 29) & 7);

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

const createDecode = ({
  extensions = builtinExtensions,
  syntax = builtinSyntax,
  csrNames = builtinCsrNames,
  isa = isaLib.createIsa({extensions})
} = {}) => {
  const byFile = Object.fromEntries(extensions.map(e => [e.name, e]));

  const csrName = (x, xlen) => csrNames.all[x] || ((xlen === 32) && csrNames.rv32[x]) || String(x);

  // decoder candidates for xlen + isa, in match order:
  //   enabled riscv-opcodes files (isaFiles), imports resolved, assembler
  //   aliases, other-xlen and unmet `requires` opcodes skipped, vector
  //   load / store with unsupported EEW skipped (ELEN 32, Zve32*), duplicates
  //   (name + encoding) removed; more specific encodings (mask popcount)
  //   first, then file order
  //   -> [{name, ext, key, op, syntax, mask, valu, len, pop, fileIdx}]
  const candidates = (xlen, isaOpt) => {
    const files = isa.isaFiles(isaOpt, xlen);
    const exts = isa.isaSet(isaOpt, xlen);
    const maxEew = exts ? isaLib.elen(exts) : 64;
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
        if (maxEew < 64 && eew64.test(src.name)) continue;
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
    return cands;
  };

  // candidate tables per xlen + isa
  const tables = new Map();
  const getTable = (xlen, isaOpt) => {
    const key = xlen + ':' + (Array.isArray(isaOpt) ? isaOpt.join('_') : String(isaOpt));
    let t = tables.get(key);
    if (t === undefined) {
      t = buckets(candidates(xlen, isaOpt));
      tables.set(key, t);
    }
    return t;
  };

  // candidate + instruction -> {name, ops} or null (reserved encoding)
  const operandsOf = (cand, inst, xlen) => {
    const syn = cand.syntax;
    if (!syn) return {name: cand.name, ops: []};
    const vars = {};
    for (const v of syn.vars || []) {
      const value = varValue(inst, v);
      if (v.xlen !== undefined && v.xlen !== xlen) continue;
      if (checksNot(v) && notList(v).includes(value)) return null;
      vars[v.name] = {v, value};
    }
    const ctx = {xlen, vars, name: cand.name, fli: /^fli\./.test(cand.name), csrName};
    const ops = [];
    for (const t of parseTemplate(syn.asm)) {
      const o = operand(t, ctx);
      if (o === RESERVED) return null;
      if (o !== SKIP) ops.push(o);
    }
    if (reserved(cand, inst, xlen, vars)) return null;
    return {name: nameOf(cand, inst), ops};
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
        const res = operandsOf(c, inst, xlen);
        if (res === null) continue; // reserved value, try less specific
        return {name: res.name, ext: c.ext, len, raw: inst, ops: res.ops, op: c.op, syntax: c.syntax};
      }
    }
    return insn(inst, len);
  };

  Object.assign(decode, {candidates, csrName});
  return decode;
};

const decode = createDecode();

module.exports = decode;
Object.assign(module.exports, {
  instLength, buckets, bucketMask, createDecode,
  candidates: decode.candidates,
  parseLocation: operands.parseLocation,
  varValue: operands.varValue,
  vtype: operands.vtype,
  fliTable: operands.fliTable
});
