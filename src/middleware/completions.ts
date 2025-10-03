/**
 * Provides and resolves completion items for Vue files by delegating to the next
 * middleware and augmenting them with results from the Tsserver bridge.
 */
import * as vscode from 'vscode';
import type * as lsp from 'vscode-languageclient/node';

import { getBridge, types, asOneBased } from '../tsserver';
import { log, completionsLog } from '../debug/log';

type CompletionEntryIdentifier = {
    readonly name: string;
    readonly source?: string;
    readonly data?: unknown;
};

type TsCompletionData = {
    readonly provider: 'ts';
    readonly file: string;
    readonly line: number;
    readonly offset: number;
    readonly entry: CompletionEntryIdentifier;
};

const completionDataStore = new WeakMap<vscode.CompletionItem, TsCompletionData>();
const ONE_BASED_OFFSET = 1;

const toPosition = (location: types.Location): vscode.Position => new vscode.Position(
    Math.max(0, location.line - ONE_BASED_OFFSET),
    Math.max(0, location.offset - ONE_BASED_OFFSET),
);

const textSpanToRange = (span: types.TextSpan): vscode.Range => new vscode.Range(
    toPosition(span.start),
    toPosition(span.end),
);

const toItemKind = (kind: string | undefined): vscode.CompletionItemKind => {
    if (!kind) {
        return vscode.CompletionItemKind.Text;
    }

    const normalised = kind.toLowerCase();

    if (normalised.includes('interface')) return vscode.CompletionItemKind.Interface;
    if (normalised.includes('class')) return vscode.CompletionItemKind.Class;
    if (normalised.includes('enum')) return vscode.CompletionItemKind.Enum;
    if (normalised.includes('alias')) return vscode.CompletionItemKind.Reference;
    if (normalised.includes('module') || normalised.includes('namespace')) return vscode.CompletionItemKind.Module;
    if (normalised.includes('function') || normalised.includes('call')) return vscode.CompletionItemKind.Function;
    if (normalised.includes('method')) return vscode.CompletionItemKind.Method;
    if (normalised.includes('constructor')) return vscode.CompletionItemKind.Constructor;
    if (normalised.includes('property') || normalised.includes('getter') || normalised.includes('setter')) {
        return vscode.CompletionItemKind.Property;
    }
    if (normalised.includes('variable') || normalised.includes('var') || normalised.includes('let')) {
        return vscode.CompletionItemKind.Variable;
    }
    if (normalised.includes('const')) return vscode.CompletionItemKind.Constant;
    if (normalised.includes('keyword')) return vscode.CompletionItemKind.Keyword;
    if (normalised.includes('snippet')) return vscode.CompletionItemKind.Snippet;
    if (normalised.includes('folder') || normalised.includes('directory')) return vscode.CompletionItemKind.Folder;
    if (normalised.includes('file') || normalised.includes('script')) return vscode.CompletionItemKind.File;
    if (normalised.includes('boolean') || normalised.includes('string') || normalised.includes('number') || normalised.includes('bigint')) {
        return vscode.CompletionItemKind.Value;
    }

    return vscode.CompletionItemKind.Text;
};

const partsToString = (parts: string | readonly types.SymbolDisplayPart[] | undefined): string | undefined => {
    if (!parts) {
        return undefined;
    }
    if (typeof parts === 'string') {
        return parts;
    }
    return parts.map(part => part.text).join('');
};

const toTriggerKind = (
    kind: vscode.CompletionTriggerKind,
): types.CompletionsRequestArgs['triggerKind'] => {
    switch (kind) {
        case vscode.CompletionTriggerKind.TriggerCharacter:
            return 1 as types.CompletionsRequestArgs['triggerKind'];
        case vscode.CompletionTriggerKind.TriggerForIncompleteCompletions:
            return 2 as types.CompletionsRequestArgs['triggerKind'];
        case vscode.CompletionTriggerKind.Invoke:
        default:
            return 0 as types.CompletionsRequestArgs['triggerKind'];
    }
};

const buildCompletionItem = (
    entry: types.CompletionEntry,
    context: {
        readonly file: string;
        readonly line: number;
        readonly offset: number;
        readonly defaultRange?: vscode.Range;
    },
): vscode.CompletionItem => {
    const item = new vscode.CompletionItem(entry.name, toItemKind(entry.kind));

    item.sortText = entry.sortText;
    item.filterText = entry.insertText ? entry.insertText : entry.filterText;
    item.commitCharacters = entry.commitCharacters;
    item.preselect = entry.isRecommended === true;
    const data: TsCompletionData = {
        provider: 'ts',
        file: context.file,
        line: context.line,
        offset: context.offset,
        entry: {
            name: entry.name,
            source: entry.source,
            data: entry.data,
        },
    };
    completionDataStore.set(item, data);

    if (entry.source) {
        item.label = { label: entry.name, description: entry.source };
    }

    if (entry.insertText) {
        item.insertText = entry.isSnippet ? new vscode.SnippetString(entry.insertText) : entry.insertText;
    }

    if (entry.replacementSpan) {
        item.range = textSpanToRange(entry.replacementSpan);
    }
    else if (context.defaultRange) {
        item.range = context.defaultRange;
    }

    const detailSuffix = entry.kindModifiers ? ` [${entry.kindModifiers}]` : '';
    item.detail = entry.kind ? `${entry.kind}${detailSuffix}` : undefined;

    return item;
};

const isTsCompletionData = (data: unknown): data is TsCompletionData => {
    if (!data || typeof data !== 'object') {
        return false;
    }
    const candidate = data as Partial<TsCompletionData>;
    return candidate.provider === 'ts'
        && typeof candidate.file === 'string'
        && typeof candidate.line === 'number'
        && typeof candidate.offset === 'number'
        && typeof candidate.entry === 'object'
        && candidate.entry !== null
        && typeof candidate.entry?.name === 'string';
};

