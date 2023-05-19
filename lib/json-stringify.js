'use strict';

const isArray = Array.isArray;

const isObject = o => Object.prototype.toString.call(o) === '[object Object]';

// const stringify = o => json5.stringify(o, null, 2);

const s4 = o => JSON.stringify(o);

// const s4 = (key, val) => (key === 'mask')
//   ? parseInt(val).toString(16)
//   : ('"' + val + '"');

const s3 = o => isObject(o)
  ? (
    '{'
    + Object.keys(o).map(key => '"' + key + '": ' + s4(o[key])).join(', ')
    + '}'
  )
  : JSON.stringify(o);

const s2 = o => isArray(o)
  ? '[\n' + o.map(s3).join(',\n') + '\n]'
  : JSON.stringify(o, null, 2);

const s1 = o => isObject(o)
  ? (
    '{'
    + Object.keys(o).map(key => '"' + key + '": ' + s2(o[key])).join(', ')
    + '}'
  )
  : JSON.stringify(o);

const s0 = o => isArray(o)
  ? '[\n' + o.map(s1).join(',\n') + '\n]\n'
  : JSON.stringify(o, null, 2);

module.exports = s0;
