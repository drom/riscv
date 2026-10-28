'use strict';

// lib/dasm.js vs llvm-mc golden samples (test/dasm/golden.json).
// test/dasm/known-diff.json lists accepted mismatches: a new or changed
// mismatch fails, and so does a fixed one still listed (keep the list shrinking).
// Update with: node bin/dasm-audit.js --update-known

const { expect } = require('chai');
const { readFileSync } = require('fs');

const oracle = require('./util/dasm-oracle.js');

const golden = JSON.parse(readFileSync(oracle.goldenPath, 'utf8'));
const known = JSON.parse(readFileSync(oracle.knownPath, 'utf8'));

const fmt = (r) => r.key + '  ours: ' + r.ours + '  llvm: ' + r.llvm
  + (r.was !== undefined ? '  known: ' + r.was : '');

describe('dasm golden (llvm-mc ' + golden.llvm + ')', () => {
  const unexpected = [];
  const fixed = [];
  const seen = new Set();

  for (const sample of golden.samples) {
    const k = oracle.key(sample);
    seen.add(k);
    let text;
    try {
      text = oracle.ours(sample);
    } catch (err) {
      text = 'THROWS ' + err.message;
    }
    const ours = oracle.norm(text);
    const row = {key: k, ours, llvm: sample.llvm, was: known[k]};
    if (oracle.classify(sample, text) === 'exact') {
      if (known[k] !== undefined) fixed.push(row);
    } else if (known[k] !== ours) {
      unexpected.push(row);
    }
  }

  it('no new or changed mismatches', () => {
    expect(unexpected.map(fmt).slice(0, 20), unexpected.length + ' unexpected').to.deep.eq([]);
  });

  it('no fixed mismatches left in known-diff.json', () => {
    expect(fixed.map(fmt).slice(0, 20), fixed.length + ' fixed').to.deep.eq([]);
  });

  it('known-diff.json has no unknown keys', () => {
    expect(Object.keys(known).filter(k => !seen.has(k)).slice(0, 20)).to.deep.eq([]);
  });
});
