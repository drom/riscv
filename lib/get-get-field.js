'use strict';

const fieldo = require('./fieldo.js');
const { throwingReport, fmtBits } = require('./report.js');

const bitMask = (msb, lsb) => (((2 ** (msb - lsb + 1)) - 1) * (2 ** lsb)) >>> 0;

const unknownFieldMsg = (name, lut) => {
  const l = lut && lut[name];
  return 'unknown field \'' + name + '\'' + (l
    ? '; arg_lut.csv has bits ' + l.msb + '..' + l.lsb
      + ' -> add to lib/fieldo.js: ' + name + ': {msb: ' + l.msb + ', lsb: ' + l.lsb + '}'
    : '; not in arg_lut.csv (check upstream src/riscv_opcodes/constants.py)');
};

// args: tokens after instruction name, e.g. ['rd', 'rs1', '14..12=0', '6..2=0x04', '1..0=3']
const getGetField = (namedFieldo, report = throwingReport, lut) => (args, loc) => {
  let mask = 0;
  let valu = 0;
  let fullMask = 0;
  const names = [];
  let broken = false; // skip coverage check after an error

  const cover = (msb, lsb, what) => {
    const m = bitMask(msb, lsb);
    if (fullMask & m) {
      report.error(what + ' overlaps already defined bits ' + fmtBits(fullMask & m), loc);
    }
    fullMask = (fullMask | m) >>> 0;
    return m;
  };

  for (const arg of args) {
    // fixed bits: "6..2=0x04" or "25=1"
    const m = arg.match(/^(\d+)(?:\.\.(\d+))?=(\S+)$/);
    if (m) {
      const msb = Number(m[1]);
      const lsb = (m[2] === undefined) ? msb : Number(m[2]);
      const val = Number(m[3]);
      if (msb > 31 || msb < lsb) {
        report.error('bad bit range \'' + arg + '\'', loc);
        broken = true;
        continue;
      }
      if (!Number.isInteger(val) || val < 0 || val >= 2 ** (msb - lsb + 1)) {
        report.error('bad value in \'' + arg + '\'', loc);
        broken = true;
        continue;
      }
      mask = (mask | cover(msb, lsb, '\'' + arg + '\'')) >>> 0;
      valu = (valu | (val * (2 ** lsb))) >>> 0;
      continue;
    }
    // named field, optionally with constraint: "rs2=rs1"
    const name = arg.split('=')[0];
    const f = fieldo[name];
    if (f === undefined) {
      report.error(unknownFieldMsg(name, lut), loc);
      broken = true;
      continue;
    }
    if (namedFieldo) {
      namedFieldo[name] = (namedFieldo[name] || 0) + 1;
    }
    cover(f.msb, f.lsb, 'field \'' + name + '\'');
    names.push(name);
  }

  // check that fixed bits + fields cover the whole instruction
  if (args.length > 0 && !broken) {
    const full = ((valu & 3) === 3) ? 0xffffffff : 0xffff;
    const missing = (full & ~fullMask) >>> 0;
    if (missing) {
      report.warn('bits ' + fmtBits(missing) + ' not covered by fixed bits or fields', loc);
    }
  }

  const sorted = names
    .map(val => ({val, prio: (fieldo[val].prio === undefined) ? 999 : fieldo[val].prio}))
    .sort((a, b) => a.prio - b.prio)
    .map(e => e.val);

  return {mask, valu, args: sorted};
};

module.exports = getGetField;
