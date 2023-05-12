'use strict';

const getCount = require('./get-count.js');

const koloro = {
  b: [94, 34, 94, 34], // blue
  z: [92, 32, 92, 32], // green
  s: [93, 33, 93, 33], // yellow
  x: [95, 35, 95, 35] // magenta
};

const color = (kind, arr) => {
  const koloroj = koloro[kind] || [];
  return arr.map((row, i) => {
    const k = koloroj[i] || 31;
    return '\x1b[' + k + 'm' + row + '\x1b[0m';
  });
};

const ext = (rootRow, xlen, exto) => {

  const rec = (srcRow, dbRow) => {
    let verSpan = '';
    if (srcRow) {
      const {major, minor} = srcRow;
      if ((major !== undefined) || (minor !== undefined)) {
        verSpan = 'v' + major + (minor ? ('.' + minor) : '');
      }
    }

    if (srcRow && !dbRow) {
      const {name} = srcRow;
      return [name.padEnd(8) + verSpan];
    }

    if (dbRow) {
      const {id, items, desc, ver, kind} = dbRow;
      const count = getCount(id, xlen);

      verSpan = (verSpan || (ver ? 'v' + ver : '')).padEnd(8);
      const spans = color(kind, [
        id.padEnd(18),
        verSpan,
        (count ? count : '').toString().padEnd(4),
        desc ? desc : '',
        // '  -> ', url ? url : ''
      ]).join('');

      if (items) {
        return [spans, ...items.flatMap(item => rec(undefined, item))];
      }
      return [spans];
    }
  };

  return rec(rootRow, exto[rootRow.name.toLowerCase()]);
};

const renderAnsi = (state, exto) => [
  'XLEN = ' + state.xlen,
  ...state.body.flatMap((row) => {
    if (row.error) {
      return [row.error + ' at: ' + row.start];
    }
    return ext(row, state.xlen, exto);
  })
].join('\n');

module.exports = renderAnsi;
