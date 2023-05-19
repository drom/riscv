'use strict';

const range = require('lodash.range');

const hashOpcodes = (opcodes) => {
  const res = [
    {mask: 0x3,  valu: 0x0},
    {mask: 0x3,  valu: 0x1},
    {mask: 0x3,  valu: 0x2},
    ...range(32).map(i => ({mask: 0x7f, valu: (i << 2) + 3}))
  ].map(grupo => {
    const ops = grupo.opcodes = [];
    opcodes.map(exto => {
      exto.opcodes.map(insto => {
        const mask = grupo.mask & insto.mask;
        if (((insto.kind === 'leaf') || (insto.kind === 'pseudo')) && (grupo.valu & mask) === (insto.valu & mask)) {
          ops.push(insto);
        }
      });
    });
    return grupo;
  });
  console.log(res.map(e => e.opcodes.length));
  return res;
};

module.exports = hashOpcodes;
