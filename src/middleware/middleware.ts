import type { Middleware } from 'vscode-languageclient/node';
import type { TsserverBridge } from '../tsserver/bridge';
import { log } from '../debug/log';
import hoverProvider from './hover';

export const createMiddleware = (
    tsServerBridge: TsserverBridge, // oxlint-disable-line
): Middleware => {
    const middleware: Middleware = {
        handleDiagnostics(uri, diagnostics, next) {
            log('[Middleware.handleDiagnostics]', uri.toString(), JSON.stringify(diagnostics, null, 2));
            next(uri, diagnostics);
        },
        provideHover: hoverProvider,
        provideDefinition(document, position, token, next) {
            log('[Middleware.provideDefinition.request]', JSON.stringify({ uri: document.uri.toString(), position }, null, 2));
            return Promise.resolve(next(document, position, token)).then(res => {
                log('[Middleware.provideDefinition.result]', JSON.stringify(res, null, 2));
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
