'use strict';

const { throwingReport } = require('./report.js');

// replace $import entries with the referenced instruction,
// check that $pseudo_op references exist
const resolveImports = (extos, report = throwingReport) => {
  const byName = {};
  for (const exto of extos) {
    byName[exto.name] = exto;
  }
  const find = (ref, loc, what) => {
    const srco = byName[ref[0]];
    if (srco === undefined) {
      report[what === 'import' ? 'error' : 'warn'](
        what + ' references unknown extension file: ' + ref[0], loc);
      return;
    }
    const srcop = srco.opcodes.find(o => (o.name === ref[1]) && (o.kind !== 'import'));
    if (srcop === undefined) {
      report[what === 'import' ? 'error' : 'warn'](
        what + ' references unknown instruction: ' + ref.join('::'), loc);
    }
    return srcop;
  };
  for (const exto of extos) {
    for (const op of exto.opcodes) {
      const loc = op.loc || {file: exto.name, inst: op.name};
      if (op.kind === 'import') {
        const srcop = find(op.ref, loc, 'import');
        if (srcop) {
          op.name = srcop.name;
          op.mask = srcop.mask;
          op.valu = srcop.valu;
          op.args = srcop.args;
        }
      } else if (op.kind === 'pseudo') {
        find(op.ref, {file: exto.name, inst: op.name}, 'pseudo_op');
      }
    }
  }
};

module.exports = resolveImports;
