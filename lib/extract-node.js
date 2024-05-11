'use strict';

const fs = require('fs');
const https = require('https');
const async = require('async');

const op2obj = require('./op2obj.js');

const getOpcodes = (opts, path, op2obj1, ratified) => {
  // let count = 0;
  return (name, cb) => {
    if (opts.url) {
      const fullName = 'https://raw.githubusercontent.com/'
        + opts.url + '/master/' + path + name;

      return https.get(fullName, res => {
        let fullData = '';
        if (res.statusCode !== 200) {
          console.log(opts.url + name, 'statusCode: ', res.statusCode);
          throw new Error();
        }
        res.on('data', data => {
          fullData += data;
        });
        res.on('end', () => {
          // console.log(name, count);
          // count++;
          cb(null, {
            name, ratified,
            opcodes: op2obj1(fullData.toString(), name)
          });
        });
      }).on('error', (e) => {
        console.error(e);
        throw new Error(e);
      });
    }
    if (opts.dir) {
      const fullName = opts.dir + path + name;
      // console.log(fullName, name);
      return fs.readFile(fullName, 'utf8', (err, fullData) => {
        // console.log(fullName, fullData);
        cb(null, {
          name, ratified,
          opcodes: op2obj1(fullData.toString(), name)
        });
      });
    }
  };
};

const extract = (opts, path, names, fieldo, isRatified) =>
  async.mapLimit(names, 5, getOpcodes(opts, path, op2obj(fieldo), isRatified));

module.exports = extract;
