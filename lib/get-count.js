'use strict';

const builtinExtensions = require('./extensions.json');

// number of instructions (leaf + import) of an extension for xlen
const createGetCount = (extensions = builtinExtensions) => (name, xlen) => {
  let ops = 0;
  ['rv_' + name, 'rv' + xlen + '_' + name].map(key => {
    const o = extensions.find(e => (e.name === key));
    if (o) {
      o.opcodes.map(e => {
        if ((e.kind === 'leaf') || (e.kind === 'import')) {
          ops += 1;
        }
      });
    }
  });
  return ops;
};

module.exports = createGetCount();
module.exports.createGetCount = createGetCount;
