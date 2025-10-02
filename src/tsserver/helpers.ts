import type * as types from './server.d.ts';
import * as vscode from 'vscode';

export const vueify = (command: string): string => {
    return `_vue:${command}`;
}

export const asOneBased = (index: number): number => {
    return index + 1;
}
export const locationToRange = (location: types.Location): vscode.Range => {
    const zeroBasedLine = Math.max(0, location.line - 1);
    const zeroBasedChar = Math.max(0, location.offset - 1);
    return new vscode.Range(zeroBasedLine, zeroBasedChar, zeroBasedLine, zeroBasedChar);
};

export const constants = {
    Diagnostic: {
        Category: {
            Error: 'error',
            Warning: 'warning',
            Suggestion: 'suggestion',
        },
    }
}