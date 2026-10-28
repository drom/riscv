'use strict';

// Diagnostics collector for the opcode build.
// Location: {file, line, inst} -- file relative to riscv-opcodes/extensions

const fmtLoc = ({file, line, inst} = {}) =>
  (file ? file + (line ? ':' + line : '') + ' ' : '') + (inst ? inst + ': ' : '');

// collects all problems, so a single run shows everything that needs fixing
const createReport = () => {
  const items = [];
  const add = level => (msg, loc) => {
    items.push({level, msg, loc: loc || {}});
  };
  return {
    items,
    error: add('error'),
    warn: add('warning'),
    info: add('info'),
    errors: () => items.filter(e => e.level === 'error'),
    warnings: () => items.filter(e => e.level === 'warning'),
    infos: () => items.filter(e => e.level === 'info'),
    // errors first; identical messages grouped with their locations
    //   verbose: include info items, show all locations
    format: ({verbose = false} = {}) => {
      const groups = new Map();
      for (const e of items) {
        const key = e.level + ': ' + e.msg;
        if (!groups.has(key)) groups.set(key, {level: e.level, locs: []});
        groups.get(key).locs.push(fmtLoc(e.loc).replace(/:? $/, ''));
      }
      const lines = [];
      for (const level of verbose ? ['error', 'warning', 'info'] : ['error', 'warning']) {
        for (const [key, g] of groups) {
          if (g.level !== level) continue;
          const locs = g.locs.filter(l => l);
          if (locs.length === 1) {
            lines.push(level + ': ' + locs[0] + ': ' + key.slice(level.length + 2));
          } else {
            const shown = verbose ? locs : locs.slice(0, 8);
            const more = locs.length - shown.length;
            lines.push(key + (shown.length ? '\n    at ' + shown.join('\n    at ') : '')
              + (more > 0 ? '\n    ... and ' + more + ' more' : ''));
          }
        }
      }
      return lines.join('\n');
    }
  };
};

// default for library use: fail fast with a descriptive message
const throwingReport = {
  error: (msg, loc) => { throw new Error(fmtLoc(loc) + msg); },
  warn: (msg, loc) => { console.warn('warning: ' + fmtLoc(loc) + msg); },
  info: () => {}
};

// format set bits of a 32-bit mask as ranges: "28, 24..23, 16..15"
const fmtBits = mask => {
  const res = [];
  for (let i = 31; i >= 0; i--) {
    if ((mask >>> i) & 1) {
      let j = i;
      while (j > 0 && ((mask >>> (j - 1)) & 1)) j--;
      res.push(i === j ? String(i) : i + '..' + j);
      i = j;
    }
  }
  return res.join(', ');
};

module.exports = {createReport, throwingReport, fmtLoc, fmtBits};
