'use strict';

const pkg = require('./package.json');

const opcodes = require('./opcodes.json');
const opcodesCustom = require('./opcodes-custom.json');
const opcodesPseudo = require('./opcodes-pseudo.json');
const opcodesRvc = require('./opcodes-rvc.json');
const opcodesRvcPseudo = require('./opcodes-rvc-pseudo.json');
const opcodesRvv = require('./opcodes-rvv.json');
const opcodesRvvPseudo = require('./opcodes-rvv-pseudo.json');

exports.pkg = pkg;
exports.opcodes = opcodes;
exports.opcodesCustom = opcodesCustom;
exports.opcodesPseudo = opcodesPseudo;
exports.opcodesRvc = opcodesRvc;
exports.opcodesRvcPseudo = opcodesRvcPseudo;
exports.opcodesRvv = opcodesRvv;
exports.opcodesRvvPseudo = opcodesRvvPseudo;
