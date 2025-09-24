import { activateAutoInsertion, activateDocumentDropEdit, createLabsInfo, middleware } from '@volar/vscode';
import * as lsp from '@volar/vscode/node';
import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
	defineExtension,
	extensionContext,
	nextTick,
	onDeactivate,
	useActiveTextEditor,
	useCommand,
	useOutputChannel,
	useVisibleTextEditors,
	watch,
} from 'reactive-vscode';
import * as vscode from 'vscode';
import { config } from './lib/config';
import * as focusMode from './lib/focusMode';
import * as interpolationDecorators from './lib/interpolationDecorators';
import * as reactivityVisualization from './lib/reactivityVisualization';
import * as welcome from './lib/welcome';

const TS_PLUGIN_NAME = 'vue-typescript-plugin-pack';
const serverPath = resolveServerPath();

for (
	const incompatibleExtensionId of [
		'johnsoncodehk.vscode-typescript-vue-plugin',
		'Vue.vscode-typescript-vue-plugin',
	]
) {
	const extension = vscode.extensions.getExtension(incompatibleExtensionId);
	if (extension) {
		vscode.window.showErrorMessage(
			`The "${incompatibleExtensionId}" extension is incompatible with the Vue extension. Please uninstall it.`,
			'Show Extension',
		).then(action => {
			if (action === 'Show Extension') {
				vscode.commands.executeCommand('workbench.extensions.search', '@id:' + incompatibleExtensionId);
			}
		});
	}
}

export = defineExtension(() => {
	let client: lsp.BaseLanguageClient | undefined;
	let tsserver: TsserverBridge | undefined;

	const context = extensionContext.value!;
	const volarLabs = createLabsInfo();
	const activeTextEditor = useActiveTextEditor();
	const visibleTextEditors = useVisibleTextEditors();
	const tsOutputChannel = useOutputChannel('Vue TypeScript Server');

	const ensureTsserver = () => {
		if (tsserver) {
			return tsserver;
		}
		const options = resolveTsserverOptions();
		if (!options) {
			return undefined;
		}
		tsserver = new TsserverBridge(options, tsOutputChannel);
		context.subscriptions.push(tsserver);
		return tsserver;
	};

	const restartLanguageFeatures = async () => {
		if (tsserver) {
			await tsserver.restart();
		}
		if (client) {
			await client.stop();
			client.outputChannel.clear();
			await client.start();
		}
	};

	const { stop } = watch(activeTextEditor, () => {
		if (
			!visibleTextEditors.value.some(
				editor => config.server.includeLanguages.includes(editor.document.languageId),
			)
		) {
			return;
		}

		nextTick(() => stop());

		watch(() => [
			config.server.path,
			config.server.includeLanguages,
		], async () => {
			const reload = await vscode.window.showInformationMessage(
				'Restart Vue language features to apply the new server settings.',
				'Restart',
			);
			if (reload) {
				await restartLanguageFeatures();
			}
		});

		// Setup typescript.js in production mode
		if (fs.existsSync(path.join(__dirname, 'language-server.js'))) {
			fs.writeFileSync(
				path.join(__dirname, 'typescript.js'),
				`module.exports = require("${
					vscode.env.appRoot.replace(/\\/g, '/')
				}/extensions/node_modules/typescript/lib/typescript.js");`,
			);
		}

		if (config.server.path && !serverPath) {
			vscode.window.showErrorMessage('Cannot find @vue/language-server.');
			return;
		}

		const tsserverBridge = ensureTsserver();
		if (!tsserverBridge) {
			vscode.window.showErrorMessage('Cannot locate the bundled TypeScript server.');
			return;
		}

		void tsserverBridge.ensureStarted();

		client = launch(
			serverPath ?? vscode.Uri.joinPath(context.extensionUri, 'dist', 'language-server.js').fsPath,
			tsserverBridge,
		);

		volarLabs.addLanguageClient(client);

		const selectors = config.server.includeLanguages;

		activateAutoInsertion(selectors, client);
		activateDocumentDropEdit(selectors, client);

		focusMode.activate(context, selectors);
		interpolationDecorators.activate(context, selectors);
		reactivityVisualization.activate(context, selectors);
		welcome.activate(context);
	}, { immediate: true });

	useCommand('typescript.tsserverRequest', async (command: string, args?: unknown) => {
		const bridge = ensureTsserver();
		if (!bridge) {
			vscode.window.showErrorMessage('Cannot locate the bundled TypeScript server.');
			return undefined;
		}
		try {
			return await bridge.request(command, args);
		}
		catch (error) {
			tsOutputChannel.appendLine(
				`[error] Failed to execute ${command}: ${error instanceof Error ? error.message : String(error)}`,
			);
			return undefined;
		}
	});

	useCommand('typescript.restartTsServer', async () => {
		const bridge = ensureTsserver();
		if (!bridge) {
			vscode.window.showErrorMessage('Cannot locate the bundled TypeScript server.');
			return;
		}
		await bridge.restart();
	});

	useCommand('vue.welcome', () => welcome.execute(context));
	useCommand('vue.action.restartServer', async () => {
		await restartLanguageFeatures();
	});

	onDeactivate(async () => {
		await client?.stop();
		await tsserver?.stop();
	});

	return volarLabs.extensionExports;
});

