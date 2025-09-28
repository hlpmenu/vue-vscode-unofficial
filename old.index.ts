import * as path from 'node:path';
import * as vscode from 'vscode';
import {
	//LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
} from 'vscode-languageclient/node';
import * as lsp from '@volar/vscode/node';

import { TsserverBridge, TsserverOptions } from './src/tsserver/bridge';
import { setBridge } from './src/tsserver/client';
import { registerVueTsserverBridge } from './src/vue-ts-bridge';

// UI Feature Imports
import { config } from './src/lib/config';
import * as focusMode from './src/lib/focusMode';
import * as interpolationDecorators from './src/lib/interpolationDecorators';
import * as reactivityVisualization from './src/lib/reactivityVisualization';
import * as welcome from './src/lib/welcome';

let vueLanguageClient: lsp.LanguageClient;
let tsServerBridge: TsserverBridge;

let vueDebugChannel: vscode.OutputChannel;

export const log = (...args: any[]) => { // oxlint-disable-line
	vueDebugChannel?.appendLine(args.join(' '));
};

export async function activate(context: vscode.ExtensionContext) {
	const vueOutputChannel = vscode.window.createOutputChannel('Vue Language Server');
	const tsOutputChannel = vscode.window.createOutputChannel('Vue TypeScript Server');
	const vueLspTraceChannel = vscode.window.createOutputChannel('Vue LSP Trace');
	vueDebugChannel = vscode.window.createOutputChannel('Vue Debug');
	context.subscriptions.push(vueOutputChannel, tsOutputChannel, vueLspTraceChannel);

	await initializeServers(context, vueOutputChannel, tsOutputChannel);

	const restartCommand = vscode.commands.registerCommand('vue.action.restartServer', async () => {
		await tsServerBridge?.restart();
		await vueLanguageClient?.restart();
		vscode.window.showInformationMessage('Vue language servers restarted.');
	});
	context.subscriptions.push(restartCommand);

	// Activate UI features
	const selectors = config.server.includeLanguages;
	focusMode.activate(context, selectors);
	interpolationDecorators.activate(context, selectors);
	reactivityVisualization.activate(context, selectors);
	welcome.activate(context);
}

export async function deactivate() {
	await vueLanguageClient?.stop();
	await tsServerBridge?.stop();
	setBridge(undefined);
}

async function initializeServers(
	context: vscode.ExtensionContext,
	vueOutputChannel: vscode.OutputChannel,
	tsOutputChannel: vscode.OutputChannel
) {

	// --- 1. Initialize the managed TypeScript Server ---
	const tsServerPath = require.resolve('typescript/lib/tsserver.js');
	const vuePluginModulePath = path.dirname(require.resolve('@vue/typescript-plugin/package.json', { paths: [context.extensionPath] }));
	const tsServerOptions: TsserverOptions = {
		tsserverPath: tsServerPath,
		pluginName: context.asAbsolutePath(path.join('dist', 'ts-plugin.js')),
		pluginProbeLocations: [vuePluginModulePath],
	};

	tsServerBridge = new TsserverBridge(tsServerOptions, tsOutputChannel, context.globalStorageUri.fsPath);
	setBridge(tsServerBridge);
	context.subscriptions.push(tsServerBridge);

	// --- 2. Initialize the Vue Language Server ---
	const vueServerModulePath = context.asAbsolutePath(path.join('node_modules', '@vue', 'language-server', 'bin', 'vue-language-server.js'));
	const serverOptions: ServerOptions = {
		run: { 
			module: vueServerModulePath, 
			transport: TransportKind.stdio,
			"options": {
				cwd: vscode?.workspace?.workspaceFolders[0].uri.fsPath || "/home/hlmpn/workspace/vue-native-ts-starter",
			},
		},
		debug: { module: vueServerModulePath, transport: TransportKind.stdio, options: { execArgv: ['--nolazy', '--inspect=6009'] } },

	};

	// --- 3. Create the Middleware to Bridge Editor Events to TSServer ---
	
	const clientOptions: LanguageClientOptions = {
		documentSelector: ['vue', 'typescript', 'javascript', 'typescriptreact', 'javascriptreact', 'vue-html', 'Vue'],


		outputChannel: vueOutputChannel,
		synchronize: {
			fileEvents: vscode.workspace.createFileSystemWatcher('**/*.{vue,ts,js,jsx,tsx}'),
		},
		//	middleware,
		workspaceFolder: vscode.workspace.workspaceFolders?.[0],

		// --- THIS IS THE CORRECTED SECTION ---
		initializationOptions: {
			// This is the most critical option. It tells the server to
			// enable its diagnostic provider, which will trigger the
			// textDocument/diagnostic requests from VS Code.
			diagnosticModel: 1,

			// We DO NOT provide the `typescript: { tsdk: ... }` block here.
			// Our RPC bridge (`tsserver/request`) is the explicit contract for TS communication.
			// Adding the tsdk path caused the client constructor to crash.
			typescript: {}, 

			// It's still good practice to identify our extension.
			extensionId: 'hlmpn.volar-vue-native'
		},

	};


	//vueLanguageClient = new LanguageClient('vue', 'Vue', serverOptions, clientOptions);
	vueLanguageClient = new lsp.LanguageClient('vue', 'Vue', serverOptions, clientOptions);
	
	// --- 4. Set up the RPC bridge between the two servers ---
	registerVueTsserverBridge(vueLanguageClient, tsServerBridge, tsOutputChannel);

	// --- 5. Start the servers ---
	try {
		await tsServerBridge.ensureStarted();
		await vueLanguageClient.start();
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to start Vue language servers: ${String(error)}`);
	}
} 