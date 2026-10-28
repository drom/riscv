'use strict';

// Join riscv-opcodes instructions with riscv-unified-db (UDB) definitions,
// cross-check both, produce lib/syntax.json entries.
//
// Join is by encoding (mask / valu), names only break ties:
//   exact        same encoding, same name
//   renamed      same encoding, different name ('.rv32' variants, ...)
//   subset       same name, one encoding is a specialization of the other
//   specialized  no name match, opcode is a specialization of a UDB encoding
//   encoding     same name, unrelated encoding  -> warning (upstream bug?)
//   missing      no UDB definition
//
// UDB encodings not joined, but specializations of a joined opcode (UDB lists
// 'amoadd.w.aq', 'vlseg2e8.v', ... separately) are attached as `variants`.
//
// syntax entry, keyed '<file>::<name>' (riscv-opcodes notation):
//   {udb: 'C/c.addi16sp', asm: 'sp, imm', vars: [UDB variables], via?: join kind,
//    variants?: [{udb, name, mask, valu}]}

const fieldo = require('./fieldo.js');
const { throwingReport } = require('./report.js');

const xlens = (file) => {
  if (/^rv32_/.test(file)) return [32];
  if (/^rv64_/.test(file)) return [64];
  if (/^rv128_/.test(file)) return [128];
  return [32, 64];
};

const normName = (name) => name.toLowerCase().replace(/[._]rv(32|64|128)$/, '');

// a is a specialization of b (a fixes all bits b fixes, with same values)
const isSpec = (a, b) => (((a.mask & b.mask) >>> 0) === b.mask) && (((a.valu & b.mask) >>> 0) === b.valu);

const popcount = (x) => {
  let n = 0;
  for (let v = x >>> 0; v; v >>>= 1) n += v & 1;
  return n;
};

// '12|4-3|5|2|6' -> [12, 4, 3, 5, 2, 6] (instruction bits, value msb first)
const parseLocation = (loc) => String(loc).split('|').flatMap(part => {
  const [hi, lo = hi] = part.split('-').map(Number);
  const res = [];
  for (let i = hi; i >= lo; i--) res.push(i);
  return res;
});

// pairs instBit -> valueBit as Map
const udbBitMap = (v) => {
  const bits = parseLocation(v.location);
  const shl = v.left_shift || 0;
  return new Map(bits.map((b, k) => [b, bits.length - 1 - k + shl]));
};

const oursBitMap = (args) => {
  const res = new Map();
  for (const a of args) {
    const f = fieldo[a];
    if (!f || !f.bits) continue;
    const len = f.msb - f.lsb + 1;
    for (let i = 0; i < len; i++) res.set(f.lsb + i, f.bits[len - 1 - i]);
  }
  return res;
};

// Map instBit -> valueBit to UDB style 'location<<shift'
const fmtBitMap = (m) => {
  const pairs = [...m].sort((a, b) => b[1] - a[1]);
  if (pairs.length === 0) return '';
  const shift = pairs[pairs.length - 1][1];
  const parts = [];
  let hi = pairs[0][0];
  let lo = hi;
  for (let k = 1; k <= pairs.length; k++) {
    const p = pairs[k];
    if (p && p[0] === lo - 1 && p[1] === pairs[k - 1][1] - 1) {
      lo = p[0];
      continue;
    }
    parts.push(hi === lo ? String(hi) : hi + '-' + lo);
    if (p) {
      hi = p[0];
      lo = hi;
    }
  }
  // value bits not contiguous (e.g. two immediates merged) -> ' (gaps)'
  const contiguous = pairs.every((p, k) => k === 0 || p[1] === pairs[k - 1][1] - 1);
  return parts.join('|') + (shift ? '<<' + shift : '') + (contiguous ? '' : ' (gaps)');
};

