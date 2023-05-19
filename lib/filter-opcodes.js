'use strict';

const filterOpcodes = (opcodesAll) => {
  const o = {rv32: [], rv64: [], rv128: []};
  opcodesAll.map(opcode => {
    const {name} = opcode;
    if (name.match(/^rv_/)) {
      o.rv32.push(opcode);
      o.rv64.push(opcode);
      o.rv128.push(opcode);
      return;
    }
    if (name.match(/^rv32_/)) {
      o.rv32.push(opcode);
      return;
    }
    if (name.match(/^rv64_/)) {
      o.rv64.push(opcode);
      return;
    }
    if (name.match(/^rv128_/)) {
      o.rv128.push(opcode);
      return;
    }
    console.log(opcode);
  });
  return o;
};

module.exports = filterOpcodes;
