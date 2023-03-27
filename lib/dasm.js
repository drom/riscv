'use strict';

const dasm16 = (inst /*, xlen */) => {
  const unknown = '?(' + inst.toString(16).padStart(4, '0') + ')';
  if (inst === 0) {
    return unknown;
  }
  switch (((inst >>> 11) & 0b11100) | (inst & 3)) {
  case 0b00100: return 'fld'; // 64dc
  case 0b01000: return 'lw';
  case 0b01100: return 'ld'; // 64
  case 0b10100: return 'fsd'; // 64dc
  case 0b11000: return 'sw';
  case 0b11100: return 'sd'; // 64
  case 0b00001: return 'addi';
  case 0b00101: return 'addiw'; // 64
  // case 0b00101: return 'c.jal'; // 32
  case 0b01001: return 'li';
  case 0b01101:
    if (((inst >>> 7) & 31) === 2) {
      return 'addi16sp';
    }
    return 'lui';
  case 0b10001:
    switch((inst >>> 10) & 7) {
    case 0: case 4: return 'srli';
    case 1: case 5: return 'srai';
    case 2: case 6: return 'andi';
    case 3:
      switch((inst >>> 5) & 3) {
      case 0: return 'sub';
      case 1: return 'xor';
      case 2: return 'or';
      case 3: return 'and';
      }
      break;
    default: return unknown;
    }
    break;
  case 0b10101: return 'j';
  case 0b11001: return 'benqz';
  case 0b11101: return 'bnez';
  case 0b00010: return 'slli';
  case 0b00110: return 'fldsp'; // 64dc
  case 0b01010: return 'lwsp';
  case 0b01110: return 'ldsp'; // 64dc
  case 0b10010: return '{jr,mv,ebreak,jalr,add}';
  case 0b10110: return 'fsdsp'; // 64dc
  case 0b11010: return 'swsp';
  case 0b11110: return 'sdsp';
  default: return unknown;
  }
};

/* eslint complexity: 0 */

const dasm32 = (inst /*, xlen */) => {
  return '32(' + inst.toString(16).padStart(8, '0') + ')';
};

const iSize = (inst) => {
  inst = Number(inst) >>>0; // u32 cast
  if ((inst & 0b11) !== 3) {
    return 16;
  }
  if ((inst & 0b11111) !== 0b11111) {
    return 32;
  }
  return 48; // ???
};

const dasm = (inst, xlen) => {
  inst = Number(inst) >>>0; // u32 cast
  const size = iSize(inst);
  if (size === 16) {
    return 'c.' + dasm16(inst & 0xffff, xlen);
  }
  if (size === 32) {
    return dasm32(inst, xlen);
  }
  return '?(' + inst.toString(16).padStart(8, '0') + ')';
};


module.exports = {
  dasm,
  iSize
};