// immediate layout and sign extension: our fieldo vs UDB variables
const checkImm = (op, enc, loc, report) => {
  const ours = oursBitMap(op.args);
  if (ours.size === 0) return;
  const udb = new Map();
  let udbSext = false;
  for (const v of enc.variables) {
    const m = udbBitMap(v);
    if (![...m.keys()].some(b => ours.has(b))) continue;
    m.forEach((val, b) => udb.set(b, val));
    if (v.sign_extend) udbSext = true;
  }
  if (udb.size === 0) return; // UDB has no variable there (fixed bits?)
  const a = fmtBitMap(ours);
  const b = fmtBitMap(udb);
  if (a !== b) {
    report.warn('immediate layout differs, lib/fieldo.js: ' + a + ', UDB: ' + b, loc);
  }
  const oursSext = op.args.some(x => fieldo[x] && fieldo[x].bits && fieldo[x].kind === 'sext');
  if (oursSext !== udbSext) {
    report.warn('sign extension differs, lib/fieldo.js: ' + oursSext + ', UDB: ' + udbSext, loc);
  }
};

const udbId = (inst) => inst.file.replace(/\.yaml$/, '');

const entry = (inst, enc, via) => {
  const res = {udb: udbId(inst), asm: inst.assembly, vars: enc.variables};
  if (via !== 'exact') res.via = via;
  return res;
};

const findBest = (op, cands) => {
  const name = normName(op.name);
  const exact = cands.filter(c => c.enc.mask === op.mask && c.enc.valu === op.valu);
  if (exact.length) {
    const same = exact.find(c => normName(c.inst.name) === name);
    return same ? {...same, via: 'exact'} : {...exact[0], via: 'renamed'};
  }
  const byName = cands.filter(c => normName(c.inst.name) === name);
  const sub = byName.find(c => isSpec(op, c.enc) || isSpec(c.enc, op));
  if (sub) return {...sub, via: 'subset'};
  const spec = cands
    .filter(c => isSpec(op, c.enc))
    .sort((a, b) => popcount(b.enc.mask) - popcount(a.enc.mask));
  if (spec.length) return {...spec[0], via: 'specialized'};
  if (byName.length) return {...byName[0], via: 'encoding'};
  return {via: 'missing'};
};

// extos: riscv-opcodes data (after patches / imports), udb: lib/get-udb.js result
// returns {syntax, counts}
const udbJoin = (extos, udb, report = throwingReport) => {
  const encs = udb.flatMap(inst => inst.encodings.map(enc => ({inst, enc})));
  const used = new Set();
  const syntax = {};
  const counts = {};
  const joined = [];
  for (const exto of extos) {
    const xs = xlens(exto.name);
    const cands = encs.filter(c => c.enc.xlen === null || xs.includes(c.enc.xlen));
    for (const op of exto.opcodes) {
      if (op.kind === 'import') continue;
      const key = exto.name + '::' + op.name;
      const loc = {file: exto.name, inst: op.name};
      const best = findBest(op, cands);
      counts[best.via] = (counts[best.via] || 0) + 1;
      if (best.via === 'missing') continue;
      used.add(best.enc);
      const id = udbId(best.inst);
      if (best.via === 'encoding') {
        report.warn('encoding differs from UDB ' + id + ': riscv-opcodes ' + fmtEnc(op)
          + ', UDB ' + best.enc.match, loc);
      } else {
        if (best.via !== 'exact') {
          report.info('joined with UDB (' + best.via + ')', {...loc, inst: op.name + ' -> ' + id});
        }
        checkImm(op, best.enc, loc, report);
      }
      syntax[key] = entry(best.inst, best.enc, best.via);
      joined.push({key, op, xs});
    }
  }
  counts['udb-variant'] = 0;
  counts['udb-only'] = 0;
  for (const c of encs) {
    if (used.has(c.enc)) continue;
    const parent = joined.find(j => (c.enc.xlen === null || j.xs.includes(c.enc.xlen)) && isSpec(c.enc, j.op));
    if (parent) {
      const e = syntax[parent.key];
      e.variants = e.variants || [];
      e.variants.push({udb: udbId(c.inst), name: c.inst.name, mask: c.enc.mask, valu: c.enc.valu});
      counts['udb-variant']++;
      continue;
    }
    counts['udb-only']++;
    report.info('UDB instruction not in riscv-opcodes', {file: 'udb:' + c.inst.file, inst: c.inst.name});
  }
  return {syntax, counts};
};

