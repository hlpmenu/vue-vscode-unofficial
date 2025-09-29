import * as vscode from 'vscode';
import { Middleware } from 'vscode-languageclient/node';
import { TsserverBridge } from '../tsserver/bridge';
import { log } from '../debug/log';

export const createMiddleware = (
    tsServerBridge: TsserverBridge,
    vueOutputChannel: vscode.OutputChannel,
): Middleware => {
    const middleware: Middleware = {
        handleDiagnostics(uri, diagnostics, next) {
            log('[Middleware.handleDiagnostics]', uri.toString(), JSON.stringify(diagnostics, null, 2));
            next(uri, diagnostics);
        },
        async provideHover(document, position, token, next) {
            log('[Middleware.provideHover.request]', JSON.stringify({ uri: document.uri.toString(), position }, null, 2));
            const res = await next(document, position, token);
            log('[Middleware.provideHover.result]', JSON.stringify(res, null, 2));
            if (res) return res;


            const args = {
                file: document.uri.fsPath,         // absolute path
                line: position.line + 1,           // 1-based
                offset: position.character + 1     // 1-based
            };
            const tsRes = await tsServerBridge.request('_vue:quickinfo', args);
            if (typeof tsRes === 'undefined') {
                return null;
            }
            vueOutputChannel.appendLine(`tsRes: ${JSON.stringify(tsRes, null, 2)}`);

            log('[Middleware.provideHover.tsResult]', JSON.stringify(tsRes, null, 2));
            if (tsRes) return tsRes as never;  
            
        },
        provideDefinition(document, position, token, next) {
            log('[Middleware.provideDefinition.request]', JSON.stringify({ uri: document.uri.toString(), position }, null, 2));
            return Promise.resolve(next(document, position, token)).then(res => {
                log('[Middleware.provideDefinition.result]', JSON.stringify(res, null, 2));
                return res;
            });
        },
        provideDocumentHighlights(document, position, token, next) {
            log('[Middleware.provideDocumentHighlights.request]', JSON.stringify({ uri: document.uri.toString(), position }, null, 2));
            return Promise.resolve(next(document, position, token)).then(res => {
                log('[Middleware.provideDocumentHighlights.result]', JSON.stringify(res, null, 2));
                return res;
            });
        },
        provideCodeActions(document, range, context, token, next) {
            log('[Middleware.provideCodeActions.request]', JSON.stringify({ uri: document.uri.toString(), range, context }, null, 2));
            return Promise.resolve(next(document, range, context, token)).then(res => {
                log('[Middleware.provideCodeActions.result]', JSON.stringify(res, null, 2));
                return res;
            });
        },
        // Some clients/versions expose inlay hints via middleware as well
        // If unsupported, this will be ignored by the client typings at runtime
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        provideInlayHints(document: any, range: any, token: any, next: any) {
            try {
                log('[Middleware.provideInlayHints.request]', JSON.stringify({ uri: document.uri?.toString?.(), range }, null, 2));
            } catch {
                // ignore
            }
            return Promise.resolve(next(document, range, token)).then((res: unknown) => {
                log('[Middleware.provideInlayHints.result]', JSON.stringify(res, null, 2));
                return res as never;
            });
        },
    };
    return middleware;
};
