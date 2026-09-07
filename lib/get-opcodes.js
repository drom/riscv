'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const getFromGithub = async (host, path) => new Promise((resolve, reject) => {
  https.get({
    host, path,
    headers: {'User-Agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)'}
  }, (res) => {
    const { statusCode } = res;
    if (statusCode !== 200) {
      console.error(res, statusCode);
      reject(statusCode);
    }
    let rawData = '';
    res.on('data', chunk => {
      rawData += chunk;
    });
    res.on('end', () => {
      resolve(rawData);
    });
  });
});

const parseLut = (csv) => csv
  .trim()
  .split('\n')
  .map(row => row.split(',').map(e => e.trim()))
  .reduce((res, row) => {
    const key = row[0].match(/^"(.+)"$/)[1];
    res[key] = {msb: row[1], lsb: row[2]};
    return res;
  }, {});

const getOpcodes = async (opts) => {
  let tree = [];
  let lut = {};
  if (opts.url) {
    const fullTreeResp = await getFromGithub(
      'api.github.com',
      '/repos/' + opts.url + '/git/trees/master?recursive=1'
    );
    tree = JSON.parse(fullTreeResp).tree;

    const argLut = await getFromGithub(
      'raw.githubusercontent.com',
      '/riscv/riscv-opcodes/master/arg_lut.csv'
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

module.exports = getOpcodes;
