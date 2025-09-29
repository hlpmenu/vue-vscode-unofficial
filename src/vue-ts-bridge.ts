
//import type { LanguageClient, LSPAny } from 'vscode-languageclient/node';
import lsp from '@volar/vscode/node';
import type { TsserverBridge } from './tsserver/bridge';
import * as vscode from 'vscode';
import { log } from './debug/log';

/**
 * Sets up the RPC bridge for custom commands between the Vue Language Server and the managed TSServer.
 * 
 * The Vue Language Server communicates with TSServer for TypeScript-related operations 
 * by sending custom notifications prefixed with 'tsserver/'. This function registers handlers 
 * to intercept these notifications, forward them to our managed TSServer instance, 
 * and then send the response back to the Vue Language Server.
 * 
 * @param vueLanguageClient The language client connected to the Vue Language Server.
 * @param tsServerBridge The bridge to our managed TSServer process.
 * @param outputChannel An output channel for logging errors and debug information.
 */
export function registerVueTsserverBridge(
    vueLanguageClient: lsp.LanguageClient,
    tsServerBridge: TsserverBridge,
    outputChannel: vscode.OutputChannel
) {
    // When the Vue server needs TypeScript information, it sends a custom 'tsserver/request' notification.
    // We intercept it, forward it to our managed tsserver, and send the response back.
    vueLanguageClient.onNotification('tsserver/request', async ([seq, command, args]) => {
        log(`[onNotification] Notification:  Seq: ${seq}, Command: ${command}, Args: ${JSON.stringify(args)}`);
        try {
            const body = await tsServerBridge.request(command, args);
            log(`[onNotification] body from tsServerBridge.request : ${JSON.stringify(body)}`);
            // The response is sent back via a 'tsserver/response' notification.
            await vueLanguageClient.sendNotification('tsserver/response', [seq, body]); // @ts-ignore-line
        }
        catch (error) {
            log(`[onNotification] Error: ${String(error)}`);
            outputChannel.appendLine(`[ERROR] TSServer request ${command} failed: ${String(error)}`);
            // Send an error/undefined response back to the Vue server to unblock it.
            await vueLanguageClient.sendNotification('tsserver/response', [seq, undefined]);
        }
    });

    vueLanguageClient.onRequest('tsserver/request', async (args) => {
        log(`[onRequest] Request:  Seq: ${args[0]}, Command: ${args[1]}, Arguments: ${JSON.stringify(args[2])}`);
        try {
            const body = await tsServerBridge.request(args[1], args[2]);
            log(`[onRequest] body from tsServerBridge.request : ${JSON.stringify(body)}`);
            // The response is sent back via a 'tsserver/response' notification.
            await vueLanguageClient.sendNotification('tsserver/response', [args[0], body]); // @ts-ignore-line
        }
        catch (error) {
            log(`[onRequest] Error: ${String(error)}`);
            outputChannel.appendLine(`[ERROR] TSServer request ${args[1]} failed: ${String(error)}`);
            // Send an error/undefined response back to the Vue server to unblock it.
            await vueLanguageClient.sendNotification('tsserver/response', [args[0], undefined]);
        }
    });
}
