#!/usr/bin/env node
'use strict';

const process = require('process');

const { program } = require('commander');

const { langParser, isaLangWith, renderAnsi, exto } = require('../lib/index.js');

const main = async () => {
  program
    .option('--isa <type>', 'RISC-V ISA string')
    .parse(process.argv);

  const opts = program.opts();

  if (opts.isa) {
    const parser = langParser(isaLangWith());
    const stt = parser(opts.isa);
    const str = renderAnsi(stt, exto);
    console.log(str);
  }
};

main();
