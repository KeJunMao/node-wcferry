"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return _default;
    }
});
const _vite = require("vite");
const _nxtsconfigpathsplugin = require("@nx/vite/plugins/nx-tsconfig-paths.plugin");
const _default = (0, _vite.defineConfig)({
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/ws',
    plugins: [
        (0, _nxtsconfigpathsplugin.nxViteTsPaths)()
    ],
    // Uncomment this if you are using workers.
    // worker: {
    //  plugins: [ nxViteTsPaths() ],
    // },
    test: {
        globals: true,
        cache: {
            dir: '../../node_modules/.vitest'
        },
        environment: 'node',
        include: [
            'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
        ],
        reporters: [
            'default'
        ],
        coverage: {
            reportsDirectory: '../../coverage/packages/ws',
            provider: 'v8'
        }
    }
});

//# sourceMappingURL=vite.config.js.map