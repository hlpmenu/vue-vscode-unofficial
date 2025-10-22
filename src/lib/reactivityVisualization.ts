import * as vscode from 'vscode';
import { requestTsserver } from '../tsserver/client';
import { config } from './config';

interface TextRange {
	readonly pos: number;
	readonly end: number;
}

interface ReactiveReferences {
	readonly dependencyRanges: readonly TextRange[];
	readonly dependentRanges: readonly TextRange[];
}

const dependencyDecorations = vscode.window.createTextEditorDecorationType({
	isWholeLine: true,
	backgroundColor: 'rgba(120,120,255,0.1)',
	border: '1px solid rgba(120,120,255,0.6)',
	borderWidth: '0 0 0 3px',
	// after: {
	//   contentText: '   dependents',
	//   color: 'rgba(120,120,255,0.6)',
	// },
});
const dependentDecorations = vscode.window.createTextEditorDecorationType({
	// outlineColor: 'rgba(80,200,80,0.6)',
	// outlineStyle: 'dashed',
	// borderRadius: '3px',
	isWholeLine: true,
	backgroundColor: 'rgba(80,200,80,0.1)',
	border: '1px solid rgba(80,200,80,0.6)',
	borderWidth: '0 0 0 3px',
});

export function activate(
	context: vscode.ExtensionContext,
	selector: vscode.DocumentSelector,
) {
	const documentUpdateVersions = new WeakMap<vscode.TextDocument, number>();

	let timeout: ReturnType<typeof setTimeout> | undefined;

	for (const editor of vscode.window.visibleTextEditors) {
		updateDecorations(editor);
	}

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(editor => {
			if (editor) {
				updateDecorations(editor);
			}
		}),
		vscode.window.onDidChangeTextEditorSelection(() => {
			const editor = vscode.window.activeTextEditor;
			if (editor) {
				clearTimeout(timeout);
				timeout = setTimeout(
					() => updateDecorations(editor),
					getUpdateInterval(editor.document),
				);
			}
		}),
	);

	function getUpdateInterval(document: vscode.TextDocument) {
		const prevVersion = documentUpdateVersions.get(document);
		if (prevVersion !== document.version) {
			documentUpdateVersions.set(document, document.version);
			return 250;
		}
		return 100;
	}

	async function updateDecorations(editor: vscode.TextEditor) {
		const { document } = editor;
		if (document.uri.scheme !== 'file') {
			return;
		}
		if (
			!vscode.languages.match(selector, document) &&
			document.languageId !== 'typescript' &&
			document.languageId !== 'javascript' &&
			document.languageId !== 'typescriptreact' &&
			document.languageId !== 'javascriptreact'
		) {
			return;
		}
		if (!config.editor.reactivityVisualization) {
			editor.setDecorations(dependencyDecorations, []);
			editor.setDecorations(dependentDecorations, []);
			return;
		}

		try {
			const normalizedPath = document.uri.fsPath.replace(/\\/g, '/');
			const result = await requestTsserver<ReactiveReferences>(
				'_vue:getReactiveReferences',
				[
					normalizedPath,
					document.offsetAt(editor.selection.active),
				],
			);
			editor.setDecorations(
				dependencyDecorations,
				getFlatRanges(document, result?.dependencyRanges ?? []),
			);
			editor.setDecorations(
				dependentDecorations,
				getFlatRanges(document, result?.dependentRanges ?? []),
			);
		}
		catch {
			editor.setDecorations(dependencyDecorations, []);
			editor.setDecorations(dependentDecorations, []);
		}
	}
}

function getFlatRanges(document: vscode.TextDocument, ranges: readonly TextRange[]) {
	const documentRanges = ranges
		.map(range =>
			new vscode.Range(
				document.positionAt(range.pos).line,
				0,
				document.positionAt(range.end).line,
				0,
			),
		)
		.sort((a, b) => a.start.compareTo(b.start));

	for (let i = 1; i < documentRanges.length; i++) {
		const prev = documentRanges[i - 1]!;
		const curr = documentRanges[i]!;

		if (prev.end.compareTo(curr.start) >= 0) {
			if (curr.end.compareTo(prev.end) <= 0) {
				documentRanges.splice(i, 1);
			}
			else {
				documentRanges.splice(i - 1, 2, new vscode.Range(prev.start, curr.end));
			}
			i--;
		}
	}
	return documentRanges;
} 