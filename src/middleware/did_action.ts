import * as vscode from 'vscode';
import { getBridge, types } from '../tsserver';
import { log } from '../debug/log';
import { asOneBased } from '../tsserver';

export const didOpen = async (
    document: vscode.TextDocument,
    next: (document: vscode.TextDocument) => Promise<void>
) => {
    if (document.languageId !== 'vue') {
        return next(document);
    }

    const file = document.uri.fsPath;

    const openArgs: types.OpenRequestArgs = {
        file,
        fileContent: document.getText(),
        scriptKindName: 'TS',
    };
    await getBridge()?.request('open', openArgs);

    const errArgs: types.GeterrRequestArgs = {
        files: [file],
        delay: 200,
    };
    const res = await getBridge()?.request('geterr', errArgs);
    log("[Middleware.didOpen.geterr]", JSON.stringify(res, null, 2));

    return next(document);
};


export const didChange = async (ev: vscode.TextDocumentChangeEvent, next: any) => {
    // Apply each VS Code change to tsserver in order
    const que: types.ChangeRequestArgs[] = [];
    const file = ev.document.uri.fsPath;

    if (ev.document.languageId !== 'vue') {
        return;
    }

    ev.contentChanges.forEach((ch: vscode.TextDocumentContentChangeEvent) => {
        const args: types.ChangeRequestArgs = {
            file,
            line: asOneBased(ch.range.start.line),
            offset: asOneBased(ch.range.start.character),
            endLine: asOneBased(ch.range.end.line),
            endOffset: asOneBased(ch.range.end.character),
            insertString: ch.text,   // "" => deletion, "\n" etc => insertion, anything => replacement
        };
        que.push(args);
    });

    que.forEach(async (args) => {
        await getBridge()?.request('change', args) as undefined
        log("[Middleware.didChange]", JSON.stringify(file, null, 2));
    });
    return next(ev);

}