function launch(serverPath: string, tsserver: TsserverBridge) {
	const client = new lsp.LanguageClient(
		'vue',
		'Vue',
		{
			run: {
				module: serverPath,
				transport: lsp.TransportKind.ipc,
				options: {},
			},
			debug: {
				module: serverPath,
				transport: lsp.TransportKind.ipc,
				options: { execArgv: ['--nolazy', '--inspect=' + 6009] },
			},
		},
		{
			middleware: {
				...middleware,
				async resolveCodeAction(item, token, next) {
					if (item.kind?.value === 'refactor.move.newFile.dumb' && config.codeActions.askNewComponentName) {
						const inputName = await vscode.window.showInputBox({ value: (item as any).data.original.data.newName });
						if (!inputName) {
							return item; // cancel
						}
						(item as any).data.original.data.newName = inputName;
					}
					return await (middleware.resolveCodeAction?.(item, token, next) ?? next(item, token));
				},
			},
			documentSelector: config.server.includeLanguages,
			markdown: {
				isTrusted: true,
				supportHtml: true,
			},
			outputChannel: useOutputChannel('Vue Language Server'),
		},
	);

	client.onNotification('tsserver/request', async ([seq, command, args]) => {
		try {
			const body = await tsserver.request(command, args);
			client.sendNotification('tsserver/response', [seq, body]);
		}
		catch {
			client.sendNotification('tsserver/response', [seq, undefined]);
		}
	});
	client.start();

	return client;
}

function resolveServerPath() {
	const tsPluginPackPath = path.join(__dirname, '..', 'node_modules', TS_PLUGIN_NAME, 'index.js');

	if (!config.server.path) {
		fs.writeFileSync(tsPluginPackPath, `module.exports = require("../../dist/typescript-plugin.js");`);
		return;
	}

	if (path.isAbsolute(config.server.path)) {
		const entryFile = require.resolve('./index.js', { paths: [config.server.path] });
		const tsPluginPath = require.resolve('@vue/typescript-plugin', { paths: [path.dirname(entryFile)] });
		fs.writeFileSync(tsPluginPackPath, `module.exports = require("${tsPluginPath}");`);
		return entryFile;
	}

	for (const { uri } of vscode.workspace.workspaceFolders ?? []) {
		if (uri.scheme !== 'file') {
			continue;
		}
		try {
			const serverPath = path.join(uri.fsPath, config.server.path);
			const entryFile = require.resolve('./index.js', { paths: [serverPath] });
			const tsPluginPath = require.resolve('@vue/typescript-plugin', { paths: [path.dirname(entryFile)] });
			fs.writeFileSync(tsPluginPackPath, `module.exports = require("${tsPluginPath}");`);
			return entryFile;
		}
		catch {}
	}
}

