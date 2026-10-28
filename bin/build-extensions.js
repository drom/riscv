#!/usr/bin/env node
'use strict';

// Build lib/extensions.json from riscv-opcodes (https://github.com/riscv/riscv-opcodes)
//
//   node bin/build-extensions.js                 # pinned commit from package.json
//   node bin/build-extensions.js --ref master    # other commit / branch / tag
//   node bin/build-extensions.js --ref master --pin   # ... and pin it in package.json
//   node bin/build-extensions.js --dir ../riscv-opcodes
//
// All problems are collected and reported together. Nothing is written
// if there are errors (unless --force).

const process = require('process');
const path = require('path');
const { parseArgs } = require('util');
const { readFile, writeFile } = require('fs').promises;

const lib = require('../lib');
const getOpcodes = require('../lib/get-opcodes.js');
const resolveImports = require('../lib/resolve-imports.js');
const { createReport } = require('../lib/report.js');
const fieldo = require('../lib/fieldo.js');

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const extPath = path.join(root, 'lib', 'extensions.json');

const help = `Usage: build-extensions [options]

Options:
  --url <repo>   GitHub repo (default: package.json riscvOpcodes.repo)
  --ref <ref>    commit / branch / tag (default: package.json riscvOpcodes.commit)
  --dir <dir>    use local riscv-opcodes checkout instead of GitHub
  --pin          store resolved commit and date in package.json
  --force        write lib/extensions.json even if there are errors
  --dry-run      check only, do not write anything
  -v             verbose
  -h, --help     display help`;

const checkDuplicates = (names, kind, report) => {
  const seen = new Set();
  for (const name of names) {
    if (seen.has(name)) report.error('duplicate ' + kind + ' file name', {file: name});
    seen.add(name);
  }
};

// compare our field table with upstream arg_lut.csv
const checkLut = (lut, report) => {
  for (const [name, {msb, lsb}] of Object.entries(lut)) {
    const f = fieldo[name];
    if (f && (f.msb !== msb || f.lsb !== lsb)) {
      report.error(
        'lib/fieldo.js ' + name + ' is bits ' + f.msb + '..' + f.lsb
        + ', arg_lut.csv says ' + msb + '..' + lsb
      );
    }
  }
};

// a is a specialization of b (pseudo with more fixed bits)
const isSubset = (a, b) => (((a.mask & b.mask) >>> 0) === b.mask) && (((a.valu & b.mask) >>> 0) === b.valu);

// same instruction name defined twice in one file with unrelated encodings
const checkInstructions = (extos, report) => {
  for (const exto of extos) {
    const seen = {};
    for (const op of exto.opcodes) {
      if (op.kind === 'import') continue;
      const prev = seen[op.name];
      if (prev && !isSubset(op, prev) && !isSubset(prev, op)) {
        report.warn('instruction name defined twice with unrelated encodings (upstream typo?)', {file: exto.name, inst: op.name});
      }
      seen[op.name] = op;
    }
  }
};

// human readable diff between old and new lib/extensions.json
const summarize = (oldExtos, newExtos) => {
  const byName = arr => Object.fromEntries(arr.map(e => [e.name, e]));
  const o = byName(oldExtos);
  const n = byName(newExtos);
  const opKey = op => op.kind + ' ' + op.name;
  const lines = [];
  for (const name of Object.keys(n)) {
    if (!o[name]) {
      lines.push('+ ' + name + ' (' + n[name].opcodes.length + ' opcodes)');
      continue;
    }
    if (JSON.stringify(o[name]) === JSON.stringify(n[name])) continue;
    const oldOps = new Map(o[name].opcodes.map(op => [opKey(op), op]));
    const newOps = new Map(n[name].opcodes.map(op => [opKey(op), op]));
    const added = [...newOps.keys()].filter(k => !oldOps.has(k));
    const removed = [...oldOps.keys()].filter(k => !newOps.has(k));
    const changed = [...newOps.keys()].filter(k =>
      oldOps.has(k) && JSON.stringify(oldOps.get(k)) !== JSON.stringify(newOps.get(k)));
    const parts = [];
    if (o[name].ratified !== n[name].ratified) parts.push(n[name].ratified ? 'ratified' : 'unratified');
    if (added.length) parts.push('+' + added.map(k => k.split(' ')[1]).join(' +'));
    if (removed.length) parts.push('-' + removed.map(k => k.split(' ')[1]).join(' -'));
    if (changed.length) parts.push('~' + changed.map(k => k.split(' ')[1]).join(' ~'));
    lines.push('~ ' + name + ': ' + parts.join(' '));
  }
  for (const name of Object.keys(o)) {
    if (!n[name]) lines.push('- ' + name);
  }
  return lines;
};

