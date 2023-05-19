'use strict';

const opcodesAll = require('./extensions.json');
const fieldo = require('./fieldo.js');
const csrs = require('./csrs.js');

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

const xabi = [
  'zero', // Hard-wired zero
  'ra', // Return address
  'sp', // Stack pointer
  'gp', // Global pointer
  'tp', // Thread pointer
  't0', 't1', 't2', // Temporaries
  's0', 's1', // Saved registers
  'a0', 'a1', // Function arguments/return values
  'a2', 'a3', 'a4', 'a5', 'a6', 'a7', // Function arguments
  's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11',
  't3', 't4', 't5', 't6'
];

const fabi = [
  'ft0', 'ft1', 'ft2', 'ft3', 'ft4', 'ft5', 'ft6', 'ft7', // FP temporaries
  'fs0', 'fs1', // FP saved registers
  'fa0', 'fa1', // FP Function arguments/return values
  'fa2', 'fa3', 'fa4', 'fa5', 'fa6', 'fa7', // FP Function arguments
  'fs2', 'fs3', 'fs4', 'fs5', 'fs6', 'fs7', 'fs8', 'fs9', 'fs10', 'fs11',
  'ft8', 'ft9', 'ft10', 'ft11'
];

const xabic = ['s0', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5'];

const rmlut = [
  'rne',  // 0: Round to Nearest, ties to Even
  'rtz',  // 1: Round towards Zero
  'rtn',  // 2: Round Down (towards
  'rup',  // 3: Round Up (towards
  'rmm',  // 4: Round to Nearest, ties to Max Magnitude
  'rsv',  // 5: Reserved for future use.
  'rsv',  // 6: Reserved for future use.
  'dyn'   // 7: In instruction’s rm field, selects dynamic rounding mode;
  //            In Rounding Mode register, reserved.
];

const bitSlice = (inst, msb, lsb) =>
  (inst >> lsb) & (Math.pow(2, msb - lsb + 1) - 1);


const kindo = {
  xr: (x) => xabi[x],
  xrc: (x) => xabic[x],
  fr: (x) => fabi[x],
  vr: (x) => 'v' + x,
  csr: (x) => csrs[x] || `0x${x.toString(16)}`,
  undef: (x) => '{' + x + '}',
  rm: (x) => rmlut[x] || 'Reserved',
  fm: (x) => (x === 0) ? '' : 'tso', // Fence mode encoding
  pred: (x) => (
    ((x & 8) ? 'i' : '') +
    ((x & 4) ? 'o' : '') +
    ((x & 2) ? 'r' : '') +
    ((x & 1) ? 'w' : '')
  ),
  succ: (x) => (
    ((x & 8) ? 'i' : '') +
    ((x & 4) ? 'o' : '') +
    ((x & 2) ? 'r' : '') +
    ((x & 1) ? 'w' : '')
  )
  // vtypei: (x) => {}
};

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
