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
  const opo = {};

  names.map(name => {
    lanes += 1;
    const des = isaTypes()[name]();
    const nam = name.toUpperCase() + '-type';

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
};

module.exports = printHeader;
