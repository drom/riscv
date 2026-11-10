'use strict';

/* eslint camelcase: 0 */

// vendor extension packs: riscv.extend

const { expect } = require('chai');

const riscv = require('../lib');
const harness = require('./util/cpp-harness.js');
const { createReport } = require('../lib/report.js');

// custom-0 (0x0b): xtest.add (R-type), xtest.addi (I-type)
const pack = () => ({
  exto: {xtest: {desc: 'Test vendor extension', url: 'https://example.com/xtest'}},
  extensions: [{name: 'rv_xtest', ratified: false, opcodes: [
    {kind: 'leaf', name: 'xtest.add', mask: 0xfe00707f, valu: 0x0000000b, args: ['rd', 'rs1', 'rs2']},
    {kind: 'leaf', name: 'xtest.addi', mask: 0x0000707f, valu: 0x0000100b, args: ['rd', 'rs1', 'imm12']}
  ]}],
  syntax: {
    'rv_xtest::xtest.add': {asm: 'xd, xs1, xs2', vars: [
      {name: 'xs2', location: '24-20'}, {name: 'xs1', location: '19-15'}, {name: 'xd', location: '11-7'}
    ]},
    'rv_xtest::xtest.addi': {asm: 'xd, xs1, imm', vars: [
      {name: 'imm', location: '31-20', sign_extend: true}, {name: 'xs1', location: '19-15'}, {name: 'xd', location: '11-7'}
    ]}
  },
  implies: {xtest: ['zicsr']},
  csrNames: {all: {0x7c0: 'xtestcfg'}}
});

const add = ((12 << 20) | (11 << 15) | (10 << 7) | 0x0b) >>> 0;            // xtest.add a0, a1, a2
const addi = ((0xfff << 20) | (11 << 15) | (1 << 12) | (10 << 7) | 0x0b) >>> 0; // xtest.addi a0, a1, -1
const csrr = ((0x7c0 << 20) | (2 << 12) | (10 << 7) | 0x73) >>> 0;        // csrrs a0, xtestcfg, zero

