'use strict';

const ALL_REAL_ILEN32_OPCODES = `
  rv32i rv64i
  rv32m rv64m
  rv32a rv64a
  rv32h rv64h
  rv32f rv64f
  rv32d rv64d
  rv32q rv64q
  rv32b rv64b
  system
  rv32zfh rv32d-zfh rv32q-zfh rv64zfh rvk
  rv32k rv64k
`.trim().split(/\s+/);

const ALL_REAL_OPCODES = ALL_REAL_ILEN32_OPCODES.concat(`
  rvc rv32c rv64c custom rvv
`.trim().split(/\s+/));

exports.ALL_OPCODES = ['pseudo', ...ALL_REAL_OPCODES, 'rvv-pseudo'];
exports.ROOT = 'https://raw.githubusercontent.com/riscv/riscv-opcodes/master/opcodes-';
