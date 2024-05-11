#!/usr/bin/env node
'use strict';

const process = require('process');

const { program } = require('commander');

const { writeFile } = require('fs').promises;

const lib = require('../lib');

const getOpcodes = require('../lib/get-opcodes.js');

const countOpcodes = (arr, name) => {
  const o = {};
  console.log(name);
  arr.map((e, i) => {
    if (o[e]) {
      console.log('Error: Duplicate name: ' + e + ' at pos: ' + i);
    }
    o[e] = true;
  });
  console.log(Object.keys(o).length + ' files');
};


const main = async () => {
  program
    .option('--url <url>', 'Github repo name with files')
    .option('--dir <dir>', 'folder with files')
    .parse(process.argv);

  const opts = program.opts();

  if (!(opts.url || opts.dir)) {
    opts.url = 'riscv/riscv-opcodes';
  }

  const opcodes = await getOpcodes(opts);
  // const opcodes = lib.opcodes;

  const fieldo = {};

  ['RATIFIED_OPCODES', 'UNRATIFIED_OPCODES'].map(e => {
    countOpcodes(opcodes[e], e);
  });

  const opcodesRatified = await lib.extractNode(
    opts, // opcodes.ROOT,
    '',
    opcodes.RATIFIED_OPCODES,
    fieldo,
    true /* ratified */
  );

  const opcodesUnratified = await lib.extractNode(
    opts,
    'unratified/', // opcodes.ROOT + 'unratified/',
    opcodes.UNRATIFIED_OPCODES,
    fieldo,
    false /* unratified */
  );

  const opcodesAll = opcodesRatified.concat(opcodesUnratified);

  await writeFile('lib/extensions.json', lib.jsonStringify(opcodesAll));

  // console.log(opcodesAll);

  // const filteredOpcodes = filterOpcodes(opcodesAll);

  // for (const xlen of [32, 64, 128]) {
  //   const opcodes = filteredOpcodes['rv' + xlen];
  //   await writeFile(
  //     'lib/extensions' + xlen + '.json',
  //     jsonStringify(opcodes)
  //   );
  //   const hash = hashOpcodes(opcodes);
  //   await writeFile(
  //     'lib/hash' + xlen + '.json',
  //     jsonStringify(hash)
  //   );
  // }

};

main();
