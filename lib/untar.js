'use strict';

const zlib = require('zlib');

// Minimal tar(.gz) reader: returns [{path, data: Buffer}] for regular files
// accepted by filter(path). Handles ustar prefix, pax 'x' path and GNU 'L'
// long names (as produced by GitHub tarballs).

const str = (buf, start, len) => {
  const s = buf.toString('utf8', start, start + len);
  const z = s.indexOf('\0');
  return (z === -1) ? s : s.slice(0, z);
};

const parsePax = (buf) => {
  const res = {};
  let i = 0;
  while (i < buf.length) {
    const sp = buf.indexOf(0x20, i);
    if (sp === -1) break;
    const len = Number(buf.toString('utf8', i, sp));
    if (!len) break;
    const rec = buf.toString('utf8', sp + 1, i + len - 1); // without '\n'
    const eq = rec.indexOf('=');
    res[rec.slice(0, eq)] = rec.slice(eq + 1);
    i += len;
  }
  return res;
};

const untar = (input, filter = () => true) => {
  const buf = (input[0] === 0x1f && input[1] === 0x8b) ? zlib.gunzipSync(input) : input;
  const res = [];
  let off = 0;
  let longName;
  while (off + 512 <= buf.length) {
    const name = str(buf, off, 100);
    if (name === '') break; // end of archive
    const size = parseInt(str(buf, off + 124, 12).trim() || '0', 8);
    const type = String.fromCharCode(buf[off + 156] || 0x30);
    const prefix = (str(buf, off + 257, 5) === 'ustar') ? str(buf, off + 345, 155) : '';
    const body = buf.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === 'x') {
      longName = parsePax(body).path || longName;
      continue;
    }
    if (type === 'L') {
      longName = str(body, 0, body.length);
      continue;
    }
    if (type === 'g') continue; // global pax header
    const path = longName || (prefix ? prefix + '/' + name : name);
    longName = undefined;
    if ((type === '0' || type === '\0') && filter(path)) {
      res.push({path, data: Buffer.from(body)});
    }
  }
  return res;
};

module.exports = untar;
