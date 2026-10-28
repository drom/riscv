'use strict';

const { readFile } = require('fs').promises;

const op2obj = require('./op2obj.js');

// map over items with at most `limit` concurrent async jobs, preserving order
const mapLimit = async (items, limit, fn) => {
  const res = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      res[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
  return res;
};

const getOpcodes = (opts, path, op2obj1, ratified) => async name => {
  let fullData;
  if (opts.url) {
    const fullName = 'https://raw.githubusercontent.com/'
      + opts.url + '/master/extensions/' + path + name;
    if (opts.v) {
      console.log(fullName);
    }
    const res = await fetch(fullName);
    if (!res.ok) {
      throw new Error(fullName + ' statusCode: ' + res.status);
    }
    fullData = await res.text();
  } else if (opts.dir) {
    fullData = await readFile(opts.dir + 'extensions/' + path + name, 'utf8');
  } else {
    return;
  }
  return {
    name, ratified,
    opcodes: op2obj1(fullData, name)
  };
};

const extract = (opts, path, names, fieldo, isRatified) =>
  mapLimit(names, 5, getOpcodes(opts, path, op2obj(fieldo), isRatified));

module.exports = extract;
