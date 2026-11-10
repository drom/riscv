'use strict';

// C++ RISC-V disassembler generator, same output as dasm(inst, {xlen, isa})
// (LLVM `llvm-mc -M no-aliases` style). XLEN and ISA are resolved at
// generation time; candidates (decode.candidates), operand rules
// (lib/operands.js `cpp` forms), reserved encodings and names are shared
// with the JS decoder.
//
//   dasmCpp({xlen, isa, style = 'members', namespace = 'riscv_dasm'}) -> {lines, count}
//
//   style 'members': member functions + tables for embedding into a class /
//                    struct (e.g. SystemC tracer); needs <cstdint>, <iostream>,
//                    <iomanip> included before the class
//   style 'header':  complete header: include guard, includes,
//                    namespace <namespace> { struct dasm_t {...};
//                    inline void dasm(std::ostream &, uint32_t); }
//
// Generated API (C++11):
//
//   void dasm (std::ostream &os, uint32_t inst);
//   void dasm (uint32_t inst); // -> std::cout

const builtinCsrNames = require('./csr-names.json');
const fieldEnums = require('./field-enums.js');
const decodeLib = require('./decode.js');
const isaLib = require('./isa.js');
const operands = require('./operands.js');

const { buckets, bucketMask } = decodeLib;
const {
  varCpp, checksNot, parseTemplate, literal, formatter,
  rmReserved, legacyRm, reservedXlen, wholeRegGroup, wholeRegVars, suffixes,
  fliTable, twiden
} = operands;

const hex = (x) => '0x' + (x >>> 0).toString(16);

const cstr = (s) => JSON.stringify(String(s));

// value list -> C++ condition on `name`
const inList = (name, list) => {
  const vals = [...new Set(list)].sort((a, b) => a - b);
  const ranges = [];
  for (const x of vals) {
    const last = ranges[ranges.length - 1];
    if (last && last[1] === x - 1) {
      last[1] = x;
    } else {
      ranges.push([x, x]);
    }
  }
  // all odd / all even values of [0, max]
  if (ranges.length > 3) {
    const max = vals[vals.length - 1];
    for (const parity of [0, 1]) {
      const all = [];
      for (let i = parity; i <= max; i += 2) all.push(i);
      if (all.length === vals.length && all.every((e, i) => e === vals[i])) {
        return '((' + name + ' & 1) == ' + parity + ' && ' + name + ' >= 0 && ' + name + ' <= ' + max + ')';
      }
    }
  }
  return '(' + ranges.map(([lo, hi]) => (lo === hi)
    ? '(' + name + ' == ' + lo + ')'
    : '(' + name + ' >= ' + lo + ' && ' + name + ' <= ' + hi + ')'
  ).join(' || ') + ')';
};

const fmtVar = (tok, x, ctx) => formatter(tok, ctx, x.v).cpp(tok, x, ctx);

// C++ lines printing the mnemonic (aq / rl / nf variants: lookup table)
const nameLines = (cand) => {
  const args = cand.op.args || [];
  if (cand.syntax && (args.includes('aq') || args.includes('rl') || args.includes('nf'))) {
    const names = [];
    for (let i = 0; i < 32; i++) {
      names.push(suffixes(args, cand.name, (i >> 4) & 1, (i >> 3) & 1, i & 7));
    }
    if (names.some(n => n !== names[0])) {
      // index: aq rl nf[2:0] = inst[26] inst[25] inst[31:29]
      return [
        '    static const char * const names[32] = {' + names.map(cstr).join(', ') + '};',
        '    os << names[(((inst >> 26) & 1) << 4) | (((inst >> 25) & 1) << 3) | ((inst >> 29) & 7)];'
      ];
    }
  }
  return ['    os << ' + cstr(cand.name) + ';'];
};

