#!/usr/bin/env node
'use strict';

/* eslint no-console: 0 */

// Build lib/extensions.json from riscv-opcodes (https://github.com/riscv/riscv-opcodes)
// and lib/syntax.json from riscv-unified-db (https://github.com/riscv/riscv-unified-db)
//
//   node bin/build-extensions.js                 # pinned commits from package.json
//   node bin/build-extensions.js --ref master    # other riscv-opcodes commit / branch / tag
//   node bin/build-extensions.js --ref master --pin   # ... and pin it in package.json
//   node bin/build-extensions.js --dir ../riscv-opcodes
//   node bin/build-extensions.js --udb-ref main --pin   # newer riscv-unified-db
//   node bin/build-extensions.js --udb-dir ../riscv-unified-db
//
// Pipeline: riscv-opcodes -> lib/patches.js -> imports -> lib/extensions.json
//           riscv-unified-db -> join by encoding + cross-check -> lib/syntax-overrides.js
//           -> lib/syntax.json
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
const applyPatches = require('../lib/apply-patches.js');
const patches = require('../lib/patches.js');
const getUdb = require('../lib/get-udb.js');
const udbJoin = require('../lib/udb-join.js');
const syntaxOverrides = require('../lib/syntax-overrides.js');

const root = path.resolve(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const extPath = path.join(root, 'lib', 'extensions.json');
const syntaxPath = path.join(root, 'lib', 'syntax.json');
const csrPath = path.join(root, 'lib', 'csr-names.json');
const udbCache = path.join(root, 'node_modules', '.cache', 'riscv-udb');

const help = `Usage: build-extensions [options]

Options:
  --url <repo>   GitHub repo (default: package.json riscvOpcodes.repo)
  --ref <ref>    commit / branch / tag (default: package.json riscvOpcodes.commit)
  --dir <dir>    use local riscv-opcodes checkout instead of GitHub
  --udb-url <repo>  riscv-unified-db repo (default: package.json riscvUdb.repo)
  --udb-ref <ref>   commit / branch / tag (default: package.json riscvUdb.commit)
  --udb-dir <dir>   use local riscv-unified-db checkout instead of GitHub
  --skip-udb     do not build lib/syntax.json
  --pin          store resolved commit(s) and date(s) in package.json
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
      'udb-url': {type: 'string'},
      'udb-ref': {type: 'string'},
      'udb-dir': {type: 'string'},
      'skip-udb': {type: 'boolean'},
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

  // 4. local fixes, cross-file checks
  const applied = applyPatches(opcodesAll, patches, report);
  console.log('patches: ' + applied.length + ' applied'
    + applied.map(p => '\n  ' + p.id + ' (' + p.class + ', ' + p.count + ' opcode(s))').join(''));
  if (opcodes.CSRS) {
    const csrApplied = applyPatches.applyCsrPatches(opcodes.CSRS, patches.csrs, report);
    console.log('CSR patches: ' + csrApplied.length + ' applied'
      + csrApplied.map(p => '\n  ' + p.id + ' (' + p.class + ', ' + p.count + ' CSR(s))').join(''));
  }
  resolveImports(opcodesAll, report);
  checkInstructions(opcodesAll, report);

  // 4b. riscv-unified-db: syntax + cross-check
  const udb = opts['skip-udb'] ? undefined : await buildSyntax(opts, pkg, opcodesAll, report);

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
  const formatted = report.format({verbose: opts.v});
  if (formatted) {
    console.log('\n' + formatted);
  }
  console.log('\n' + errors.length + ' error(s), ' + warnings.length + ' warning(s)');

  return save(opts, pkg, rev, opcodesAll, udb, opcodes.CSRS, errors.length);
};

const buildSyntax = async (opts, pkg, opcodesAll, report) => {
  const pinned = pkg.riscvUdb || {};
  const uopts = opts['udb-dir']
    ? {dir: opts['udb-dir']}
    : {url: opts['udb-url'] || pinned.repo, ref: opts['udb-ref'] || pinned.commit};
  if (!uopts.dir && !uopts.url) {
    report.error('no riscv-unified-db source: use --udb-url / --udb-dir or riscvUdb in package.json');
    return;
  }
  uopts.v = opts.v;
  uopts.cache = udbCache;
  const rev = await getOpcodes.getCommit(uopts, {paths: [getUdb.INST_DIR], defaultRef: 'main'});
  if (uopts.url) uopts.ref = rev.commit;
  if (rev.dirty) {
    report.warn('local riscv-unified-db checkout has uncommitted changes in ' + getUdb.INST_DIR);
  }
  console.log('\nUDB: ' + (uopts.dir || uopts.url)
    + (rev.commit ? ' @ ' + rev.commit + ' (' + rev.date + ')' : ''));
  if (pinned.commit && rev.commit && pinned.commit !== rev.commit) {
    console.log('pinned: ' + pinned.commit + ' (' + pinned.date + ')');
  }
  const insts = await getUdb(uopts, report);
  const {syntax, counts} = udbJoin(opcodesAll, insts, report);
  const overridden = udbJoin.applyOverrides(opcodesAll, syntax, syntaxOverrides, report);
  const missing = udbJoin.checkMissing(opcodesAll, syntax, report);
  console.log('UDB instructions: ' + insts.length);
  console.log('join: ' + Object.entries(counts).map(([k, v]) => k + ' ' + v).join(', '));
  console.log('overrides: ' + overridden + ', without syntax: ' + missing);

  let old = {};
  try {
    old = JSON.parse(await readFile(syntaxPath, 'utf8'));
  } catch {
    // first build
  }
  const keys = new Set([...Object.keys(old), ...Object.keys(syntax)]);
  const changed = [...keys].filter(k => JSON.stringify(old[k]) !== JSON.stringify(syntax[k]));
  console.log('changes vs lib/syntax.json: ' + (changed.length ? changed.length + ' entries' : 'none'));
  if (opts.v) changed.forEach(k => console.log('  ' + k));
  return {opts: uopts, rev, syntax};
};

// one entry per line keeps git diffs readable
const stringifySyntax = (syntax) => '{\n' + Object.entries(syntax)
  .map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n') + '\n}\n';

// {all: {num: name}, rv32: {...}}, one CSR per line
const stringifyCsrs = (csrs) => '{\n' + Object.entries(csrs).map(([k, t]) => JSON.stringify(k) + ': {\n'
  + Object.entries(t).map(([n, name]) => JSON.stringify(n) + ': ' + JSON.stringify(name)).join(',\n')
  + '\n}').join(',\n') + '\n}\n';

const save = async (opts, pkg, rev, opcodesAll, udb, csrs, errorCount) => {
  if (opts['dry-run']) {
    return errorCount ? 1 : 0;
  }
  if (errorCount && !opts.force) {
    console.log('lib/extensions.json NOT written (use --force to override)');
    return 1;
  }

  await writeFile(extPath, lib.jsonStringify(opcodesAll));
  console.log('written: lib/extensions.json');
  if (csrs) {
    await writeFile(csrPath, stringifyCsrs(csrs));
    console.log('written: lib/csr-names.json (' + Object.keys(csrs.all).length + ' + '
      + Object.keys(csrs.rv32).length + ' rv32 CSRs)');
  }
  if (udb) {
    await writeFile(syntaxPath, stringifySyntax(udb.syntax));
    console.log('written: lib/syntax.json');
  }

  if (opts.pin) {
    let pinned = false;
    if (opts.url && rev.commit) {
      pkg.riscvOpcodes = {repo: opts.url, commit: rev.commit, date: rev.date};
      console.log('pinned riscv-opcodes: ' + rev.commit + ' (' + rev.date + ') in package.json');
      pinned = true;
    }
    if (udb && udb.opts.url && udb.rev.commit) {
      pkg.riscvUdb = {repo: udb.opts.url, commit: udb.rev.commit, date: udb.rev.date};
      console.log('pinned riscv-unified-db: ' + udb.rev.commit + ' (' + udb.rev.date + ') in package.json');
      pinned = true;
    }
    if (pinned) {
      await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    } else {
      console.log('--pin needs GitHub source (not --dir / --udb-dir)');
    }
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
