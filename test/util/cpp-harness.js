'use strict';

// compile C++ dasm sources from dasmCpp and run them on instruction words

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// first working C++ compiler: $CXX, c++, g++, clang++ (null: none)
let found;
const compiler = () => {
  if (found !== undefined) return found;
  found = null;
  for (const cxx of [process.env.CXX, 'c++', 'g++', 'clang++'].filter(Boolean)) {
    const r = spawnSync(cxx, ['--version'], {encoding: 'utf8'});
    if (r.status === 0) {
      found = cxx;
      break;
    }
  }
  return found;
};

const program = (gen) => (gen.style === 'header')
  ? gen.lines.join('\n') + `

#include <string>

int main () {
  std::string line;
  while (std::getline(std::cin, line)) {
    ${gen.namespace}::dasm(std::cout, (uint32_t)std::stoul(line, nullptr, 16));
    std::cout << "\\n";
  }
  return 0;
}
`
  : `\
#include <cstdint>
#include <iostream>
#include <iomanip>
#include <string>

template <unsigned XLEN>
struct D {
${gen.lines.join('\n')}
};

int main () {
  D<0> d;
  std::string line;
  while (std::getline(std::cin, line)) {
    d.dasm(std::cout, (uint32_t)std::stoul(line, nullptr, 16));
    std::cout << "\\n";
  }
  return 0;
}
`;

// gen: {lines, style, namespace} -> run(words) -> [text]
const build = (gen, name) => {
  const cxx = compiler();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'riscv-dasm-cpp-'));
  const base = path.join(dir, name.replace(/\W/g, '_'));
  fs.writeFileSync(base + '.cpp', program(gen));
  const cc = spawnSync(cxx, ['-std=c++11', '-O0', '-Wall', '-Wextra', '-Werror', '-o', base, base + '.cpp'], {encoding: 'utf8'});
  if (cc.status !== 0) {
    throw new Error(name + ': compile failed\n' + cc.stderr.split('\n').slice(0, 30).join('\n'));
  }
  const run = (words) => {
    const r = spawnSync(base, [], {
      input: words.map(w => (w >>> 0).toString(16)).join('\n') + '\n',
      encoding: 'utf8',
      maxBuffer: 1 << 30
    });
    return r.stdout.split('\n').slice(0, words.length);
  };
  run.cleanup = () => fs.rmSync(dir, {recursive: true, force: true});
  return run;
};

// xorshift32 random words
const rng = (seed = 0x12345678) => () => {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed;
};

// per candidate n random encodings (fixed bits from mask / valu) + random words
const samples = (cands, n, rnd = rng()) => {
  const res = [];
  for (const c of cands) {
    for (let i = 0; i < n; i++) {
      let w = ((rnd() & ~c.mask) | c.valu) >>> 0;
      if (c.len === 2) w &= 0xffff;
      res.push(w);
    }
  }
  for (let i = 0; i < 64 * n; i++) {
    res.push(rnd());
    res.push(rnd() & 0xffff);
  }
  return res;
};

module.exports = {compiler, build, samples, rng};