function resolveTsserverOptions(): TsserverOptions | undefined {
	const tsExtension = vscode.extensions.getExtension('vscode.typescript-language-features');
	if (!tsExtension) {
		return undefined;
	}

	try {
		const resolutionPaths = [tsExtension.extensionPath];
		const tsserverPath = require.resolve('typescript/lib/tsserver.js', { paths: resolutionPaths });
		let typingsInstallerPath: string | undefined;
		try {
			typingsInstallerPath = require.resolve('typescript/lib/typingsInstaller.js', { paths: resolutionPaths });
		}
		catch {
			typingsInstallerPath = undefined;
		}

		return {
			tsserverPath,
			typingsInstallerPath,
			pluginProbeLocations: [path.join(__dirname, '..', 'node_modules')],
		};
	}
	catch {
		return undefined;
	}
}

interface TsserverOptions {
	readonly tsserverPath: string;
	readonly typingsInstallerPath?: string;
	readonly pluginProbeLocations: readonly string[];
}

type TsserverProtocolMessage =
	| {
			readonly type: 'response';
			readonly request_seq: number;
			readonly success: boolean;
			readonly body?: unknown;
		}
	| {
			readonly type: 'event';
			readonly event: string;
			readonly body?: unknown;
		}
	| {
			readonly seq: number;
			readonly type: 'request';
			readonly command: string;
			readonly arguments?: unknown;
		};

class TsserverBridge implements vscode.Disposable {
	private process: cp.ChildProcessWithoutNullStreams | undefined;
	private startPromise: Promise<void> | undefined;
	private readonly pending = new Map<number, { resolve(value: unknown | undefined): void; reject(error: unknown): void }>();
	private readonly output: vscode.OutputChannel;
	private buffer = '';
	private disposed = false;
	private seq = 0;

	constructor(private readonly options: TsserverOptions, output: vscode.OutputChannel) {
		this.output = output;
	}

	async ensureStarted() {
		if (this.disposed) {
			throw new Error('tsserver bridge disposed');
		}
		if (this.process) {
			return;
		}
		if (!this.startPromise) {
			this.startPromise = this.start();
		}
		await this.startPromise;
	}

	async request(command: string, args: unknown) {
		await this.ensureStarted();
		const seq = ++this.seq;
		const payload = JSON.stringify({
			seq,
			type: 'request',
			command,
			arguments: args,
		});
		const message = `Content-Length: ${Buffer.byteLength(payload, 'utf8')}` + '\r\n\r\n' + payload;

		return new Promise<unknown | undefined>((resolve, reject) => {
			const child = this.process;
			if (!child || !child.stdin.writable) {
				reject(new Error('tsserver is not running'));
				return;
			}
			this.pending.set(seq, { resolve, reject });
			child.stdin.write(message, 'utf8', error => {
				if (error) {
					this.pending.delete(seq);
					reject(error);
				}
			});
		});
	}

	async restart() {
		await this.stop();
		await this.ensureStarted();
	}

	async stop() {
		this.rejectAll(new Error('tsserver stopped'));
		const child = this.process;
		if (!child) {
			return;
		}
		this.process = undefined;
		this.startPromise = undefined;
		try {
			child.stdin.end();
		}
		catch {}

		await new Promise<void>(resolve => {
			if (child.exitCode !== null || child.signalCode !== null) {
				resolve();
				return;
			}
			child.once('exit', () => resolve());
			child.kill();
		});
	}

	dispose() {
		this.disposed = true;
		void this.stop();
	}

