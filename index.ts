import * as path from 'node:path';
import * as vscode from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    Middleware, // We will need this for the final step
} from 'vscode-languageclient/node';

// We will also need the original files for the TsserverBridge
import { TsserverBridge, TsserverOptions } from './src/tsserver/bridge';
import { setBridge } from './src/tsserver/client';
// We will need this in the next step, but let's import it now.
import { registerVueTsserverBridge } from './src/vue-ts-bridge';

let vueLanguageClient: LanguageClient;
let tsServerBridge: TsserverBridge; // The bridge to our managed tsserver
let vueDebugChannel: vscode.OutputChannel;

// A simple logger for now
export const log = (...args: any[]) => { // oxlint-disable-line
    vueDebugChannel?.appendLine(args.join(' '));
};


export async function activate(context: vscode.ExtensionContext) {
    console.log('Activating Vue LSP client with TsserverBridge.');

    const vueOutputChannel = vscode.window.createOutputChannel('Vue Language Server');
    const tsOutputChannel = vscode.window.createOutputChannel('Vue TypeScript Server');
    vueDebugChannel = vscode.window.createOutputChannel('Vue Debug');
    context.subscriptions.push(vueOutputChannel, tsOutputChannel, vueDebugChannel);

    // --- 1. Initialize our managed TypeScript Server ---
    // This part is from your old file, responsible for setting up and
    // finding the right tsserver.js and plugin paths.
    const tsServerPath = require.resolve('typescript/lib/tsserver.js');
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




    const middleware: Middleware = {
        handleDiagnostics(uri, diagnostics, next) {
            log('[Middleware.handleDiagnostics]', uri.toString(), JSON.stringify(diagnostics, null, 2));
            next(uri, diagnostics);
        },
    };

    

    const clientOptions: LanguageClientOptions = {
        middleware: middleware,
        documentSelector: [
            { language: 'vue', scheme: 'file' },
            { language: 'typescript', scheme: 'file' },
        ],
        initializationOptions: {
            typescript: {},
        },
        outputChannel: vueOutputChannel,
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.vue'),
        },
    };

    vueLanguageClient = new LanguageClient(
        'vue',
        'Vue Language Server',
        serverOptions,
        clientOptions
    );

    registerVueTsserverBridge(vueLanguageClient, tsServerBridge, tsOutputChannel);


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