"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _interop_require_default = require("@swc/helpers/_/_interop_require_default");
const _commander = require("commander");
const _packagejson = /*#__PURE__*/ _interop_require_default._(require("../package.json"));
const _ws = require("./lib/ws");
function main() {
    _commander.program.name('wcfwebsocket').version(_packagejson.default.version).description('start a wcferry websocket server').option('-p,--port <number>', 'websocket port', '8000').option('-h,--host <string>', 'websocket host', '127.0.0.1').option('-P,--rpc-port <number>', 'wcferry rpc endpoint', '10086').option('-H, --rpc-host <string>', 'wcferry rpc host. if empty, program will try to execute wcferry.exe', '').action((options)=>{
        _ws.WcfWSServer.start({
            wcferry: {
                port: Number.parseInt(options.rpcPort, 10) || 10086,
                host: options.rpcHost
            },
            ws: {
                port: Number.parseInt(options.port, 10) || 8000,
                host: options.host
            }
        });
    });
    _commander.program.parse();
}
void main();

//# sourceMappingURL=cmd.js.map