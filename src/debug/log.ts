import * as vscode from 'vscode';
import type { ExtensionContext } from 'vscode';

let vueDebugChannel: vscode.OutputChannel;

const setuo = (ctx: ExtensionContext) => {

    vueDebugChannel = vscode.window.createOutputChannel('Vue Debug');
    ctx.subscriptions.push(vueDebugChannel);
}

const log = (...args: any[]) => { // oxlint-disable-line
    if (!vueDebugChannel) return;
    vueDebugChannel?.appendLine(args.join(' '));
};

export {
    setuo,
    vueDebugChannel,
    log,
}