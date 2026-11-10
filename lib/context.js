'use strict';

// Data contexts: the built-in opcode set, or extended by vendor packs.
//
//   const ctx = riscv.extend({
//     exto:       {xfoo: {desc, url, ver}},               // ISA explain / renderAnsi
//     extensions: [{name: 'rv_xfoo', ratified: false, opcodes: [...]}],  // extensions.json format
//     syntax:     {'rv_xfoo::foo.add': {asm, vars}},      // syntax.json format
//     implies:    {xfoo: ['zicsr']},
//     csrNames:   {all: {0x7c0: 'foocfg'}, rv32: {}},
//     fieldo:     {...}                                    // optional fields
//   }, {override: false, report});
//
//   ctx.dasm / decode / candidates / isaSet / isaFiles / dasmCpp / renderAnsi /
//   getCount / extend (chain) + merged data (extensions, syntax, exto, ...)
//
// A context never modifies its parent (or the built-in data).
//
// Validation (errors throw, unless `report` is given: then collected):
//   * file names `rv_<ext>`, `rv32_<ext>`, `rv64_<ext>`; new or `override`
//   * opcodes: kind leaf / pseudo / import, `valu & ~mask == 0`, imports
//     resolve
//   * encodings overlapping existing opcodes: error unless `override`
//   * syntax keys `<file>::<name>` of known opcodes; variables + fixed bits
//     cover the instruction (warning)
//   * opcodes without syntax (warning: printed without operands)

const isaLib = require('./isa.js');
const decodeLib = require('./decode.js');
const { createDasm } = require('./dasm.js');
const { createDasmCpp } = require('./dasm-cpp.js');
const { createGetCount } = require('./get-count.js');
const renderAnsi = require('./render-ansi.js');
const { parseLocation } = require('./operands.js');
const { createReport } = require('./report.js');

const lenMask = (valu) => (decodeLib.instLength(valu) === 2) ? 0xffff : 0xffffffff;

const overlaps = (a, b) => ((((a.valu ^ b.valu) & a.mask & b.mask) >>> 0) === 0)
  && decodeLib.instLength(a.valu) === decodeLib.instLength(b.valu);

const checkFiles = (baseFiles, pack, override, report) => {
  const newFiles = new Map();
  for (const ext of pack.extensions || []) {
    const loc = {file: ext.name};
    if (!/^rv(32|64)?_[a-z0-9_]+$/.test(ext.name || '')) {
      report.error('invalid extension file name (rv_<ext>, rv32_<ext>, rv64_<ext>)', loc);
      continue;
    }
    if (newFiles.has(ext.name)) report.error('extension file defined twice', loc);
    if (baseFiles.has(ext.name) && !override) report.error('extension file exists (use override)', loc);
    if (!Array.isArray(ext.opcodes)) {
      report.error('extension without opcodes list', loc);
      continue;
    }
    newFiles.set(ext.name, ext);
  }
  return newFiles;
};

// encoding fields; false: not checked further
const checkEncoding = (op, loc, report) => {
  if (op.kind !== 'leaf' && op.kind !== 'pseudo') {
    report.error('opcode kind must be leaf, pseudo or import', loc);
    return false;
  }
  if (typeof op.name !== 'string' || !Number.isInteger(op.mask) || !Number.isInteger(op.valu)) {
    report.error('opcode needs name, mask, valu', loc);
    return false;
  }
  if (((op.valu & ~op.mask) >>> 0) !== 0) report.error('valu has bits outside mask', loc);
  if (!Array.isArray(op.args)) report.error('opcode needs args list', loc);
  return true;
};

const checkCoverage = (op, syn, loc, report) => {
  let covered = op.mask >>> 0;
  for (const v of syn.vars || []) {
    for (const b of parseLocation(v.location)) covered |= (1 << b);
  }
  const full = lenMask(op.valu);
  if (((covered & full) >>> 0) !== full) {
    report.warn('bits not covered by fixed bits or syntax variables: 0x'
      + ((full & ~covered) >>> 0).toString(16), loc);
  }
};

