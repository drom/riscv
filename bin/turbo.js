#!/usr/bin/env node
'use strict';

const process = require('process');

const { parseArgs } = require('util');

const iso = {
  rv32i: [],
  rb64i: []
};

const main = async () => {
  const { values: opts } = parseArgs({
    args: process.argv.slice(2),
    options: {
      isa: {type: 'string', short: 'i'}
    }
  });

  if (opts.isa === undefined) {
    console.error('error: required option \'-i, --isa <type>\' not specified');
    process.exit(1);
  }

  const ops = iso[opts.isa];
  if (ops === undefined) {
    console.error('Unknown ISA string:', opts.isa);
  }

};

main();
