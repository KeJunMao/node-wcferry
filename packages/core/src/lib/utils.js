"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    createTmpDir: function() {
        return createTmpDir;
    },
    ensureDirSync: function() {
        return ensureDirSync;
    },
    sleep: function() {
        return sleep;
    },
    uint8Array2str: function() {
        return uint8Array2str;
    }
});
const _interop_require_default = require("@swc/helpers/_/_interop_require_default");
const _fs = require("fs");
const _os = require("os");
const _path = /*#__PURE__*/ _interop_require_default._(require("path"));
function sleep(ms = 1000) {
    return new Promise((res)=>setTimeout(()=>res(), ms));
}
function ensureDirSync(dir) {
    try {
        (0, _fs.mkdirSync)(dir, {
            recursive: true
        });
    } catch (e) {
    // noop
    }
}
function createTmpDir(name = 'wcferry') {
    return _path.default.join((0, _os.tmpdir)(), name);
}
function uint8Array2str(arr) {
    return Buffer.from(arr).toString();
}

//# sourceMappingURL=utils.js.map