'use strict';

const resolveImports = (extos) => {
  extos.map(exto => {
    exto.opcodes.map(op => {
      if (op.kind === 'import') {
        const srco = extos.find((o) => (o.name === op.ref[0]));
        if (srco === undefined) {
          console.error('can\'t find source extention:', op.ref[0]);
          throw new Error();
        }
        const srcop = srco.opcodes.find((o) => (o.name === op.ref[1]));
        if (srcop === undefined) {
          console.error('can\'t find source instruction:', op.ref[1], 'in extention:', op.ref[0]);
          throw new Error();
        }
        op.name = srcop.name;
        op.mask = srcop.mask;
        op.valu = srcop.valu;
        op.args = srcop.args;
      }
    });
  });
};

module.exports = resolveImports;
