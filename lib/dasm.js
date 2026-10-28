'use strict';

// RISC-V disassembler, LLVM `llvm-mc --disassemble -M no-aliases` format.
//
//   dasm(inst, {xlen = 64, isa}) -> 'addi a0, zero, 1'
//
// isa: ISA string ('rv64gc_zba'), list of extension names, or 'all'
// (default: base I). Unknown or reserved encodings -> '.insn 0x...'.

const decode = require('./decode.js');

const format = (d) => d.ops.length
  ? d.name + ' ' + d.ops.map(o => o.text).join(', ')
  : d.name;

const dasm = (inst, opts) => format(decode(inst, opts));

module.exports = dasm;
module.exports.format = format;
module.exports.decode = decode;
