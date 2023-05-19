'use strict';

const lib = require('./lib');

const width = 1012;

const c = lib.c;
const v = lib.v;

const tabler16 = lib.tabler(16, width);
const tabler32 = lib.tabler(32, width);

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
  ['rv32c', 'inst', tabler16(
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
    c.swsp
  )],
  ['rv64c', 'inst', tabler16(
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
    c.swsp, c.sdsp
  )],
  ['rv32fc', 'inst', tabler16(
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
    c.swsp, c.fswsp
  )],
  ['rv64fc', 'inst', tabler16(
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
    c.swsp, c.fswsp, c.sdsp
  )],
  ['rv32dc', 'inst', tabler16(
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
    c.fsdsp, c.swsp
  )],
  ['rv64dc', 'inst', tabler16(
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
    c.fsdsp, c.swsp, c.sdsp
  )],
  // RVV
  ['rvv-6',   'inst', tabler32(v.rvv_6)],
  ['rvv-7-4', 'inst', tabler32(v.rvv_7_4)],
  ['rvv-7-5', 'inst', tabler32(v.rvv_7_5)],
  ['rvv-7-6', 'inst', tabler32(v.rvv_7_6)],
  ['rvv-7-7', 'inst', tabler32(v.rvv_7_7)],
  ['rvv-7-8-1-1', 'inst', tabler32(v.rvv_7_8_1_1)],
  ['rvv-7-8-1-2', 'inst', tabler32(v.rvv_7_8_1_2)],
  ['rvv-7-8-2-1', 'inst', tabler32(v.rvv_7_8_2_1)],
  ['rvv-7-8-2-2', 'inst', tabler32(v.rvv_7_8_2_2)],
  ['rvv-7-8-3-1', 'inst', tabler32(v.rvv_7_8_3_1)],
  ['rvv-7-8-3-2', 'inst', tabler32(v.rvv_7_8_3_2)],
  ['rvv-7-8-3-3', 'inst', tabler32(v.rvv_7_8_3_3)],
  ['rvv-7-8-3-4', 'inst', tabler32(v.rvv_7_8_3_4)],
  ['rvv-7-8-3-5', 'inst', tabler32(v.rvv_7_8_3_5)],

  // ['rvv-7-9', 'inst32',
  // // Vector Load/Store Whole Registers
  // // https://github.com/riscv/riscv-v-spec/blob/master/v-spec.adoc#79-vector-loadstore-whole-register-instructions
  //   (Object.keys(opcodesAll.rvv).filter(e => e.match(/vl(\d+)re(\d+).v/) || e.match(/vs(\d+)r.v/)))
  // ],

  ['rvv-11-1', 'inst32', `
    vadd.vv vadd.vx vadd.vi
    vsub.vv vsub.vx
    vrsub.vx vrsub.vi
  `],
  ['rvv-11-2', 'inst32', `
    vwaddu.vv vwaddu.vx vwsubu.vv vwsubu.vx
    vwadd.vv vwadd.vx vwsub.vv vwsub.vx
    vwaddu.wv vwaddu.wx vwsubu.wv vwsubu.wx
    vwadd.wv vwadd.wx vwsub.wv vwsub.wx
  `],
  ['rvv-11-3', 'inst32', `
  vzext.vf2 vsext.vf2
  vzext.vf4 vsext.vf4
  vzext.vf8 vsext.vf8
  `],
  ['rvv-11-4', 'inst32', `
  vadc.vvm vadc.vxm vadc.vim
  vmadc.vvm vmadc.vxm vmadc.vim

  vsbc.vvm vsbc.vxm

  vmsbc.vvm
  vmsbc.vxm

  `
  /*
  vmadc.vv
  vmadc.vx
  vmadc.vi

  vmsbc.vv
  vmsbc.vx
  */],
  ['rvv-11-5', 'inst32', `
  vand.vv vand.vx vand.vi
  vor.vv vor.vx vor.vi
  vxor.vv vxor.vx vxor.vi
  `],
  ['rvv-11-6', 'inst32', `
  vsll.vv vsll.vx vsll.vi
  vsrl.vv vsrl.vx vsrl.vi
  vsra.vv vsra.vx vsra.vi
  `],

  ['rvv-11-7', 'inst32', `
  vnsrl.wv vnsrl.wx vnsrl.wi
  vnsra.wv vnsra.wx vnsra.wi
  `],

  ['rvv-11-8', 'inst32', `
  vmseq.vv vmseq.vx vmseq.vi
  vmsne.vv vmsne.vx vmsne.vi
  vmsltu.vv vmsltu.vx
  vmslt.vv vmslt.vx
  vmsleu.vv vmsleu.vx vmsleu.vi
  vmsle.vv vmsle.vx vmsle.vi
  vmsgtu.vx vmsgtu.vi
  vmsgt.vx vmsgt.vi
  `
  /*
  vmsgeu.vx
  vmsge.vx
  */],
  ['rvv-11-9', 'inst32', `
  vminu.vv vminu.vx
  vmin.vv vmin.vx
  vmaxu.vv vmaxu.vx
  vmax.vv vmax.vx
  `],
  ['rvv-11-10', 'inst32', `
  vmul.vv vmul.vx
  vmulh.vv vmulh.vx
  vmulhu.vv vmulhu.vx
  vmulhsu.vv vmulhsu.vx
  `],
  ['rvv-11-11', 'inst32', `
  vdivu.vv vdivu.vx
  vdiv.vv vdiv.vx
  vremu.vv vremu.vx
  vrem.vv vrem.vx
  `],
  ['rvv-11-12', 'inst32', `
  vwmul.vv vwmul.vx
  vwmulu.vv vwmulu.vx
  vwmulsu.vv vwmulsu.vx
  `],
  ['rvv-11-13', 'inst32', `
  vmacc.vv vmacc.vx
  vnmsac.vv vnmsac.vx
  vmadd.vv vmadd.vx
  vnmsub.vv vnmsub.vx
  `],
  ['rvv-11-14', 'inst32', `
  vwmaccu.vv vwmaccu.vx
  vwmacc.vv vwmacc.vx
  vwmaccsu.vv vwmaccsu.vx
  vwmaccus.vx
  `],
  ['rvv-11-15', 'inst32', 'vmerge.vvm vmerge.vxm vmerge.vim'],
  ['rvv-11-16', 'inst32', 'vmv.v.v vmv.v.x vmv.v.i'],
  ['rvv-12-1', 'inst32', `
  vsaddu.vv vsaddu.vx vsaddu.vi
  vsadd.vv vsadd.vx vsadd.vi
  vssubu.vv vssubu.vx
  vssub.vv vssub.vx
  `],
  ['rvv-12-2', 'inst32', `
  vaaddu.vv vaaddu.vx
  vaadd.vv vaadd.vx
  vasubu.vv vasubu.vx
  vasub.vv vasub.vx
  `],
  ['rvv-12-3', 'inst32', 'vsmul.vv vsmul.vx'],
  ['rvv-12-4', 'inst32', `
  vssrl.vv vssrl.vx vssrl.vi
  vssra.vv vssra.vx vssra.vi
  `],
  ['rvv-12-5', 'inst32', `
  vnclipu.wv vnclipu.wx vnclipu.wi
  vnclip.wv vnclip.wx vnclip.wi
  `],
  ['rvv-13-2', 'inst32', `
  vfadd.vv vfadd.vf
  vfsub.vv vfsub.vf vfrsub.vf
  `],
  ['rvv-13-3', 'inst32', `
  vfwadd.vv vfwadd.vf vfwsub.vv vfwsub.vf
  vfwadd.wv vfwadd.wf vfwsub.wv vfwsub.wf
  `],
  ['rvv-13-4', 'inst32', `
  vfmul.vv vfmul.vf
  vfdiv.vv vfdiv.vf
  vfrdiv.vf
  `],
  ['rvv-13-5', 'inst32', 'vfwmul.vv vfwmul.vf'],
  ['rvv-13-6', 'inst32', `
  vfmacc.vv vfmacc.vf
  vfnmacc.vv vfnmacc.vf
  vfmsac.vv vfmsac.vf
  vfnmsac.vv vfnmsac.vf
  vfmadd.vv vfmadd.vf
  vfnmadd.vv vfnmadd.vf
  vfmsub.vv vfmsub.vf
  vfnmsub.vv vfnmsub.vf
  `],
  ['rvv-13-7', 'inst32', `
  vfwmacc.vv vfwmacc.vf
  vfwnmacc.vv vfwnmacc.vf
  vfwmsac.vv vfwmsac.vf
  vfwnmsac.vv vfwnmsac.vf
  `],
  ['rvv-13-8', 'inst32', `
  vfsqrt.v
  vfrsqrt7.v
  vfrec7.v
  `],
  ['rvv-13-11', 'inst32', `
  vfmin.vv vfmin.vf
  vfmax.vv vfmax.vf
  `],
  ['rvv-13-12', 'inst32', `
  vfsgnj.vv vfsgnj.vf
  vfsgnjn.vv vfsgnjn.vf
  vfsgnjx.vv vfsgnjx.vf
  `],
  ['rvv-13-13', 'inst32', `
  vmfeq.vv vmfeq.vf
  vmfne.vv vmfne.vf
  vmflt.vv vmflt.vf
  vmfle.vv vmfle.vf
  vmfgt.vf
  vmfge.vf
  `],
  ['rvv-13-16', 'inst32', `
  vfclass.v
  vfmerge.vfm
  vfmv.v.f
  `],
  ['rvv-13-17', 'inst32', `
  vfcvt.xu.f.v
  vfcvt.x.f.v
  vfcvt.rtz.xu.f.v
  vfcvt.rtz.x.f.v
  vfcvt.f.xu.v
  vfcvt.f.x.v
  `],
  ['rvv-13-18', 'inst32', `
  vfwcvt.xu.f.v
  vfwcvt.x.f.v
  vfwcvt.rtz.xu.f.v
  vfwcvt.rtz.x.f.v
  vfwcvt.f.xu.v
  vfwcvt.f.x.v
  vfwcvt.f.f.v
  `],
  ['rvv-13-19', 'inst32', `
  vfncvt.xu.f.w
  vfncvt.x.f.w
  vfncvt.rtz.xu.f.w
  vfncvt.rtz.x.f.w
  vfncvt.f.xu.w
  vfncvt.f.x.w
  vfncvt.f.f.w
  vfncvt.rod.f.f.w
  `]
];

module.exports = pics;
