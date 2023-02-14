'use strict';

const range = require('lodash.range');

const _ = {range};

const pusher = (label, fields) => (accLabels, accFields, opo) => {
  opo[label] = fields;
  accLabels.push(label);
  accFields.push(...fields);
};

const f = ({
  // C0
  cl: ({imm, rd, rs1, funct3}) => [
    {bits: 2, name: 0},
    {bits: 3, name: (rd === undefined) ? 'rd`' : rd,  type: 2},
    ..._.range(2).map(i => ({bits: 1, name: '[' + parseInt(imm[4 - i], 32) + ']', type: 3})),
    {bits: 3, name: (rs1 === undefined) ? 'rs1`' : rs1, type: (typeof rs1 === 'string') ? 4 : undefined},
    ..._.range(3).map(i => ({bits: 1, name: '[' + parseInt(imm[2 - i], 32) + ']', type: 3})),
    {bits: 3, name: (funct3 === undefined) ? 'funct3' : funct3}
  ],
  cs: ({imm, rs2, rs1, funct3}) => [
    {bits: 2, name: 0},
    {bits: 3, name: (rs2 === undefined) ? 'rs2`' : rs2, type: (typeof rs2 === 'string') ? 4 : undefined},
    ..._.range(2).map(i => ({bits: 1, name: '[' + parseInt(imm[4 - i], 32) + ']', type: 3})),
    {bits: 3, name: (rs1 === undefined) ? 'rs1`' : rs1, type: (typeof rs1 === 'string') ? 4 : undefined},
    ..._.range(3).map(i => ({bits: 1, name: '[' + parseInt(imm[2 - i], 32) + ']', type: 3})),
    {bits: 3, name: (funct3 === undefined) ? 'funct3' : funct3}
  ],
  ciw: ({imm, /*  rd, */ funct3}) => [
    {bits: 2, name: 0},
    ..._.range(8).map(i => ({bits: 1, name: '[' + parseInt(imm[5 - i], 32) + ']', type: 3})),
    {bits: 3, name: (funct3 === undefined) ? 'funct3' : funct3}
  ],
  // C1
  cj: ({imm, funct3}) => [
    {bits: 2, name: 1},
    ..._.range(11).map(i => ({bits: 1, name: '[' + parseInt(imm[10 - i], 32) + ']', type: 3})),
    {bits: 3, name: (funct3 === undefined) ? 'funct3' : funct3}
  ],
  cb: ({imm, rs1, funct3}) => [
    {bits: 2, name: 1},
    ..._.range(5).map(i => ({bits: 1, name: '[' + parseInt(imm[7 - i], 32) + ']', type: 3})),
    {bits: 3, name: (rs1 === undefined) ? 'rs1' : rs1, type: (typeof rs1 === 'string') ? 4 : undefined},
    ..._.range(3).map(i => ({bits: 1, name: '[' + parseInt(imm[2 - i], 32) + ']', type: 3})),
    {bits: 3, name: (funct3 === undefined) ? 'funct3' : funct3}
  ],
  cbs: ({imm, rs1, funct2, funct3}) => [
    {bits: 2, name: 1},
    ..._.range(5).map(i => ({bits: 1, name: '[' + parseInt(imm[5 - i], 32) + ']', type: 3})),
    {bits: 3, name: (rs1 === undefined) ? 'rs1' : rs1, type: (typeof rs1 === 'string') ? 7 : undefined},
    {bits: 2, name: (funct2 === undefined) ? 'funct2' : funct2},
    {bits: 1, name: '[' + parseInt(imm[0], 32) + ']', type: 3},
    {bits: 3, name: (funct3 === undefined) ? 'funct3' : funct3}
  ],
  ca: ({rs1, rs2, funct2, funct6}) => [
    {bits: 2, name: 1},
    {bits: 3, name: (rs2 === undefined) ? 'rs2`' : rs2, type: (typeof rs2 === 'string') ? 4 : undefined},
    {bits: 2, name: (funct2 === undefined) ? 'funct2' : funct2},
    {bits: 3, name: (rs1 === undefined) ? 'rs1`' : rs1, type: (typeof rs1 === 'string') ? 7 : undefined},
    {bits: 6, name: (funct6 === undefined) ? 'funct6' : funct6}
  ],
  // C2
  css: ({imm, rs2, funct3}) => [
    {bits: 2, name: 2},
    {bits: 5, name: (rs2 === undefined) ? 'rs2' : rs2, type: (typeof rs2 === 'string') ? 4 : undefined},
    ..._.range(6).map(i => ({bits: 1, name: '[' + parseInt(imm[5 - i], 32) + ']', type: 3})),
    {bits: 3, name: (funct3 === undefined) ? 'funct3' : funct3}
  ],
  cr: ({rs1, rs2, funct4, rs1type}) => [
    {bits: 2, name: 2},
    {bits: 5, name: (rs2 === undefined) ? 'rs2' : rs2, type: (typeof rs2 === 'string') ? 4 : undefined},
    {bits: 5, name: (rs1 === undefined) ? 'rs1' : rs1, type: rs1type || ((typeof rs1 === 'string') ? 4 : undefined)},
    {bits: 4, name: (funct4 === undefined) ? 'funct4' : funct4}
  ],
  // C?
  ci: ({imm, rd, funct3, op, rdtype}) => [
    {bits: 2, name: op},
    ..._.range(5).map(i => ({bits: 1, name: '[' + parseInt(imm[5 - i], 32) + ']', type: 3})),
    {bits: 5, name: (rd === undefined) ? 'rd' : rd, type: rdtype || ((typeof rd === 'string') ? 2 : undefined)},
    {bits: 1, name: '[' + parseInt(imm[0], 32) + ']', type: 3},
    {bits: 3, name: (funct3 === undefined) ? 'funct3' : funct3}
  ],
});

