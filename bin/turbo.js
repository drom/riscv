#!/usr/bin/env node
'use strict';

const process = require('process');

const { program } = require('commander');

const iso = {
  rv32i: [],
  rb64i: []
};

const main = async () => {
  program
    .requiredOption('-i, --isa <type>', 'RISC-V ISA string')
    .parse(process.argv);

  const opts = program.opts();

  const ops = iso[opts.isa];
  if (ops === undefined) {
    console.error('Unknown ISA string:', opts.isa);
  }

};

main();
