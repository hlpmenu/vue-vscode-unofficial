import * as vscode from 'vscode';
import { Middleware, vsdiag } from 'vscode-languageclient/node';

import { log } from '../debug/log';
import { getBridge, types, constants, locationToRange } from '../tsserver';

type TsDiagnostic = types.Diagnostic | types.DiagnosticWithLinePosition;

const diagnosticCategoryToSeverity = (category: types.DiagnosticCategory | string | undefined): vscode.DiagnosticSeverity => {
    switch (category) {
        case constants.Diagnostic.Category.Error:
            return vscode.DiagnosticSeverity.Error;
        case constants.Diagnostic.Category.Warning:
            return vscode.DiagnosticSeverity.Warning;
        case constants.Diagnostic.Category.Suggestion:
            return vscode.DiagnosticSeverity.Hint;
        default:
            return vscode.DiagnosticSeverity.Information;
    }
};

const toPosition = (location: types.Location) => locationToRange(location).start;

const getStartLocation = (diagnostic: TsDiagnostic): types.Location | undefined => ('startLocation' in diagnostic ? diagnostic.startLocation : diagnostic.start);

const getEndLocation = (diagnostic: TsDiagnostic): types.Location | undefined => {
    if ('endLocation' in diagnostic && diagnostic.endLocation) {
        return diagnostic.endLocation;
    }
    if ('end' in diagnostic && diagnostic.end) {
        return diagnostic.end;
    }
    return getStartLocation(diagnostic);
};

const toRange = (diagnostic: TsDiagnostic): vscode.Range | undefined => {
    const startLocation = getStartLocation(diagnostic);
    if (!startLocation) {
        return undefined;
    }

    const start = toPosition(startLocation);
    const endLocation = getEndLocation(diagnostic) ?? startLocation;
    const end = toPosition(endLocation);
    return new vscode.Range(start, end);
};

const convertRelatedInformation = (related: readonly types.DiagnosticRelatedInformation[] | undefined): vscode.DiagnosticRelatedInformation[] => {
    if (!related?.length) {
        return [];
    }

    const result: vscode.DiagnosticRelatedInformation[] = [];

    for (const info of related) {
        const span = info.span;
        if (!span) {
            continue;
        }

        const uri = vscode.Uri.file(span.file);
        const start = toPosition(span.start);
        const end = toPosition(span.end ?? span.start);
        const range = new vscode.Range(start, end);
        result.push(new vscode.DiagnosticRelatedInformation(new vscode.Location(uri, range), info.message));
    }

    return result;
};

const convertTsDiagnostic = (diagnostic: TsDiagnostic): vscode.Diagnostic | undefined => {
    const range = toRange(diagnostic);
    if (!range) {
        return undefined;
    }

    const message = 'message' in diagnostic ? diagnostic.message : diagnostic.text;
    const severity = diagnosticCategoryToSeverity(diagnostic.category);
    const converted = new vscode.Diagnostic(range, message, severity);

    if (typeof diagnostic.code !== 'undefined') {
        converted.code = diagnostic.code;
    }

    const source = 'source' in diagnostic && diagnostic.source ? diagnostic.source : 'tsserver';
    converted.source = source;

    const tags: vscode.DiagnosticTag[] = [];
    if ('reportsUnnecessary' in diagnostic && diagnostic.reportsUnnecessary) {
        tags.push(vscode.DiagnosticTag.Unnecessary);
    }
    if ('reportsDeprecated' in diagnostic && diagnostic.reportsDeprecated) {
        tags.push(vscode.DiagnosticTag.Deprecated);
    }
    if (tags.length) {
        converted.tags = tags;
    }

    const related = convertRelatedInformation(diagnostic.relatedInformation);
    if (related.length) {
        converted.relatedInformation = related;
    }

    return converted;
};