describe('extend', () => {
  it('vendor pack: dasm, isa, csr names, base untouched', () => {
    const ctx = riscv.extend(pack());
    expect(ctx.dasm(add, {isa: 'rv64i_xtest'})).to.eq('xtest.add a0, a1, a2');
    expect(ctx.dasm(addi, {isa: 'rv64i_xtest'})).to.eq('xtest.addi a0, a1, -1');
    expect(ctx.dasm(add, {isa: 'rv64i'})).to.eq('.insn 0x00c5850b');
    expect(ctx.dasm(add, {isa: 'all'})).to.eq('xtest.add a0, a1, a2');
    expect(ctx.isaFiles('rv64i_xtest', 64)).to.include('rv_xtest');
    expect(ctx.isaSet('rv64i_xtest', 64).has('zicsr')).to.eq(true);
    expect(ctx.dasm(csrr, {isa: 'rv64i_xtest'})).to.eq('csrrs a0, xtestcfg, zero');
    expect(ctx.decode(add, {isa: 'rv64i_xtest'}).ext).to.eq('rv_xtest');
    expect(ctx.candidates(64, 'rv64i_xtest').map(c => c.name)).to.include('xtest.addi');

    // built-in data unchanged
    expect(riscv.dasm(add, {isa: 'all'})).to.eq('.insn 0x00c5850b');
    expect(riscv.dasm(csrr, {isa: 'rv64i_zicsr'})).to.eq('csrrs a0, 1984, zero');
    expect(riscv.extensions.some(e => e.name === 'rv_xtest')).to.eq(false);
    expect(riscv.exto.xtest).to.eq(undefined);
    expect(riscv.implies.xtest).to.eq(undefined);
    expect(riscv.isaSet('rv64i_xtest', 64).has('zicsr')).to.eq(false);
  });

  it('renderAnsi uses pack exto and opcode counts', () => {
    const ctx = riscv.extend(pack());
    const state = riscv.langParser(riscv.isaLangWith())('rv64i_xtest');
    const text = ctx.renderAnsi(state);
    expect(text).to.contain('Test vendor extension');
    expect(text).to.match(/xtest\s+\S*\s+\S*2\s/);
    expect(ctx.exto.xtest.kind).to.eq('x');
  });

  it('chained packs, contexts independent', () => {
    const a = riscv.extend(pack());
    const b = a.extend({
      extensions: [{name: 'rv_xtwo', opcodes: [
        {kind: 'leaf', name: 'xtwo.nop', mask: 0xffffffff, valu: 0x0000002b, args: []}
      ]}]
    });
    expect(b.dasm(0x2b, {isa: 'rv64i_xtwo'})).to.eq('xtwo.nop');
    expect(b.dasm(add, {isa: 'rv64i_xtest'})).to.eq('xtest.add a0, a1, a2');
    expect(a.dasm(0x2b, {isa: 'all'})).to.eq('.insn 0x0000002b');
  });

  it('validation', () => {
    const errs = (p, opts = {}) => {
      const report = createReport();
      riscv.extend(p, {...opts, report});
      return report.items.map(e => e.level + ': ' + (e.loc.inst || e.loc.file) + ': ' + e.msg);
    };
    const op = (o) => ({extensions: [{name: 'rv_xbad', opcodes: [{kind: 'leaf', name: 'xbad.op', args: [], ...o}]}]});

    expect(errs(op({mask: 0x7f, valu: 0x10b}))).to.deep.eq(['error: xbad.op: valu has bits outside mask']);
    // addi encoding
    expect(errs(op({mask: 0x707f, valu: 0x13}))).to.deep.eq(['error: xbad.op: encoding overlaps rv_i::addi (use override)']);
    expect(errs(op({mask: 0x707f, valu: 0x13}), {override: true})).to.deep.eq([]);
    expect(errs({extensions: [{name: 'xbad', opcodes: []}]})).to.deep.eq(['error: xbad: invalid extension file name (rv_<ext>, rv32_<ext>, rv64_<ext>)']);
    expect(errs({extensions: [{name: 'rv_i', opcodes: []}]})).to.deep.eq(['error: rv_i: extension file exists (use override)']);
    expect(errs({extensions: [{name: 'rv_xbad', opcodes: [{kind: 'import', ref: ['rv_i', 'nope']}]}]}))
      .to.deep.eq(['error: rv_i::nope: import does not resolve']);
    expect(errs({syntax: {'rv_xnope::foo': {asm: ''}}})).to.deep.eq(['error: foo: syntax for unknown opcode']);
    expect(errs({syntax: {'rv_i::addi': {asm: ''}}})).to.deep.eq(['error: addi: syntax exists (use override)']);
    expect(errs(op({mask: 0x707f, valu: 0x100b, args: ['rd']}))).to.deep.eq(['warning: xbad.op: opcode without syntax (printed without operands)']);
    expect(errs({...op({mask: 0x707f, valu: 0x100b, args: ['rd']}),
      syntax: {'rv_xbad::xbad.op': {asm: 'xd', vars: [{name: 'xd', location: '11-7'}]}}}))
      .to.deep.eq(['warning: xbad.op: bits not covered by fixed bits or syntax variables: 0xffff8000']);

    // without report: errors throw
    expect(() => riscv.extend(op({mask: 0x7f, valu: 0x10b}))).to.throw('valu has bits outside mask');
  });

  it('dasmCpp of an extended context', function () {
    this.timeout(60000);
    if (!harness.compiler()) this.skip();
    const ctx = riscv.extend(pack());
    const cfg = {xlen: 64, isa: 'rv64i_xtest'};
    const run = harness.build(ctx.dasmCpp(cfg), 'xtest');
    try {
      const words = harness.samples(ctx.candidates(64, cfg.isa), 8).concat([add, addi, csrr]);
      const out = run(words);
      words.forEach((w, i) => expect(out[i], w.toString(16)).to.eq(ctx.dasm(w, cfg)));
      expect(out.slice(-3)).to.deep.eq(['xtest.add a0, a1, a2', 'xtest.addi a0, a1, -1', 'csrrs a0, xtestcfg, zero']);
    } finally {
      run.cleanup();
    }
  });
});
