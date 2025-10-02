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
    log('[Middleware.provideHover.request]', JSON.stringify({ uri: document.uri.toString(), position }, null, 2));
    const res = await next(document, position, token);
    log('[Middleware.provideHover.result]', JSON.stringify(res, null, 2));
    const result: string[] = []
    if (res) return res;
            

    const args: types.QuickInfoRequestArgs = {
        verbosityLevel: 4,
        file: document.uri.fsPath,         // absolute path
        line: asOneBased(position.line),           // 1-based
        offset: asOneBased(position.character)     // 1-based
    };



    const tsRes = await getBridge()?.request('_vue:quickinfo', args) as types.QuickInfoResponseBody | undefined;
    if (typeof tsRes === 'undefined') {
        return null;
    }

    log(`tsRes: ${JSON.stringify(tsRes, null, 2)}`);

    if (tsRes?.displayString) return new vscode.Hover([new vscode.MarkdownString().appendCodeblock(tsRes.displayString, 'ts')]);


    log('[Middleware.provideHover.tsResult]', JSON.stringify(tsRes, null, 2));
    return new vscode.Hover(result)
}


/*
* Exports the HoverProvider
*/
export default hoverProvider; 