const extractAdditionalTextEdits = (
    details: readonly types.CompletionEntryDetails[] | undefined,
    targetFile: string,
): vscode.TextEdit[] => {
    if (!details?.length) {
        return [];
    }

    const edits: vscode.TextEdit[] = [];

    for (const detail of details) {
        const actions = detail.codeActions ?? [];
        for (const action of actions) {
            for (const change of action.changes) {
                if (change.fileName !== targetFile) {
                    continue;
                }
                for (const textChange of change.textChanges) {
                    const range = new vscode.Range(toPosition(textChange.start), toPosition(textChange.end));
                    edits.push(vscode.TextEdit.replace(range, textChange.newText));
                }
            }
        }
    }

    return edits;
};

const mergeCompletionResults = (
    base: vscode.CompletionItem[] | vscode.CompletionList | null | undefined,
    extraItems: vscode.CompletionItem[],
    isIncomplete: boolean,
): vscode.CompletionItem[] | vscode.CompletionList => {
    if (!base) {
        return new vscode.CompletionList(extraItems, isIncomplete);
    }

    if (base instanceof vscode.CompletionList) {
        base.items.push(...extraItems);
        base.isIncomplete = base.isIncomplete || isIncomplete;
        return base;
    }

    const combined = Array.isArray(base) ? base.slice() : [];
    combined.push(...extraItems);
    return combined;
};

/**
 * Provides completion items for Vue files.
 *
 * @param document The text document.
 * @param position The position.
 * @param context The completion context.
 * @param token The cancellation token.
 * @param next The next middleware.
 * @returns
 */
export const provideCompletionItem = async (
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.CompletionContext,
    token: vscode.CancellationToken,
    next: lsp.ProvideCompletionItemsSignature,
): Promise<vscode.CompletionItem[] | vscode.CompletionList> => {
    const base = await next(document, position, context, token);
    if (token.isCancellationRequested) {
        return base ?? [];
    }

    const bridge = getBridge();
    if (!bridge) {
        return base ?? [];
    }

    const file = document.uri.fsPath;
    const lastLineIndex = Math.max(document.lineCount - 1, 0);
    const boundedLineIndex = Math.min(Math.max(position.line, 0), lastLineIndex);
    const boundedCharacter = Math.min(
        Math.max(position.character, 0),
        document.lineAt(boundedLineIndex).text.length,
    );
    const line = asOneBased(boundedLineIndex);
    const offset = asOneBased(boundedCharacter);

    const args: types.CompletionsRequestArgs = {
        file,
        line,
        offset,
        triggerKind: toTriggerKind(context.triggerKind),
    };

    if (context.triggerCharacter) {
        args.triggerCharacter = context.triggerCharacter as types.CompletionsTriggerCharacter;
    }

    log('[Middleware.provideCompletionItem.request]', JSON.stringify({ file, line, offset, triggerKind: args.triggerKind, triggerCharacter: args.triggerCharacter, isVue: document.languageId === 'vue' }));
    const response = await bridge.request('completionInfo', args) as types.CompletionInfo | undefined;
    log('[Middleware.provideCompletionItem.response]', JSON.stringify({ entries: response?.entries.length ?? 0, isIncomplete: response?.isIncomplete }));
    if (!response || !response.entries.length || token.isCancellationRequested) {
        return base ?? [];
    }


    let defaultRange = response.optionalReplacementSpan ? textSpanToRange(response.optionalReplacementSpan) : undefined;
    const tsItems = response.entries.map((entry: types.CompletionEntry) => buildCompletionItem(entry, { file, line, offset, defaultRange }));

    if (response.isMemberCompletion && !response.optionalReplacementSpan && !defaultRange) {
        const pos = new vscode.Position(boundedLineIndex, boundedCharacter);
        defaultRange = new vscode.Range(pos, pos);
    }
    
    return mergeCompletionResults(base, tsItems, Boolean(response.isIncomplete));
};

/**
 * Resolves a completion item.
 *
 * @param item The completion item to resolve.
 * @param token The cancellation token.
 * @param next The next middleware.
 * @returns
 */
export const resolveCompletionItem = async (
    item: vscode.CompletionItem,
    token: vscode.CancellationToken,
    next: lsp.ResolveCompletionItemSignature,
): Promise<vscode.CompletionItem> => {
    const base = await next(item, token);
    const target = base ?? item;

    if (token.isCancellationRequested) {
        return target;
    }

    const data = completionDataStore.get(target) ?? completionDataStore.get(item);
    if (!isTsCompletionData(data)) {
        return target;
    }

    const bridge = getBridge();
    if (!bridge) {
        return target;
    }

    const args: types.CompletionDetailsRequestArgs = {
        file: data.file,
        line: data.line,
        offset: data.offset,
        entryNames: [data.entry],
    };

    const details = await bridge.request('completionEntryDetails', args) as readonly types.CompletionEntryDetails[] | undefined;
    if (!details?.length || token.isCancellationRequested) {
        return target;
    }

    const [detail] = details;
    const description = partsToString(detail.displayParts);
    if (description && !target.detail) {
        target.detail = description;
    }

    const documentation = partsToString(detail.documentation);
    if (documentation && !target.documentation) {
        target.documentation = new vscode.MarkdownString(documentation);
    }

    const additionalEdits = extractAdditionalTextEdits(details, data.file);
    if (additionalEdits.length) {
        target.additionalTextEdits = [...(target.additionalTextEdits ?? []), ...additionalEdits];
    }

    return target;
};
