/**
 * @file The main entry point for the Vue Native extension.
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
} from 'vscode-languageclient/node';

import { TsserverBridge, TsserverOptions } from './src/tsserver/bridge';
import { setBridge } from './src/tsserver/client';

// --- Begin: UI Feature Imports --- //
// These are less critical for core functionality but provide a richer user experience.
// They are based on the original Volar extension's features.
import { config } from './src/lib/config';
import * as focusMode from './src/lib/focusMode';
import * as interpolationDecorators from './src/lib/interpolationDecorators';
import * as reactivityVisualization from './src/lib/reactivityVisualization';
import * as welcome from './src/lib/welcome';
// --- End: UI Feature Imports --- //

/** The language client for the Vue Language Server. */
let vueLanguageClient: LanguageClient | undefined;

/** The bridge to our managed TypeScript server process. */
let tsServerBridge: TsserverBridge | undefined;

/** Output channel for the Vue Language Server. */
let vueOutputChannel: vscode.OutputChannel | undefined;

/** Output channel for the managed TypeScript server. */
let tsOutputChannel: vscode.OutputChannel | undefined;

export async function activate(context: vscode.ExtensionContext) {
	// Create output channels for logging
	vueOutputChannel = vscode.window.createOutputChannel('Vue Language Server');
	tsOutputChannel = vscode.window.createOutputChannel('Vue TypeScript Server');
	context.subscriptions.push(vueOutputChannel, tsOutputChannel);

	// Initialize both the Vue Language Server and our managed TypeScript server
	await initializeServers(context);

	// Register commands
	const restartCommand = vscode.commands.registerCommand('vue.action.restartServer', async () => {
		if (!vueLanguageClient || !tsServerBridge) {
			vscode.window.showErrorMessage('Servers are not running.');
			return;
		}
		await tsServerBridge.restart();
		await vueLanguageClient.restart();
		vscode.window.showInformationMessage('Vue language servers restarted.');
	});
	context.subscriptions.push(restartCommand);

	// --- Begin: Activate UI Features --- //
	const selectors = config.server.includeLanguages;
	focusMode.activate(context, selectors);
	interpolationDecorators.activate(context, selectors);
	reactivityVisualization.activate(context, selectors);
	welcome.activate(context);
	// --- End: Activate UI Features --- //
}

export async function deactivate() {
	await vueLanguageClient?.stop();
	await tsServerBridge?.stop();
	setBridge(undefined);
}

/**
 * Initializes and starts the Vue Language Server and the managed TSServer.
 */
async function initializeServers(context: vscode.ExtensionContext) {
	if (!vueOutputChannel || !tsOutputChannel) {
		return; // Should not happen
	}

	// --- 1. Initialize the managed TypeScript Server --- //

	const tsServerPath = require.resolve('typescript/lib/tsserver.js', {
		paths: [context.extensionPath],
	});
	const tsPluginPath = path.resolve(context.extensionPath, 'dist', 'ts-plugin.js');

	const tsServerOptions: TsserverOptions = {
		tsserverPath: tsServerPath,
		pluginName: tsPluginPath,
		pluginProbeLocations: [],
	};

	tsServerBridge = new TsserverBridge(tsServerOptions, tsOutputChannel);
	setBridge(tsServerBridge); // Make the bridge available to other parts of the extension
	context.subscriptions.push(tsServerBridge);

	// --- 2. Initialize the Vue Language Server --- //

	const vueServerModulePath = path.resolve(context.extensionPath, 'dist', 'vue-lsp.js');

	const serverOptions: ServerOptions = {
		run: { module: vueServerModulePath, transport: TransportKind.ipc },
		debug: { module: vueServerModulePath, transport: TransportKind.ipc, options: { execArgv: ['--nolazy', '--inspect=6009'] } },
	};

	const clientOptions: LanguageClientOptions = {
		documentSelector: config.server.includeLanguages,
		outputChannel: vueOutputChannel,
	};

	vueLanguageClient = new LanguageClient('vue', 'Vue', serverOptions, clientOptions);

	// --- 3. Set up the bridge between the two servers --- //

	// When the Vue server needs TypeScript information, it sends a custom request.
	// We intercept it and forward it to our managed tsserver.
	vueLanguageClient.onNotification('tsserver/request', async ([seq, command, args]) => {
		if (!tsServerBridge) return;
		try {
			const body = await tsServerBridge.request(command, args);
			// Send the response back to the Vue server
			vueLanguageClient?.sendNotification('tsserver/response', [seq, body]);
		}
		catch (error) {
			            tsOutputChannel?.appendLine(`[ERROR] TSServer request ${command} failed: ${String(error)}`);			// Send an error response back
			vueLanguageClient?.sendNotification('tsserver/response', [seq, undefined]);
		}
	});

	// --- 4. Start the servers --- //

	try {
		await tsServerBridge.ensureStarted();
		await vueLanguageClient.start();
	} catch (error) {
		vscode.window.showErrorMessage(`Failed to start Vue language servers: ${error}`);
	}
}
