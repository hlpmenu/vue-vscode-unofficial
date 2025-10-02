import * as cp from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

import { log } from '../debug/log';

export interface TsserverOptions {
	readonly tsserverPath: string;
	readonly typingsInstallerPath?: string;
	readonly pluginName: string;
	readonly pluginProbeLocations: readonly string[];
}

const TYPINGS_INSTALLER_FILENAME = 'typingsInstaller.js';
const logFilePath = '/tmp/tsserver.log';

export const resolveTsserverOptions = (
	pluginName: string,
	pluginProbeLocations: readonly string[],
	extensionPath: string,
): TsserverOptions | undefined => {
	const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
	const workspaceBases = workspaceFolders
		.filter(folder => folder.uri.scheme === 'file')
		.map(folder => folder.uri.fsPath);

	const workspaceTs = resolveTypeScriptFromBases(workspaceBases);
	if (workspaceTs) {
		return {
			tsserverPath: workspaceTs,
			typingsInstallerPath: resolveSibling(workspaceTs, TYPINGS_INSTALLER_FILENAME),
			pluginName,
			pluginProbeLocations,
		};
	}

	const bundledBase = path.join(extensionPath, 'node_modules');
	const bundledTs = resolveTypeScriptFromBases([bundledBase]);
	if (!bundledTs) {
		return undefined;
	}

	return {
		tsserverPath: bundledTs,
		typingsInstallerPath: resolveSibling(bundledTs, TYPINGS_INSTALLER_FILENAME),
		pluginName,
		pluginProbeLocations,
	};
};

const resolveTypeScriptFromBases = (bases: readonly string[]) => {
	for (const base of bases) {
		const resolved = resolveFromBase(base, 'typescript/lib/tsserver.js');
		if (resolved) {
			return resolved;
		}
	}
	return undefined;
};

const resolveFromBase = (base: string, specifier: string) => {
	try {
		return require.resolve(specifier, { paths: [base] });
	}
	catch {
		return undefined;
	}
};

const resolveSibling = (filePath: string, sibling: string) => {
	const candidate = path.join(path.dirname(filePath), sibling);
	return fs.existsSync(candidate) ? candidate : undefined;
};

interface SerializedRequest {
	readonly seq: number;
	readonly type: 'request';
	readonly command: string;
	readonly arguments?: unknown;
}

interface SerializedResponse {
	readonly seq: number;
	readonly type: 'response';
	readonly request_seq: number;
	readonly success: boolean;
	readonly body?: unknown;
}

interface SerializedEvent {
	readonly seq: number;
	readonly type: 'event';
	readonly event: string;
	readonly body?: unknown;
}

export type TsserverMessage = SerializedRequest | SerializedResponse | SerializedEvent;

type PendingRequest = {
	resolve(value: unknown | undefined): void;
	reject(error: unknown): void;
};

export class TsserverBridge implements vscode.Disposable {
	private process: cp.ChildProcessWithoutNullStreams | undefined;
	private startPromise: Promise<void> | undefined;
	private readonly pending = new Map<number, PendingRequest>();
	private readonly output: vscode.OutputChannel;
	private buffer = '';
	private disposed = false;
	private seq = 0;

	constructor(private readonly options: TsserverOptions, output: vscode.OutputChannel, private readonly storagePath: string) {
		this.output = output;
	}

	async ensureStarted() {
		if (this.disposed) {
			throw new Error('tsserver bridge has been disposed');
		}
		if (this.process) {
			return;
		}
		if (!this.startPromise) {
			this.startPromise = this.spawn();
		}
		await this.startPromise;
	}

	async request(command: string, args: unknown) {
		log('[In request(): TsserverBridge.request]', `Command: ${command}`, JSON.stringify(args, null, 2));
		await this.ensureStarted();
		const current = this.process;
		if (!current || !current.stdin.writable) {
			throw new Error('tsserver process is unavailable');
		}

		const seq = ++this.seq;
		const payload: SerializedRequest = {
			seq,
			type: 'request',
			command,
			arguments: args,
		};
		const json = JSON.stringify(payload);
		this.output.appendLine(`[stdin] ${json}`);
		let frame = `${json}\r\n`;
		return new Promise<unknown | undefined>((resolve, reject) => {
			this.pending.set(seq, { resolve, reject });
			current.stdin.write(frame, 'utf8', error => {
				if (!error) {
					return;
				}
				this.pending.delete(seq);
				reject(error);
			});
		});
	}

	async restart() {
		await this.stop();
		await this.ensureStarted();
	}

	async stop() {
		this.rejectAll(new Error('tsserver stopped'));
		const current = this.process;
		if (!current) {
			return;
		}

		this.process = undefined;
		this.startPromise = undefined;

		try {
			current.stdin.end();
		}
		catch {
			// ignore
		}

		await new Promise<void>(resolve => {
			if (current.exitCode !== null || current.signalCode !== null) {
				resolve();
				return;
			}
			current.once('exit', () => resolve());
			current.kill();
		});
	}

	dispose() {
		this.disposed = true;
		void this.stop();
	}

