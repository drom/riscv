'use strict';

const isaTypes = require('./isa-types.js');
const isaTable = require('./isa-table.js');

module.exports = (names, width, opcodesAll, opcodesAllFlat) => {
  console.log(names);
  if (typeof names === 'string') {
    names = names.trim().split(/\s+/);
  }
  const fields = [];
  const labels = [];
  let lanes = 0;
  names.map(name => {
    const ns = name.split('/');

    const opcode = (ns.length === 1)
      ? opcodesAllFlat[name]
      : opcodesAll[ns[1]][ns[0]];

    lanes += 1;
    fields.push(...isaTypes(opcode)[opcode.type]());
    labels.push(ns[0].toUpperCase());
  });
  return isaTable(fields, {
    hflip: true,
    hspace: width,
    bits: lanes * 16, lanes,
    compact: true,
    margin: {right: width / 6},
    label: {right: labels}
  });
  // return names;
};

