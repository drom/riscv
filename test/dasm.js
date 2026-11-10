'use strict';

const { expect } = require('chai');

const dasm = require('../lib/dasm.js');
const decode = require('../lib/decode.js');
const { isaFiles, parseIsaString } = require('../lib/isa.js');

describe('dasm', () => {
  it('base ISA, LLVM no-aliases format', () => {
    expect(dasm(0x00a00513)).to.eq('addi a0, zero, 10');
    expect(dasm(0xfe000ee3, {xlen: 32})).to.eq('beq zero, zero, -4');
    expect(dasm(0x0000a503)).to.eq('lw a0, 0(ra)');
    expect(dasm(0x00b52023)).to.eq('sw a1, 0(a0)');
    expect(dasm(0x698e8c37, {xlen: 32})).to.eq('lui s8, 432360');
  });

  it('isa option', () => {
    expect(dasm(0x4501)).to.eq('.insn 0x4501'); // C not enabled
    expect(dasm(0x4501, {isa: 'rv64gc'})).to.eq('c.li a0, 0');
    expect(dasm(0x4501, {isa: ['c']})).to.eq('c.li a0, 0');
    expect(dasm(0x6b9c, {isa: 'rv32gc'})).to.eq('c.flw fa5, 16(a5)'); // xlen from ISA string
    expect(dasm(0x6b9c, {isa: 'rv64gc'})).to.eq('c.ld a5, 16(a5)');
    expect(dasm(0xc00495d3, {isa: 'rv64g'})).to.eq('fcvt.w.s a1, fs1, rtz');
    expect(dasm(0x0000a007, {isa: 'rv64g'})).to.eq('flw ft0, 0(ra)');
    expect(dasm(0x02b54557, {isa: 'rv64gcv'})).to.eq('vadd.vx v10, v11, a0');
    expect(dasm(0x00b54557, {isa: 'rv64gcv'})).to.eq('vadd.vx v10, v11, a0, v0.t');
    expect(dasm(0x0080f057, {isa: 'all'})).to.match(/^vsetvli/);
  });

  it('more specific encodings first', () => {
    // prefetch.i (Zicbop) is an ori with rd = 0
    expect(dasm(0x7605e013, {isa: 'rv64i_zicbop'})).to.eq('prefetch.i 1888(a1)');
    expect(dasm(0x7605e013)).to.eq('ori zero, a1, 1888');
    expect(dasm(0x7605e013, {isa: 'rv64i_zicbom'})).to.eq('ori zero, a1, 1888');
    expect(dasm(0x0013a00f, {isa: 'rv64i_zicbom'})).to.eq('cbo.clean (t2)');
    // c.addi16sp is a c.lui with rd = sp
    expect(dasm(0x7101, {isa: 'rv64gc'})).to.eq('c.addi16sp sp, -512');
    // Zcmp vs Zcd
    expect(dasm(0xb84a, {isa: 'rv32imac_zcmp'})).to.eq('cm.push {ra}, -48');
  });

  it('names: aq / rl, segments, .rv32, register specialized', () => {
    expect(dasm(0x140ba5af, {isa: 'rv64ia'})).to.eq('lr.w.aq a1, (s7)');
    expect(dasm(0x0752abaf, {isa: 'rv64ia'})).to.eq('amoadd.w.aqrl s7, s5, (t0)');
    expect(dasm(0xa2070d07, {isa: 'rv64gcv'})).to.eq('vlseg6e8.v v26, (a4)');
    expect(dasm(0x69835413, {xlen: 32, isa: ['zbb']})).to.eq('rev8 s0, t1');
    expect(dasm(0xce104073, {isa: ['zicfiss']})).to.eq('sspush ra');
  });

  it('immediates, implicit operands, formatters', () => {
    expect(dasm(0x1e01, {isa: ['c']})).to.eq('c.addi t3, -32');
    expect(dasm(0x7ee1, {isa: ['c']})).to.eq('c.lui t4, 1048568');
    expect(dasm(0x0b88, {isa: ['c']})).to.eq('c.addi4spn a0, sp, 464');
    expect(dasm(0x1cddf9d7, {isa: ['v']})).to.eq('vsetvli s3, s11, e16alt, mf8, ta, ma');
    expect(dasm(0x0a7d7857, {isa: ['v']})).to.eq('vsetvli a6, s10, 167');
    expect(dasm(0xf0148f53, {isa: ['zfa']})).to.eq('fli.s ft10, 0.3125');
    expect(dasm(0x0100000f)).to.eq('fence w, 0');
    expect(dasm(0xc8002873, {xlen: 32, isa: ['zicsr']})).to.eq('csrrs a6, cycleh, zero');
    expect(dasm(0x0eb0bb73, {isa: ['zicsr']})).to.eq('csrrc s6, 235, ra');
    expect(dasm(0xd20206d3, {isa: ['d']})).to.eq('fcvt.d.w fa3, tp');
    expect(dasm(0xbaf6, {xlen: 32, isa: ['zcmp']})).to.eq('cm.pop {ra, s0-s11}, 80');
    expect(dasm(0xbaf6, {isa: ['zcmp']})).to.eq('cm.pop {ra, s0-s11}, 128');
    expect(dasm(0x580d3563, {isa: ['zibi']})).to.eq('bnei s10, -1, 1418');
  });

  it('reserved encodings and unknown instructions', () => {
    expect(dasm(0x0000, {isa: ['c']})).to.eq('.insn 0x0000'); // c.addi4spn imm = 0
    expect(dasm(0x228d8087, {isa: ['v']})).to.eq('.insn 0x228d8087'); // vl2re8.v v1 misaligned
    expect(dasm(0x293e30af, {xlen: 32, isa: ['zacas']})).to.eq('.insn 0x293e30af'); // amocas.d odd pair
    expect(dasm(0x0000000b)).to.eq('.insn 0x0000000b');
    expect(dasm(0xffffffff)).to.eq('.insn 0xffffffff');
    expect(dasm(0x5dfab3d3, {isa: 'rv64gc'})).to.eq('.insn 0x5dfab3d3'); // rm = 5
  });
});

