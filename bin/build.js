#!/usr/bin/env node
'use strict';

const { writeFile } = require('fs').promises;

const lib = require('../lib');

const flat = o => Object.keys(o)
  .reduce((res, key) => Object.assign(res, o[key]), {});

const width = 1012;

const c = lib.c;
const tabler16 = lib.tabler(16, width);

const pics = [
  // major RV opcodes
  ['rvAll-fmt', 'fmt', 'r i s sb u uj'],
  ['rv32i', 'inst32', `
    lui auipc
    jal jalr beq bne blt bge bltu bgeu
    lb lh lw lbu lhu sb sh sw
    addi slti sltiu xori ori andi
    slli srli srai
    add sub sll slt sltu xor srl sra or and
    fence
    ecall ebreak
  `],
  ['rv32i-fmt', 'fmt', 'r i s'],
  ['rv64i', 'inst32', `
    lwu ld sd
    slli srli srai
    addiw slliw srliw sraiw
    addw subw sllw srlw sraw
  `],
  ['Zifencei', 'inst32', 'fence.i'],
  ['Zicsr', 'inst32', `
    csrrw csrrs csrrc
    csrrwi csrrsi csrrci
  `],
  ['rv32m', 'inst32', `
    mul mulh mulhsu mulhu
    div divu rem remu
  `],
  ['rv64m', 'inst32', 'mulw divw divuw remw remuw'],
  ['rv64m-fmt', 'fmt', 'r'],
  ['rv32a', 'inst32', `
    lr.w sc.w
    amoswap.w
    amoadd.w amoxor.w amoand.w amoor.w
    amomin.w amomax.w amominu.w amomaxu.w
  `],
  ['rv64a', 'inst32', `
    lr.d sc.d
    amoswap.d
    amoadd.d amoxor.d amoand.d amoor.d
    amomin.d amomax.d amominu.d amomaxu.d
  `],
  ['rv32f-fmt', 'fmt', 'r r4 i s'],
  ['rv32f', 'inst32', `
    flw fsw
    fmadd.s fmsub.s fnmsub.s fnmadd.s
    fadd.s fsub.s fmul.s fdiv.s fsqrt.s
    fsgnj.s fsgnjn.s fsgnjx.s fmin.s fmax.s
    fcvt.w.s fcvt.wu.s fmv.x.w
    feq.s flt.s fle.s fclass.s
    fcvt.s.w fcvt.s.wu fmv.w.x
  `],
  ['rv64f', 'inst32', `
    fcvt.l.s fcvt.lu.s
    fcvt.s.l fcvt.s.lu
  `],
  ['rv32d-fmt', 'fmt', 'r r4 i s'],
  ['rv32d', 'inst32', `
    fld fsd
    fmadd.d fmsub.d fnmsub.d fnmadd.d
    fadd.d fsub.d fmul.d fdiv.d fsqrt.d
    fsgnj.d fsgnjn.d fsgnjx.d fmin.d fmax.d
    fcvt.s.d fcvt.d.s
    feq.d flt.d fle.d fclass.d
    fcvt.w.d fcvt.wu.d
    fcvt.d.w fcvt.d.wu
  `],
  ['rv64d', 'inst32', `
    fcvt.l.d fcvt.lu.d fmv.x.d
    fcvt.d.l fcvt.d.lu fmv.d.x
  `],
  ['rv32q-fmt', 'fmt', 'r r4 i s'],
  ['rv32q', 'inst32', `
    flq fsq
    fmadd.q fmsub.q fnmsub.q fnmadd.q
    fadd.q fsub.q fmul.q fdiv.q fsqrt.q
    fsgnj.q fsgnjn.q fsgnjx.q fmin.q fmax.q
    fcvt.s.q fcvt.q.s
    fcvt.d.q fcvt.q.d
    feq.q flt.q fle.q fclass.q
    fcvt.w.q fcvt.wu.q
    fcvt.q.w fcvt.q.wu
  `],
  ['rv64q', 'inst32', `
    fcvt.l.q fcvt.lu.q
    fcvt.q.l fcvt.q.lu
  `],
  ['rv32Zfh', 'inst32', `
    flh fsh

    fmadd.h fmsub.h   fnmadd.h fnmsub.h   fadd.h fsub.h

    fmul.h fdiv.h fsqrt.h fsgnj.h fsgnjn.h fsgnjx.h
    fmin.h fmax.h

    fcvt.s.h fcvt.d.h fcvt.q.h
    fcvt.h.s fcvt.h.d fcvt.h.q

    fmv.x.h

    feq.h flt.h fle.h fclass.h

    fcvt.w.h fcvt.wu.h
    fcvt.h.w fcvt.h.wu

    fmv.h.x
  `],
  ['rv64Zfh', 'inst32', `
    fcvt.l.h fcvt.lu.h
    fcvt.h.l fcvt.h.lu
  `],
  // C opcodes
  ['rv32c', 'inst16', tabler16(
    c.illegal,
    c.lw,
    c.sw,

    c.addi,
    c.jal,
    c.li,
    c.addi16sp,
    c.lui,
    c.srli, c.srai, c.andi, c.sub, c.xor, c.or, c.and,
    c.j,
    c.beqz, c.bnez,

    c.slli,
    c.lwsp,
    c.jr,
    c.mv, c.ebreak,
    c.jalr,
    c.add,
    c.swsp,
  )],
  ['rv64c', 'inst16', tabler16(
    c.illegal,
    c.lw, c.ld,
    c.sw, c.sd,

    c.addi, c.addiw,
    c.li,
    c.addi16sp,
    c.lui,
    c.srli, c.srai, c.andi, c.sub, c.xor, c.or, c.and, c.subw, c.addw,
    c.j,
    c.beqz, c.bnez,

    c.slli,
    c.lwsp, c.ldsp,
    c.jr,
    c.mv, c.ebreak,
    c.jalr,
    c.add,
    c.swsp, c.sdsp,
  )],
  ['rv32fc', 'inst16', tabler16(
    c.illegal,
    c.lw, c.flw,
    c.sw, c.fsw,

    c.addi,
    c.jal,
    c.li,
    c.addi16sp,
    c.lui,
    c.srli, c.srai, c.andi, c.sub, c.xor, c.or, c.and,
    c.j,
    c.beqz, c.bnez,

    c.slli,
    c.lwsp, c.flwsp,
    c.jr,
    c.mv, c.ebreak,
    c.jalr,
    c.add,
    c.swsp, c.fswsp,
  )],
  ['rv64fc', 'inst16', tabler16(
    c.illegal,
    c.lw, c.flw, c.ld,
    c.sw, c.fsw, c.sd,

    c.addi, c.addiw,
    c.li,
    c.addi16sp,
    c.lui,
    c.srli, c.srai, c.andi, c.sub, c.xor, c.or, c.and, c.subw, c.addw,
    c.j,
    c.beqz, c.bnez,

    c.slli,
    c.fldsp, c.lwsp, c.flwsp, c.ldsp,
    c.jr,
    c.mv, c.ebreak,
    c.jalr,
    c.add,
    c.swsp, c.fswsp, c.sdsp,
  )],
  ['rv32dc', 'inst16', tabler16(
    c.illegal,
    c.fld, c.lw,
    c.fsd, c.sw,

    c.addi,
    c.jal,
    c.li,
    c.addi16sp,
    c.lui,
    c.srli, c.srai, c.andi, c.sub, c.xor, c.or, c.and,
    c.j,
    c.beqz, c.bnez,

    c.slli,
    c.fldsp, c.lwsp,
    c.jr,
    c.mv, c.ebreak,
    c.jalr,
    c.add,
    c.fsdsp, c.swsp,
  )],
  ['rv64dc', 'inst16', tabler16(
    c.illegal,
    c.fld, c.lw, c.ld,
    c.fsd, c.sw, c.sd,

    c.addi, c.addiw,
    c.li,
    c.addi16sp,
    c.lui,
    c.srli, c.srai, c.andi, c.sub, c.xor, c.or, c.and, c.subw, c.addw,
    c.j,
    c.beqz, c.bnez,

    c.slli,
    c.fldsp, c.lwsp, c.ldsp,
    c.jr,
    c.mv, c.ebreak,
    c.jalr,
    c.add,
    c.fsdsp, c.swsp, c.sdsp,
  )]
];

const main = async () => {
  const opcodesAll = await lib.extractNode(lib.opcodes.ALL_OPCODES);
  const opcodesAllFlat = flat(opcodesAll);
  for (const pic of pics) {
    let svg;
    if (pic[1] === 'fmt') {
      svg = lib.printHeader(pic[2], width);
    } else
    if (pic[1] === 'inst32') {
      svg = lib.printInsts(pic[2], width, opcodesAll, opcodesAllFlat);
    } else
    if (pic[1] === 'inst16') {
      svg = pic[2];
    } else {
      throw new Error(pic);
    }
    await writeFile('assets/' + pic[0] + '.svg', svg);
  }
};

main();
