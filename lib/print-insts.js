'use strict';

// const { opcodesAll, opcodesAllFlat } = require('./opcodes.js');
const isaTypes = require('./isa-types.js');
const isaTable = require('./isa-table.js');

module.exports = (names, width, opcodesAll, opcodesAllFlat) => {
  if (typeof names === 'string') {
    names = names.trim().split(/\s+/);
  }
  const fields = [];
  const labels = [];
  let lanes = 0;
  const opo = {};
  names.map(name => {
    const ns = name.split('/');

    const opcode = (ns.length === 1)
      ? opcodesAllFlat[name]
      : opcodesAll[ns[1]][ns[0]];

    lanes += 1;
    const des = isaTypes(opcode)[opcode.type]();
    const nam = ns[0].toUpperCase();
    fields.push(...des);
    labels.push(nam);
    opo[nam] = des;
  });
  return [isaTable(fields, {
    hflip: true,
    hspace: width,
    bits: lanes * 32, lanes,
    compact: true,
    margin: {right: width / 6},
    label: {right: labels}
  }), opo];
  // return names;
};
