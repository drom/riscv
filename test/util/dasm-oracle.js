'use strict';

// Shared helpers for the llvm-mc based disassembler oracle
// (bin/dasm-audit.js and test/dasm-golden.js).

const path = require('path');

const dir = path.join(__dirname, '..', 'dasm');
const goldenPath = path.join(dir, 'golden.json');
const knownPath = path.join(dir, 'known-diff.json');

const { fileExts } = require('../../lib/isa.js');

// extensions enabled for a sample: the parts of its riscv-opcodes file name
// (same as the llvm-mc -mattr used for the golden data)
const isaOf = (sample) => (fileExts(sample.ext) || [])
  .flatMap(e => (e === 'zicbo') ? ['zicbom', 'zicboz', 'zicbop'] : [e]);

const ours = (sample) => {
  const dasm = require('../../lib/dasm.js');
  return dasm(parseInt(sample.inst, 16), {xlen: sample.xlen, isa: isaOf(sample)});
};

// whitespace / separator normalization: 'addi\ta0, zero, 1' -> 'addi a0,zero,1'
const norm = (s) => String(s)
  .replace(/\s+/g, ' ')
  .replace(/ ?, ?/g, ',')
  .trim();

const key = (sample) => sample.xlen + ':' + sample.ext + ':' + sample.inst;

// categories (llvm === null means llvm-mc reports invalid encoding)
const classify = (sample, text) => {
  const o = norm(text);
  if (sample.llvm === null) {
    return o.startsWith('.insn') ? 'exact' : 'llvm-invalid';
  }
  const l = norm(sample.llvm);
  if (o === l) return 'exact';
  if (o.split(' ')[0] === l.split(' ')[0]) return 'operands';
  return 'mnemonic';
};

const categories = ['exact', 'operands', 'mnemonic', 'llvm-invalid'];

module.exports = {isaOf, dir, goldenPath, knownPath, ours, norm, key, classify, categories};
