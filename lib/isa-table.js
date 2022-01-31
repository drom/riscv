'use strict';

const onml = require('onml');
const bitField = require('bit-field');

const isaTable = (desc, opt) => {
//   const div = document.createElement('div');
//   const render = onml.renderer(div);
//   const ml = bitField.render(desc, opt);
//   render(ml);
//   return div;
  const ml = bitField.render(desc, opt);
  const svg = onml.stringify(ml);
  return svg;
};

module.exports = isaTable;

/* eslint-env browser */
