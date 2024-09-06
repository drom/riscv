'use strict';

const csrs = require('./csrs.js');
const fieldEnums = require('./field-enums.js');

const kindo = {
  xr: (x) => fieldEnums.xabi[x],
  xrc: (x) => fieldEnums.xabic[x],
  fr: (x) => fieldEnums.fabi[x],
  vr: (x) => 'v' + x,
  csr: (x) => csrs[x] || `0x${x.toString(16)}`,
  undef: (x) => '{' + x + '}',
  rm: (x) => fieldEnums.rmlut[x] || 'Reserved',
  fm: (x) => (x === 0) ? '' : 'tso', // Fence mode encoding
  pred: (x) => (
    ((x & 8) ? 'i' : '') +
    ((x & 4) ? 'o' : '') +
    ((x & 2) ? 'r' : '') +
    ((x & 1) ? 'w' : '')
  ),
  succ: (x) => (
    ((x & 8) ? 'i' : '') +
    ((x & 4) ? 'o' : '') +
    ((x & 2) ? 'r' : '') +
    ((x & 1) ? 'w' : '')
  ),
  frc: () => {},
  vtypei: () => {}
};

module.exports = kindo;
