import * as vscode from 'vscode';
import { configs } from './generated-meta';

type ConfigKey = keyof typeof configs;

type ConfigValue<K extends ConfigKey> = (typeof configs)[K] extends { default: infer T } ? T : unknown;

const get = <K extends ConfigKey>(key: K): ConfigValue<K> => {
	const item = configs[key];
	return vscode.workspace.getConfiguration().get(item.key, item.default) as ConfigValue<K>;
};

export const config = {
	get editor() {
		return {
			focusMode: get('editorFocusMode'),
			reactivityVisualization: get('editorReactivityVisualization'),
			templateInterpolationDecorators: get('editorTemplateInterpolationDecorators'),
		};
	},
	get server() {
		return {
			path: get('serverPath'),
			includeLanguages: get('serverIncludeLanguages'),
		};
	},
	get codeActions() {
		return {
			askNewComponentName: get('codeActionsAskNewComponentName'),
		};
	},
	get autoInsert() {
		return {
			dotValue: get('autoInsertDotValue'),
			bracketSpacing: get('autoInsertBracketSpacing'),
		};
	},
	get suggest() {
		return {
			componentNameCasing: get('suggestComponentNameCasing'),
			propNameCasing: get('suggestPropNameCasing'),
			defineAssignment: get('suggestDefineAssignment'),
		};
	},
	get inlayHints() {
		return {
			destructuredProps: get('inlayHintsDestructuredProps'),
			missingProps: get('inlayHintsMissingProps'),
			inlineHandlerLeading: get('inlayHintsInlineHandlerLeading'),
			optionsWrapper: get('inlayHintsOptionsWrapper'),
			vBindShorthand: get('inlayHintsVBindShorthand'),
		};
	},
	get format() {
		return {
			template: { initialIndent: get('formatTemplateInitialIndent') },
			script: { initialIndent: get('formatScriptInitialIndent') },
			style: { initialIndent: get('formatStyleInitialIndent') },
			wrapAttributes: get('formatWrapAttributes'),
		};
	},
	get trace() {
		return {
			server: get('traceServer'),
		};
	},
};

export const onConfigChange = (
	context: vscode.ExtensionContext,
	handler: () => void,
	sectionPrefix = 'vue.',
) => {
	const disposable = vscode.workspace.onDidChangeConfiguration(event => {
		if (event.affectsConfiguration(sectionPrefix.slice(0, -1))) {
			handler();
		}
	});
	context.subscriptions.push(disposable);
	return disposable;
};
