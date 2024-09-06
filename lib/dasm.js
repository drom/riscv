'use strict';

const opcodesAll = require('./extensions.json');
const fieldo = require('./fieldo.js');
const kindo = require('./kindo.js');

const filterOpcodes = require('./filter-opcodes.js');
const hashOpcodes = require('./hash-opcodes.js');

const filteredOpcodes = filterOpcodes(opcodesAll);
const hash32 = hashOpcodes(filteredOpcodes.rv32);
const hash64 = hashOpcodes(filteredOpcodes.rv64);

const inst2idx = (inst) => {
  const inst3 = inst & 3;
  if (inst3 === 3) {
    return ((inst >> 2) & 31) + 3;
  }
  return inst3;
};

const bitSlice = (inst, msb, lsb) =>
  (inst >> lsb) & (Math.pow(2, msb - lsb + 1) - 1);

const toAsm = (inst, row) => {
  const tail = [];
  let imm;
  for (const arg of row.args) {
    if (typeof arg === 'string') {
      const field = fieldo[arg];
      const x = bitSlice(inst, field.msb, field.lsb);
      if (field.bits) {
        imm = imm || 0;
        const len = (field.msb - field.lsb) + 1;
        for (let i = 0; i < len; i++) {
          const bit = (inst >> (i + field.lsb)) & 1;
          imm = imm | (bit << (field.bits[len - i - 1]));
        }
        if (field.kind === 'sext') {
          const sign = (inst >> field.msb) & 1;
          for (let i = field.bits[0]; i < 32; i++) {
            imm = imm | (sign << i);
          }
        }
        continue;
      }
      tail.push({
        val: (kindo[field.kind] || kindo.undef)(x),
        prio: (field.prio === undefined) ? 999 : field.prio
      });
    }
  }
  const tail2 = tail.sort((a, b) => a.prio - b.prio);
  const tail3 = tail2.flatMap(e => (e.val === '') ? [] : [e.val]);
  if (imm != undefined) {
    tail3.push(imm);
  }
  return row.name + ' ' + tail3.join(',');
};

const dasm32 = (inst) => {
  const g = hash32[inst2idx(inst)];
  if (((inst & g.mask) >>> 0) === g.valu) {
    for (const row of g.opcodes) {
      if (((row.mask & inst) >>> 0) === row.valu) {
        return toAsm(inst, row);
      }
    }
    return `{${g.mask}-${g.valu}}`;
  }
  return 'foo32';
};

const dasm64 = (inst) => {
  const g = hash64[inst2idx(inst)];
  if (((inst & g.mask) >>> 0) === g.valu) {
    for (const row of g.opcodes) {
      if (((row.mask & inst) >>> 0) === row.valu) {
        return toAsm(inst, row);
      }
    }
    return `{${g.mask}-${g.valu}}`;
  }
  return 'foo32';
};

module.exports = {
  '32': dasm32,
  '64': dasm64
  // dasm,
  // iSize
};