// syntax variables -> C++ declarations, `not` checks; ctx.vars filled
const varLines = (syn, xlen, vars) => {
  const body = [];
  (syn.vars || []).forEach((v, i) => {
    if (v.xlen !== undefined && v.xlen !== xlen) return;
    const id = 'v' + i + '_' + v.name.replace(/\W/g, '_');
    let expr = varCpp(v);
    if (v.map) {
      body.push('    const int64_t ' + id + '_raw = ' + expr + ';');
      expr = Object.keys(v.map).reduceRight(
        (acc, k) => '((' + id + '_raw == ' + k + ') ? ' + v.map[k] + ' : ' + acc + ')',
        id + '_raw'
      );
    }
    body.push('    const int64_t ' + id + ' = ' + expr + ';');
    if (checksNot(v)) {
      body.push('    if ' + inList(id, [].concat(v.not)) + ' return false;');
    }
    vars[v.name] = {v, id};
  });
  return body;
};

// template token -> {text, cond?} (C++ stream expression, print condition)
// or null (not printed); reserved checks pushed to `body`
const operandCpp = (t, ctx, body) => {
  const vars = ctx.vars;
  if (t.raw !== undefined) return {text: cstr(t.raw)};
  if (t.name === 'vm') {
    return vars.vm ? {text: '"v0.t"', cond: vars.vm.id + ' == 0'} : null;
  }
  if (t.name === '{reg_list}') return {text: 'rlist_name(' + vars.rlist.id + ')'};
  if (t.name === 'stack_adj') {
    const sp = vars.spimm;
    return {text: (t.neg ? '"-" << ' : '') + 'stack_adj(' + vars.rlist.id + ', ' + sp.id + ', ' + (sp.v.left_shift ? 1 : 16) + ')'};
  }
  let text = '';
  let cond;
  if (t.name !== '') {
    const x = vars[t.name];
    if (x === undefined) {
      text = cstr(literal(t.name).text);
    } else {
      if (x.v.omit !== undefined) cond = x.id + ' != ' + x.v.omit;
      text = fmtVar(t.name, x, ctx);
      if (formatter(t.name, ctx, x.v).rule === 'rm') {
        body.push('    if (' + rmReserved.map(r => x.id + ' == ' + r).join(' || ') + ') return false;');
        if (legacyRm.test(ctx.name)) cond = x.id + ' != 0';
      }
    }
  }
  if (t.base !== undefined) {
    const b = vars[t.base];
    const bt = b ? fmtVar(t.base, b, ctx) : cstr(literal(t.base).text);
    text = (text ? text + ' << ' : '') + '"(" << ' + bt + ' << ")"';
  }
  return {text, cond};
};

// candidate -> C++ member function lines; null when always reserved
const candFn = (cand, fname, xlen) => {
  const name = cand.name;
  const syn = cand.syntax;
  if (syn && reservedXlen(name, xlen)) return null;

  const vars = {};
  const body = syn ? varLines(syn, xlen, vars) : [];
  const ctx = {xlen, vars, name, fli: /^fli\./.test(name)};

  const ops = [];
  for (const t of parseTemplate(syn && syn.asm)) {
    const o = operandCpp(t, ctx, body);
    if (o) ops.push(o);
  }

  const n = syn ? wholeRegGroup(name) : 0;
  if (n) {
    for (const r of wholeRegVars) {
      if (vars[r]) body.push('    if (' + vars[r].id + ' % ' + n + ') return false;');
    }
  }

  body.push(...nameLines(cand));
  if (ops.length) {
    const dynamic = ops.some(o => o.cond);
    if (dynamic) body.push('    const char *sep = " ";');
    ops.forEach((o, i) => {
      if (dynamic) {
        const line = 'os << sep << ' + o.text + '; sep = ", ";';
        body.push(o.cond ? '    if (' + o.cond + ') { ' + line + ' }' : '    ' + line);
      } else {
        body.push('    os << ' + cstr(i ? ', ' : ' ') + ' << ' + o.text + ';');
      }
    });
  }
  body.push('    return true;');

  // drop unused variables (declared, never referenced)
  const decl = body.filter((line, i) => {
    const d = line.match(/^ {4}const int64_t (\w+) = /);
    if (!d) return true;
    const re = new RegExp('\\b' + d[1] + '\\b');
    return body.some((other, j) => j !== i && re.test(other));
  });

  const usesInst = decl.some(line => /\binst\b/.test(line));
  return [
    '  // ' + cand.ext + ' ' + name,
    '  bool ' + fname + ' (std::ostream &os, uint32_t ' + (usesInst ? 'inst' : '/* inst */') + ') {',
    ...decl,
    '  }'
  ];
};

