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

    return {
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

    return {
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
const getCommit = async (opts) => {
  if (opts.url) {
    const ref = opts.ref || 'master';
    const info = JSON.parse(await getText(
      'https://api.github.com/repos/' + opts.url + '/commits/' + ref
    ));
    return {commit: info.sha, date: info.commit.committer.date};
  }
  if (opts.dir) {
    const git = (...args) => execFileSync('git', ['-C', opts.dir, ...args], {encoding: 'utf8'}).trim();
    try {
      return {
        commit: git('rev-parse', 'HEAD'),
        date: new Date(git('log', '-1', '--format=%cI')).toISOString().replace(/\.000Z$/, 'Z'),
        dirty: git('status', '--porcelain', '--', 'extensions', 'arg_lut.csv') !== ''
      };
    } catch {
      return {}; // not a git checkout
    }
  }
  return {};
};

module.exports = getOpcodes;
module.exports.getCommit = getCommit;
