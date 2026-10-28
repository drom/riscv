'use strict';

const getGetField = require('./get-get-field.js');
const { throwingReport } = require('./report.js');

// parse one riscv-opcodes extension file
//   namedFieldo -- optional object collecting field usage counts
//   report      -- diagnostics sink (default: throw on error)
//   lut         -- optional arg_lut.csv table, used for error hints
const op2obj = (namedFieldo, report = throwingReport, lut) => (txt, file) => {
  const getField = getGetField(namedFieldo, report, lut);
  return txt.split(/\n/).flatMap((row, idx) => {
    row = row.replace(/#.*/, '').trim();
    if (row === '') return [];
    const loc = {file, line: idx + 1};
    const els = row.split(/\s+/);
    const first = els.shift();
    if (first === '$pseudo_op') {
      const ref = (els.shift() || '').split('::');
      const name = els.shift();
      if (ref.length !== 2 || !name) {
        report.error('malformed $pseudo_op', loc);
        return [];
      }
      loc.inst = name;
      return [{kind: 'pseudo', ref, name, ...getField(els, loc)}];
    }
    if (first === '$import') {
      const ref = (els.shift() || '').split('::');
      if (ref.length !== 2) {
        report.error('malformed $import', loc);
        return [];
      }
      const op = {kind: 'import', ref};
      Object.defineProperty(op, 'loc', {value: loc}); // not serialized
      return [op];
    }
    if (first[0] === '$') {
      report.error('unknown directive ' + first, loc);
      return [];
    }
    loc.inst = first;
    return [{kind: 'leaf', name: first, ...getField(els, loc)}];
  });
};

module.exports = op2obj;
