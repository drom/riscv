'use strict';

// const opcodes = require('./opcodes.js');
const all = require('../assets/all.json');

const rv32iNames = `
lui auipc
jal jalr beq bne blt bge bltu bgeu
lb lh lw lbu lhu sb sh sw
addi slti sltiu xori ori andi
slli srli srai
add sub sll slt sltu xor srl sra or and
fence
ecall ebreak
`.trim().split(/\s+/);

module.exports = $ => {
  rv32iNames.map(name => {
    $[name] = all[name];
  });
  // console.log(rv32io);
  // opcodes.ALL_OPCODES.map(name => $[name] = name);
};
