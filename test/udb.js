'use strict';

/* eslint camelcase: 0 */

const { expect } = require('chai');
const zlib = require('zlib');

const udbJoin = require('../lib/udb-join.js');
const { parseMatch } = require('../lib/get-udb.js');
const untar = require('../lib/untar.js');
const { createReport } = require('../lib/report.js');
const fromArgs = require('../lib/args-syntax.js');

const { parseLocation, fmtBitMap, udbBitMap, oursBitMap, fmtEnc } = udbJoin;

const enc = (match, variables = [], xlen = null) => ({xlen, ...parseMatch(match), match, variables});
const inst = (file, assembly, ...encodings) => ({name: file.split('/')[1], ext: file.split('/')[0],
  file: file + '.yaml', assembly, encodings});

// c.addi16sp from riscv-opcodes / UDB
const addi16sp = {kind: 'leaf', name: 'c.addi16sp', ...parseMatch('011-00010-----01'),
  args: ['c_nzimm10hi', 'c_nzimm10lo']};
const udbAddi16sp = inst('C/c.addi16sp', 'sp, imm', enc('011-00010-----01',
  [{name: 'imm', location: '12|4-3|5|2|6', left_shift: 4, not: 0, sign_extend: true}]));

const msgs = report => report.items.map(e => e.level + ': ' + (e.loc.file || '') + ' '
  + (e.loc.inst || '') + ': ' + e.msg);

