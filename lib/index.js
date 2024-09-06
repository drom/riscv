'use strict';

const opcodes = require('./opcodes.js');
const fieldo = require('./fieldo.js');
const kindo = require('./kindo.js');
const fieldEnums = require('./field-enums.js');
const csrs = require('./csrs.js');
const extractNode = require('./extract-node.js');
const op2obj = require('./op2obj.js');
const jsonStringify = require('../lib/json-stringify.js');
const isaLangWith = require('./isa-lang-with.js');
const langParser = require('./lang-parser.js');
const extensions = require('./extensions.json');
const renderAnsi = require('./render-ansi.js');
const exto = require('./exto.js');
const getCount = require('./get-count.js');
const hashOpcodes = require('./hash-opcodes.js');
const filterOpcodes = require('./filter-opcodes.js');
const dasm = require('./dasm.js');


// const printHeader = require('./print-header.js');
// const printInsts = require('./print-insts.js');
// const printInsts16 = require('./print-insts-16.js');
// const extractWeb = require('./extract-web.js');
// const c = require('./c.js');
// const v = require('./v.js');

exports.opcodes = opcodes;
exports.fieldo = fieldo;
exports.kindo = kindo;
exports.fieldEnums = fieldEnums;
exports.csrs = csrs;
exports.extractNode = extractNode;
exports.op2obj = op2obj;
exports.jsonStringify = jsonStringify;
exports.isaLangWith = isaLangWith;
exports.langParser = langParser;
exports.extensions = extensions;
exports.renderAnsi = renderAnsi;
exports.exto = exto;
exports.getCount = getCount;
exports.hashOpcodes = hashOpcodes;
exports.filterOpcodes = filterOpcodes;
exports.dasm = dasm;

// exports.printHeader = printHeader;
// exports.printInsts = printInsts;
// exports.printInsts16 = printInsts16;
// exports.extractWeb = extractWeb;
// exports.tabler = tabler;
// exports.c = c;
// exports.v = v;