describe('decode', () => {
  it('result shape', () => {
    const d = decode(0x00a00513, {xlen: 32});
    expect(d.name).to.eq('addi');
    expect(d.ext).to.eq('rv_i');
    expect(d.len).to.eq(4);
    expect(d.ops.map(o => [o.kind, o.text])).to.deep.eq([['xreg', 'a0'], ['xreg', 'zero'], ['imm', '10']]);
  });

  it('instruction length', () => {
    expect(decode.instLength(0x4501)).to.eq(2);
    expect(decode.instLength(0x00000013)).to.eq(4);
    expect(decode.instLength(0x0000001f)).to.eq(6);
    expect(decode.instLength(0x0000003f)).to.eq(8);
    expect(decode.instLength(0x0000007f)).to.eq(0);
    expect(decode(0x0000001f)).to.include({name: '.insn', len: 6});
  });
});

describe('isa', () => {
  it('parseIsaString', () => {
    expect(parseIsaString('rv64gc_zba_zbb')).to.deep.eq(['g', 'c', 'zba', 'zbb']);
    expect(parseIsaString('RV32I2p1M2_Zicsr2p0')).to.deep.eq(['i', 'm', 'zicsr']);
    expect(() => parseIsaString('foo')).to.throw('invalid ISA string');
  });

  it('isaFiles', () => {
    expect(isaFiles(undefined, 32)).to.deep.eq(['rv32_i', 'rv_i', 'rv_s', 'rv_system']);
    const g = isaFiles('rv64gc', 64);
    expect(g).to.include.members(['rv64_c', 'rv_c_d', 'rv_d', 'rv_zicsr', 'rv_zifencei']);
    expect(g).to.not.include('rv32_c_f');
    expect(isaFiles('rv32gc', 32)).to.include('rv32_c_f');
    expect(isaFiles('rv32imafc_zclsd', 32)).to.not.include('rv32_c_f');
    expect(isaFiles(['zk'], 64)).to.include.members(['rv_zk', 'rv_zbkb', 'rv64_zkne']);
    expect(isaFiles('all', 64)).to.not.include('rv_v_aliases');
  });
});

