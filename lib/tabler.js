'use strict';

const isaTable = require('./isa-table.js');

const tabler = (ilen, width) => function () {
  let labels = [];
  let fields = [];
  for (const fn of arguments) {
    fn(labels, fields);
  }
  const lanes = labels.length;
  return isaTable(fields, {
    hflip: true,
    hspace: width,
    bits: lanes * ilen, lanes,
    compact: true,
    margin: {right: width / 6},
    label: {right: labels}
  });
};

module.exports = tabler;
