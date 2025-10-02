import type * as types from '../tsserver/server.d.ts';
import * as vscode from 'vscode';



export const locationToRange = (location: types.Location): vscode.Range => {
    const zeroBasedLine = Math.max(0, location.line - 1);
    const zeroBasedChar = Math.max(0, location.offset - 1);
    return new vscode.Range(zeroBasedLine, zeroBasedChar, zeroBasedLine, zeroBasedChar);
};




