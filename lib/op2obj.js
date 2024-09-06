'use strict';

const getGetField = require('./get-get-field.js');

const op2obj = namedFieldo => (txt /* , name*/) => {
  // console.log(name);
  const t1 = txt.split(/\n/);
  const getField = getGetField(namedFieldo);

  const t2 = t1.flatMap(row => {
    row = row.trim();
    if (row === '') return [];
    if (row.slice(0, 1) === '#') return [];
    const els = row.split(/\s+/);
    const first = els.shift();
    if (first === '$pseudo_op') {
      const ref = els.shift().split('::');
      const name = els.shift();
      return [{kind: 'pseudo', ref, name, ...getField(els)}];
    }
    if (first === '$import') {
      const ref = els.shift().split('::');
      return [{kind: 'import', ref}];
    }
    return [{kind: 'leaf', name: first, ...getField(els)}];
  }, []);
  return t2;
};

module.exports = op2obj;

// const arglut = ({
//   rd: [11,7],
//   rt: [19,15], // source+dest register address. Overlaps rs1.
//   rs1: [19,15],
//   rs2: [24,20],
//   rs3: [31,27],
//   aqrl: [26,25],
//   fm: [31,28],
//   pred: [27,24],
//   succ: [23,20],
//   rm: [14,12],
//   funct3: [14,12],
//   imm20: [31,12],
//   jimm20: [31,12],
//   imm12: [31,20],
//   imm12hi: [31,25],
//   bimm12hi: [31,25],
//   imm12lo: [11,7],
//   bimm12lo: [11,7],
//   zimm: [19,15],
//   shamt: [25,20],
//   shamtw: [24,20],
//   bs: [31,30], // byte select for RV32K AES
//   rnum: [23,20], // round constant for RV64 AES
//   // for vectors
//   vd: [11,7],
//   vs3: [11,7],
//   vs1: [19,15],
//   vs2: [24,20],
//   vm: [25,25],
//   wd: [26,26],
//   amoop: [31,27],
//   nf: [31,29],
//   simm5: [19,15],
//   zimm10: [29,20],
//   zimm11: [30,20],
// });

// const classify = n => { /* eslint complexity: 0 */
//   if (n.name.match(/v((macc|nmsac|madd|nmsub|wmaccu|wmacc|wmaccsu)|f(w)?(n)?m(acc|sac|add|sub)).vv/)) return 'opfvvacc';
//   if (n.name.match(/v((macc|nmsac|madd|nmsub|wmaccu|wmacc|wmaccsu|wmaccus)|f(w)?(n)?m(acc|sac|add|sub)).v(f|x)/)) return 'opfvfacc';


//   if (n.name.match(/vmv(\d)r.v/)) return 'opivi';
//   if (n.name.match(/vid.v/)) return 'opivv';
//   if (n.name.match(/vmv.x.s/)) return 'opivvrd';
//   if (n.name.match(/vmv.v.x|vfmv.s.f|vfmv.v.f|vfmerge.vfm|vmv.s.x/)) return 'opfvf';
//   if ('wd'.split(/\s+/).every(e => n.args.includes(e))) return 'vamo';

//   if (n.opcodes['1..0'] === 0) return 'cl';

//   if (n.name.match(/vle(\d+).v/)) return 'vle';
//   if (n.name.match(/vse(\d+).v/)) return 'vse';
//   if (n.name.match(/vluxei(\d+).v/)) return 'vluxei';
//   if (n.name.match(/vsuxei(\d+).v/)) return 'vsuxei';
//   if (n.name.match(/vlse(\d+).v/)) return 'vlse';
//   if (n.name.match(/vsse(\d+).v/)) return 'vsse';
//   if (n.name.match(/vloxei(\d+).v/)) return 'vluxei';
//   if (n.name.match(/vsoxei(\d+).v/)) return 'vsuxei';
//   if (n.name.match(/vl(\d+)re(\d+).v/)) return 'vle';
//   if (n.name.match(/vs(\d+)r.v/)) return 'vse';



//   if (n.name.match(/vfmv.f.s|vmv.v.v|(.vvm$)/)) return 'opfvv';


//   if (        'simm5'.split(/\s+/).every(e => n.args.includes(e))) return 'opivi';
//   if ('vm vs2 rs1 vd'.split(/\s+/).every(e => n.args.includes(e))) return 'opfvf';
//   if ('vm vs2 vs1 vd'.split(/\s+/).every(e => n.args.includes(e))) return 'opfvv';
//   if ('vm vs2     vd'.split(/\s+/).every(e => n.args.includes(e))) return 'opfvv';
//   if ('vm     rs1 vd'.split(/\s+/).every(e => n.args.includes(e))) return 'vle';
//   if (   'vs2 rs1 vd'.split(/\s+/).every(e => n.args.includes(e))) return 'opfvf';
//   if (   'vs2 vs1 vd'.split(/\s+/).every(e => n.args.includes(e))) return 'opivv';
//   if (   'vm vs2 rd'.split(/\s+/).every(e => n.args.includes(e))) return 'opivvrd';




//   if (n.name === 'fence' || n.name === 'fence.tso' || n.name === 'pause') return 'fence';
//   if (n.args.includes('aqrl')) return 'amo';
//   if (n.args.includes('shamt')) return 'ish';
//   if (n.args.includes('shamtw')) return 'ishw';
//   if (n.args.includes('imm20')) return 'u';
//   if (n.args.includes('jimm20')) return 'uj';
//   if (n.name.slice(0, 3) === 'csr') return 'csr';
//   if (n.args.includes('imm12') || n.name === 'ecall' || n.name === 'ebreak') return 'i';
//   if (n.args.includes('imm12hi')) return 's';
//   if (n.args.includes('bimm12hi')) return 'sb';
//   if (n.args.includes('rs3')) return 'r4';
//   return 'r';
// };
