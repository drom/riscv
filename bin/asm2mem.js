#!/usr/bin/env node
'use strict';

const process = require('process');

const main = async (src) => {
  src.setEncoding('utf8');
  let text = '';
  src.on('readable', () => {
    text += src.read() || '';
  });
  src.on('end', () => {
    text.split('\n').map(row => {
      if (row.trim() === '') {
        console.log('\n', row);
      } else {
        const m = row.match(/\s{4}([0-9a-f]+):\s*([0-9a-f\s]+)\s+(.+)/);
        if (m) {
          console.log('@' + m[1] + ' ' + m[2] + ' // ' + m [3]);
        } else {
          console.log('// ' + row);
        }
      }
    });
  });

};

main(process.stdin);
