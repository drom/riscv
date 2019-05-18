#!/usr/bin/env node
'use strict';

// const request = require('request');
const fs = require('fs-extra');
const rpn = require('request-promise-native');

const github = 'https://raw.githubusercontent.com/riscv/riscv-opcodes/master/';

const urls = [
  'opcodes',
  'opcodes-custom',
  'opcodes-pseudo',
  'opcodes-rvc',
  'opcodes-rvc-pseudo',
  'opcodes-rvv',
  'opcodes-rvv-pseudo'
];


const parse = txt => txt
  .split('\n')
  .map(row => row.trim())
  .filter(row => row !== '')
  .filter(row => row[0] !== '#')
  .map(row => row.split(/\s+/))
  // .map(row => ({
  //   name: row[0],
  //   args: row.slice(1)
  // }))
  .reduce((res, row) => {
    res[row[0]] = row.slice(1);
    return res;
  }, {})
  ;

const main = async () => {
  urls.map(async url => {
    const body = await rpn(github + url);
    const obj = parse(body);
    await fs.outputJSON(url + '.json', obj, {spaces: 2});
    console.log(url);
  });
};

main();
