'use strict';

// native replacement for lodash.range (single argument form)
const range = n => Array.from({length: n}, (_, i) => i);

module.exports = range;