	private start() {
		return new Promise<void>((resolve, reject) => {
			const args = [
				this.options.tsserverPath,
				'--serverMode',
				'partialSemantic',
				'--useInferredProjectPerProjectRoot',
				'--enableTelemetry',
				'--globalPlugins',
				TS_PLUGIN_NAME,
				'--allowLocalPluginLoads',
				'--locale',
				vscode.env.language,
			];

			for (const location of this.options.pluginProbeLocations) {
				args.push('--pluginProbeLocations', location);
			}
			if (this.options.typingsInstallerPath) {
				args.push('--typingsInstaller', this.options.typingsInstallerPath);
			}

			const child = cp.spawn(process.execPath, args, {
				cwd: path.dirname(this.options.tsserverPath),
				env: {
					...process.env,
					TSS_NONPOLLING_IO: '1',
				},
				stdio: ['pipe', 'pipe', 'pipe'],
			});

			child.once('error', error => {
				this.process = undefined;
				this.startPromise = undefined;
				this.output.appendLine(`[error] tsserver failed to start: ${error instanceof Error ? error.message : String(error)}`);
				reject(error);
			});

			child.stdout.on('data', chunk => this.handleStdout(chunk));
			child.stderr.on('data', chunk => {
				this.output.appendLine(`[stderr] ${chunk.toString()}`);
			});
			child.on('exit', (code, signal) => {
				if (this.process === child) {
					this.process = undefined;
					this.startPromise = undefined;
				}
				if (!this.disposed) {
					this.output.appendLine(`[info] tsserver exited (code ${code ?? 'null'}, signal ${signal ?? 'null'})`);
				}
				this.rejectAll(new Error('tsserver exited'));
			});

			this.process = child;
			this.seq = 0;
			resolve();
		});
	}

	private handleStdout(chunk: Buffer) {
		this.buffer += chunk.toString('utf8');
		while (true) {
			const separatorIndex = this.buffer.indexOf('\r\n\r\n');
			if (separatorIndex === -1) {
				return;
			}
			const header = this.buffer.slice(0, separatorIndex);
			const lengthMatch = /Content-Length: (\d+)/i.exec(header);
			if (!lengthMatch) {
				this.buffer = this.buffer.slice(separatorIndex + 4);
				continue;
			}
			const bodyLength = Number(lengthMatch[1]);
			const messageStart = separatorIndex + 4;
			const messageEnd = messageStart + bodyLength;
			if (this.buffer.length < messageEnd) {
				return;
			}
			const json = this.buffer.slice(messageStart, messageEnd);
			this.buffer = this.buffer.slice(messageEnd);
			try {
				const message = JSON.parse(json) as TsserverProtocolMessage;
				this.handleMessage(message);
			}
			catch (error) {
				this.output.appendLine(`[error] Failed to parse tsserver message: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}

	private handleMessage(message: TsserverProtocolMessage) {
		if (message.type === 'response') {
			const pending = this.pending.get(message.request_seq);
			if (!pending) {
				return;
			}
			this.pending.delete(message.request_seq);
			if (message.success) {
				pending.resolve(message.body);
			}
			else {
				pending.resolve(undefined);
			}
			return;
		}
		if (message.type === 'event') {
			this.output.appendLine(`[event] ${message.event}`);
			return;
		}

		this.output.appendLine(`[warn] Unhandled tsserver request from server: ${message.command}`);
		this.writeToServer({
			seq: 0,
			type: 'response',
			request_seq: message.seq,
			success: false,
			body: undefined,
		});
	}

	private writeToServer(message: unknown) {
		const payload = JSON.stringify(message);
		const content = `Content-Length: ${Buffer.byteLength(payload, 'utf8')}` + '\r\n\r\n' + payload;
		this.process?.stdin.write(content, 'utf8');
	}

	private rejectAll(error: unknown) {
		for (const pending of this.pending.values()) {
			pending.reject(error);
		}
		this.pending.clear();
	}
}