// --- helpers -----------------------------------------------------------------

const csrSwitch = (csrNames, xlen) => {
  const names = Object.assign({}, (xlen === 32) ? csrNames.rv32 : {}, csrNames.all);
  return Object.keys(names).map(Number).sort((a, b) => a - b)
    .map(k => '    case ' + hex(k) + ': return os << ' + cstr(names[k]) + ';');
};

const helpers = (csrNames, xlen) => [
  '  // riscv dasm (riscv-unified-db syntax, llvm-mc -M no-aliases style)',
  '  const char * const a_xabi[32] = {' + fieldEnums.xabi.map(cstr).join(', ') + '};',
  '  const char * const a_fabi[32] = {' + fieldEnums.fabi.map(cstr).join(', ') + '};',
  '  const char * const a_rmlut[8] = {' + fieldEnums.rmlut.map(cstr).join(', ') + '};',
  '  const char * const a_fli[32] = {' + fliTable.map(cstr).join(', ') + '};',
  '  const unsigned a_twiden[4] = {' + twiden.join(', ') + '};',
  '',
  '  static int64_t sext (int64_t x, unsigned width) {',
  '    const int64_t m = (int64_t)1 << (width - 1);',
  '    return (x & m) ? (x - (m << 1)) : x;',
  '  }',
  '',
  '  struct csr_name_t { int64_t x; };',
  '  static csr_name_t csr_name (int64_t x) { return {x}; }',
  '  friend std::ostream &operator<< (std::ostream &os, csr_name_t c) {',
  '    switch (c.x) {',
  ...csrSwitch(csrNames, xlen),
  '    }',
  '    return os << c.x;',
  '  }',
  '',
  '  struct vtype_t { int64_t x; };',
  '  static vtype_t vtype (int64_t x) { return {x}; }',
  '  friend std::ostream &operator<< (std::ostream &os, vtype_t t) {',
  '    static const char * const lmuls[8] = {"m1", "m2", "m4", "m8", nullptr, "mf8", "mf4", "mf2"};',
  '    const int64_t x = t.x;',
  '    const char *lmul = lmuls[x & 7];',
  '    const int64_t vsew = (x >> 3) & 7;',
  '    const int64_t alt = x & 0x100;',
  '    if (lmul == nullptr || vsew > 3 || (x >> 9) != 0 || (alt && vsew > 1)) return os << x;',
  '    return os << "e" << (8 << vsew) << (alt ? "alt" : "") << ", " << lmul',
  '      << ", " << ((x & 0x40) ? "ta" : "tu") << ", " << ((x & 0x80) ? "ma" : "mu");',
  '  }',
  '',
  '  struct fence_set_t { int64_t x; };',
  '  static fence_set_t fence_set (int64_t x) { return {x}; }',
  '  friend std::ostream &operator<< (std::ostream &os, fence_set_t f) {',
  '    if (f.x == 0) return os << "0";',
  '    if (f.x & 8) os << "i";',
  '    if (f.x & 4) os << "o";',
  '    if (f.x & 2) os << "r";',
  '    if (f.x & 1) os << "w";',
  '    return os;',
  '  }',
  '',
  '  struct rlist_name_t { int64_t r; };',
  '  static rlist_name_t rlist_name (int64_t r) { return {r}; }',
  '  friend std::ostream &operator<< (std::ostream &os, rlist_name_t l) {',
  '    if (l.r == 4) return os << "{ra}";',
  '    if (l.r == 5) return os << "{ra, s0}";',
  '    if (l.r == 15) return os << "{ra, s0-s11}";',
  '    return os << "{ra, s0-s" << (l.r - 5) << "}";',
  '  }',
  '',
  '  static int64_t stack_adj (int64_t r, int64_t spimm, int64_t scale) {',
  '    const int64_t regs = (r == 15) ? 13 : r - 3;',
  '    const int64_t bytes = regs * ' + (xlen / 8) + ';',
  '    return ((bytes + 15) / 16) * 16 + spimm * scale;',
  '  }',
  ''
];

// --- dispatch ----------------------------------------------------------------

