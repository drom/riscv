'use strict';

const chai = require('chai');
const dasm = require('../lib/dasm.js');

const expect = chai.expect;

describe('dasm', async () => {
  it ('fcvt', async () => {
    expect(dasm[64](0xc00495d3)).to.eq('fcvt.w.s a1,fs1,rtz');
  });
});

/* eslint-env mocha */
