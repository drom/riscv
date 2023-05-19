'use strict';

const styleLut = {
  b: 'typeName',
  z: 'macroName',
  s: 'propertyName',
  x: 'labelName'
};

const isaLangWith = () => {
  return {
    name: 'riscvIsa',
    startState: function () {
      const body = [];
      return {
        state: 0,
        body,
        append: (o) => {
          body.push(o);
        },
        tail: (o) => Object.assign(body[body.length - 1], o)
      };
    },
    token: function (stream, stt) {
      // console.log(stt);
      const start = stream.pos;
      switch(stt.state) {
      case 0:
        { const m = stream.match(/^rv/i); if (m) { stt.state = 1; return 'namespace'; } }
        stt.append({error: 'Has to start with RV', start});
        break;
      case 1:
        {
          const m = stream.match(/^(?<name>\w\d\d\w)/); if (m) {
            stt.append({kind: 'b', name: m.groups.name, start});
            return 'typeName';
          }
        }
        {
          const m = stream.match(/^(32|64|128)/); if (m) {
            stt.xlen = Number(m[0]);
            stt.state = 2;
            return 'className';
          }
        }
        stt.append({error: 'Has to start with RV{32,64,128}', start});
        break;
      case 2: // extension signature
        { const m = stream.match(/^_+/); if (m) {             return 'comment'; } }

        { const m = stream.match(/^(?<name>(?<kind>[s])(v\d\d))(_|$)/i, false); if (m) {
          const w = stream.match(/^(?<name>(?<kind>[s])(v\d\d))/i);
          let {kind, name} = w.groups;
          kind = kind.toLowerCase();
          stt.append({kind, name, start}); stt.state = 3;  return styleLut[kind];
        } }

        { const m = stream.match(/^(?<name>(?<kind>[zxs])([a-z]+|([0-9]+[a-oq-z]))+(_|$))/i, false); if (m) {
          const w = stream.match(/^(?<name>(?<kind>[zxs])([a-z]+|([0-9]+[a-oq-z]))+)/i);
          let {kind, name} = w.groups;
          kind = kind.toLowerCase();
          stt.append({kind, name, start}); stt.state = 3;  return styleLut[kind];
        } }

        { const m = stream.match(/^(?<name>(?<kind>[zxs])([a-z]+|([0-9]+[a-oq-z]))+([0-9]|_|$))/i, false); if (m) {
          const w = stream.match(/^(?<name>(?<kind>[zxs])([a-z]+|([0-9]+[a-oq-z]))+)/i);
          let {kind, name} = w.groups;
          kind = kind.toLowerCase();
          stt.append({kind, name, start}); stt.state = 3;  return styleLut[kind];
        } }

        // { const m = stream.match(/^z([a-z]+)(_|$|\d)/i, false); if (m) {
        //   const w = stream.match(/^z([a-z]+)/i);
        //   stt.append({kind: 'z', name: w[0], start}); stt.state = 3;  return 'macroName';
        // } }
        // { const m = stream.match(/^x([a-z0-9]+[a-oq-z]|[a-z]+)(_|$|\d)/i, false); if (m) {
        //   const w = stream.match(/^x([a-z0-9]+[a-oq-z]|[a-z]+)/i);
        //   stt.append({kind: 'x', name: w[0], start}); stt.state = 3;  return 'labelName';
        // } }
        { const m = stream.match(/^[a-rt-wy]/i); if (m) {
          stt.append({kind: 'b', name: m[0], start}); stt.state = 3;  return 'typeName';
        } }
        stt.append({error: 'invalid chunk', start});
        stt.state = 6;
        return null;
      case 3: // major in version
        { const m = stream.match(/^\d+/); if (m) {
          stt.tail({major: Number(m[0])});
          stt.state = 4;
          return 'number';
        } }
        stt.tail({end: stream.pos});
        stt.state = 2;
        return null;
      case 4: // period in version
        { const m = stream.match(/^p/i); if (m) {
          stt.state = 5;
          return 'punctuation';
        } }
        stt.tail({end: stream.pos});
        stt.state = 2;
        return null;
      case 5: // minor in version
        { const m = stream.match(/^\d+/); if (m) {
          stt.tail({minor: Number(m[0]), end: stream.pos});
          stt.state = 2;
          return 'number';
        } }
        break;
      case 6: // error recovery
        { const m = stream.match(/[^_]*(_|$)/); if (m) {
          stt.tail({name: m[0], end: stream.pos});
          stt.state = 2;
          return 'invalid';
        } }
        break;
      default: {
        const m = stream.match(/^\w/);
        if (m) {
          return 'comment';
        }
      }
      }
      stream.skipToEnd();
      // console.log(stt);
      return 'comment';
    }
  };
} /* eslint complexity: [1, 30] */;

module.exports = isaLangWith;
