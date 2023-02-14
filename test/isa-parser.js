'use strict';

const chai = require('chai');
const { isaLangWith, langParser } = require('../lib/');
const expect = chai.expect;

describe('isa-lang-with', async () => {
  it ('isFn', async () => {
    expect(isaLangWith).to.an('function');
    expect(langParser).to.an('function');
  });
  it ('valid 1', async () => {
    const p = langParser(isaLangWith());
    const stt = p('rv64g_zifencei_Sv39_zVe64f1_sscofpmf0p1_xpa64q_xpb1_zicbop');
    expect(stt.body).to.deep.eq([
      { kind: 'b', name: 'g', start: 4, end: 5 },
      { kind: 'z', name: 'zifencei', start: 6, end: 14 },
      { kind: 's', name: 'Sv39', start: 15, end: 19 },
      { kind: 'z', name: 'zVe64f', start: 20, major: 1, end: 27 },
      { kind: 's', name: 'sscofpmf', start: 28, major: 0, minor: 1, end: 39 },
      { kind: 'x', name: 'xpa64q', start: 40, end: 46 },
      { kind: 'x', name: 'xpb', start: 47, major: 1, end: 51 },
      { kind: 'z', name: 'zicbop', start: 52 }
    ]);
  });
  it ('error 1', async () => {
    const p = langParser(isaLangWith());
    const stt = p('foo');
    expect(stt.body).to.deep.eq([
      { error: 'Has to start with RV', start: 0 }
    ]);
  });
  it ('error 2', async () => {
    const p = langParser(isaLangWith());
    const stt = p('Rva23');
    expect(stt.body).to.deep.eq([
      { error: 'Has to start with RV{32,64,128}', start: 2 }
    ]);
  });
  it ('error recovery', async () => {
    const p = langParser(isaLangWith());
    const stt = p('rv64g_zifencei_Sv39_:#$f7_zVe64f1_sscofpmf0p1_xpa64q_xp%b1ertertqer');
    expect(stt.body).to.deep.eq([
      { kind: 'b', name: 'g', start: 4, end: 5 },
      { kind: 'z', name: 'zifencei', start: 6, end: 14 },
      { kind: 's', name: 'Sv39', start: 15, end: 19 },
      {            name: ':#$f7_', error: 'invalid chunk', start: 20, end: 26 },
      { kind: 'z', name: 'zVe64f', start: 26, major: 1, end: 33 },
      { kind: 's', name: 'sscofpmf', start: 34, major: 0, minor: 1, end: 45 },
      { kind: 'x', name: 'xpa64q', start: 46, end: 52 },
      {            name: 'xp%b1ertertqer', error: 'invalid chunk', start: 53, end: 67 }
    ]);
  });

});

/* eslint-env mocha */