	private spawn() {
		return new Promise<void>((resolve, reject) => {
			//const tsPluginPath = path.resolve(path.dirname(this.options.tsserverPath), '../../../', '@vue/typescript-plugin');
			const args = [
				this.options.tsserverPath,
			//	'--disableAutomaticTypingAcquisition',
				'--globalPlugins',
				'@vue/typescript-plugin',
				'--pluginProbeLocations',
				this.options.pluginProbeLocations.join(','),
			//	'--suppressDiagnosticEvents',
				'--locale',
				vscode.env.language,
				'--logVerbosity',
				'verbose',
				'--logFile',
				logFilePath,
			];
			if (this.options.typingsInstallerPath) {
				args.push('--typingsInstaller', this.options.typingsInstallerPath);
			}
			// @ts-ignore
			const workspaceDir = vscode.workspace.workspaceFolders[0].uri.fsPath; 


			const child = cp.spawn(process.execPath, args, {
				//	cwd: path.dirname(this.options.tsserverPath),
				cwd: workspaceDir,
				env: {
					...process.env,
					TSS_NONPOLLING_IO: '1',
				},
				stdio: ['pipe', 'pipe', 'pipe'],
			});

			this.process = child;

			child.once('error', error => {
				if (this.process === child) {
					this.process = undefined;
					this.startPromise = undefined;
				}
				this.output.appendLine(`[error] Failed to start tsserver: ${error instanceof Error ? error.message : String(error)}`);
				reject(error);
			});

			child.stdout.on('data', data => this.handleStdout(data));
			child.stderr.on('data', data => {
				this.output.appendLine(`[stderr] ${data.toString()}`);
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

			this.request('configure', {
				hostInfo: 'vscode',
				preferences: {
					providePrefixAndSuffixTextForRename: true,
					allowRenameOfImportPath: true,
					includePackageJsonAutoImports: 'auto',
					excludeLibrarySymbolsInNavTo: false,
				},
			}).then(() => {
				return this.request('compilerOptionsForInferredProjects', {
					options: {
						module: 'ESNext',
						moduleResolution: 'Bundler',
						target: 'ESNext',
						jsx: 'react',
						allowImportingTsExtensions: true,
						checkJs: true,
						allowJs: true,
						strictNullChecks: true,
						strictFunctionTypes: true,
						sourceMap: true,
						allowSyntheticDefaultImports: true,
						allowNonTsExtensions: true,
						resolveJsonModule: true,
					},
				});
			}).then(() => {
				resolve();
				this.bootstrapProject();
			});
		});
	}
            
	private bootstrapProject() {
		const workspaceFolder = vscode.workspace.workspaceFolders?.find(folder => folder.uri.scheme === 'file');
		const projectRootPath = workspaceFolder?.uri.fsPath ?? this.storagePath;
		const openFiles = [{ file: `${projectRootPath}/tsconfig.json` }];
		this.output.appendLine(`[info] Bootstrapping project at ${projectRootPath}`);
		this.output.appendLine(`[info] workspacefolder: ${workspaceFolder}`);
		//	const dummyFilePath = path.join(projectRootPath, '__dummy_project_bootstrap__.ts');
		this.request('updateOpen', {
			openFiles: openFiles,
					
		});	
	}

	private handleStdout(chunk: Buffer) {
		this.output.appendLine(`[stdout] ${chunk.toString('utf8')}`);
		this.buffer += chunk.toString('utf8');
		while (true) {
			const separator = this.buffer.indexOf('\r\n\r\n');
			if (separator === -1) {
				return;
			}

			const header = this.buffer.slice(0, separator);
			const lengthMatch = /Content-Length: (\d+)/i.exec(header);
			if (!lengthMatch) {
				this.buffer = this.buffer.slice(separator + 4);
				continue;
			}

			const length = Number(lengthMatch[1]);
			const messageStart = separator + 4;
			const messageEnd = messageStart + length;

			if (this.buffer.length < messageEnd) {
				return;
			}

			const json = this.buffer.slice(messageStart, messageEnd);
			this.buffer = this.buffer.slice(messageEnd);

			try {
				const message = JSON.parse(json) as TsserverMessage;
				this.handleMessage(message);
			}
			catch (error) {
				this.output.appendLine(`[error] Failed to parse tsserver payload: ${error instanceof Error ? error.message : String(error)}`);
				this.output.appendLine(`[error] Payload: ${json}`);
			}
		}
	}

	private handleMessage(message: TsserverMessage) {
		log('[TsserverBridge.handleMessage]', JSON.stringify(message, null, 2));
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
		this.write({
			seq: 0,
			type: 'response',
			request_seq: message.seq,
			success: false,
			body: undefined,
		});
	}

	private write(message: SerializedResponse) {
		log('[TsserverBridge.write]', JSON.stringify(message, null, 2));
		const json = JSON.stringify(message);
		const frame = `Content-Length: ${Buffer.byteLength(json, 'utf8')}` + '\r\n\r\n' + json;
		this.process?.stdin.write(frame, 'utf8');
	}

	private rejectAll(error: unknown) {
		for (const pending of this.pending.values()) {
			pending.reject(error);
		}
		this.pending.clear();
	}
}
