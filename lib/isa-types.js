'use strict';

const isaTypes = (obj) => { /* eslint complexity: 0 */
  obj = obj || {};
  const opo = obj.opcodes || {};
  const args = obj.args || [];

  const op = opo['1..0'] === undefined ? 'op' : opo['1..0'];
  const func3 = opo['15..13'] === undefined ? 'func3' : opo['15..13'];
  const amoop = opo['31..27'] === undefined ? 'amoop' : opo['31..27'];
  let opcode = (opo['1..0'] + (opo['6..2'] << 2));

  if (opo['6..0'] !== undefined) opcode = opo['6..0'];
  if (Number.isNaN(opcode)) opcode = 'opcode';

  const funct2 = opo['26..25'] === undefined ? 'funct2' : opo['26..25'];

  let funct3 = opo['14..12'] === undefined ? 'funct3' : opo['14..12'];
  if (args.includes('rm')) funct3 = 'rm';

  let funct7 = (opo['26..25'] + (opo['31..27'] << 2));
  if (opo['31..25'] !== undefined) funct7 = opo['31..25'];
  if (Number.isNaN(funct7)) funct7 = 'funct7';

  let funct6 = opo['31..26'] === undefined ? 'funct6' : opo['31..26'];

  let rs2 = opo['24..20'];
  if (rs2 === undefined) rs2 = 'rs2';

  let rs3 = (opo['28..27'] + (opo['31..29'] << 2));
  if (Number.isNaN(rs3)) rs3 = 'rs3';

  let shamt = opo['24..20'];
  if (shamt === undefined) shamt = 'shamt';

  let shamtw = opo['25..20'];
  if (shamtw === undefined) shamtw = 'shamt';

  let imm20 = opo['31..20']; if (imm20 === undefined) imm20 = 'imm[11:0]';
  let simm5 = opo['19..15']; if (simm5 === undefined) simm5 = 'simm5';


  let mew = opo['28']; if (mew === undefined) mew = 'mew';

  let mop = opo['27..26']; if (mop === undefined) mop = 'mop';

  let width = opo['14..12']; if (width === undefined) width = 'width';
  let lumop = opo['24..20']; if (lumop === undefined) lumop = 'lumop';
  let sumop = opo['24..20']; if (sumop === undefined) sumop = 'sumop';
  let vm = opo['25']; if (vm === undefined) vm = 'vm';

  let vs1 = opo['19..15']; if (vs1 === undefined) vs1 = '<b>vs1';
  let vs2 = opo['24..20']; if (vs2 === undefined) vs2 = '<b>vs2';
  let nf = opo['31..29']; if (nf === undefined) nf = 'nf';
  if (opo['31..28'] !== undefined) {
    nf = opo['31..28'] >> 1;
    mew = opo['31..28'] & 1;
  }

  return {
    r: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: 'rd', type: 2},
      {bits: 3,  name: funct3},
      {bits: 5,  name: 'rs1', type: 4},
      {bits: 5,  name: rs2, type: (typeof rs2 === 'number') ? undefined : 4},
      {bits: 7,  name: funct7}
    ],
    i: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: 'rd', type: 2},
      {bits: 3,  name: funct3},
      {bits: 5,  name: 'rs1', type: 4},
      {bits: 12, name: imm20, type: (typeof imm20 === 'number') ? undefined : 3},
    ],
    s: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: 'imm[4:0]', type: 3},
      {bits: 3,  name: funct3},
      {bits: 5,  name: 'rs1', type: 4},
      {bits: 5,  name: rs2, type: (typeof rs2 === 'number') ? undefined : 4},
      {bits: 7,  name: 'imm[11:5]', type: 3}
    ],
    sb: () => [
      {bits: 7,  name: opcode},
      {bits: 1,  name: '[11]',      type: 3},
      {bits: 4,  name: 'imm[4:1]',  type: 3},
      {bits: 3,  name: funct3},
      {bits: 5,  name: 'rs1', type: 4},
      {bits: 5,  name: rs2, type: (typeof rs2 === 'number') ? undefined : 4},
      {bits: 6,  name: 'imm[10:5]', type: 3},
      {bits: 1,  name: '[12]',      type: 3}
    ],
    u: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: 'rd', type: 2},
      {bits: 20, name: 'imm[31:12]', type: 3}
    ],
    uj: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: 'rd', type: 2},
      {bits: 8,  name: 'imm[19:12]', type: 3},
      {bits: 1,  name: '[11]',       type: 3},
      {bits: 10, name: 'imm[10:1]',  type: 3},
      {bits: 1,  name: '[20]',       type: 3}
    ],
    a: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: 'rd', type: 2},
      {bits: 8,  name: 'imm[19:12]', type: 3},
      {bits: 1,  name: '[11]',       type: 3},
      {bits: 10, name: 'imm[10:1]',  type: 3},
      {bits: 1,  name: '[20]',       type: 3}
    ],
    r4: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: 'rd', type: 2},
      {bits: 3,  name: funct3},
      {bits: 5,  name: 'rs1', type: 4},
      {bits: 5,  name: rs2, type: (typeof rs2 === 'number') ? undefined : 4},
      {bits: 2,  name: funct2},
      {bits: 5,  name: rs3, type: (typeof rs3 === 'number') ? undefined : 4},
    ],
    ish: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: 'rd', type: 2},
      {bits: 3,  name: funct3},
      {bits: 5,  name: 'rs1', type: 4},
      {bits: 5,  name: shamt, type: (typeof shamt === 'number') ? undefined : 3},
      {bits: 1},
      {bits: 6,  name: funct6}
    ],
    ishw: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: 'rd', type: 2},
      {bits: 3,  name: funct3},
      {bits: 5,  name: 'rs1', type: 4},
      {bits: 5,  name: shamtw, type: (typeof shamtw === 'number') ? undefined : 3},
      {bits: 7,  name: funct7}
    ],
    fence: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: 'rd', type: 2},
      {bits: 3,  name: funct3},
      {bits: 5,  name: 'rs1', type: 4},
      {bits: 4,  name: 'succ'},
      {bits: 4,  name: 'pred'},
      {bits: 4,  name: 'fm'},
    ],
    amo: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: 'rd', type: 2},
      {bits: 3,  name: funct3},
      {bits: 5,  name: 'rs1', type: 4},
      {bits: 5,  name: rs2, type: (typeof rs2 === 'number') ? undefined : 4},
      {bits: 1,  name: 'rl'},
      {bits: 1,  name: 'aq'},
      {bits: 5,  name: rs3},
    ],
    csr: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: 'rd', type: 2},
      {bits: 3,  name: funct3},
      {bits: 5,  name: 'rs1', type: 4},
      {bits: 12, name: imm20, type: (typeof imm20 === 'number') ? undefined : 3},
    ],
    vle: () => [ // Vector Unit-Stride Instructions (including segment part)
      {bits: 7, name: opcode},
      {bits: 5, name: '<b>vd', type: 2},
      {bits: 3, name: width},
      {bits: 5, name: 'rs1', type: 4},
      {bits: 5, name: lumop},
      {bits: 1, name: vm},
      {bits: 2, name: mop},
      {bits: 1, name: mew},
      {bits: 3, name: nf},
    ],
    vse: () => [
      {bits: 7, name: opcode},
      {bits: 5, name: '<b>vs3', type: 4},
      {bits: 3, name: width},
      {bits: 5, name: 'rs1', type: 4},
      {bits: 5, name: sumop},
      {bits: 1, name: vm},
      {bits: 2, name: mop},
      {bits: 1, name: mew},
      {bits: 3, name: nf},
    ],
    vluxei: () => [ // Vector Indexed-Unordered Instructions (including segment part)
      {bits: 7, name: opcode},
      {bits: 5, name: '<b>vd', type: 2},
      {bits: 3, name: width},
      {bits: 5, name: 'rs1', type: 4},
      {bits: 5,  name: vs2, type: (typeof vs2 === 'number') ? undefined : 4},
      {bits: 1, name: vm},
      {bits: 2, name: mop},
      {bits: 1, name: mew},
      {bits: 3, name: nf},
    ],
    vsuxei: () => [ // VSX* indexed
      {bits: 7, name: opcode},
      {bits: 5, name: '<b>vs3', type: 4},
      {bits: 3, name: width},
      {bits: 5, name: 'rs1', type: 4},
      {bits: 5,  name: vs2, type: (typeof vs2 === 'number') ? undefined : 4},
      {bits: 1, name: vm},
      {bits: 2, name: mop},
      {bits: 1, name: mew},
      {bits: 3, name: nf},
    ],
    vlse: () => [ // Vector Strided Instructions (including segment part)
      {bits: 7, name: opcode},
      {bits: 5, name: '<b>vd', type: 2},
      {bits: 3, name: width},
      {bits: 5, name: 'rs1', type: 4},
      {bits: 5, name: 'rs2', type: 4},
      {bits: 1, name: vm},
      {bits: 2, name: mop},
      {bits: 1, name: mew},
      {bits: 3, name: nf},
    ],
    vsse: () => [
      {bits: 7, name: opcode},
      {bits: 5, name: '<b>vs3', type: 4},
      {bits: 3, name: width},
      {bits: 5, name: 'rs1', type: 4},
      {bits: 5, name: 'rs2', type: 4},
      {bits: 1, name: vm},
      {bits: 2, name: mop},
      {bits: 1, name: mew},
      {bits: 3, name: nf},
    ],
    opfvf: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: '<b>vd', type: 2},
      {bits: 3,  name: 5},
      {bits: 5,  name: 'rs1', type: 4},
      {bits: 5,  name: vs2, type: (typeof vs2 === 'number') ? undefined : 4},
      {bits: 1,  name: vm},
      {bits: 6,  name: funct6},
    ],
    opfvfacc: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: '<b>vd / vs3', type: 7},
      {bits: 3,  name: 5},
      {bits: 5,  name: 'rs1', type: 4},
      {bits: 5,  name: vs2, type: (typeof vs2 === 'number') ? undefined : 4},
      {bits: 1,  name: vm},
      {bits: 6,  name: funct6},
    ],
    opfvv: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: '<b>vd', type: 2},
      {bits: 3,  name: funct3},
      {bits: 5,  name: vs1, type: (typeof vs1 === 'number') ? undefined : 4},
      {bits: 5,  name: vs2, type: (typeof vs2 === 'number') ? undefined : 4},
      {bits: 1,  name: vm},
      {bits: 6,  name: funct6},
    ],
    opfvvacc: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: '<b>vd / vs3', type: 7},
      {bits: 3,  name: funct3},
      {bits: 5,  name: vs1, type: (typeof vs1 === 'number') ? undefined : 4},
      {bits: 5,  name: vs2, type: (typeof vs2 === 'number') ? undefined : 4},
      {bits: 1,  name: vm},
      {bits: 6,  name: funct6},
    ],
    opivv: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: '<b>vd', type: 2},
      {bits: 3,  name: funct3},
      {bits: 5,  name: vs1, type: (typeof vs1 === 'number') ? undefined : 4},
      {bits: 5,  name: vs2, type: (typeof vs2 === 'number') ? undefined : 4},
      {bits: 1,  name: vm},
      {bits: 6,  name: funct6},
    ],
    opivi: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: '<b>vd', type: 2},
      {bits: 3,  name: funct3},
      {bits: 5,  name: simm5, type: (typeof simm5 === 'number') ? undefined : 3},
      {bits: 5,  name: vs2, type: (typeof vs2 === 'number') ? undefined : 4},
      {bits: 1,  name: vm},
      {bits: 6,  name: funct6},
    ],
    opivvrd: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: 'rd', type: 2},
      {bits: 3,  name: funct3},
      {bits: 5,  name: vs1, type: (typeof vs1 === 'number') ? undefined : 4},
      {bits: 5,  name: vs2, type: (typeof vs2 === 'number') ? undefined : 4},
      {bits: 1,  name: vm},
      {bits: 6,  name: funct6},
    ],
    vamo: () => [
      {bits: 7,  name: opcode},
      {bits: 5,  name: '<b>vd', type: 2},
      {bits: 3,  name: width},
      {bits: 5,  name: 'rs1', type: 4},
      {bits: 5,  name: vs2, type: (typeof vs2 === 'number') ? undefined : 4},
      {bits: 1,  name: vm},
      {bits: 1,  name: 'wd'},
      {bits: 5,  name: amoop},
    ],
    cr: () => [
      {bits: 2, name: op},
      {bits: 5, name: 'rs2',    type: 4},
      {bits: 5, name: 'rd / rs1', type: 7},
      {bits: 4, name: 'funct4', type: 8},
    ],
    ci: () => [
      {bits: 2, name: op},
      {bits: 5, name: 'imm',    type: 3},
      {bits: 5, name: 'rd / rs1', type: 7},
      {bits: 1, name: 'imm',    type: 3},
      {bits: 3,  name: func3, type: 8},
    ],
    css: () => [
      {bits: 2, name: op},
      {bits: 5, name: 'rs2',    type: 4},
      {bits: 6, name: 'imm',    type: 3},
      {bits: 3,  name: func3, type: 8},
    ],
    ciw: () => [
      {bits: 2, name: op},
      {bits: 3, name: 'rd`',    type: 2},
      {bits: 8, name: 'imm',    type: 3},
      {bits: 3,  name: func3, type: 8},
    ],
    cl: () => [
      {bits: 2, name: op},
      {bits: 3, name: 'rd`',    type: 2},
      {bits: 2, name: 'imm',    type: 3},
      {bits: 3, name: 'rs1`',   type: 4},
      {bits: 3, name: 'imm',    type: 3},
      {bits: 3,  name: func3, type: 8},
    ],
    cs: () => [
      {bits: 2, name: op},
      {bits: 3, name: 'rs2`',   type: 4},
      {bits: 2, name: 'imm',    type: 3},
      {bits: 3, name: 'rs1`',   type: 4},
      {bits: 3, name: 'imm',    type: 3},
      {bits: 3,  name: func3, type: 8},
    ],
    ca: () => [
      {bits: 2, name: op},
      {bits: 3, name: 'rs2`',   type: 4},
      {bits: 2, name: 'funct2', type: 8},
      {bits: 3, name: 'rd` / rs1`',   type: 7},
      {bits: 6, name: 'funct6', type: 8},
    ],
    cb: () => [
      {bits: 2, name: op},
      {bits: 5, name: 'offset', type: 3},
      {bits: 3, name: 'rd` / rs1`',   type: 7},
      {bits: 3, name: 'offset', type: 3},
      {bits: 3,  name: func3, type: 8},
    ],
    cj: () => [
      {bits: 2, name: op},
      {bits: 11, name: 'jump target', type: 3},
      {bits: 3,  name: func3, type: 8},
    ]
  };
};

module.exports = isaTypes;
