'use strict';

const getCount = require('./get-count.js');

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
      const {id, items, desc, ver} = dbRow;
      const count = getCount(id, xlen);

      verSpan = (verSpan || (ver ? 'v' + ver : '')).padEnd(8);
      const spans = [
        id.padEnd(10),
        verSpan,
        (count ? count : '').toString().padEnd(4),
        desc ? desc : '',
        // '  -> ', url ? url : ''
      ].join('');

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
