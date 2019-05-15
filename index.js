'use strict';

const pkg = require('./package.json');

const opcodes = require('./opcodes.json');
const opcodesCustom = require('./opcodes-custom.json');
const opcodesPseudo = require('./opcodes-pseudo.json');
const opcodesRvc = require('./opcodes-rvc.json');
const opcodesRvcPseudo = require('./opcodes-rvc-pseudo.json');

exports.pkg = pkg;
exports.opcodes = opcodes;
exports.opcodesCustom = opcodesCustom;
exports.opcodesPseudo = opcodesPseudo;
exports.opcodesRvc = opcodesRvc;
exports.opcodesRvcPseudo = opcodesRvcPseudo;
