'use strict';

const xabi = [
  'zero', // Hard-wired zero
  'ra', // Return address
  'sp', // Stack pointer
  'gp', // Global pointer
  'tp', // Thread pointer
  't0', 't1', 't2', // Temporaries
  's0', 's1', // Saved registers
  'a0', 'a1', // Function arguments/return values
  'a2', 'a3', 'a4', 'a5', 'a6', 'a7', // Function arguments
  's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11',
  't3', 't4', 't5', 't6'
];

const fabi = [
  'ft0', 'ft1', 'ft2', 'ft3', 'ft4', 'ft5', 'ft6', 'ft7', // FP temporaries
  'fs0', 'fs1', // FP saved registers
  'fa0', 'fa1', // FP Function arguments/return values
  'fa2', 'fa3', 'fa4', 'fa5', 'fa6', 'fa7', // FP Function arguments
  'fs2', 'fs3', 'fs4', 'fs5', 'fs6', 'fs7', 'fs8', 'fs9', 'fs10', 'fs11',
  'ft8', 'ft9', 'ft10', 'ft11'
];

const xabic = ['s0', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5'];

const fabic = ['fs0', 'fs1', 'fa0', 'fa1', 'fa2', 'fa3', 'fa4', 'fa5'];

const rmlut = [
  'rne',  // 0: Round to Nearest, ties to Even
  'rtz',  // 1: Round towards Zero
  'rtn',  // 2: Round Down (towards
  'rup',  // 3: Round Up (towards
  'rmm',  // 4: Round to Nearest, ties to Max Magnitude
  'rsv',  // 5: Reserved for future use.
  'rsv',  // 6: Reserved for future use.
  'dyn'   // 7: In instruction’s rm field, selects dynamic rounding mode;
  //            In Rounding Mode register, reserved.
];

exports.xabi = xabi;
exports.fabi = fabi;
exports.xabic = xabic;
exports.fabic = fabic;
exports.rmlut = rmlut;
