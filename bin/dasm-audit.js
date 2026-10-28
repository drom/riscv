#!/usr/bin/env node
'use strict';

/* eslint no-console: 0 */

// llvm-mc based disassembler oracle
//
//   node bin/dasm-audit.js                    # stats: lib/dasm.js vs test/dasm/golden.json
//   node bin/dasm-audit.js --show operands    # list samples of a category
//   node bin/dasm-audit.js --update-known     # snapshot current diffs -> test/dasm/known-diff.json
//   node bin/dasm-audit.js --generate         # regenerate golden.json (needs llvm-mc)
//   node bin/dasm-audit.js --generate -n 8    # ... with 8 samples per opcode

const process = require('process');
const { parseArgs } = require('util');
const { spawn, spawnSync } = require('child_process');
const { readFileSync, writeFileSync, mkdirSync } = require('fs');

const oracle = require('../test/util/dasm-oracle.js');

const help = `Usage: dasm-audit [options]

Options:
  --generate        regenerate test/dasm/golden.json with llvm-mc
  -n <num>          samples per opcode for --generate (default 4)
  --seed <num>      random seed for --generate (default 7)
  --llvm-mc <path>  llvm-mc binary (default: llvm-mc)
  --update-known    write current diffs to test/dasm/known-diff.json
  --show <cat>      list samples: ${oracle.categories.join(', ')}, all-diff
  -h, --help        display help`;

// riscv-opcodes file name part -> llvm feature ('' = base ISA, no feature)
const featAlias = {i: '', s: '', system: '', zicbo: 'zicbom,+zicboz,+zicbop'};

const llvmFeatures = (llvmMc) => {
  const r = spawnSync(llvmMc, ['-triple=riscv64', '-mattr=help'], {encoding: 'utf8'});
  if (r.error) throw new Error('can not run ' + llvmMc + ': ' + r.error.message);
  return new Set((r.stdout + r.stderr).split('\n').map(l => l.trim().split(/\s+/)[0]));
};

const llvmVersion = (llvmMc) => {
  const r = spawnSync(llvmMc, ['--version'], {encoding: 'utf8'});
  const m = (r.stdout || '').match(/LLVM version (\S+)/);
  return m ? m[1] : 'unknown';
};

// rv32_c_d -> '+c,+d' ; null when llvm does not know a part
const extFeatures = (name, feats) => {
  const res = [];
  for (const part of name.split('_').slice(1)) {
    if (featAlias[part] !== undefined) {
      if (featAlias[part] !== '') res.push(featAlias[part]);
    } else if (feats.has(part)) {
      res.push(part);
    } else if (feats.has('experimental-' + part)) {
      res.push('experimental-' + part);
    } else {
      return null;
    }
  }
  return res.map(f => '+' + f).join(',');
};

const run = (cmd, args, input) => new Promise((resolve, reject) => {
  const p = spawn(cmd, args);
  let stdout = '';
  let stderr = '';
  p.stdout.on('data', d => { stdout += d; });
  p.stderr.on('data', d => { stderr += d; });
  p.on('error', reject);
  p.on('close', code => resolve({code, stdout, stderr}));
  p.stdin.end(input);
});

