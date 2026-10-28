'use strict';

// ISA option of the disassembler -> set of extension names -> riscv-opcodes files
//
//   isa: 'rv64gc_zba_zbb'        ISA string (xlen taken from opts.xlen)
//        ['m', 'a', 'zba']       list of extension names
//        'all'                   every extension file (conflicting encodings:
//                                more specific / earlier file wins)
//   base 'i' (+ privileged 'rv_s', 'rv_system') is always included

const extensions = require('./extensions.json');

// extension -> implied extensions (transitive)
const implies = {
  g: ['i', 'm', 'a', 'f', 'd', 'zicsr', 'zifencei'],
  b: ['zba', 'zbb', 'zbs'],
  a: ['zaamo', 'zalrsc'],
  f: ['zicsr'],
  d: ['f'],
  q: ['d'],
  zfh: ['zfhmin'],
  zfhmin: ['f'],
  zfa: ['f'],
  zfbfmin: ['f'],
  v: ['zicsr'],
  zk: ['zkn', 'zkr', 'zkt'],
  zkn: ['zbkb', 'zbkc', 'zbkx', 'zkne', 'zknd', 'zknh'],
  zks: ['zbkb', 'zbkc', 'zbkx', 'zksed', 'zksh'],
  zvkn: ['zvkned', 'zvknhb', 'zvkb', 'zvkt'],
  zvknc: ['zvkn', 'zvbc'],
  zvkng: ['zvkn', 'zvkg'],
  zvks: ['zvksed', 'zvksh', 'zvkb', 'zvkt'],
  zvksc: ['zvks', 'zvbc'],
  zvksg: ['zvks', 'zvkg'],
  zvbb: ['zvkb'],
  zcb: ['zca'],
  zcmp: ['zca'],
  zcmt: ['zca', 'zicsr'],
  zcmop: ['zca'],
  zce: ['zca', 'zcb', 'zcmp', 'zcmt'],
  zclsd: ['zca', 'zilsd'],
  zcd: ['zca', 'd'],
  zcf: ['zca', 'f'],
  zacas: ['zaamo'],
  zabha: ['zaamo'],
  zicfiss: ['zimop'],
  h: ['zicsr'],
  zicntr: ['zicsr'],
  zihpm: ['zicsr'],
  m: ['zmmul'],
  // riscv-opcodes rv_zicbo file: Zicbom, Zicboz, Zicbop (lib/patches.js `requires`)
  zicbom: ['zicbo'],
  zicboz: ['zicbo'],
  zicbop: ['zicbo']
};

const close = (names, xlen) => {
  const res = new Set(['i']);
  const add = (n) => {
    if (res.has(n)) return;
    res.add(n);
    (implies[n] || []).forEach(add);
  };
  names.forEach(n => add(String(n).toLowerCase()));
  (implies.i || []).forEach(add);
  // 'c' = Zca (+ Zcf on RV32 with F) (+ Zcd with D)
  if (res.has('c')) {
    add('zca');
    if (res.has('d')) add('zcd');
    if (xlen === 32 && res.has('f')) add('zcf');
  }
  // incompatible: Zclsd / Zcf (RV32), Zcmp / Zcmt / Zcd; the explicit one wins
  if (res.has('zclsd')) res.delete('zcf');
  if (res.has('zcmp') || res.has('zcmt')) res.delete('zcd');
  return res;
};

// 'rv64imac_zba_zbb2p0' -> ['i', 'm', 'a', 'c', 'zba', 'zbb']
const parseIsaString = (str) => {
  const s = String(str).toLowerCase().trim();
  const m = s.match(/^rv(32|64|128)?([a-z0-9_]*)$/);
  if (!m) throw new Error('invalid ISA string: ' + str);
  const res = [];
  m[2].split('_').filter(Boolean).forEach((chunk, idx) => {
    if (idx > 0 || /^[zsx]/.test(chunk)) {
      res.push(chunk.replace(/\d+(p\d+)?$/, ''));
      return;
    }
    // single letter extensions, optional versions: i2p1m2a
    for (const e of chunk.match(/[a-z](\d+(p\d+)?)?/g) || []) res.push(e[0]);
  });
  return res;
};

// riscv-opcodes file name -> required extensions (null: never, e.g. aliases)
//   rv_c_d -> ['zcd'], rv32_c_f -> ['zcf'], rv_c_zicfiss -> ['zca', 'zicfiss']
const base = new Set(['i', 's', 'system']);
const fileExts = (file) => {
  const parts = file.split('_').slice(1);
  if (parts.includes('aliases')) return null;
  if (parts[0] === 'c') {
    if (parts.length === 2 && parts[1] === 'd') return ['zcd'];
    if (parts.length === 2 && parts[1] === 'f') return ['zcf'];
    return ['zca', ...parts.slice(1)];
  }
  return parts.filter(p => !base.has(p));
};

const fileXlen = (file) => {
  const m = file.match(/^rv(32|64|128)?_/);
  return (m && m[1]) ? Number(m[1]) : undefined;
};

const isAll = (isa) => (isa === 'all' || isa === '*');

// -> Set of enabled extension names (null: all)
const isaSet = (isa, xlen) => {
  if (isAll(isa)) return null;
  const names = (isa === undefined) ? [] : Array.isArray(isa) ? isa : parseIsaString(isa);
  return close(names, xlen);
};

// -> list of enabled extension file names, in lib/extensions.json order
const isaFiles = (isa, xlen) => {
  const all = isAll(isa);
  const set = isaSet(isa, xlen);
  return extensions
    .map(e => e.name)
    .filter(file => {
      const fx = fileXlen(file);
      if (fx !== undefined && fx !== xlen) return false;
      const req = fileExts(file);
      if (req === null) return false;
      return all || req.every(r => set.has(r));
    });
};

module.exports = {isaFiles, isaSet, parseIsaString, fileExts, implies};