const dispatch = (cands, fnames, len) => {
  const bm = bucketMask(len);
  const index = new Map(cands.map((c, i) => [c, i]));
  const table = buckets(cands)[len];
  const res = ['      switch (inst & ' + hex(bm) + ') {'];
  [...table.keys()].sort((a, b) => a - b).forEach(k => {
    const ids = table.get(k).map(c => index.get(c)).filter(i => fnames[i] !== null);
    if (ids.length === 0) return;
    res.push('      case ' + hex(k) + ':');
    for (const i of ids) {
      const c = cands[i];
      res.push('        if ((inst & ' + hex(c.mask) + ') == ' + hex(c.valu) + ' && ' + fnames[i] + '(os, inst)) return; // ' + c.name);
    }
    res.push('        break;');
  });
  res.push('      }');
  return res;
};

const members = ({xlen, files, cands, csrNames, byFile}) => {
  const fnames = [];
  const fns = [];
  cands.forEach((c, i) => {
    const fname = 'd_' + i;
    const lines = candFn(c, fname, xlen);
    fnames.push(lines ? fname : null);
    if (lines) fns.push(...lines);
  });
  const lines = [
    ...files.map(f => '  // ' + f + ' : ' + byFile[f].opcodes.length),
    ...helpers(csrNames, xlen),
    ...fns,
    '',
    '  void dasm (std::ostream &os, uint32_t inst) {',
    '    const std::ios_base::fmtflags flags = os.flags();',
    '    const char fill = os.fill();',
    '    os << std::dec;',
    '    [&] {',
    '      if ((inst & 3) != 3) { // 16-bit',
    '        inst &= 0xffff;',
    ...dispatch(cands, fnames, 2),
    '        os << ".insn 0x" << std::hex << std::setw(4) << std::setfill(\'0\') << inst;',
    '        return;',
    '      }',
    '      if ((inst & 0x1c) != 0x1c) { // 32-bit',
    ...dispatch(cands, fnames, 4),
    '      }',
    '      os << ".insn 0x" << std::hex << std::setw(8) << std::setfill(\'0\') << inst;',
    '    }();',
    '    os.flags(flags);',
    '    os.fill(fill);',
    '  }',
    '',
    '  void dasm (uint32_t inst) { dasm(std::cout, inst); }'
  ];
  return {lines, count: fnames.filter(Boolean).length};
};

const header = (res, {xlen, isa, namespace}) => {
  const guard = namespace.toUpperCase() + '_H';
  const isaText = Array.isArray(isa) ? isa.join('_') : String(isa);
  return {count: res.count, lines: [
    '// generated by riscv dasmCpp: RV' + xlen + ' ' + isaText,
    '#ifndef ' + guard,
    '#define ' + guard,
    '',
    '#include <cstdint>',
    '#include <iostream>',
    '#include <iomanip>',
    '',
    'namespace ' + namespace + ' {',
    '',
    'struct dasm_t {',
    ...res.lines,
    '};',
    '',
    'inline void dasm (std::ostream &os, uint32_t inst) { static dasm_t d; d.dasm(os, inst); }',
    'inline void dasm (uint32_t inst) { dasm(std::cout, inst); }',
    '',
    '} // namespace ' + namespace,
    '',
    '#endif // ' + guard
  ]};
};

// generator for a decoder / ISA model (lib/context.js)
const createDasmCpp = ({
  decode = decodeLib,
  isa = isaLib,
  csrNames = builtinCsrNames,
  extensions = require('./extensions.json')
} = {}) => {
  const byFile = Object.fromEntries(extensions.map(e => [e.name, e]));
  return ({xlen = 64, isa: isaOpt, style = 'members', namespace = 'riscv_dasm'} = {}) => {
    if (style !== 'members' && style !== 'header') throw new Error('dasmCpp: unknown style ' + style);
    if (!/^[A-Za-z_]\w*$/.test(namespace)) throw new Error('dasmCpp: invalid namespace ' + namespace);
    const res = members({
      xlen,
      files: isa.isaFiles(isaOpt, xlen),
      cands: decode.candidates(xlen, isaOpt),
      csrNames,
      byFile
    });
    return (style === 'header') ? header(res, {xlen, isa: isaOpt, namespace}) : res;
  };
};

module.exports = createDasmCpp();
module.exports.createDasmCpp = createDasmCpp;
