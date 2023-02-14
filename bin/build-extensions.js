#!/usr/bin/env node
'use strict';

const { writeFile } = require('fs').promises;

const { opcodes, extractNode, jsonStringify } = require('../lib');

const main = async () => {
  const fieldo = {};

  const opcodesRatified = await extractNode(
    opcodes.ROOT,
    opcodes.RATIFIED_OPCODES,
    fieldo
  );

  const opcodesUnratified = await extractNode(
    opcodes.ROOT + 'unratified/',
    opcodes.UNRATIFIED_OPCODES,
    fieldo
  );

  const opcodesAll = opcodesRatified.concat(opcodesUnratified);

  await writeFile('lib/extensions.json', jsonStringify(opcodesAll));
};

main();
