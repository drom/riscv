'use strict';

const chai = require('chai');
const lib = require('../index.js');
const expect = chai.expect;

const counts = {
  opcodes: 198,
  opcodesCustom: 24,
  opcodesPseudo: 22,
  opcodesRvc: 32,
  opcodesRvcPseudo: 14,
  opcodesRvv: 320,
  opcodesRvvPseudo: 8
};

describe('basic', () => {
  it('count ISA groups', done => {
    expect(Object.keys(lib).length).eq(8);
    done();
  });
  Object.keys(lib).map((group, i) => {
    if (counts[group]) {
      const len = Object.keys(lib[group]).length;
      it(`${i}) ${group} ${len}`, done => {
        expect(lib[group]).to.be.an('object');
        expect(len).eq(counts[group]);
        done();
      });
    }
  });
});

/* eslint-env mocha */