const opKeys = (extos) => extos.flatMap(exto => exto.opcodes
  .filter(op => op.kind !== 'import')
  .map(op => ({key: exto.name + '::' + op.name, file: exto.name, name: op.name, op})));

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const test = (pattern, value) => (pattern === undefined) || ((pattern instanceof RegExp)
  ? pattern.test(value)
  : pattern === value);

// hand-written overrides (lib/syntax-overrides.js), merged into syntax in place
//   key: '<file>::<name>' or '<name>' (all files)
//   value: {reason, asm?, vars?, ...} -- fields replace UDB data; a field
//          given as function (old value, op) -> new value edits UDB data
//   overrides.rules: [{reason, file?, name?, gen: (op) -> {asm, vars}}]
//          syntax for opcodes UDB does not have (applied to missing only)
const applyOverrides = (extos, syntax, overrides, report = throwingReport) => {
  const ops = opKeys(extos);
  let count = 0;
  for (const [okey, ovr] of Object.entries(overrides)) {
    if (okey === 'rules') continue;
    const loc = {file: 'lib/syntax-overrides.js', inst: okey};
    const {reason, ...fields} = ovr;
    if (!reason) report.warn('override without reason', loc);
    const keys = new Set();
    const targets = ops.filter(o => (o.key === okey || (!okey.includes('::') && o.name === okey))
      && !keys.has(o.key) && keys.add(o.key));
    if (targets.length === 0) {
      report.warn('override is stale: no such opcode, remove it', loc);
      continue;
    }
    for (const t of targets) {
      const old = syntax[t.key] || {};
      const delta = Object.fromEntries(Object.entries(fields).map(([k, v]) =>
        [k, (typeof v === 'function') ? v(old[k], t.op) : v]));
      if (Object.entries(delta).every(([k, v]) => same(old[k], v))) {
        report.warn('override is redundant: same as UDB, remove it', {...loc, inst: t.key});
        continue;
      }
      syntax[t.key] = {...old, ...delta, override: true};
      count++;
    }
  }
  for (const rule of overrides.rules || []) {
    const loc = {file: 'lib/syntax-overrides.js', inst: 'rule: ' + rule.reason};
    let n = 0;
    for (const t of ops) {
      if (syntax[t.key] || !test(rule.file, t.file) || !test(rule.name, t.name)) continue;
      syntax[t.key] = {...rule.gen(t.op), override: 'rule'};
      n++;
    }
    if (n === 0) report.warn('override rule is stale: matches nothing, remove it', loc);
    count += n;
  }
  return count;
};

// opcodes without syntax, one warning per file
const checkMissing = (extos, syntax, report = throwingReport) => {
  const byFile = {};
  for (const o of opKeys(extos)) {
    if (!syntax[o.key]) (byFile[o.file] = byFile[o.file] || []).push(o.name);
  }
  let count = 0;
  for (const [file, names] of Object.entries(byFile)) {
    count += names.length;
    const shown = names.slice(0, 6).join(' ') + ((names.length > 6) ? ' ...' : '');
    report.warn(names.length + ' opcode(s) without syntax (not in UDB, no override): ' + shown, {file});
  }
  return count;
};

const fmtEnc = (op) => {
  const len = ((op.valu & 3) === 3) ? 32 : 16;
  let s = '';
  for (let i = len - 1; i >= 0; i--) {
    s += ((op.mask >>> i) & 1) ? String((op.valu >>> i) & 1) : '-';
  }
  return s;
};

module.exports = udbJoin;
Object.assign(module.exports, {applyOverrides, checkMissing, parseLocation, fmtBitMap, udbBitMap, oursBitMap, normName, isSpec, fmtEnc});
