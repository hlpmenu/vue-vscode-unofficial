import * as path from 'node:path';
import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    Trace,
} from 'vscode-languageclient/node';
import * as lsp from 'vscode-languageclient/node';
import { createMiddleware } from './src/middleware/middleware';
import type { Middleware } from 'vscode-languageclient';

// We will also need the original files for the TsserverBridge
import { TsserverBridge, TsserverOptions } from './src/tsserver/bridge';
import { setBridge } from './src/tsserver/client';
// We will need this in the next step, but let's import it now.
import { registerVueTsserverBridge } from './src/vue-ts-bridge';
import { setuo as setupLog } from './src/debug/log';
import { log } from './src/debug/log';
let vueLanguageClient: LanguageClient;
let tsServerBridge: TsserverBridge; // The bridge to our managed tsserver
let vueOutputChannel: vscode.OutputChannel;



export async function activate(context: vscode.ExtensionContext) {

    setupLog(context);
    console.log('Activating Vue LSP client with TsserverBridge.');

    

    vueOutputChannel = vscode.window.createOutputChannel('Vue Language Server');
    const tsOutputChannel = vscode.window.createOutputChannel('Vue TypeScript Server');
    context.subscriptions.push(vueOutputChannel, tsOutputChannel);

    // --- 1. Initialize our managed TypeScript Server ---
    // This part is from your old file, responsible for setting up and
    // finding the right tsserver.js and plugin paths.
    const tsPath = path.dirname(require.resolve('typescript'));
    const tsServerPath = path.join(tsPath, 'tsserver.js');
    const tsDkPath = path.join(tsPath, 'typescriptServices.js');
    // Assuming the plugin is in the workspace's node_modules for now
    const vuePluginModulePath = path.dirname(require.resolve('@vue/typescript-plugin/package.json', { paths: [context.extensionPath] }));

    const tsserverOptions: TsserverOptions = {
        tsserverPath: tsServerPath,
        pluginName: '@vue/typescript-plugin', // The name of the plugin to load
        pluginProbeLocations: [vuePluginModulePath],
    };

    tsServerBridge = new TsserverBridge(tsserverOptions, tsOutputChannel, context.globalStorageUri.fsPath);
    setBridge(tsServerBridge);
    context.subscriptions.push(tsServerBridge);


    // --- 2. Initialize the Vue Language Server ---
    const vueServerModulePath = context.asAbsolutePath(
        path.join('node_modules', '@vue', 'language-server', 'bin', 'vue-language-server.js')
    );

    const serverOptions: ServerOptions = {

        
        run: { module: vueServerModulePath, transport: TransportKind.stdio },
        debug: { module: vueServerModulePath, transport: TransportKind.stdio, options: { execArgv: ['--nolazy', '--inspect=6009'] } },
    };

    


    // const middleware = createMiddleware(tsServerBridge);

    const templogChan = vscode.window.createOutputChannel('Temp Logs');
    context.subscriptions.push(templogChan);
    const debugLog = (...args: any[]) => {
        templogChan.appendLine(args.join(' '));
    };
    const tempMiddleware: Middleware = {
        // Called when a request is sent from the client to the server.
        // Called when a request is sent from the client to the server.
        async sendRequest(method, params, token, next) {
            const methodName = typeof method === 'string' ? method : method.method;
            debugLog(`[CLIENT->SERVER] [Request] Method: ${methodName}`);
            debugLog(`    Params: ${JSON.stringify(params, null, 2)}`);
            const startTime = Date.now();

            const result = await next(method, params, token);

            const duration = Date.now() - startTime;
            debugLog(`[SERVER->CLIENT] [Response] Method: ${methodName} (took ${duration}ms)`);
            debugLog(`    Result: ${JSON.stringify(result, null, 2)}`);

            return result;
        },

        // Called when a notification is sent from the client to the server.
        sendNotification(method, next, params) {
            const methodName = typeof method === 'string' ? method : method.method;
            debugLog(`[CLIENT->SERVER] [Notification] Method: ${methodName}`);
            debugLog(`    Params: ${JSON.stringify(params, null, 2)}`);
            return next(method, params);
        },

        // Called on hover requests
        async provideHover(document, position, token, next) {
            debugLog('[Middleware] provideHover: Triggered.');
            const startTime = Date.now();
            const result = await next(document, position, token);
            const duration = Date.now() - startTime;
            debugLog(`[Middleware] provideHover: 'next()' returned in ${duration}ms.`);
            debugLog(`    Result from server: ${JSON.stringify(result, null, 2)}`);
            return result;
        },

        // Called on inlay hint requests
        async provideInlayHints(document, range, token, next) {
            debugLog('[Middleware] provideInlayHints: Triggered.');
            const startTime = Date.now();
            const result = await next(document, range, token);
            const duration = Date.now() - startTime;
            debugLog(`[Middleware] provideInlayHints: 'next()' returned in ${duration}ms.`);
            debugLog(`    Result from server: ${JSON.stringify(result, null, 2)}`);
            return result;
        },

        // Called on code action requests
        async provideCodeActions(document, range, context, token, next) {
            debugLog('[Middleware] provideCodeActions: Triggered.');
            const startTime = Date.now();
            const result = await next(document, range, context, token);
            const duration = Date.now() - startTime;
            debugLog(`[Middleware] provideCodeActions: 'next()' returned in ${duration}ms.`);
            debugLog(`    Result from server: ${JSON.stringify(result, null, 2)}`);
            return result;
        },

        // You can add more specific handlers here if needed, like provideDefinition, etc.
    };

    const debugOnNotificationhandler = (seq: number, command: string, args: any): void => {
        debugLog(`[INCOMING_NOTIFICATION_HANDLER] Received notification from server:`);
        debugLog(`    Sequence ID: ${seq}`);
        debugLog(`    Command: ${command}`);
        debugLog(`    Args: ${JSON.stringify(args, null, 2)}`);
    }

    const debugOnRequesthandler = (args: any): void => {
        debugLog(`[INCOMING_REQUEST_HANDLER] Received request from server:`);
        debugLog(`    Full Request Args: ${JSON.stringify(args, null, 2)}`);
    }

    const clientOptions: LanguageClientOptions = {
        //  middleware: middleware,
        middleware: tempMiddleware,
        documentSelector: [
            { language: 'vue', scheme: 'file' },
            //   { pattern: '*.vue' }
        ],

        initializationOptions: {
            typescript: {},
            vue: {
                hybridMode: false,
                tsdk: tsDkPath,
            },
            hybridMode: false,
            "diagnosticModel": "pull",
            "completion": { "ignoreTriggerCharacters": false }


        },
        
        outputChannel: vueOutputChannel,
        // Route full LSP traces to the Vue Debug channel so we see bodies
        traceOutputChannel: vueOutputChannel,
    };

    vueLanguageClient = new LanguageClient(
        'vue',
        'Vue Language Server',
        serverOptions,
        clientOptions
    );

    vueLanguageClient.setTrace(Trace.Verbose);

    vueLanguageClient.onNotification('tsserver/request', debugOnNotificationhandler);
    vueLanguageClient.onRequest('tsserver/request', debugOnRequesthandler);


    // Ensure verbose tracing (includes params/results bodies)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    // (vueLanguageClient as unknown as { setTrace: (t: Trace) => void }).setTrace?.(Trace.Verbose);

    // registerVueTsserverBridge(vueLanguageClient, tsServerBridge, tsOutputChannel);


    
    // --- 3. Start Both Servers ---
    // We start both servers, but they are not yet connected.
    try {
        await tsServerBridge.ensureStarted();
        console.log('TsserverBridge started successfully.');
        console.log('TsShadowClient started successfully.');
        await vueLanguageClient.start();
        console.log('Vue Language Server client started successfully.');

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to start language servers: ${String(error)}`);
        console.error('Activation Error:', error);
    }
}

export async function deactivate(): Promise<void> {
    await vueLanguageClient?.stop();
    await tsServerBridge?.stop();
    setBridge(undefined);
} 
