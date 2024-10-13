export = Api;
declare class Api {
    constructor(token: any, options: any);
    token: any;
    options: any;
    buildRequest(method: any, params?: {}): {
        headers: {
            'Crypto-Pay-API-Token': any;
        };
        body: string;
    };
    makeRequest({ body, headers }: {
        body: any;
        headers: any;
    }): Promise<any>;
    callApi(method: any, params: any): Promise<any>;
}
