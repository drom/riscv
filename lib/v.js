'use strict';

const range = require('lodash.range');

const _ = {range};

const pusher = (labels, fields, opo) => (label, reg) => {
  opo[label] = {reg};
  labels.push(label);
  fields.push(...reg);
};

const v = {
  // configuration setting
  // https://github.com/riscv/riscv-v-spec/blob/master/vcfg-format.adoc
  // print_insts(Object.keys(opcodesAll.rvv).filter(e => e.match(/vset/)))
  rvv_6: (labels, fields, opo) => {
    const p = pusher(labels, fields, opo);
    p('VSETVLI', [
      {bits: 7,  name: 0x57},
      {bits: 5,  name: 'rd', type: 2},
      {bits: 3,  name: 7},
      {bits: 5,  name: 'rs1', type: 4},
      {bits: 11, name: 'zimm[10:0]', type: 3},
      {bits: 1,  name: '0'}
    ]);
    p('VSETIVLI', [
      {bits: 7,  name: 0x57},
      {bits: 5,  name: 'rd', type: 2},
      {bits: 3,  name: 7},
      {bits: 5,  name: 'uimm[4:0]', type: 3},
      {bits: 10, name: 'zimm[9:0]', type: 3},
      {bits: 1,  name: '1'},
      {bits: 1,  name: '1'}
    ]);
    p('VSETVL', [
      {bits: 7,  name: 0x57},
      {bits: 5,  name: 'rd', type: 2},
      {bits: 3,  name: 7},
      {bits: 5,  name: 'rs1', type: 4},
      {bits: 5,  name: 'rs2', type: 4},
      {bits: 6,  name: 0x1000},
      {bits: 1,  name: 1}
    ]);
  },
  // https://github.com/riscv/riscv-v-spec/blob/master/vmem-format.adoc
  // Vector Unit-Stride Instructions (including segment part)
  // https://github.com/riscv/riscv-v-spec/blob/master/v-spec.adoc#74-vector-unit-stride-instructions
  // print_insts(Object.keys(opcodesAll.rvv).filter(e => e.match(/v[ls]e(8|16|32|64).v/)))
  // Vector Loads and Store
  rvv_7_4: (labels, fields, opo) => {
    const p = pusher(labels, fields, opo);
    [0, 1].map(t => {
      [0, 5, 6, 7].map((eew, ieew) => {
        p('V' + (t ? 'S' : 'L') + 'E' + (2 ** (ieew + 3)) + '.V', [
          {bits: 7,  name: 0x7 + (t << 5)},
          {bits: 5,  name: '<b>v' + (t ? 's3' : 'd'), type: t ? 4 : 2},
          {bits: 3,  name: eew},
          {bits: 5,  name: 'rs1', type: 4},
          {bits: 5,  name: 0},
          {bits: 1,  name: 'vm'},
          {bits: 2,  name: 0},
          {bits: 1,  name: 0},
          {bits: 3,  name: 0},
        ]);
      });
    });
    p('VLM.V', [
      {bits: 7,  name: 0x7},
      {bits: 5,  name: '<b>vd', type: 2},
      {bits: 3,  name: 0},
      {bits: 5,  name: 'rs1', type: 4},
      {bits: 5,  name: 11},
      {bits: 1,  name: 1},
      {bits: 2,  name: 0},
      {bits: 1,  name: 0},
      {bits: 3,  name: 0}
    ]);
    p('VSM.V', [
      {bits: 7,  name: 0x27},
      {bits: 5,  name: '<b>vs3', type: 4},
      {bits: 3,  name: 0},
      {bits: 5,  name: 'rs1', type: 4},
      {bits: 5,  name: 11},
      {bits: 1,  name: 1},
      {bits: 2,  name: 0},
      {bits: 1,  name: 0},
      {bits: 3,  name: 0}
    ]);
  },
  // Vector Strided Instructions (including segment part)
  // https://github.com/riscv/riscv-v-spec/blob/master/v-spec.adoc#75-vector-strided-instructions
  // print_insts(Object.keys(opcodesAll.rvv).filter(e => e.match(/v[ls]se\d\d?.v/)))
  rvv_7_5: (labels, fields, opo) => {
    const p = pusher(labels, fields, opo);
    [0, 1].map(t => {
      [0, 5, 6, 7].map((eew, ieew) => {
        p('V' + (t ? 'S' : 'L') + 'SE' + (2 ** (ieew + 3)) + '.V', [
          {bits: 7,  name: 0x7 + (t << 5)},
          {bits: 5,  name: '<b>v' + (t ? 's3' : 'd'), type: t ? 4 : 2},
          {bits: 3,  name: eew},
          {bits: 5,  name: 'rs1', type: 4},
          {bits: 5,  name: 'rs2', type: 4},
          {bits: 1,  name: 'vm'},
          {bits: 2,  name: 2},
          {bits: 1,  name: 0},
          {bits: 3,  name: 0}
        ]);
      });
    });
  },
  // Vector Indexed-Unordered Instructions (including segment part)
  // https://github.com/riscv/riscv-v-spec/blob/master/v-spec.adoc#76-vector-indexed-instructions
  // print_insts(Object.keys(opcodesAll.rvv).filter(e => e.match(/v[ls]uxei\d\d?.v/)))
  rvv_7_6: (labels, fields, opo) => {
    const p = pusher(labels, fields, opo);
    [0, 1].map(t => {
      [0, 5, 6, 7].map((eew, ieew) =>
        p('V' + (t ? 'S' : 'L') + 'UXEI' + (2 ** (ieew + 3)) + '.V', [
          {bits: 7,  name: 0x7 + (t << 5)},
          {bits: 5,  name: '<b>v' + (t ? 's3' : 'd'), type: t ? 4 : 2},
          {bits: 3,  name: eew},
          {bits: 5,  name: 'rs1', type: 4},
          {bits: 5,  name: '<b>vs2', type: 4},
          {bits: 1,  name: 'vm'},
          {bits: 2,  name: 1},
          {bits: 1,  name: 0},
          {bits: 3,  name: 0},
        ])
      );
    });
    [0, 1].map(t => {
      [0, 5, 6, 7].map((eew, ieew) =>
        p('V' + (t ? 'S' : 'L') + 'OXEI' + (2 ** (ieew + 3)) + '.V', [
          {bits: 7,  name: 0x7 + (t << 5)},
          {bits: 5,  name: '<b>v' + (t ? 's3' : 'd'), type: t ? 4 : 2},
          {bits: 3,  name: eew},
          {bits: 5,  name: 'rs1', type: 4},
          {bits: 5,  name: '<b>vs2', type: 4},
          {bits: 1,  name: 'vm'},
          {bits: 2,  name: 3},
          {bits: 1,  name: 0},
          {bits: 3,  name: 0},
        ])
      );
    });
  },
  // Unit-stride F31..29=0ault-Only-First Loads
  // https://github.com/riscv/riscv-v-spec/blob/master/v-spec.adoc#77-unit-stride-fault-only-first-loads
  // print_insts(Object.keys(opcodesAll.rvv).filter(e => e.match(/vle\d\d?ff.v/)))
  rvv_7_7: (labels, fields, opo) => {
    const p = pusher(labels, fields, opo);
    [0, 5, 6, 7].map((eew, ieew) => {
      p('VLE' + (2 ** (ieew + 3)) + 'FF.V', [
        {bits: 7,  name: 0x7},
        {bits: 5,  name: '<b>vd', type: 2},
        {bits: 3,  name: eew},
        {bits: 5,  name: 'rs1', type: 4},
        {bits: 5,  name: 16},
        {bits: 1,  name: 'vm'},
        {bits: 2,  name: 0},
        {bits: 1,  name: 0},
        {bits: 3,  name: 0},
      ]);
    });
  },
  rvv_7_8_1_1: (labels, fields, opo) => {
    const p = pusher(labels, fields, opo);
    [0, 5, 6, 7].map((eew, ieew) => {
      _.range(7).map(nf => {
        p('VLSEG' + (nf + 2) + 'E' + (2 ** (ieew + 3)) + '.V', [
          {bits: 7,  name: 0x7},
          {bits: 5,  name: '<b>vd', type: 2},
          {bits: 3,  name: eew},
          {bits: 5,  name: 'rs1', type: 4},
          {bits: 5,  name: 0},
          {bits: 1,  name: 'vm'},
          {bits: 2,  name: 0},
          {bits: 1,  name: 0},
          {bits: 3,  name: nf + 1}
        ]);
      });
    });
  },
  rvv_7_8_1_2: (labels, fields, opo) => {
    const p = pusher(labels, fields, opo);
    [0, 5, 6, 7].map((eew, ieew) => {
      _.range(7).map(nf =>
        p('VSSEG' + (nf + 2) + 'E' + (2 ** (ieew + 3)) + '.V', [
          {bits: 7,  name: 0x27},
          {bits: 5,  name: '<b>vs3', type: 4},
          {bits: 3,  name: eew},
          {bits: 5,  name: 'rs1', type: 4},
          {bits: 5,  name: 0},
          {bits: 1,  name: 'vm'},
          {bits: 2,  name: 0},
          {bits: 1,  name: 0},
          {bits: 3,  name: nf + 1}
        ])
      );
    });
  },
  rvv_7_8_2_1: (labels, fields, opo) => {
    const p = pusher(labels, fields, opo);
    [0, 5, 6, 7].map((eew, ieew) => {
      _.range(7).map(nf => {
        p('VLSSEG' + (nf + 2) + 'EI' + (2 ** (ieew + 3)) + '.V', [
          {bits: 7,  name: 0x7},
          {bits: 5,  name: '<b>vd', type: 2},
          {bits: 3,  name: eew},
          {bits: 5,  name: 'rs1', type: 4},
          {bits: 5,  name: 'rs2', type: 4},
          {bits: 1,  name: 'vm'},
          {bits: 2,  name: 2},
          {bits: 1,  name: 0},
          {bits: 3,  name: nf + 1},
        ]);
      });
    });
  },
  rvv_7_8_2_2: (labels, fields, opo) => {
    const p = pusher(labels, fields, opo);
    [0, 5, 6, 7].map((eew, ieew) => {
      _.range(7).map(nf => {
        p('VSSSEG' + (nf + 2) + 'EI' + (2 ** (ieew + 3)) + '.V', [
          {bits: 7,  name: 0x27},
          {bits: 5,  name: '<b>vs3', type: 4},
          {bits: 3,  name: eew},
          {bits: 5,  name: 'rs1', type: 4},
          {bits: 5,  name: 'rs2', type: 4},
          {bits: 1,  name: 'vm'},
          {bits: 2,  name: 2},
          {bits: 1,  name: 0},
          {bits: 3,  name: nf + 1},
        ]);
      });
    });
  },
  rvv_7_8_3_1: (labels, fields, opo) => {
    const p = pusher(labels, fields, opo);
    [0, 5, 6, 7].map((eew, ieew) => {
      _.range(7).map(nf => {
        p('VLUXSEG' + (nf + 2) + 'EI' + (2 ** (ieew + 3)) + '.V', [
          {bits: 7,  name: 0x7},
          {bits: 5,  name: '<b>vd', type: 2},
          {bits: 3,  name: eew},
          {bits: 5,  name: 'rs1', type: 4},
          {bits: 5,  name: '<b>vs2', type: 4},
          {bits: 1,  name: 'vm'},
          {bits: 2,  name: 1},
          {bits: 1,  name: 0},
          {bits: 3,  name: nf + 1},
        ]);
      });
    });
  },
  rvv_7_8_3_2: (labels, fields, opo) => {
    const p = pusher(labels, fields, opo);
    [0, 5, 6, 7].map((eew, ieew) => {
      _.range(7).map(nf => {
        p('VSUXSEG' + (nf + 2) + 'EI' + (2 ** (ieew + 3)) + '.V', [
          {bits: 7,  name: 0x27},
          {bits: 5,  name: '<b>vs3', type: 4},
          {bits: 3,  name: eew},
          {bits: 5,  name: 'rs1', type: 4},
          {bits: 5,  name: '<b>vs2', type: 4},
          {bits: 1,  name: 'vm'},
          {bits: 2,  name: 1},
          {bits: 1,  name: 0},
          {bits: 3,  name: nf + 1},
        ]);
      });
    });
  },
  rvv_7_8_3_3: (labels, fields, opo) => {
    const p = pusher(labels, fields, opo);
    [0, 5, 6, 7].map((eew, ieew) => {
      _.range(7).map(nf => {
        p('VLOXSEG' + (nf + 2) + 'EI' + (2 ** (ieew + 3)) + '.V', [
          {bits: 7,  name: 0x7},
          {bits: 5,  name: '<b>vd', type: 2},
          {bits: 3,  name: eew},
          {bits: 5,  name: 'rs1', type: 4},
          {bits: 5,  name: '<b>vs2', type: 4},
          {bits: 1,  name: 'vm'},
          {bits: 2,  name: 3},
          {bits: 1,  name: 0},
          {bits: 3,  name: nf + 1},
        ]);
      });
    });
  },
  rvv_7_8_3_4: (labels, fields, opo) => {
    const p = pusher(labels, fields, opo);
    [0, 5, 6, 7].map((eew, ieew) => {
      _.range(7).map(nf => {
        p('VSOXSEG' + (nf + 2) + 'EI' + (2 ** (ieew + 3)) + '.V', [
          {bits: 7,  name: 0x27},
          {bits: 5,  name: '<b>vs3', type: 4},
          {bits: 3,  name: eew},
          {bits: 5,  name: 'rs1', type: 4},
          {bits: 5,  name: '<b>vs2', type: 4},
          {bits: 1,  name: 'vm'},
          {bits: 2,  name: 3},
          {bits: 1,  name: 0},
          {bits: 3,  name: nf + 1},
        ]);
      });
    });
  },
  rvv_7_8_3_5: (labels, fields, opo) => {
    const p = pusher(labels, fields, opo);
    [0, 1, 2, 3].map(eew => {
      _.range(7).map(nf => {
        p('VLSEG' + (nf + 2) + 'E' + (2 ** (eew + 3)) + 'FF.V', [
          {bits: 7,  name: 0x7},
          {bits: 5,  name: '<b>vd', type: 2},
          {bits: 3,  name: eew},
          {bits: 5,  name: 'rs1', type: 4},
          {bits: 5,  name: 16},
          {bits: 1,  name: 'vm'},
          {bits: 2,  name: 0},
          {bits: 1,  name: 0},
          {bits: 3,  name: nf + 1},
        ]);
      });
    });
  }
};

module.exports = v;
