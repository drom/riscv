'use strict';

const chai = require('chai');
const lib = require('../lib/');
const expect = chai.expect;

describe('basic', async () => {
  // let opcodesAll;
  // before(async () => {
  //   opcodesAll = await lib.extractNode(lib.opcodes.ALL_OPCODES);
  //   // console.log(opcodesAll);
  // });

  it ('got all files', async () => {
    expect(lib.opcodes.ALL_OPCODES.length).to.eq(107);
  });

  // it ('got all opcodes', async () => {
  //   const o = Object.keys(opcodesAll).reduce((res, key) => {
  //     res[key] = Object.keys(opcodesAll[key]).length;
  //     return res;
  //   }, {});
  //   // console.log(o);

  //   expect(o).deep.eq({
  //     rv32i: 36,      rv64i: 15,
  //     rv32m: 8,       rv64m: 5,
  //     rv32a: 11,      rv64a: 11,
  //     rv32h: 12,      rv64h: 3,
  //     rv32f: 26,      rv64f: 4,
  //     rv32d: 26,      rv64d: 6,
  //     rv32q: 28,      rv64q: 4,
  //     rv32b: 61,      rv64b: 35,
  //     rv32zfh: 28,    'rv32d-zfh': 2, 'rv32q-zfh': 2, rv64zfh: 4, rvk: 8,
  //     rv32k: 10,      rv64k: 11,
  //     rvc: 35,        rv32c: 3,       rv64c: 7,

  //     system: 13,
  //     custom: 24,
  //     rvv: 447,

  //     pseudo: 23,
  //     'rvv-pseudo': 12
  //   });
  // });

});

/* eslint-env mocha */