describe('udb', () => {
  it('parseMatch', () => {
    expect(parseMatch('011-00010-----01')).to.deep.eq({len: 16, mask: 0xef83, valu: 0x6101});
    expect(parseMatch('0000000----------000-----0110011')).to.deep.eq({len: 32, mask: 0xfe00707f, valu: 0x33});
    expect(parseMatch('01x')).to.eq(undefined);
  });

  it('immediate bit maps', () => {
    expect(parseLocation('12|4-3|5|2|6')).to.deep.eq([12, 4, 3, 5, 2, 6]);
    const u = udbBitMap({location: '12|4-3|5|2|6', left_shift: 4});
    expect(fmtBitMap(u)).to.eq('12|4-3|5|2|6<<4');
    expect(fmtBitMap(oursBitMap(['c_nzimm10hi', 'c_nzimm10lo']))).to.eq('12|4-3|5|2|6<<4');
    expect(fmtBitMap(oursBitMap(['bimm12hi', 'bimm12lo']))).to.eq('31|7|30-25|11-8<<1');
    expect(fmtEnc(addi16sp)).to.eq('011-00010-----01');
  });

  it('join kinds, cross-check, variants', () => {
    const extos = [{name: 'rv_c', opcodes: [addi16sp]}, {name: 'rv_i', opcodes: [
      {kind: 'leaf', name: 'add', ...parseMatch('0000000----------000-----0110011'), args: ['rd', 'rs1', 'rs2']},
      {kind: 'pseudo', name: 'mv', ...parseMatch('000000000000-----000-----0010011'), args: ['rd', 'rs1']},
      {kind: 'leaf', name: 'sub', ...parseMatch('0100000----------000-----0110011'), args: ['rd', 'rs1', 'rs2']},
      {kind: 'leaf', name: 'foo', ...parseMatch('0000000----------111-----1111011'), args: ['rd', 'rs1', 'rs2']},
      {kind: 'import', ref: ['rv_c', 'c.addi16sp']}
    ]}, {name: 'rv_a', opcodes: [
      {kind: 'leaf', name: 'amoadd.w', ...parseMatch('00000------------010-----0101111'), args: ['rd', 'rs1', 'rs2', 'aq', 'rl']}
    ]}];
    const udb = [
      udbAddi16sp,
      inst('I/add', 'xd, xs1, xs2', enc('0000000----------000-----0110011')),
      inst('I/addi', 'xd, xs1, imm', enc('-----------------000-----0010011')),
      inst('I/sub', 'xd, xs1, xs2', enc('0100001----------000-----0110011')),
      inst('Zaamo/amoadd.w', 'xd, xs2, (xs1)', enc('0000000----------010-----0101111')),
      inst('Zaamo/amoadd.w.aq', 'xd, xs2, (xs1)', enc('0000010----------010-----0101111')),
      inst('X/bar', '', enc('1111111----------111-----1111011'))
    ];
    const report = createReport();
    const {syntax, counts} = udbJoin(extos, udb, report);
    expect(counts).to.deep.eq({exact: 2, specialized: 1, encoding: 1, missing: 1, subset: 1,
      'udb-variant': 1, 'udb-only': 1});
    expect(syntax['rv_c::c.addi16sp']).to.deep.eq({udb: 'C/c.addi16sp', asm: 'sp, imm',
      vars: udbAddi16sp.encodings[0].variables});
    expect(syntax['rv_i::mv'].udb).to.eq('I/addi');
    const {mask, valu} = parseMatch('0000010----------010-----0101111');
    expect(syntax['rv_a::amoadd.w'].variants).to.deep.eq([{udb: 'Zaamo/amoadd.w.aq', name: 'amoadd.w.aq', mask, valu}]);
    expect(msgs(report)).to.deep.eq([
      'info: rv_i mv -> I/addi: joined with UDB (specialized)',
      'warning: rv_i sub: encoding differs from UDB I/sub: riscv-opcodes 0100000----------000-----0110011, '
        + 'UDB 0100001----------000-----0110011',
      'info: rv_a amoadd.w -> Zaamo/amoadd.w: joined with UDB (subset)',
      'info: udb:X/bar.yaml bar: UDB instruction not in riscv-opcodes'
    ]);

    const r2 = createReport();
    const n = udbJoin.applyOverrides(extos, syntax, {
      'rv_i::foo': {reason: 'not in UDB', asm: 'xd, xs1, xs2'},
      'add': {reason: 'same', asm: 'xd, xs1, xs2'},
      'rv_i::nope': {asm: ''}
    }, r2);
    expect(n).to.eq(1);
    expect(syntax['rv_i::foo']).to.deep.eq({asm: 'xd, xs1, xs2', override: true});
    expect(udbJoin.checkMissing(extos, syntax, r2)).to.eq(0);
    expect(msgs(r2)).to.deep.eq([
      'warning: lib/syntax-overrides.js rv_i::add: override is redundant: same as UDB, remove it',
      'warning: lib/syntax-overrides.js rv_i::nope: override without reason',
      'warning: lib/syntax-overrides.js rv_i::nope: override is stale: no such opcode, remove it'
    ]);
  });

  it('override functions and rules', () => {
    const extos = [{name: 'rv_x', opcodes: [
      {kind: 'leaf', name: 'a', mask: 3, valu: 3, args: ['rd', 'rs1']},
      {kind: 'leaf', name: 'b', mask: 7, valu: 7, args: ['p_rd_p', 'rs1', 'p_w_uimm5']}
    ]}];
    const syntax = {'rv_x::a': {udb: 'X/a', asm: 'xd, xs1', vars: [{name: 'xd', location: '11-7', not: 0}]}};
    const report = createReport();
    const n = udbJoin.applyOverrides(extos, syntax, {
      'rv_x::a': {reason: 'hint', vars: vars => vars.map(({not, ...v}) => v)}, // eslint-disable-line no-unused-vars
      rules: [
        {reason: 'gen', file: /^rv_x$/, gen: fromArgs},
        {reason: 'none', file: 'rv_y', gen: fromArgs}
      ]
    }, report);
    expect(n).to.eq(2);
    expect(syntax['rv_x::a'].vars).to.deep.eq([{name: 'xd', location: '11-7'}]);
    expect(syntax['rv_x::b']).to.deep.eq({asm: 'xd, xs1, imm', override: 'rule', vars: [
      {name: 'xd', location: '11-8', left_shift: 1}, {name: 'xs1', location: '19-15'},
      {name: 'imm', location: '24-20'}]});
    expect(msgs(report)).to.deep.eq([
      'warning: lib/syntax-overrides.js rule: none: override rule is stale: matches nothing, remove it'
    ]);
  });

  it('fromArgs', () => {
    expect(fromArgs({name: 'vdot4a.vx', args: ['vd', 'rs1', 'vs2', 'vm']}).asm).to.eq('vd, vs2, xs1, vm');
    expect(fromArgs({name: 'beq', args: ['bimm12hi', 'rs1', 'rs2', 'bimm12lo']})).to.deep.eq({
      asm: 'xs1, xs2, imm', vars: [
        {name: 'imm', location: '31|7|30-25|11-8', left_shift: 1, sign_extend: true},
        {name: 'xs1', location: '19-15'}, {name: 'xs2', location: '24-20'}]});
    expect(() => fromArgs({name: 'x', args: ['nope']})).to.throw('unknown field nope');
  });

  it('untar', () => {
    const header = (name, size, type = '0') => {
      const h = Buffer.alloc(512);
      h.write(name, 0);
      h.write(size.toString(8).padStart(11, '0'), 124);
      h.write(type, 156);
      h.write('ustar', 257);
      return h;
    };
    const pad = (b) => Buffer.concat([b, Buffer.alloc((512 - (b.length % 512)) % 512)]);
    const long = 'r/spec/std/isa/inst/' + 'x'.repeat(120) + '.yaml';
    const pax = Buffer.from((long.length + 10) + ' path=' + long + '\n');
    const tar = Buffer.concat([
      header('r/a.txt', 2), pad(Buffer.from('hi')),
      header('PaxHeader', pax.length, 'x'), pad(pax),
      header('r/short', 3), pad(Buffer.from('abc')),
      Buffer.alloc(1024)
    ]);
    const files = untar(zlib.gzipSync(tar));
    expect(files.map(f => [f.path, f.data.toString()])).to.deep.eq([['r/a.txt', 'hi'], [long, 'abc']]);
    expect(untar(tar, p => p.endsWith('.yaml')).length).to.eq(1);
  });
});
