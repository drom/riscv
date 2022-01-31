'use strict';

const isaTypes = require('./isa-types.js');
const isaTable = require('./isa-table.js');

const printHeader = (names, width) => {
  if (typeof names === 'string') {
    names = names.trim().split(/\s+/);
  }
  const fields = [];
  const labels = [];
  let lanes = 0;

  names.map(name => {
    lanes += 1;
    fields.push(...isaTypes()[name]());
    labels.push(name.toUpperCase() + '-type');
  });
  return isaTable(fields, {
    hflip: true,
    hspace: width,
    bits: lanes * 32, lanes,
    compact: true,
    margin: {right: width / 6},
    label: {right: labels}
  });
};

module.exports = printHeader;