describe('exports', () => {
  const riscv = require('../lib');

  it('ISA, decoder building blocks, CSR names', () => {
    for (const name of ['isaSet', 'implies', 'fileExts', 'isaFiles', 'parseIsaString',
      'candidates', 'buckets', 'bucketMask', 'varValue', 'parseLocation', 'vtype',
      'fliTable', 'csrNames', 'syntax', 'extensions', 'decode', 'dasm', 'instLength']) {
      expect(riscv[name], name).to.not.eq(undefined);
    }
    expect(riscv.isaSet('rv64gc', 64).has('zicsr')).to.eq(true);
    expect(riscv.isaSet('all', 64)).to.eq(null);
    expect(riscv.implies.g).to.include('d');
    expect(riscv.fileExts('rv_c_d')).to.deep.eq(['zcd']);
    expect(riscv.csrNames.all[0x300]).to.eq('mstatus');
    expect(riscv.csrNames.rv32[0xc80]).to.eq('cycleh');
    expect(riscv.vtype(0xd0)).to.eq('e32, m1, ta, ma');
    expect(riscv.fliTable).to.have.length(32);
    expect(riscv.parseLocation('12|4-3')).to.deep.eq([12, 4, 3]);
    expect(riscv.bucketMask(2)).to.eq(0xe003);
  });

  it('candidates: order, no duplicates, consistent with decode', () => {
    for (const xlen of [32, 64]) {
      const cands = riscv.candidates(xlen, 'all');
      const ids = new Set();
      cands.forEach((c, i) => {
        const id = c.name + ':' + c.mask + ':' + c.valu;
        expect(ids.has(id), id).to.eq(false);
        ids.add(id);
        expect(c.op.alias, c.key).to.not.eq(true);
        if (i) expect(cands[i - 1].pop >= c.pop).to.eq(true);
      });
      // every candidate is in the bucket of its own encoding
      const b = riscv.buckets(cands);
      for (const c of cands.slice(0, 200)) {
        const bucket = b[c.len].get((c.valu & riscv.bucketMask(c.len)) >>> 0);
        expect(bucket, c.key).to.include(c);
      }
    }
    expect(riscv.candidates(64, 'rv64i').map(c => c.name)).to.include('addi');
  });
});

describe('embedded vector subsets (Zve*)', () => {
  const riscv = require('../lib');
  const op = (name) => riscv.extensions.find(e => e.name === 'rv_v').opcodes.find(o => o.name === name).valu;
  const d = (name, isa) => dasm(op(name), {isa}).split(' ')[0];
  // vsetvli a0, a1, e64, m1, ta, ma
  const vsetvli = ((0xd8 << 20) | (11 << 15) | (7 << 12) | (10 << 7) | 0x57) >>> 0;

  it('implications, ELEN', () => {
    const set = riscv.isaSet('rv32imac_zve32x', 32);
    expect([...set]).to.include.members(['zve32x', 'zicsr', 'zvl32b']);
    expect(set.has('zve32f')).to.eq(false);
    expect([...riscv.isaSet('rv64gcv', 64)]).to.include.members(['zve64d', 'zve64f', 'zve64x', 'zve32f', 'zvl128b', 'zvl32b']);
    expect(riscv.isaFiles('rv32imac_zve32x', 32)).to.include('rv_v');
    expect(riscv.fileExts('rv_v')).to.deep.eq(['zve32x']);
    const { elen } = require('../lib/isa.js');
    expect(elen(riscv.isaSet('rv32imac_zve32x', 32))).to.eq(32);
    expect(elen(riscv.isaSet('rv32imac_zve64x', 32))).to.eq(64);
    expect(elen(riscv.isaSet('rv64gcv', 64))).to.eq(64);
    expect(elen(riscv.isaSet('rv64gc', 64))).to.eq(0);
  });

  it('integer instructions decode, EEW=64 load / store reserved without ELEN=64', () => {
    expect(d('vadd.vv', 'rv32imac_zve32x')).to.eq('vadd.vv');
    for (const name of ['vle64.v', 'vse64.v', 'vlse64.v', 'vle64ff.v', 'vl1re64.v', 'vluxei64.v', 'vsoxei64.v']) {
      expect(d(name, 'rv32imac_zve32x'), name).to.eq('.insn');
      expect(d(name, 'rv64imac_zve64x'), name).to.eq(name);
      expect(d(name, 'rv64gcv'), name).to.eq(name);
    }
    expect(d('vle32.v', 'rv32imac_zve32x')).to.eq('vle32.v');
    expect(d('vluxei64.v', 'rv32imac_zve64x')).to.eq('.insn'); // XLEN=32
  });

  it('vector FP needs Zve32f', () => {
    expect(d('vfadd.vv', 'rv32imac_zve32x')).to.eq('.insn');
    expect(d('vmfeq.vv', 'rv64imac_zve64x')).to.eq('.insn');
    expect(d('vfadd.vv', 'rv32imafc_zve32f')).to.eq('vfadd.vv');
    expect(d('vfadd.vv', 'rv64gcv')).to.eq('vfadd.vv');
    expect(d('vfirst.m', 'rv32imac_zve32x')).to.eq('vfirst.m');
  });

  it('vtype dependent legality is a runtime property (vill), not reserved', () => {
    expect(dasm(vsetvli, {isa: 'rv32imac_zve32x'})).to.eq('vsetvli a0, a1, e64, m1, ta, ma');
  });
});
