'use strict';

const { throwingReport } = require('./report.js');

// Apply local fixes (lib/patches.js) to parsed riscv-opcodes data.
//
// patch:
//   id        unique name
//   class     'U' upstream data bug (needs `upstream` issue / PR link)
//             'N' upstream naming convention (permanent local rename)
//   upstream  issue / PR URL or null
//   reason    free text
//   file      extension file name, RegExp, or omitted (all files)
//   match     {name, kind, args, mask, valu}; name may be a RegExp,
//             args compared as a list; omitted keys match anything
//   set       object merged into the opcode, or function (op) -> object
//   rename    [RegExp, replacement] applied to op.name (and op.ref name)
//   remove    true: delete matching opcodes
//   add       opcode or list of opcodes appended to `file` (string);
//             no `match`; stale if an opcode with that name exists
//
// Stale detection: a patch that matches nothing, or matches but changes
// nothing, is reported (fixed upstream? -> remove the patch).

const test = (pattern, value) => (pattern instanceof RegExp)
  ? pattern.test(value)
  : pattern === value;

const sameList = (a, b) => Array.isArray(a) && Array.isArray(b)
  && a.length === b.length && a.every((e, i) => e === b[i]);

const matchOp = (match = {}, op) => Object.entries(match).every(([k, v]) =>
  (k === 'args') ? sameList(v, op.args) : test(v, op[k]));

const snapshot = (op) => JSON.stringify(op);

const applyOne = (patch, op) => {
  const before = snapshot(op);
  if (patch.set) {
    const delta = (typeof patch.set === 'function') ? patch.set(op) : patch.set;
    Object.assign(op, delta);
  }
  if (patch.rename) {
    op.name = op.name.replace(patch.rename[0], patch.rename[1]);
    if (op.ref) op.ref = [op.ref[0], op.ref[1].replace(patch.rename[0], patch.rename[1])];
  }
  return before !== snapshot(op);
};

const checkPatch = (patch, ids, report) => {
  const loc = {file: 'lib/patches.js', inst: patch.id};
  if (!patch.id) {
    report.error('patch without id', loc);
    return false;
  }
  if (ids.has(patch.id)) {
    report.error('duplicate patch id', loc);
    return false;
  }
  ids.add(patch.id);
  if (patch.class !== 'U' && patch.class !== 'N') {
    report.error('patch class must be \'U\' or \'N\'', loc);
    return false;
  }
  if (!patch.set && !patch.rename && !patch.remove && !patch.add) {
    report.error('patch has neither set, rename, remove nor add', loc);
    return false;
  }
  if (patch.add && (typeof patch.file !== 'string' || patch.match)) {
    report.error('add patch needs `file` name and no `match`', loc);
    return false;
  }
  if (patch.class === 'U' && !patch.upstream) {
    report.warn('upstream bug patch without upstream issue / PR link', loc);
  }
  return true;
};

const addOps = (patch, extos, report, loc) => {
  const exto = extos.find(e => e.name === patch.file);
  if (!exto) {
    report.warn('patch is stale: file not found, remove it', loc);
    return 0;
  }
  let count = 0;
  for (const op of [].concat(patch.add)) {
    if (exto.opcodes.some(o => o.name === op.name && o.kind !== 'import')) {
      report.warn('patch is stale: ' + op.name + ' exists (fixed upstream?), remove it', loc);
      continue;
    }
    exto.opcodes.push({kind: 'leaf', ...op});
    count++;
  }
  return count;
};

// extos: parsed extension files [{name, opcodes}], modified in place
// returns [{id, class, count}] for applied patches
const applyPatches = (extos, patches, report = throwingReport) => {
  const ids = new Set();
  const applied = [];
  for (const patch of patches) {
    if (!checkPatch(patch, ids, report)) continue;
    const loc = {file: 'lib/patches.js', inst: patch.id};
    if (patch.add) {
      const count = addOps(patch, extos, report, loc);
      if (count) applied.push({id: patch.id, class: patch.class, count});
      continue;
    }
    let matched = 0;
    let changed = 0;
    for (const exto of extos) {
      if (patch.file !== undefined && !test(patch.file, exto.name)) continue;
      exto.opcodes = exto.opcodes.filter(op => {
        if (op.kind === 'import' || !matchOp(patch.match, op)) return true;
        matched++;
        if (patch.remove) {
          changed++;
          return false;
        }
        if (applyOne(patch, op)) changed++;
        return true;
      });
    }
    if (matched === 0) {
      report.warn('patch is stale: target not found (fixed upstream?), remove it', loc);
    } else if (changed === 0) {
      report.warn('patch is stale: no change (fixed upstream?), remove it', loc);
    } else {
      applied.push({id: patch.id, class: patch.class, count: changed});
    }
  }
  return applied;
};

// CSR table fixes (patches.csrs): csrs {all: {num: name}, rv32: {...}}, in place
const applyCsrPatches = (csrs, patches = [], report = throwingReport) => {
  const applied = [];
  for (const patch of patches) {
    const loc = {file: 'lib/patches.js', inst: patch.id};
    if (patch.class === 'U' && !patch.upstream) {
      report.warn('upstream bug patch without upstream issue / PR link', loc);
    }
    let count = 0;
    for (const num of patch.move) {
      const name = csrs[patch.from][num];
      if (name === undefined) continue;
      delete csrs[patch.from][num];
      csrs[patch.to][num] = name;
      count++;
    }
    if (count === 0) {
      report.warn('patch is stale: no CSR moved (fixed upstream?), remove it', loc);
    } else {
      applied.push({id: patch.id, class: patch.class, count});
    }
  }
  return applied;
};

module.exports = applyPatches;
module.exports.applyCsrPatches = applyCsrPatches;
