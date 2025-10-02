import * as interpolationDecorators from '../lib/interpolationDecorators'; 
import * as vscode from 'vscode';

export const activeateInerpolationDecorators = (context: vscode.ExtensionContext, selectors: string[]) => {
    interpolationDecorators.activate(context, selectors);


}