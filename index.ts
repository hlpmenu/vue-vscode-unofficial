import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
} from 'vscode-languageclient/node';
import {
	activateAutoInsertion,
	activateDocumentDropEdit,
	createLabsInfo,
	middleware,
} from '@volar/vscode';

import { config, onConfigChange } from './src/lib/config';
import * as focusMode from './src/lib/focusMode';
import * as interpolationDecorators from './src/lib/interpolationDecorators';
import * as reactivityVisualization from './src/lib/reactivityVisualization';
import * as welcome from './src/lib/welcome';
import { TsserverBridge, resolveTsserverOptions } from './src/tsserver/bridge';
import { setBridge } from './src/tsserver/client';

const TS_PLUGIN_NAME = 'vue-typescript-plugin-pack';

const labs = createLabsInfo();

let client: LanguageClient | undefined;
let bridge: TsserverBridge | undefined;
let tsOutputChannel: vscode.OutputChannel | undefined;
let vueOutputChannel: vscode.OutputChannel | undefined;

export async function activate(context: vscode.ExtensionContext) {
	vueOutputChannel = vscode.window.createOutputChannel('Vue Language Server');
	tsOutputChannel = vscode.window.createOutputChannel('Vue TypeScript Server');
	context.subscriptions.push(vueOutputChannel, tsOutputChannel);

	const selectors = config.server.includeLanguages;
	const resources = resolveVueResources(context);
	if (!resources.serverModule) {
		vscode.window.showErrorMessage('Cannot locate the Vue language server entry point.');
		return;
	}

	const tsOptions = resolveTsserverOptions(
		TS_PLUGIN_NAME,
		resources.pluginProbeLocations,
		context.extensionPath,
	);
	if (!tsOptions) {
		vscode.window.showErrorMessage('Cannot locate a TypeScript server to launch.');
		return;
	}

	bridge = new TsserverBridge(tsOptions, tsOutputChannel);
	setBridge(bridge);
	context.subscriptions.push(bridge);

	const restartCommand = vscode.commands.registerCommand('vue.action.restartServer', async () => {
		await restartCurrentLanguageFeatures();
	});
	const welcomeCommand = vscode.commands.registerCommand('vue.welcome', () => welcome.execute(context));
	context.subscriptions.push(restartCommand, welcomeCommand);

	const configListener = onConfigChange(context, () => {
		vscode.window
			.showInformationMessage(
				'Restart Vue language features to apply the new server settings.',
				'Restart',
			)
			.then(action => {
				if (action === 'Restart') {
					void restartWithResources(context);
				}
			});
	});
	context.subscriptions.push(configListener);

	await startLanguageFeatures(context, selectors, resources.serverModule);

	focusMode.activate(context, selectors);
	interpolationDecorators.activate(context, selectors);
	reactivityVisualization.activate(context, selectors);
	welcome.activate(context);

	return labs.extensionExports;
}

export async function deactivate() {
	await client?.stop();
	await bridge?.stop();
	setBridge(undefined);
}

async function startLanguageFeatures(
	context: vscode.ExtensionContext,
	selectors: string[],
	serverModule: string,
) {
	if (!bridge || !tsOutputChannel || !vueOutputChannel) {
		return;
	}

	await bridge.ensureStarted();

	if (client) {
		await client.stop();
	}

	const clientOptions: LanguageClientOptions = {
		middleware: {
			...middleware,
			async resolveCodeAction(item, token, next) {
				if (
					item.kind?.value === 'refactor.move.newFile.dumb' &&
					config.codeActions.askNewComponentName
				) {
					const inputName = await vscode.window.showInputBox({
						value: (item as any).data?.original?.data?.newName,
					});
					if (!inputName) {
						return item;
					}
					(item as any).data.original.data.newName = inputName;
				}
				return middleware.resolveCodeAction?.(item, token, next) ?? next(item, token);
			},
		},
		documentSelector: selectors,
		markdown: {
			isTrusted: true,
			supportHtml: true,
		},
		outputChannel: vueOutputChannel,
	};

	const serverOptions: ServerOptions = {
		run: {
			module: serverModule,
			transport: TransportKind.ipc,
		},
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: { execArgv: ['--nolazy', '--inspect=6009'] },
		},
	};

	client = new LanguageClient('vue', 'Vue', serverOptions, clientOptions);

	client.onNotification('tsserver/request', async ([seq, command, args]) => {
		try {
			const body = await bridge?.request(command, args);
			client?.sendNotification('tsserver/response', [seq, body]);
		}
		catch (error) {
			tsOutputChannel?.appendLine(
				`[error] Failed forwarding ${command}: ${error instanceof Error ? error.message : String(error)}`,
			);
			client?.sendNotification('tsserver/response', [seq, undefined]);
		}
	});

	client.start();
	context.subscriptions.push(client);

	await client.onReady();

	activateAutoInsertion(selectors, client);
	activateDocumentDropEdit(selectors, client);
	labs.addLanguageClient(client);
}