const mapLimit = async (items, limit, fn) => {
  const res = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      res[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
  return res;
};

const toBytes = (inst, len) => {
  const res = [];
  for (let i = 0; i < len; i++) res.push('0x' + ((inst >>> (8 * i)) & 255).toString(16).padStart(2, '0'));
  return res.join(' ');
};

const asmLines = (stdout) => stdout.split('\n')
  .map(l => l.trim())
  .filter(l => l && !l.startsWith('.text'));

// disassemble words; one batch call, per-word fallback if anything is invalid
const disasm = async (llvmMc, xlen, mattr, words) => {
  const args = ['--disassemble', '-triple=riscv' + xlen, '-M', 'no-aliases'];
  if (mattr) args.push('-mattr=' + mattr);
  const input = words.map(w => toBytes(w.inst, w.len)).join('\n') + '\n';
  const batch = await run(llvmMc, args, input);
  const lines = asmLines(batch.stdout);
  if (!/warning|error/.test(batch.stderr) && lines.length === words.length) {
    return lines;
  }
  return mapLimit(words, 8, async (w) => {
    const r = await run(llvmMc, args, toBytes(w.inst, w.len) + '\n');
    const l = asmLines(r.stdout);
    if (/invalid instruction encoding/.test(r.stderr) || l.length !== 1) return null;
    return l[0];
  });
};

const generate = async (opts) => {
  const llvmMc = opts['llvm-mc'] || 'llvm-mc';
  const feats = llvmFeatures(llvmMc);
  const lib = require('../lib');
  const pkg = require('../package.json');
  const perXlen = lib.filterOpcodes(lib.extensions);
  const n = Number(opts.n || 4);
  let seed = Number(opts.seed || 7);
  const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0);

  const jobs = [];
  const unsupported = new Set();
  for (const xlen of [32, 64]) {
    for (const ext of perXlen['rv' + xlen]) {
      const mattr = extFeatures(ext.name, feats);
      if (mattr === null) {
        unsupported.add(ext.name);
        continue;
      }
      const words = [];
      const seen = new Set();
      for (const op of ext.opcodes) {
        if (op.kind !== 'leaf' && op.kind !== 'pseudo') continue;
        const len = ((op.valu & 3) === 3) ? 4 : 2;
        const full = (len === 4) ? 0xffffffff : 0xffff;
        for (let k = 0; k < n; k++) {
          const inst = ((op.valu | (rnd() & ~op.mask)) & full) >>> 0;
          if (seen.has(inst)) continue; // fully fixed encodings, collisions
          seen.add(inst);
          words.push({op, len, inst});
        }
      }
      if (words.length) jobs.push({xlen, ext: ext.name, mattr, words});
    }
  }

  const results = await mapLimit(jobs, 4, async (job) => {
    const asm = await disasm(llvmMc, job.xlen, job.mattr, job.words);
    return job.words.map((w, i) => ({
      xlen: job.xlen,
      ext: job.ext,
      name: w.op.name,
      inst: w.inst.toString(16).padStart(w.len * 2, '0'),
      llvm: (asm[i] === null) ? null : oracle.norm(asm[i])
    }));
  });

  const golden = {
    llvm: llvmVersion(llvmMc),
    riscvOpcodes: (pkg.riscvOpcodes || {}).commit,
    samplesPerOpcode: n,
    unsupported: [...unsupported].sort(),
    mattr: Object.fromEntries(jobs.map(j => [j.xlen + ':' + j.ext, j.mattr])),
    samples: results.flat()
  };
  mkdirSync(oracle.dir, {recursive: true});
  writeFileSync(oracle.goldenPath, stringify(golden));
  console.log('written: ' + oracle.goldenPath + ' (' + golden.samples.length + ' samples, llvm '
    + golden.llvm + ')');
  console.log('unsupported by llvm: ' + golden.unsupported.join(' '));
};

// one sample per line keeps git diffs readable
const stringify = (golden) => {
  const {samples, ...head} = golden;
  return '{\n' + Object.entries(head).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v) + ',\n').join('')
    + '"samples": [\n' + samples.map(s => JSON.stringify(s)).join(',\n') + '\n]}\n';
};

const evaluate = (golden) => golden.samples.map(sample => {
  let text;
  try {
    text = oracle.ours(sample);
  } catch (err) {
    text = 'THROWS ' + err.message;
  }
  return {sample, text, cat: oracle.classify(sample, text)};
});

const stats = (golden, rows, show) => {
  const counts = Object.fromEntries(oracle.categories.map(c => [c, 0]));
  rows.forEach(r => counts[r.cat]++);
  console.log('golden: llvm ' + golden.llvm + ', riscv-opcodes ' + golden.riscvOpcodes
    + ', ' + rows.length + ' samples\n');
  console.log('| result       | count |   %   |');
  console.log('|--------------|------:|------:|');
  for (const c of oracle.categories) {
    console.log('| ' + c.padEnd(12) + ' | ' + String(counts[c]).padStart(5) + ' | '
      + (100 * counts[c] / rows.length).toFixed(1).padStart(5) + ' |');
  }
  if (show) {
    console.log();
    for (const r of rows) {
      if (r.cat === show || (show === 'all-diff' && r.cat !== 'exact')) {
        console.log(r.sample.xlen + ' ' + r.sample.ext.padEnd(18) + r.sample.inst.padStart(8)
          + '  ours: ' + oracle.norm(r.text).padEnd(40) + ' llvm: ' + r.sample.llvm);
      }
    }
  }
};

const updateKnown = (rows) => {
  const known = {};
  for (const r of rows) {
    if (r.cat !== 'exact') known[oracle.key(r.sample)] = oracle.norm(r.text);
  }
  writeFileSync(oracle.knownPath, '{\n' + Object.entries(known)
    .map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n') + '\n}\n');
  console.log('written: ' + oracle.knownPath + ' (' + Object.keys(known).length + ' known diffs)');
};

const main = async () => {
  const { values: opts } = parseArgs({
    args: process.argv.slice(2),
    options: {
      generate: {type: 'boolean'},
      n: {type: 'string', short: 'n'},
      seed: {type: 'string'},
      'llvm-mc': {type: 'string'},
      'update-known': {type: 'boolean'},
      show: {type: 'string'},
      help: {type: 'boolean', short: 'h'}
    }
  });
  if (opts.help) {
    console.log(help);
    return;
  }
  if (opts.generate) {
    await generate(opts);
  }
  const golden = JSON.parse(readFileSync(oracle.goldenPath, 'utf8'));
  const rows = evaluate(golden);
  stats(golden, rows, opts.show);
  if (opts['update-known']) {
    updateKnown(rows);
  }
};

main().catch(err => {
  console.error('fatal: ' + err.message);
  process.exitCode = 1;
});
