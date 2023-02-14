'use strict';

const https = require('https');
const async = require('async');

const op2obj = require('./op2obj.js');

const getOpcodes = (path, op2obj1) => (name, cb) => {
  // console.log(path, name);
  return https.get(path + name, res => {
    let fullData = '';
    res.on('data', data => {
      fullData += data;
    });
    res.on('end', () => cb(null, {
      name,
      opcodes: op2obj1(fullData.toString(), name)
    }));
  }).on('error', (e) => {
    console.error(e);
    throw new Error(e);
  });
};

const extract = (path, names, fieldo) =>
  async.map(names, getOpcodes(path, op2obj(fieldo)));

module.exports = extract;
