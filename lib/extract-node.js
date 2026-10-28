'use strict';

const { readFile } = require('fs').promises;
const pathLib = require('path');

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
  try {
    fullData = await getText(opts, path, name);
  } catch (err) {
    if (!opts.report) throw err;
    opts.report.error(err.message, {file: path + name});
    return;
  }
  if (fullData === undefined) {
    return;
  }
  return {
    name, ratified,
    opcodes: op2obj1(fullData, path + name)
  };
};

const getText = async (opts, path, name) => {
  if (opts.url) {
    const fullName = 'https://raw.githubusercontent.com/'
      + opts.url + '/' + (opts.ref || 'master') + '/extensions/' + path + name;
    if (opts.v) {
      console.log(fullName);
    }
    const res = await fetch(fullName);
    if (!res.ok) {
      throw new Error(fullName + ' statusCode: ' + res.status);
    }
    return res.text();
  }
  if (opts.dir) {
    return readFile(pathLib.join(opts.dir, 'extensions', path, name), 'utf8');
  }
};

// opts: {url, ref} or {dir}; optional opts.report (collect diagnostics), opts.lut (arg_lut.csv)
const extract = async (opts, path, names, fieldo, isRatified) =>
  (await mapLimit(names, 5, getOpcodes(opts, path, op2obj(fieldo, opts.report, opts.lut), isRatified)))
    .filter(e => e !== undefined);

module.exports = extract;
