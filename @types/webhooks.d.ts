export = Webhooks;
declare class Webhooks {
    constructor(token: any, options: any, updateHandler: any);
    token: any;
    options: any;
    updateHandler: any;
    webhookServer: import("https").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse> | import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
    handleRequest(update: any, headers: any): void;
    verifyUpdate(update: any, signature: any): boolean;
    webhookCallbackFabric(webhookPath: any, requestHandler: any): (req: any, res: any, next: any) => any;
}
