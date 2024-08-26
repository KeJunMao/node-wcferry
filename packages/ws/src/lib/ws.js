"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "WcfWSServer", {
    enumerable: true,
    get: function() {
        return WcfWSServer;
    }
});
const _extends = require("@swc/helpers/_/_extends");
const _interop_require_default = require("@swc/helpers/_/_interop_require_default");
const _core = require("@wcferry/core");
const _debug = /*#__PURE__*/ _interop_require_default._(require("debug"));
const _ws = /*#__PURE__*/ _interop_require_default._(require("ws"));
const logger = (0, _debug.default)('wcferry:ws');
const AllowedBuiltinMethods = [
    'acceptNewFriend',
    'addChatRoomMembers',
    'dbSqlQuery',
    'decryptImage',
    'delChatRoomMembers',
    'downloadAttach',
    'downloadImage',
    'forwardMsg',
    'getAliasInChatRoom',
    'getAudioMsg',
    'getChatRoomMembers',
    'getChatRooms',
    'getContact',
    'getContacts',
    'getDbNames',
    'getFriends',
    'getMsgTypes',
    'getOCRResult',
    'getSelfWxid',
    'getUserInfo',
    'inviteChatroomMembers',
    'isLogin',
    'receiveTransfer',
    'refreshPyq',
    'revokeMsg',
    'sendFile',
    'sendImage',
    'sendPat',
    'sendRichText',
    'sendTxt'
];
let WcfWSServer = class WcfWSServer {
    static start(options) {
        const wcferry = new _core.Wcferry(options == null ? void 0 : options.wcferry);
        wcferry.start();
        logger('new websocket server: %O', options == null ? void 0 : options.ws);
        return new WcfWSServer(wcferry, options == null ? void 0 : options.ws);
    }
    listen() {
        this.wss.on('error', (err)=>{
            logger(`Websocket server error: %O`, err);
        });
        this.wss.on('connection', (ws)=>{
            logger('Wcferry websocket server is started...');
            ws.on('error', (err)=>{
                logger(`Websokcet server error: %O`, err);
            });
            ws.on('message', async (data)=>{
                const req = this.parseReq(data.toString('utf8'));
                if (req) {
                    logger('-> recv %s [%s]: %o', req.id, req.method, req.params);
                    if (AllowedBuiltinMethods.some((m)=>m === req.method)) {
                        const ret = await this.executeCommand(req.method, req.params);
                        this.send(ws, req.id, ret);
                    }
                    switch(req.method){
                        case 'recvPyq':
                            var _req_params;
                            this.wcferry.recvPyq = !!((_req_params = req.params) == null ? void 0 : _req_params[0]);
                            this.send(ws, req.id, {
                                result: true
                            });
                            return;
                        case 'message.enable':
                            try {
                                var _this_off;
                                (_this_off = this.off) != null ? _this_off : this.off = this.wcferry.on((msg)=>{
                                    logger('<- msg %o', msg.raw);
                                    ws.send(JSON.stringify({
                                        type: 'message',
                                        data: msg.raw
                                    }));
                                });
                                this.send(ws, req.id, {
                                    result: true
                                });
                            } catch (err) {
                                this.send(ws, req.id, {
                                    error: {
                                        message: this.formatError(err),
                                        code: -2
                                    }
                                });
                            }
                            return;
                        case 'message.disable':
                            try {
                                this.off == null ? void 0 : this.off.call(this);
                                this.send(ws, req.id, {
                                    result: true
                                });
                            } catch (err) {
                                this.send(ws, req.id, {
                                    error: {
                                        message: this.formatError(err),
                                        code: -2
                                    }
                                });
                            }
                    }
                }
            });
        });
    }
    send(ws, id, payload) {
        const resp = _extends._({
            id
        }, payload);
        logger('<- resp %s %o', id, payload);
        ws.send(JSON.stringify(resp));
    }
    async executeCommand(method, params = []) {
        try {
            // eslint-disable-next-line prefer-spread
            const ret = await this.wcferry[method](...params);
            return {
                result: ret
            };
        } catch (err) {
            return {
                error: {
                    message: `Execute ${method} failed: ${this.formatError(err)}`,
                    code: -1
                }
            };
        }
    }
    formatError(err) {
        return err instanceof Error ? err.message : `${err}`;
    }
    parseReq(data) {
        try {
            const json = JSON.parse(data);
            if (typeof json.id === 'number' && typeof json.method === 'string') {
                return json;
            }
            return undefined;
        } catch (e) {
            return undefined;
        }
    }
    close() {
        this.wss.close();
    }
    constructor(wcferry, options){
        this.wcferry = wcferry;
        this.wss = new _ws.default.WebSocketServer(_extends._({
            port: 8000
        }, options));
        this.listen();
    }
};

//# sourceMappingURL=ws.js.map