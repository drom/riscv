'use strict';

const fs = require('fs');
const path = require('path');

const { execFileSync } = require('child_process');

const headers = () => Object.assign(
  {'User-Agent': 'riscv-npm'},
  process.env.GITHUB_TOKEN ? {Authorization: 'Bearer ' + process.env.GITHUB_TOKEN} : {}
);

const getText = async (url) => {
  const res = await fetch(url, {headers: headers()});
  if (!res.ok) {
    throw new Error(url + ' statusCode: ' + res.status);
  }
  return res.text();
};

const parseLut = (csv) => csv
  .trim()
  .split('\n')
  .map(row => row.split(',').map(e => e.trim()))
  .reduce((res, row) => {
    const key = row[0].match(/^"(.+)"$/)[1];
    res[key] = {msb: Number(row[1]), lsb: Number(row[2])};
    return res;
  }, {});

// csrs.csv: 0x001, "fflags" -> {1: 'fflags'}
const parseCsrs = (csv) => {
  const res = {};
  for (const row of csv.split('\n')) {
    const m = row.match(/^\s*(0x[0-9a-f]+)\s*,\s*"?([\w.]+)"?/i);
    if (m) res[parseInt(m[1], 16)] = m[2];
  }
  return res;
};

const getOpcodes = async (opts) => {
  let tree = [];
  let lut = {};
  if (opts.url) {
    const ref = opts.ref || 'master';
    const fullTreeResp = await getText(
      'https://api.github.com/repos/' + opts.url + '/git/trees/' + ref + '?recursive=1'
    );
    tree = JSON.parse(fullTreeResp).tree;

    const argLut = await getText(
      'https://raw.githubusercontent.com/' + opts.url + '/' + ref + '/arg_lut.csv'
    );
    lut = parseLut(argLut);

    const raw = name => getText('https://raw.githubusercontent.com/' + opts.url + '/' + ref + '/' + name);
    const CSRS = {all: parseCsrs(await raw('csrs.csv')), rv32: parseCsrs(await raw('csrs32.csv'))};

    return {
      CSRS,
      RATIFIED_OPCODES: tree.flatMap(e => {
        const m = e.path.match(/^extensions\/(rv.+)$/);
        return m ? [m[1]] : [];
      }),
      UNRATIFIED_OPCODES: tree.flatMap(e => {
        const m = e.path.match(/^extensions\/unratified\/(rv.+)$/);
        return m ? [m[1]] : [];
      }),
      LUT: lut
    };
  }

  if (opts.dir) {
    const extDir = path.join(opts.dir, 'extensions');
    const unratifiedDir = path.join(extDir, 'unratified');

    const listRv = (dir) => fs.readdirSync(dir)
      .filter(name => /^rv/.test(name));

    const argLut = fs.readFileSync(
      path.join(opts.dir, 'arg_lut.csv'), 'utf8'
    );
    lut = parseLut(argLut);

    const raw = name => fs.readFileSync(path.join(opts.dir, name), 'utf8');
    const CSRS = {all: parseCsrs(raw('csrs.csv')), rv32: parseCsrs(raw('csrs32.csv'))};

    return {
      CSRS,
      RATIFIED_OPCODES: listRv(extDir),
      UNRATIFIED_OPCODES: listRv(unratifiedDir),
      LUT: lut
    };
  }

  return {
    RATIFIED_OPCODES: [],
    UNRATIFIED_OPCODES: [],
    LUT: lut
  };
};

// resolve the source revision: {commit, date, dirty?}
//   url mode: branch / tag / short hash -> full commit hash via GitHub API
//   dir mode: git -C dir (if it is a git checkout)
//   paths:      checked for uncommitted changes in dir mode
//   defaultRef: when opts.ref is not given
const getCommit = async (opts, {paths = ['extensions', 'arg_lut.csv'], defaultRef = 'master'} = {}) => {
  if (opts.url) {
    const ref = opts.ref || defaultRef;
    const info = JSON.parse(await getText(
      'https://api.github.com/repos/' + opts.url + '/commits/' + ref
    ));
    return {commit: info.sha, date: info.commit.committer.date};
  }
  if (opts.dir) {
    const git = (...args) => execFileSync('git', ['-C', opts.dir, ...args], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
    try {
      return {
        commit: git('rev-parse', 'HEAD'),
        date: new Date(git('log', '-1', '--format=%cI')).toISOString().replace(/\.000Z$/, 'Z'),
        dirty: git('status', '--porcelain', '--', ...paths) !== ''
      };
    } catch {
      return {}; // not a git checkout
    }
  }
  return {};
};

module.exports = getOpcodes;
module.exports.getCommit = getCommit;
module.exports.getText = getText;
module.exports.parseCsrs = parseCsrs;
module.exports.headers = headers;
