#!/usr/bin/env node
'use strict';

const process = require('process');

const { program } = require('commander');

const range = require('lodash.range');

const { writeFile } = require('fs').promises;

const { opcodes, extractNode, jsonStringify } = require('../lib');

const filterOpcodes = (opcodesAll) => {
  const o = {rv32: [], rv64: [], rv128: []};
  opcodesAll.map(opcode => {
    const {name} = opcode;
    if (name.match(/^rv_/)) {
      o.rv32.push(opcode);
      o.rv64.push(opcode);
      o.rv128.push(opcode);
      return;
    }
    if (name.match(/^rv32_/)) {
      o.rv32.push(opcode);
      return;
    }
    if (name.match(/^rv64_/)) {
      o.rv64.push(opcode);
      return;
    }
    if (name.match(/^rv128_/)) {
      o.rv128.push(opcode);
      return;
    }
    console.log(opcode);
  });
  return o;
};

const hashOpcodes = (opcodes) => {
  const res = [
    {mask: 0x3,  valu: 0x0},
    {mask: 0x3,  valu: 0x1},
    {mask: 0x3,  valu: 0x2},
    ...range(32).map(i => ({mask: 0x7f, valu: (i << 2) + 3}))
  ].map(grupo => {
    const ops = grupo.opcodes = [];
    opcodes.map(exto => {
      exto.opcodes.map(insto => {
        const mask = grupo.mask & insto.mask;
        if (((insto.kind === 'leaf') || (insto.kind === 'pseudo')) && (grupo.valu & mask) === (insto.valu & mask)) {
          ops.push(insto);
        }
      });
    });
    return grupo;
  });
  console.log(res.map(e => e.opcodes.length));
  return res;
};

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
    .option('--url <url>', 'URL with files')
    .option('--dir <dir>', 'folder with files')
    .parse(process.argv);

  const opts = program.opts();

  const fieldo = {};

  ['RATIFIED_OPCODES', 'UNRATIFIED_OPCODES'].map(e => {
    countOpcodes(opcodes[e], e);
  });

  const opcodesRatified = await extractNode(
    opts, // opcodes.ROOT,
    '',
    opcodes.RATIFIED_OPCODES,
    fieldo,
    true /* ratified */
  );

  const opcodesUnratified = await extractNode(
    opts,
    'unratified/', // opcodes.ROOT + 'unratified/',
    opcodes.UNRATIFIED_OPCODES,
    fieldo,
    false /* unratified */
  );

  const opcodesAll = opcodesRatified.concat(opcodesUnratified);

  await writeFile('lib/extensions.json', jsonStringify(opcodesAll));

  const filteredOpcodes = filterOpcodes(opcodesAll);

  for (const xlen of [32, 64, 128]) {
    const opcodes = filteredOpcodes['rv' + xlen];
    await writeFile(
      'lib/extensions' + xlen + '.json',
      jsonStringify(opcodes)
    );
    const hash = hashOpcodes(opcodes);
    await writeFile(
      'lib/hash' + xlen + '.json',
      jsonStringify(hash)
    );
  }

};

main();