const c = ({
  illegal: (l, f) => { l.push('illegal'); f.push({bits: 16, name: 0}); },
  ebreak:  (l, f) => { l.push('C.EBREAK'); f.push({bits: 16, name: 0x9002}); },

  // Stack-Pointer-Based Loads
  lwsp:   pusher('C.LWSP',  f.ci({op: 2, imm: '543276', rd: 'rd ≠ 0', funct3: 2})),
  ldsp:   pusher('C.LDSP',  f.ci({op: 2, imm: '543876', rd: 'rd ≠ 0', funct3: 3})),
  lqsp:   pusher('C.LQSP',  f.ci({op: 2, imm: '549876', rd: 'rd ≠ 0', funct3: 1})),
  flwsp:  pusher('C.FLWSP', f.ci({op: 2, imm: '543276', rd: 'dest', funct3: 3})),
  fldsp:  pusher('C.FLDSP', f.ci({op: 2, imm: '543876', rd: 'dest', funct3: 1})),

  // Stack-Pointer-Based Stores
  swsp:   pusher('C.SWSP',  f.css({imm: '543276', rs2: 'src', funct3: 6})),
  sdsp:   pusher('C.SDSP',  f.css({imm: '543876', rs2: 'src', funct3: 7})),
  sqsp:   pusher('C.SQSP',  f.css({imm: '549876', rs2: 'src', funct3: 5})),
  fswsp:  pusher('C.FSWSP', f.css({imm: '543276', rs2: 'src', funct3: 7})),
  fsdsp:  pusher('C.FSDSP', f.css({imm: '543876', rs2: 'src', funct3: 5})),

  // Register-Based Loads
  lw:     pusher('C.LW',    f.cl({imm: '54326', rd: 'dest', rs1: 'base', funct3: 2})),
  ld:     pusher('C.LD',    f.cl({imm: '54376', rd: 'dest', rs1: 'base', funct3: 3})),
  lq:     pusher('C.LQ',    f.cl({imm: '54876', rd: 'dest', rs1: 'base', funct3: 0})),
  flw:    pusher('C.FLW',   f.cl({imm: '54326', rd: 'dest', rs1: 'base', funct3: 3})),
  fld:    pusher('C.FLD',   f.cl({imm: '54376', rd: 'dest', rs1: 'base', funct3: 1})),

  // Register-Based Stores
  sw:     pusher('C.SW',    f.cs({imm: '54326', rs2: 'src', rs1: 'base', funct3: 6})),
  sd:     pusher('C.SD',    f.cs({imm: '54376', rs2: 'src', rs1: 'base', funct3: 7})),
  sq:     pusher('C.SQ',    f.cs({imm: '54876', rs2: 'src', rs1: 'base', funct3: 5})),
  fsw:    pusher('C.FSW',   f.cs({imm: '54326', rs2: 'src', rs1: 'base', funct3: 7})),
  fsd:    pusher('C.FSD',   f.cs({imm: '54376', rs2: 'src', rs1: 'base', funct3: 5})),

  // Control Transfer Instructions
  j:      pusher('C.J',     f.cj({imm: 'b498a673215', funct3: 5})),
  jal:    pusher('C.JAL',   f.cj({imm: 'b498a673215', funct3: 1})),
  jr:     pusher('C.JR',    f.cr({rs1: 'src ≠ 0', rs2: 0, funct4: 8})),
  jalr:   pusher('C.JALR',  f.cr({rs1: 'src ≠ 0', rs2: 0, funct4: 9})),
  beqz:   pusher('C.BEQZ',  f.cb({imm: '84376215', rs1: 'src', funct3: 6})),
  bnez:   pusher('C.BNEZ',  f.cb({imm: '84376215', rs1: 'src', funct3: 7})),

  // Integer Constant-Generation Instructions
  li:     pusher('C.LI',    f.ci({op: 1, imm: '543210', rd: 'dest ≠ 0', funct3: 2})),
  lui:    pusher('C.LUI',   f.ci({op: 1, imm: 'hgfedc', rd: 'dest ≠ {0, 2}', funct3: 3})),

  // Integer Register-Immediate Operations
  addi:   pusher('C.ADDI',  f.ci({op: 1, imm: '543210', rd: 'dest ≠ 0', funct3: 0, rdtype: 7})),
  addiw:  pusher('C.ADDIW',  f.ci({op: 1, imm: '543210', rd: 'dest ≠ 0', funct3: 1, rdtype: 7})),
  addi16sp: pusher('C.ADDI16SP', f.ci({op: 1, imm: '946875', rd: 2, funct3: 3})),
  addi4spn: pusher('C.ADDI4SPN', f.ciw({imm: '54987623', rd: 'dest', funct3: 0})),

  slli:   pusher('C.SLLI', f.ci({op: 2, imm: '543210', rd: 'dest ≠ 0', funct3: 0, rdtype: 7})),

  srli:   pusher('C.SRLI', f.cbs({imm: '543210', rs1: 'dest',   funct2: 0, funct3: 4})),
  srai:   pusher('C.SRAI', f.cbs({imm: '543210', rs1: 'dest ≠ 0', funct2: 1, funct3: 4})),
  andi:   pusher('C.ANDI', f.cbs({imm: '543210', rs1: 'dest', funct2: 2, funct3: 4})),

  mv:     pusher('C.MV',    f.cr({rs1: 'dest ≠ 0', rs2: 'src ≠ 0', funct4: 8})),
  add:    pusher('C.ADD',   f.cr({rs1: 'dest ≠ 0', rs2: 'src ≠ 0', funct4: 9, rs1type: 7})),

  and:    pusher('C.AND',   f.ca({rs1: 'dest', rs2: 'src', funct2: 3, funct6: 35})),
  or:     pusher('C.OR',    f.ca({rs1: 'dest', rs2: 'src', funct2: 2, funct6: 35})),
  xor:    pusher('C.XOR',   f.ca({rs1: 'dest', rs2: 'src', funct2: 1, funct6: 35})),
  sub:    pusher('C.SUB',   f.ca({rs1: 'dest', rs2: 'src', funct2: 0, funct6: 35})),
  addw:   pusher('C.ADDW',  f.ca({rs1: 'dest', rs2: 'src', funct2: 0, funct6: 39})), // OPCODES?
  subw:   pusher('C.SUBW',  f.ca({rs1: 'dest', rs2: 'src', funct2: 0, funct6: 39})), // OPCODES?

});

module.exports = c;
