/**
 * A file header providing a readable description of the action or actions its handling
 */

/*
(method) provideHover(this: void, document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, next: ProvideHoverSignature): Promise<...>

*/
import * as vscode from 'vscode';
import type * as lsp from 'vscode-languageclient/node';
import { log } from '../debug/log';
import { getBridge, types, asOneBased } from '../tsserver';

/**
 * Provides hover information for Vue files by delegating to the next middleware
 * and falling back to the Vue quick info bridge when the upstream provider
 * offers no result.
 *
 * @param document - The text document where the hover was invoked.
 * @param position - The zero-based position in the document.
 * @param token - Signals cancellation of the current hover request.
 * @param next - The downstream hover provider supplied by VS Code.
 * @returns Promise resolving to hover content from the downstream provider or the Vue bridge, or null when nothing is available.
 */
const hoverProvider = async (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, next: lsp.ProvideHoverSignature) => {
    const emptyResult: vscode.Hover = new vscode.Hover([]);
    if (token?.isCancellationRequested) return emptyResult;

    log('[Middleware.provideHover.request]', JSON.stringify({ uri: document.uri.toString(), position }, null, 2));
    const res = await next(document, position, token);
    log('[Middleware.provideHover.result]', JSON.stringify(res, null, 2));
    if (res) return res;
            

    const args: types.QuickInfoRequestArgs = {
        verbosityLevel: 3,
        file: document.uri.fsPath,         // absolute path
        line: asOneBased(position.line),           // 1-based
        offset: asOneBased(position.character)     // 1-based
    };

    const tsRes = await getBridge()?.request('_vue:quickinfo', args) as types.QuickInfoResponseBody | undefined;
    if (typeof tsRes === 'undefined') {
        return null;
    }

   

    log(`tsRes: ${JSON.stringify(tsRes, null, 2)}`);
    

    if (tsRes?.displayString) {
        const md = new vscode.MarkdownString().appendCodeblock(tsRes.displayString, 'ts');

        // --- Documentation ---
        switch (true) {
            case typeof tsRes?.documentation === 'string':
                md.appendMarkdown('\n\n' + tsRes.documentation);
                break;

            case Array.isArray(tsRes?.documentation):
                // Concatenate text parts; SymbolDisplayPart.text already contains its own spacing.
                md.appendMarkdown('\n\n' + tsRes.documentation.map((p: types.SymbolDisplayPart) => p.text).join(''));
                break;
        }

        // --- JSDoc tags ---
        if (tsRes?.tags) {
            for (const tag of tsRes.tags) {
                if (!tag.text) continue;

                md.appendMarkdown(`\n\n*@${tag.name}*`);

                // tag.text is already a plain string when displayPartsForJSDoc is false
                md.appendMarkdown(' ' + tag.text);
            }
        }


        md.isTrusted = true;
        return new vscode.Hover([md]);
    }


    log('[Middleware.provideHover.tsResult]', JSON.stringify(tsRes, null, 2));
    return emptyResult;
}


/*
* Exports the HoverProvider
*/
export default hoverProvider; 
