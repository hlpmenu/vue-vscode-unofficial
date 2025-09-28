import * as cp from 'node:child_process';
import * as path from 'node:path';
import { resolveTsserverOptions } from '../src/tsserver/bridge';

const extensionPath = path.resolve(__dirname, '..');

const options = resolveTsserverOptions(
	'',
	[],
	extensionPath,
);

if (!options) {
	console.error('Could not resolve tsserver options');
	process.exit(1);
}

const args = [
	options.tsserverPath,
	'--port',
	'9988',
	'--serverMode',
	'partialSemantic',
	'--useInferredProjectPerProjectRoot',
	'--enableTelemetry',
	'--locale',
	'en',
	'--logVerbosity',
	'verbose',
];

console.log('Starting tsserver with args:', args);

const child = cp.spawn(process.execPath, args, {
	cwd: path.dirname(options.tsserverPath),
	stdio: 'inherit',
});

child.on('exit', (code, signal) => {
	console.log(`tsserver exited (code ${code ?? 'null'}, signal ${signal ?? 'null'})`);
});