'use strict';

const chai = require('chai');
const lib = require('../index.js');
const expect = chai.expect;

describe('basic', function () {
  it('basic', function (done) {
    expect(lib.pkg).to.be.an('object');
    done();
  });
});

/* eslint-env mocha */