const checkOpcode = (file, op, env) => {
  const {fileOf, existing, syntax, override, report} = env;
  const loc = {file, inst: op.name || (op.ref || []).join('::')};
  if (op.kind === 'import') {
    const [rf, rn] = op.ref || [];
    const src = fileOf(rf);
    if (!src || !src.opcodes.some(o => o.name === rn && o.kind !== 'import')) {
      report.error('import does not resolve', loc);
    }
    return;
  }
  if (!checkEncoding(op, loc, report) || op.alias) return;
  if (!override) {
    const hit = existing.find(e => overlaps(op, e.op));
    if (hit) report.error('encoding overlaps ' + hit.file + '::' + hit.op.name + ' (use override)', loc);
  }
  const syn = syntax[file + '::' + op.name];
  if (syn === undefined) {
    if (op.args && op.args.length) report.warn('opcode without syntax (printed without operands)', loc);
    return;
  }
  checkCoverage(op, syn, loc, report);
};

const checkSyntaxKeys = (base, pack, fileOf, newFiles, override, report) => {
  for (const key of Object.keys(pack.syntax || {})) {
    const [file, name] = key.split('::');
    const ext = fileOf(file);
    if (!ext || !ext.opcodes.some(o => o.name === name)) {
      report.error('syntax for unknown opcode', {file, inst: name});
    }
    if (base.syntax[key] !== undefined && !override && !newFiles.has(file)) {
      report.error('syntax exists (use override)', {file, inst: name});
    }
  }
};

const checkPack = (base, pack, override, report) => {
  const baseFiles = new Map(base.extensions.map(e => [e.name, e]));
  const newFiles = checkFiles(baseFiles, pack, override, report);
  const fileOf = (name) => newFiles.get(name) || baseFiles.get(name);
  // existing opcodes (files not replaced), for the overlap check
  const existing = [];
  for (const [name, ext] of baseFiles) {
    if (newFiles.has(name)) continue;
    for (const op of ext.opcodes) {
      if (op.kind !== 'import' && !op.alias) existing.push({file: name, op});
    }
  }
  const env = {fileOf, existing, syntax: pack.syntax || {}, override, report};
  for (const [file, ext] of newFiles) {
    for (const op of ext.opcodes) checkOpcode(file, op, env);
  }
  checkSyntaxKeys(base, pack, fileOf, newFiles, override, report);
  return newFiles;
};

// exto entries: add id and kind (b, z, s, x) like lib/exto.js
const normExto = (exto = {}) => Object.fromEntries(Object.entries(exto).map(([id, e]) => [id, {
  ...e,
  id,
  kind: e.kind || ['z', 's', 'x'].find(k => k === id[0]) || 'b'
}]));

const createContext = (data) => {
  const isa = isaLib.createIsa({extensions: data.extensions, implies: data.implies});
  const decode = decodeLib.createDecode({
    extensions: data.extensions, syntax: data.syntax, csrNames: data.csrNames, isa
  });
  const dasm = createDasm(decode);
  const dasmCpp = createDasmCpp({decode, isa, csrNames: data.csrNames, extensions: data.extensions});
  const getCount = createGetCount(data.extensions);

  const ctx = {
    ...data,
    isaSet: isa.isaSet,
    isaFiles: isa.isaFiles,
    fileExts: isaLib.fileExts,
    parseIsaString: isaLib.parseIsaString,
    candidates: decode.candidates,
    decode,
    dasm,
    dasmCpp,
    getCount,
    renderAnsi: (state, exto = data.exto) => renderAnsi(state, exto, {getCount})
  };

  ctx.extend = (pack = {}, {override = false, report} = {}) => {
    const rep = report || createReport();
    const newFiles = checkPack(data, pack, override, rep);
    if (!report && rep.errors().length) {
      throw new Error('riscv extend:\n' + rep.format());
    }
    const extensions = data.extensions
      .filter(e => !newFiles.has(e.name))
      .concat([...newFiles.values()]);
    const merge2 = (a = {all: {}, rv32: {}}, b = {}) => ({
      all: {...a.all, ...(b.all || {})},
      rv32: {...a.rv32, ...(b.rv32 || {})}
    });
    const next = createContext({
      extensions,
      syntax: {...data.syntax, ...(pack.syntax || {})},
      csrNames: merge2(data.csrNames, pack.csrNames),
      exto: {...data.exto, ...normExto(pack.exto)},
      implies: {...data.implies, ...(pack.implies || {})},
      fieldo: {...data.fieldo, ...(pack.fieldo || {})}
    });
    next.report = rep;
    return next;
  };

  return ctx;
};

// context of the built-in data
const builtin = createContext({
  extensions: require('./extensions.json'),
  syntax: require('./syntax.json'),
  csrNames: require('./csr-names.json'),
  exto: require('./exto.js'),
  implies: isaLib.implies,
  fieldo: require('./fieldo.js')
});

module.exports = {createContext, builtin};