const requestDiagnostics = async (command: string, file: string): Promise<readonly TsDiagnostic[]> => {
    const bridge = getBridge();
    if (!bridge) {
        return [];
    }

    const args = { file, includeLinePosition: true } as types.SemanticDiagnosticsSyncRequest['arguments'];

    try {
        const result = await bridge.request(command, args);
        return Array.isArray(result) ? (result as TsDiagnostic[]) : [];
    }
    catch (error) {
        log('[Middleware.diagnostics.request.error]', JSON.stringify({ command, file, error: error instanceof Error ? error.message : String(error) }));
        return [];
    }
};

const fetchTsDiagnosticsForUri = async (uri: vscode.Uri): Promise<vscode.Diagnostic[]> => {
    if (uri.scheme !== 'file') {
        return [];
    }

    const file = uri.fsPath;
    const commands = [
        'syntacticDiagnosticsSync',
        'semanticDiagnosticsSync',
        'suggestionDiagnosticsSync',
    ];

    const primary = await Promise.all(commands.map(command => requestDiagnostics(command, file)));
    let diagnostics = primary.flat();

    if (!diagnostics.length && file.endsWith('.vue')) {
        const vueCommands = [
            '_vue:syntacticDiagnosticsSync',
            '_vue:semanticDiagnosticsSync',
            '_vue:suggestionDiagnosticsSync',
        ];
        const vue = await Promise.all(vueCommands.map(command => requestDiagnostics(command, file)));
        diagnostics = vue.flat();
    }

    return diagnostics
        .map(convertTsDiagnostic)
        .filter((diagnostic): diagnostic is vscode.Diagnostic => Boolean(diagnostic));
};

export const handleDiagnostics: Middleware['handleDiagnostics'] = (uri, diagnostics, next) => {
    if (uri.scheme !== 'file') {
        next(uri, diagnostics);
        return;
    }

    void (async () => {
        try {
            const tsDiagnostics = await fetchTsDiagnosticsForUri(uri);
            if (!tsDiagnostics.length) {
                next(uri, diagnostics);
                return;
            }

            const merged = diagnostics.concat(tsDiagnostics);
            log('[Middleware.handleDiagnostics]', JSON.stringify({ uri: uri.toString(), original: diagnostics.length, ts: tsDiagnostics.length, total: merged.length }, null, 2));
            next(uri, merged);
        }
        catch (error) {
            log('[Middleware.handleDiagnostics.error]', JSON.stringify({ uri: uri.toString(), error: error instanceof Error ? error.message : String(error) }));
            next(uri, diagnostics);
        }
    })();
};

const extractUri = (documentOrUri: vscode.TextDocument | vscode.Uri): vscode.Uri => (
    documentOrUri instanceof vscode.Uri ? documentOrUri : documentOrUri.uri
);

const asFullReport = (report: vsdiag.DocumentDiagnosticReport | null | undefined): vsdiag.RelatedFullDocumentDiagnosticReport | undefined => {
    if (!report || report.kind !== vsdiag.DocumentDiagnosticReportKind.full) {
        return undefined;
    }
    return report as vsdiag.RelatedFullDocumentDiagnosticReport;
};

export const provideDiagnostics: Middleware['provideDiagnostics'] = async (documentOrUri, previousResultId, token, next) => {
    const baseReport = await next(documentOrUri, previousResultId, token);
    const uri = extractUri(documentOrUri);

    if (token.isCancellationRequested) {
        return baseReport;
    }

    const tsDiagnostics = await fetchTsDiagnosticsForUri(uri);
    if (!tsDiagnostics.length) {
        return baseReport;
    }

    const baseFull = asFullReport(baseReport);
    const mergedItems = [...(baseFull?.items ?? []), ...tsDiagnostics];

    const merged: vsdiag.RelatedFullDocumentDiagnosticReport = {
        kind: vsdiag.DocumentDiagnosticReportKind.full,
        items: mergedItems,
    };

    if (baseFull?.resultId) {
        merged.resultId = baseFull.resultId;
    }

    if (baseFull?.relatedDocuments) {
        merged.relatedDocuments = baseFull.relatedDocuments;
    }

    log('[Middleware.provideDiagnostics]', JSON.stringify({ uri: uri.toString(), original: baseFull?.items.length ?? 0, ts: tsDiagnostics.length, total: merged.items.length }, null, 2));

    return merged;
};
