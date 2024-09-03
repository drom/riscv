'use strict';

const fieldo = require('./fieldo.js');

const getGetField = ( /* namedFieldo */ ) => args => {
  const args1 = args.map(arg => {
    {
      const m = arg.match(/^(?<bit>\d+)=(?<val>((\d+)|(0x[0-9a-fA-F]+)|(0b[01]+)))$/);
      if (m) {
        return [Number(m[1]), Number(m[1]), Number(m[2])];
      }
    }
    {
      const m = arg.match(/^(?<msb>\d+)\.\.(?<lsb>\d+)=(?<val>((\d+)|(0x[0-9a-fA-F]+)|(0b[01]+)))$/);
      if (m) {
        return [Number(m[1]), Number(m[2]), Number(m[3])];
      }
    }
    // named field
    if (fieldo[arg] === undefined) {
      const parts = arg.split('=');
      if (parts.length === 2) {
        return parts[0];
      } else {
        console.error(args, fieldo, 'unknown field:', arg);
        throw new Error();
      }
    }
    // fieldo[arg].count -= 1;
    // namedFieldo[arg] = namedFieldo[arg] || 0;
    // namedFieldo[arg] += 1;
    return arg;
  });

  let mask = 0;
  let valu = 0;
  let fullMask = 0;

  args1.map(arg => {
    if (Array.isArray(arg)) {
      const [msb, lsb, val] = arg;
      const maskUpdate = (((1 << (msb - lsb + 1)) - 1) >>> 0) << lsb;
      const valuUpdate = (val >>> 0) << lsb;

      if (fullMask & maskUpdate) {
        console.error(args1, arg);
        throw new Error();
      }
      fullMask = (fullMask | maskUpdate) >>> 0;

      if (mask & maskUpdate) {
        console.error(args1, arg);
        throw new Error();
      }
      mask = (mask | maskUpdate) >>> 0;

      valu = (valu | valuUpdate) >>> 0;
      return;
    }
    if (typeof arg !== 'string') {
      throw new Error('must be string', arg, args);
    }
    const sf = fieldo[arg];
    if (sf.msb !== 0) {
      const maskUpdate = (((1 << (sf.msb - sf.lsb + 1)) - 1) >>> 0) << sf.lsb;
      if (fullMask & maskUpdate) {
        console.error(args1, arg, args);
        throw new Error();
      }
      fullMask = (fullMask | maskUpdate) >>> 0;
    }

  });

  return {
    mask, // : '0x' + mask.toString(16),
    valu, // : '0x' + valu.toString(16),
    fullMask, // : '0x' + fullMask.toString(16),
    args: args1
  };
};

module.exports = getGetField;
