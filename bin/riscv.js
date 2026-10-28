#!/usr/bin/env node
'use strict';

const process = require('process');

const { parseArgs } = require('util');

const { langParser, isaLangWith, renderAnsi, exto } = require('../lib/index.js');

const main = async () => {
  const { values: opts } = parseArgs({
    args: process.argv.slice(2),
    options: {
      isa: {type: 'string'},
      help: {type: 'boolean', short: 'h'}
    }
  });

  if (opts.help) {
    console.log(`Usage: riscv [options]

Options:
  --isa <type>  RISC-V ISA string
  -h, --help    display help for command`);
    return;
  }

  if (opts.isa) {
    const parser = langParser(isaLangWith());
    const stt = parser(opts.isa);
    const str = renderAnsi(stt, exto);
    console.log(str);
  }
};

main();
