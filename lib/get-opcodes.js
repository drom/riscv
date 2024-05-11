'use strict';

const https = require('https');

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
    lut = argLut
      .trim()
      .split('\n')
      .map(row => row.split(',').map(e => e.trim()))
      .reduce((res, row) => {
        const key = row[0].match(/^"(.+)"$/)[1];
        res[key] = {msb: row[1], lsb: row[2]};
        return res;
      }, {});
    // console.log(lut);
  }

  return {
    RATIFIED_OPCODES: tree.flatMap(e => {
      const m = e.path.match(/^(rv.+)$/);
      return m ? [m[1]] : [];
    }),
    UNRATIFIED_OPCODES: tree.flatMap(e => {
      const m = e.path.match(/^unratified\/(rv.+)$/);
      return m ? [m[1]] : [];
    }),
    LUT: lut
  };
};

module.exports = getOpcodes;
