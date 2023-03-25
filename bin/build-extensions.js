#!/usr/bin/env node
'use strict';

const { writeFile } = require('fs').promises;

const { opcodes, extractNode, jsonStringify } = require('../lib');

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
  const fieldo = {};

  ['RATIFIED_OPCODES', 'UNRATIFIED_OPCODES'].map(e => {
    countOpcodes(opcodes[e], e);
  });

  const opcodesRatified = await extractNode(
    opcodes.ROOT,
    opcodes.RATIFIED_OPCODES,
    fieldo,
    true /* ratified */
  );

  const opcodesUnratified = await extractNode(
    opcodes.ROOT + 'unratified/',
    opcodes.UNRATIFIED_OPCODES,
    fieldo,
    false /* unratified */
  );

  const opcodesAll = opcodesRatified.concat(opcodesUnratified);

  await writeFile('lib/extensions.json', jsonStringify(opcodesAll));
};

main();
