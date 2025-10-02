import * as vscode from 'vscode';
import { getBridge, types } from '../tsserver';
import { log } from '../debug/log';


export const didOpen = async (document: vscode.TextDocument) => {
   
    const args: types.GeterrRequestArgs = {
        delay: 200,                         // debounce a bit; 0 is also fine
        files: [document.uri.fsPath],       // native path
        // projectFileName?: '/abs/path/to/tsconfig.json' // optional
    };
    const res = await getBridge()?.request('geterr', args) as any | undefined;
    log("[Middleware.didOpen.result]", JSON.stringify(res, null, 2));
}