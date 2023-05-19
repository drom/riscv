'use strict';

const csrs = {
  // Standard User R/W
  0x000: 'ustatus',
  0x001: 'fflags',
  0x002: 'frm',
  0x003: 'fcsr',
  0x004: 'uie',
  0x005: 'utvec',

  0x008: 'vstart',
  0x009: 'vxsat',
  0x00A: 'vxrm',
  0x00F: 'vcsr',

  0x040: 'uscratch',
  0x041: 'uepc',
  0x042: 'ucause',
  0x043: 'utval',
  0x044: 'uip',
};

// Standard Supervisor R/W
Object.assign(csrs, {
  0x100: 'sstatus',
  0x104: 'sie',
  0x105: 'stvec',
  0x106: 'scounteren',
  0x140: 'sscratch',
  0x141: 'sepc',
  0x142: 'scause',
  0x143: 'stval',
  0x144: 'sip',
  0x180: 'satp',
});

// Standard Hypervisor R/w
Object.assign(csrs, {
  0x200: 'vsstatus',
  0x204: 'vsie',
  0x205: 'vstvec',
  0x240: 'vsscratch',
  0x241: 'vsepc',
  0x242: 'vscause',
  0x243: 'vstval',
  0x244: 'vsip',
  0x280: 'vsatp',

  0x600: 'hstatus',
  0x602: 'hedeleg',
  0x603: 'hideleg',
  0x606: 'hcounteren',
  0x680: 'hgatp'
});

// Tentative CSR assignment for CLIC
Object.assign(csrs, {
  0x007: 'utvt',
  0x045: 'unxti',
  0x046: 'uintstatus',
  0x048: 'uscratchcsw',
  0x049: 'uscratchcswl',

  0x107: 'stvt',
  0x145: 'snxti',
  0x146: 'sintstatus',
  0x148: 'sscratchcsw',
  0x149: 'sscratchcswl',

  0x307: 'mtvt',
  0x345: 'mnxti',
  0x346: 'mintstatus',
  0x348: 'mscratchcsw',
  0x349: 'mscratchcswl'
});

// Standard User RO
Object.assign(csrs, {
  0xC00: 'cycle',
  0xC01: 'time',
  0xC02: 'instret',

  0xC20: 'vl',
  0xC21: 'vtype'
});

for (let i = 3; i < 32; i++) {
  csrs[0xC00 + i] = 'hpmcounter' + i;
}

// Standard Machine R/W
Object.assign(csrs, {
  0x300: 'mstatus',
  0x301: 'misa',
  0x302: 'medeleg',
  0x303: 'mideleg',
  0x304: 'mie',
  0x305: 'mtvec',
  0x306: 'mcounteren',
  0x340: 'mscratch',
  0x341: 'mepc',
  0x342: 'mcause',
  0x343: 'mtval',
  0x344: 'mip',
  0x3a0: 'pmpcfg0',
  0x3a1: 'pmpcfg1',
  0x3a2: 'pmpcfg2',
  0x3a3: 'pmpcfg3',
  0x7a0: 'tselect',
  0x7a1: 'tdata1',
  0x7a2: 'tdata2',
  0x7a3: 'tdata3',
  0x7b0: 'dcsr',
  0x7b1: 'dpc',
  0x7b2: 'dscratch',
  0xB00: 'mcycle',
  0xB02: 'minstret'
});

// Standard Machine RO
Object.assign(csrs, {
  0xF11: 'mvendorid',
  0xF12: 'marchid',
  0xF13: 'mimpid',
  0xF14: 'mhartid',
  0xF15: 'mentropy', // # crypto ext
  0x7A9: 'mnoise'
});

for (let i = 0; i < 16; i++) {
  csrs[0x3b0 + i] = 'pmpaddr' + i;
}

for (let i = 3; i < 32; i++) {
  csrs[0xb00 + i] = 'mhpmcounter' + i;
}

for (let i = 3; i < 32; i++) {
  csrs[0x320 + i] = 'mhpmevent' + i;
}

module.exports = csrs;
