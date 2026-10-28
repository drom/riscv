'use strict';

const { expect } = require('chai');

const applyPatches = require('../lib/apply-patches.js');
const { createReport } = require('../lib/report.js');

const extos = () => [{name: 'rv32_zilsd', opcodes: [
  {kind: 'pseudo', ref: ['rv64_i', 'ld'], name: 'ld', mask: 1, valu: 1, args: ['rd_e', 'rs1', 'imm12']},
  {kind: 'pseudo', ref: ['rv64_i', 'ld'], name: 'ld', mask: 2, valu: 2, args: ['rs1', 'rs2_e', 'imm12hi', 'imm12lo']},
  {kind: 'import', ref: ['rv_i', 'add']}
]}, {name: 'rv32_zbb', opcodes: [
  {kind: 'leaf', name: 'rev8.rv32', mask: 3, valu: 3, args: ['rd', 'rs1']}
]}];

const msgs = report => report.items.map(e => e.level + ': ' + e.loc.inst + ': ' + e.msg);

describe('patches', () => {
  it('set by name + args, rename by RegExp', () => {
    const data = extos();
    const report = createReport();
    const applied = applyPatches(data, [
      {id: 'sd', class: 'U', upstream: 'https://example.com/1', file: 'rv32_zilsd',
        match: {name: 'ld', args: ['rs1', 'rs2_e', 'imm12hi', 'imm12lo']},
        set: {name: 'sd', ref: ['rv64_i', 'sd']}},
      {id: 'rv32', class: 'N', match: {name: /\.rv32$/}, rename: [/\.rv32$/, '']}
    ], report);
    expect(msgs(report)).to.deep.eq([]);
    expect(applied).to.deep.eq([{id: 'sd', class: 'U', count: 1}, {id: 'rv32', class: 'N', count: 1}]);
    expect(data[0].opcodes.map(o => o.name)).to.deep.eq(['ld', 'sd', undefined]);
    expect(data[0].opcodes[1].ref).to.deep.eq(['rv64_i', 'sd']);
    expect(data[1].opcodes[0].name).to.eq('rev8');
  });

  it('stale and malformed patches are reported', () => {
    const report = createReport();
    const applied = applyPatches(extos(), [
      {id: 'gone', class: 'U', upstream: 'x', match: {name: 'nope'}, set: {name: 'x'}},
      {id: 'same', class: 'N', match: {name: 'ld'}, set: {kind: 'pseudo'}},
      {id: 'nolink', class: 'U', file: /zbb/, set: op => ({name: op.name + '!'})},
      {id: 'nolink', class: 'N', set: {}},
      {id: 'bad', class: 'X', set: {}},
      {id: 'empty', class: 'N'}
    ], report);
    expect(applied).to.deep.eq([{id: 'nolink', class: 'U', count: 1}]);
    expect(msgs(report)).to.deep.eq([
      'warning: gone: patch is stale: target not found (fixed upstream?), remove it',
      'warning: same: patch is stale: no change (fixed upstream?), remove it',
      'warning: nolink: upstream bug patch without upstream issue / PR link',
      'error: nolink: duplicate patch id',
      'error: bad: patch class must be \'U\' or \'N\'',
      'error: empty: patch has neither set, rename, remove nor add'
    ]);
  });

  it('remove, add', () => {
    const data = extos();
    const report = createReport();
    const applied = applyPatches(data, [
      {id: 'rm', class: 'N', file: 'rv32_zilsd', match: {name: 'ld', mask: 2}, remove: true},
      {id: 'add', class: 'N', file: 'rv32_zbb', add: {name: 'x', mask: 7, valu: 7, args: []}},
      {id: 'add-stale', class: 'N', file: 'rv32_zbb', add: {name: 'rev8.rv32', mask: 7, valu: 7, args: []}},
      {id: 'add-bad', class: 'N', add: {name: 'y'}}
    ], report);
    expect(applied).to.deep.eq([{id: 'rm', class: 'N', count: 1}, {id: 'add', class: 'N', count: 1}]);
    expect(data[0].opcodes.map(o => o.name)).to.deep.eq(['ld', undefined]);
    expect(data[1].opcodes.map(o => o.name + ':' + o.kind)).to.deep.eq(['rev8.rv32:leaf', 'x:leaf']);
    expect(msgs(report)).to.deep.eq([
      'warning: add-stale: patch is stale: rev8.rv32 exists (fixed upstream?), remove it',
      'error: add-bad: add patch needs `file` name and no `match`'
    ]);
  });

  it('CSR patches', () => {
    const csrs = {all: {1: 'a', 2: 'b'}, rv32: {3: 'c'}};
    const report = createReport();
    const applied = applyPatches.applyCsrPatches(csrs, [
      {id: 'up', class: 'N', move: [3], from: 'rv32', to: 'all'},
      {id: 'down', class: 'U', upstream: 'x', move: [2], from: 'all', to: 'rv32'},
      {id: 'gone', class: 'N', move: [9], from: 'all', to: 'rv32'}
    ], report);
    expect(csrs).to.deep.eq({all: {1: 'a', 3: 'c'}, rv32: {2: 'b'}});
    expect(applied.map(p => p.id)).to.deep.eq(['up', 'down']);
    expect(msgs(report)).to.deep.eq(['warning: gone: patch is stale: no CSR moved (fixed upstream?), remove it']);
  });

  it('lib/patches.js is well formed', () => {
    const patches = require('../lib/patches.js');
    const ids = new Set();
    for (const p of [...patches, ...patches.csrs]) {
      expect(ids.has(p.id), p.id).to.eq(false);
      ids.add(p.id);
      expect(p.reason, p.id).to.be.a('string');
    }
  });
});
