'use strict';

const langParser = (lang) => {
  const state = lang.startState();
  const stream = {
    pos: 0
  };

  stream.match = (regx, consume) => {
    const sub = stream.string.slice(stream.pos);
    const m = sub.match(regx);
    if (m && ((consume === undefined) || (consume === true))) {
      stream.pos += m[0].length;
    }
    return m;
  };

  stream.skipToEnd = () => {
    stream.pos = stream.string.length;
  };

  return (string) => {
    stream.string = string;
    while (stream.pos < stream.string.length) {
      lang.token(stream, state);
    }
    return state;
  };
};

module.exports = langParser;
