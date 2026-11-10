'use strict';

// C++ disassembler (lib/dasm-cpp.js) vs JS dasm: compile generated code,
// run random encodings of every candidate + random words (+ golden samples).
// Skipped when no C++ compiler is found ($CXX, c++, g++, clang++).

const { expect } = require('chai');
const { readFileSync } = require('fs');

const riscv = require('../lib');
const harness = require('./util/cpp-harness.js');
const oracle = require('./util/dasm-oracle.js');

const N = Number(process.env.DASM_CPP_SAMPLES || 4);

const configs = [
  {xlen: 32, isa: 'all'},
  {xlen: 64, isa: 'all'},
  {xlen: 32, isa: 'rv32imac'},
  {xlen: 32, isa: 'rv32imafc_zce'},
  {xlen: 64, isa: 'rv64gc_zba_zbb_zicbop'},
  {xlen: 64, isa: 'rv64gcv_zfh_zvfh_zfa'},
  {xlen: 32, isa: 'rv32imac_zve32x'},
  {xlen: 64, isa: 'rv64imac_zve64x', style: 'header', namespace: 'zve64x'}
];

const diffs = (words, out, ref) => {
  const res = [];
  words.forEach((w, i) => {
    const js = ref(w);
    if (out[i] !== js) res.push(w.toString(16).padStart(8, '0') + ' js: ' + js + ' | c++: ' + out[i]);
  });
  return res;
};

describe('dasm-cpp', function () {
  this.timeout(600000);

  before(function () {
    if (!harness.compiler()) this.skip();
  });

  for (const cfg of configs) {
    const name = 'rv' + cfg.xlen + ':' + cfg.isa + (cfg.style ? ' (' + cfg.style + ')' : '');
    it(name, () => {
      const gen = {...riscv.dasmCpp(cfg), style: cfg.style, namespace: cfg.namespace};
      const run = harness.build(gen, name);
      try {
        const words = harness.samples(riscv.candidates(cfg.xlen, cfg.isa), N);
        if (cfg.isa === 'all') {
          const golden = JSON.parse(readFileSync(oracle.goldenPath, 'utf8'));
          for (const s of golden.samples) {
            if (s.xlen === cfg.xlen) words.push(parseInt(s.inst, 16) >>> 0);
          }
        }
        const out = run(words);
        const d = diffs(words, out, w => riscv.dasm(w, cfg));
        expect(d.slice(0, 10), d.length + ' diffs').to.deep.eq([]);
      } finally {
        run.cleanup();
      }
    });
  }

  it('options', () => {
    expect(() => riscv.dasmCpp({style: 'foo'})).to.throw('unknown style');
    expect(() => riscv.dasmCpp({style: 'header', namespace: 'a-b'})).to.throw('invalid namespace');
    const h = riscv.dasmCpp({xlen: 32, isa: 'rv32i', style: 'header', namespace: 'my_dasm'}).lines;
    expect(h).to.include('namespace my_dasm {');
    expect(h).to.include('#ifndef MY_DASM_H');
  });
});
