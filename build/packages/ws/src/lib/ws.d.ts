import { Wcferry, WcferryOptions } from '@wcferry/core';
import ws from 'ws';
export interface IncomingMessage {
    id: string;
    method: string;
    params?: unknown[];
}
export declare class WcfWSServer {
    private wcferry;
    private wss;
    constructor(wcferry: Wcferry, options?: ws.ServerOptions);
    static start(options?: {
        wcferry: WcferryOptions;
        ws: ws.ServerOptions;
    }): WcfWSServer;
    private off?;
    private listen;
    send(ws: ws.WebSocket, id: string, payload: {
        result: unknown;
    } | {
        error: {
            message: string;
            code?: number;
        };
    }): void;
    private executeCommand;
    private formatError;
    private parseReq;
    close(): void;
}
//# sourceMappingURL=ws.d.ts.map