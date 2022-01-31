'use strict';

const opcodes = require('./opcodes.js');
const op2obj = require('./op2obj.js');
const printHeader = require('./print-header.js');
const printInsts = require('./print-insts.js');
const printInsts16 = require('./print-insts-16.js');
const extractNode = require('./extract-node.js');
const extractWeb = require('./extract-web.js');
const tabler = require('./tabler.js');
const c = require('./c.js');

exports.opcodes = opcodes;
exports.op2obj = op2obj;
exports.printHeader = printHeader;
exports.printInsts = printInsts;
exports.printInsts16 = printInsts16;
exports.extractNode = extractNode;
exports.extractWeb = extractWeb;
exports.tabler = tabler;
exports.c = c;
