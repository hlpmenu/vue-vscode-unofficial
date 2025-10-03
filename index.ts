import * as path from 'node:path';
import * as vscode from 'vscode';
import {
    LanguageClient,
    Trace,
    TransportKind,
    type LanguageClientOptions,
    type ServerOptions,
} from 'vscode-languageclient/node';
import { createMiddleware } from './src/middleware/middleware';
import { TsserverBridge, setBridge, TsserverOptions } from './src/tsserver';
import { registerVueTsserverBridge } from './src/vue-ts-bridge';
import {
    getTsOutputChannel,
    getVueOutputChannel,
    setup as setupLog,
} from './src/debug/log';
import { activeateInerpolationDecorators } from './src/features';
let vueLanguageClient: LanguageClient;
let tsServerBridge: TsserverBridge;
const includedLanguages = ['vue', 'typescript', 'javascript', 'typescriptreact', 'javascriptreact', 'vue-html'];


export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
    setupLog(context);
    activeateInerpolationDecorators(context, includedLanguages);
    
    console.log('Activating Vue LSP client with TsserverBridge.');

    const vueOutputChannel = getVueOutputChannel();
    const tsOutputChannel = getTsOutputChannel();
 
    const tsPath = path.dirname(require.resolve('typescript'));
    const tsServerPath = path.join(tsPath, 'tsserver.js');
    //   const tsDkPath = path.join(tsPath, 'typescriptServices.js');
    const vueServerModulePath = context.asAbsolutePath(
        path.join('node_modules', '@vue', 'language-server', 'bin', 'vue-language-server.js'),
    );
    const vuePluginModulePath = path.dirname(
        require.resolve('@vue/typescript-plugin/package.json', { paths: [context.extensionPath] }),
    );

    const tsserverOptions: TsserverOptions = {
    
        tsserverPath: tsServerPath,
        pluginName: '@vue/typescript-plugin', 
        pluginProbeLocations: [vuePluginModulePath],
    };



    tsServerBridge = new TsserverBridge(tsserverOptions, tsOutputChannel, context.globalStorageUri.fsPath);
    setBridge(tsServerBridge);
    context.subscriptions.push(tsServerBridge);

    const serverOptions: ServerOptions = {
        run: { module: vueServerModulePath, transport: TransportKind.stdio },
        debug: {
            module: vueServerModulePath,
            transport: TransportKind.stdio,
            options: { execArgv: ['--nolazy', '--inspect=6009'] },
        },
    };

    const middleware = createMiddleware(tsServerBridge);

    const clientOptions: LanguageClientOptions = {
        middleware,
        documentSelector: includedLanguages,

        markdown: {
            isTrusted: true,
            supportHtml: true,
        },
      
        diagnosticCollectionName: "pull",
        diagnosticPullOptions: {
            onTabs: true,                   // re-pull on tab change
            onChange: true,                 // re-pull on didChange
            onSave: true,                   // re-pull on didSave

        },
        initializationOptions: {
            // By defining this, we are instructing the @vue/language-server
            // to announce that it supports completions and to use these
            // specific characters to trigger them.
            completion: {
                triggerCharacters: [
                    '.',
                    '"',
                    '\'',
                    '/',
                    '@',
                    '<',
                    '#',
                ],
            },
        },


        outputChannel: vueOutputChannel,
        traceOutputChannel: vueOutputChannel,
    };

    vueLanguageClient = new LanguageClient(
        'vue',
        'Vue Language Server',
        serverOptions,
        clientOptions
    );

    vueLanguageClient.setTrace(Trace.Verbose);


    registerVueTsserverBridge(vueLanguageClient, tsServerBridge, tsOutputChannel);


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
};

export const deactivate = async (): Promise<void> => {
    await vueLanguageClient?.stop();
    await tsServerBridge?.stop();
    setBridge(undefined);
};