const main = async () => {
  const { values: opts } = parseArgs({
    args: process.argv.slice(2),
    options: {
      url: {type: 'string'},
      ref: {type: 'string'},
      dir: {type: 'string'},
      pin: {type: 'boolean'},
      force: {type: 'boolean'},
      'dry-run': {type: 'boolean'},
      v: {type: 'boolean', short: 'v'},
      help: {type: 'boolean', short: 'h'}
    }
  });

  if (opts.help) {
    console.log(help);
    return 0;
  }
  return build(opts);
};

const build = async (opts) => {
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  const pinned = pkg.riscvOpcodes || {};

  if (!opts.dir) {
    opts.url = opts.url || pinned.repo;
    opts.ref = opts.ref || pinned.commit;
  }

  const report = createReport();
  opts.report = report;

  // 1. resolve exact revision, so all files come from the same commit
  const rev = await getOpcodes.getCommit(opts);
  if (opts.url) {
    opts.ref = rev.commit;
  }
  if (rev.dirty) {
    report.warn('local checkout has uncommitted changes in extensions/ or arg_lut.csv');
  }
  console.log('source: ' + (opts.dir || opts.url)
    + (rev.commit ? ' @ ' + rev.commit + ' (' + rev.date + ')' : ''));
  if (pinned.commit && rev.commit && pinned.commit !== rev.commit) {
    console.log('pinned: ' + pinned.commit + ' (' + pinned.date + ')');
  }

  // 2. list of files and field table
  const opcodes = await getOpcodes(opts);
  opts.lut = opcodes.LUT;
  checkDuplicates(opcodes.RATIFIED_OPCODES, 'ratified', report);
  checkDuplicates(opcodes.UNRATIFIED_OPCODES, 'unratified', report);
  checkLut(opcodes.LUT, report);
  console.log('files: ' + opcodes.RATIFIED_OPCODES.length + ' ratified, '
    + opcodes.UNRATIFIED_OPCODES.length + ' unratified');

  // 3. parse all files
  const usage = {};
  const opcodesAll = [
    ...await lib.extractNode(opts, '', opcodes.RATIFIED_OPCODES, usage, true),
    ...await lib.extractNode(opts, 'unratified/', opcodes.UNRATIFIED_OPCODES, usage, false)
  ];

  // 4. cross-file checks
  resolveImports(opcodesAll, report);
  checkInstructions(opcodesAll, report);

  // 5. what changed
  let oldExtos = [];
  try {
    oldExtos = JSON.parse(await readFile(extPath, 'utf8'));
  } catch (err) {
    report.warn('can not read old lib/extensions.json: ' + err.message);
  }
  const diff = summarize(oldExtos, opcodesAll);
  console.log('\nchanges vs lib/extensions.json: ' + (diff.length ? '' : 'none'));
  diff.forEach(line => console.log('  ' + line));

  // 6. diagnostics
  const errors = report.errors();
  const warnings = report.warnings();
  if (report.items.length) {
    console.log('\n' + report.format());
  }
  console.log('\n' + errors.length + ' error(s), ' + warnings.length + ' warning(s)');

  return save(opts, pkg, rev, opcodesAll, errors.length);
};

const save = async (opts, pkg, rev, opcodesAll, errorCount) => {
  if (opts['dry-run']) {
    return errorCount ? 1 : 0;
  }
  if (errorCount && !opts.force) {
    console.log('lib/extensions.json NOT written (use --force to override)');
    return 1;
  }

  await writeFile(extPath, lib.jsonStringify(opcodesAll));
  console.log('written: lib/extensions.json');

  if (opts.pin && opts.url && rev.commit) {
    pkg.riscvOpcodes = {repo: opts.url, commit: rev.commit, date: rev.date};
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('pinned: ' + rev.commit + ' (' + rev.date + ') in package.json');
  } else if (opts.pin) {
    console.log('--pin needs GitHub source (not --dir)');
  }
  return errorCount ? 1 : 0;
};

main().then(code => {
  process.exitCode = code;
}, err => {
  console.error('fatal: ' + err.message);
  if (process.env.DEBUG) console.error(err);
  process.exitCode = 2;
});
