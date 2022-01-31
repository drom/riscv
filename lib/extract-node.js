'use strict';

const https = require('https');

const op2obj = require('./op2obj.js');
const opcodes = require('./opcodes.js');

const extract = names => new Promise((resolve, reject) => {
  let count = names.length;
  const ret = {};
  for (const name of names) {
    https.get(opcodes.ROOT + name, res => {
      let fullData = '';
      res.on('data', data => {
        fullData += data;
      });
      res.on('end', () => {
        ret[name] = op2obj(fullData.toString(), name);
        count--;
        if (count === 0) {
          resolve(ret);
        }
      });
    }).on('error', (e) => {
      console.error(e);
      reject(e);
    });
  }
});

module.exports = extract;
