'use strict';

/* eslint camelcase: 0 */ // UDB field names

// Load instruction definitions from riscv-unified-db (UDB)
//   https://github.com/riscv/riscv-unified-db  spec/std/isa/inst/<Ext>/<name>.yaml
//
// opts: {url, ref} (GitHub repo + resolved commit) or {dir} (local checkout)
//       optional opts.report, opts.cache (directory for downloaded tarballs)
//
// result: [{name, ext, file, assembly, encodings: [{xlen, len, mask, valu, match, variables}]}]
//   xlen      null (both), 32 or 64 (UDB encoding.RV32 / encoding.RV64)
//   variables [{name, location, left_shift, sign_extend, not}] as in UDB

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const untar = require('./untar.js');
const { headers } = require('./get-opcodes.js');
const { throwingReport } = require('./report.js');

const INST_DIR = 'spec/std/isa/inst/';

// GitHub tarball: '<repo>-<sha>/spec/std/isa/inst/V/vadd.vx.yaml' -> 'V/vadd.vx.yaml'
const instPath = (p) => {
  const i = p.indexOf('/' + INST_DIR);
  return (i === -1) ? undefined : p.slice(i + INST_DIR.length + 1);
};

const download = async (opts) => {
  const cacheFile = opts.cache && path.join(opts.cache, 'udb-' + opts.ref + '.tar.gz');
  if (cacheFile && fs.existsSync(cacheFile)) {
    return fs.readFileSync(cacheFile);
  }
  const url = 'https://codeload.github.com/' + opts.url + '/tar.gz/' + opts.ref;
  if (opts.v) console.log(url);
  const res = await fetch(url, {headers: headers()});
  if (!res.ok) {
    throw new Error(url + ' statusCode: ' + res.status);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (cacheFile) {
    fs.mkdirSync(opts.cache, {recursive: true});
    fs.writeFileSync(cacheFile, buf);
  }
  return buf;
};

const walk = (dir) => fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : [p];
});

// [{path: 'V/vadd.vx.yaml', text}]
const readFiles = async (opts) => {
  if (opts.dir) {
    const root = path.join(opts.dir, INST_DIR);
    return walk(root)
      .filter(p => p.endsWith('.yaml'))
      .map(p => ({path: path.relative(root, p).split(path.sep).join('/'), text: fs.readFileSync(p, 'utf8')}));
  }
  if (opts.url) {
    const tar = await download(opts);
    return untar(tar, p => (instPath(p) !== undefined) && p.endsWith('.yaml'))
      .map(e => ({path: instPath(e.path), text: e.data.toString('utf8')}));
  }
  return [];
};

// '011-00010-----01' -> {len: 16, mask, valu}
const parseMatch = (match) => {
  const s = String(match);
  if (!/^[01-]+$/.test(s) || s.length > 32) return;
  let mask = 0;
  let valu = 0;
  for (const c of s) {
    mask = (mask * 2) + ((c === '-') ? 0 : 1);
    valu = (valu * 2) + ((c === '1') ? 1 : 0);
  }
  return {len: s.length, mask: mask >>> 0, valu: valu >>> 0};
};

const normVar = (v) => {
  const res = {name: v.name, location: String(v.location)};
  if (v.left_shift !== undefined) res.left_shift = v.left_shift;
  if (v.sign_extend !== undefined) res.sign_extend = v.sign_extend;
  if (v.not !== undefined) res.not = v.not;
  return res;
};

const normEncoding = (enc, xlen, loc, report) => {
  const m = parseMatch(enc.match);
  if (m === undefined) {
    report.warn('UDB: unsupported encoding match \'' + enc.match + '\'', loc);
    return [];
  }
  return [{xlen, ...m, match: String(enc.match), variables: (enc.variables || []).map(normVar)}];
};

const normInst = (file, doc, report) => {
  const loc = {file: 'udb:' + file, inst: doc.name};
  const enc = doc.encoding || {};
  let encodings;
  if (enc.match !== undefined) {
    encodings = normEncoding(enc, null, loc, report);
  } else {
    encodings = ['RV32', 'RV64'].flatMap(k => enc[k] ? normEncoding(enc[k], Number(k.slice(2)), loc, report) : []);
  }
  if (encodings.length === 0) return;
  return {
    name: doc.name,
    ext: file.split('/')[0],
    file,
    assembly: (doc.assembly === undefined || doc.assembly === null) ? '' : String(doc.assembly),
    encodings
  };
};

const getUdb = async (opts, report = throwingReport) => {
  const files = await readFiles(opts);
  const res = [];
  for (const f of files) {
    let doc;
    try {
      doc = yaml.load(f.text);
    } catch (err) {
      report.error('UDB: YAML parse error: ' + err.message.split('\n')[0], {file: 'udb:' + f.path});
      continue;
    }
    if (!doc || doc.kind !== 'instruction') continue;
    const inst = normInst(f.path, doc, report);
    if (inst) res.push(inst);
  }
  return res.sort((a, b) => (a.file < b.file) ? -1 : 1);
};

module.exports = getUdb;
module.exports.parseMatch = parseMatch;
module.exports.INST_DIR = INST_DIR;