async function restartCurrentLanguageFeatures() {
	if (!bridge || !client) {
		return;
	}
	await bridge.restart();
	await client.stop();
	tsOutputChannel?.clear();
	client.start();
}

async function restartWithResources(context: vscode.ExtensionContext) {
	const resources = resolveVueResources(context);
	if (!resources.serverModule) {
		vscode.window.showErrorMessage('Cannot locate the Vue language server entry point.');
		return;
	}
	if (!tsOutputChannel) {
		return;
	}

	const existingBridge = bridge;
	setBridge(undefined);

	if (existingBridge) {
		await existingBridge.stop();
		existingBridge.dispose();
	}

	const selectors = config.server.includeLanguages;

	const tsOptions = resolveTsserverOptions(
		TS_PLUGIN_NAME,
		resources.pluginProbeLocations,
		context.extensionPath,
	);
	if (!tsOptions) {
		vscode.window.showErrorMessage('Cannot locate a TypeScript server to launch.');
		return;
	}

	bridge = new TsserverBridge(tsOptions, tsOutputChannel);
	setBridge(bridge);
	context.subscriptions.push(bridge);

	await startLanguageFeatures(context, selectors, resources.serverModule);
}

interface VueResources {
	readonly serverModule?: string;
	readonly pluginProbeLocations: readonly string[];
}

function resolveVueResources(context: vscode.ExtensionContext): VueResources {
	const pluginDir = path.join(context.extensionPath, 'node_modules', TS_PLUGIN_NAME);
	const pluginPackEntry = path.join(pluginDir, 'index.js');
	fs.mkdirSync(pluginDir, { recursive: true });

	const bundledPlugin = path.join(context.extensionPath, 'dist', 'typescript-plugin.js');
	const bundledServer = path.join(context.extensionPath, 'dist', 'language-server.js');

	const writePackLiteral = (target: string | undefined) => {
		const content = target
			? `module.exports = require("${target}");`
			: 'module.exports = undefined;';
		fs.writeFileSync(pluginPackEntry, content);
	};

	const writePackAbsolute = (absolutePath: string) => {
		writePackLiteral(toPosixPath(absolutePath));
	};

	const override = config.server.path;
	if (!override) {
		writePackLiteral(fs.existsSync(bundledPlugin) ? '../../dist/typescript-plugin.js' : undefined);
		return {
			serverModule: fs.existsSync(bundledServer) ? bundledServer : undefined,
			pluginProbeLocations: [path.join(context.extensionPath, 'node_modules')],
		};
	}

	const resolveFrom = (base: string) => {
		const entry = require.resolve('./index.js', { paths: [base] });
		const plugin = require.resolve('@vue/typescript-plugin', { paths: [path.dirname(entry)] });
		writePackAbsolute(plugin);
		return entry;
	};

	if (path.isAbsolute(override)) {
		try {
			const entry = resolveFrom(override);
			return {
				serverModule: entry,
				pluginProbeLocations: [path.join(context.extensionPath, 'node_modules')],
			};
		}
		catch (error) {
			tsOutputChannel?.appendLine(
				`[error] Failed to resolve Vue language server from ${override}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			writePackLiteral(fs.existsSync(bundledPlugin) ? '../../dist/typescript-plugin.js' : undefined);
			return {
				serverModule: fs.existsSync(bundledServer) ? bundledServer : undefined,
				pluginProbeLocations: [path.join(context.extensionPath, 'node_modules')],
			};
		}
	}

	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		if (folder.uri.scheme !== 'file') {
			continue;
		}
		const candidate = path.join(folder.uri.fsPath, override);
		try {
			const entry = resolveFrom(candidate);
			return {
				serverModule: entry,
				pluginProbeLocations: [path.join(context.extensionPath, 'node_modules')],
			};
		}
		catch {
			continue;
		}
	}

	writePackLiteral(fs.existsSync(bundledPlugin) ? '../../dist/typescript-plugin.js' : undefined);
	return {
		serverModule: fs.existsSync(bundledServer) ? bundledServer : undefined,
		pluginProbeLocations: [path.join(context.extensionPath, 'node_modules')],
	};
}


const toPosixPath = (value: string) => value.split('\').join('/');
