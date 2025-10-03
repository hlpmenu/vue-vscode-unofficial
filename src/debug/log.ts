import * as vscode from 'vscode';
import type { ExtensionContext } from 'vscode';

let vueDebugChannel: vscode.OutputChannel | undefined;
let vueLanguageChannel: vscode.OutputChannel | undefined;
let tsLanguageChannel: vscode.OutputChannel | undefined;
let completionsDebugChannel: vscode.OutputChannel | undefined;

const setup = (ctx: ExtensionContext) => {
    vueDebugChannel = vscode.window.createOutputChannel('Vue Debug');
    vueLanguageChannel = vscode.window.createOutputChannel('Vue Language Server');
    tsLanguageChannel = vscode.window.createOutputChannel('Vue TypeScript Server');
    completionsDebugChannel = vscode.window.createOutputChannel('Vue Completions Server');
    ctx.subscriptions.push(vueDebugChannel, vueLanguageChannel, tsLanguageChannel, completionsDebugChannel);
};

const log = (...args: any[]) => { // oxlint-disable-line
    vueDebugChannel?.appendLine(args.join(' '));
};

const vueLog = (...args: any[]) => { // oxlint-disable-line
    vueLanguageChannel?.appendLine(args.join(' '));
};

const tsLog = (...args: any[]) => { // oxlint-disable-line
    tsLanguageChannel?.appendLine(args.join(' '));
};

const getVueOutputChannel = (): vscode.OutputChannel => {
    if (!vueLanguageChannel) {
        throw new Error('Vue output channel is not initialized');
    }
    return vueLanguageChannel;
};

const getTsOutputChannel = (): vscode.OutputChannel => {
    if (!tsLanguageChannel) {
        throw new Error('TypeScript output channel is not initialized');
    }
    return tsLanguageChannel;
};

const completionsLog = (...args: any[]) => { // oxlint-disable-line
    completionsDebugChannel?.appendLine(args.join(' '));
};

export {
    setup,
    vueDebugChannel,
    log,
    vueLog,
    tsLog,
    completionsLog,
    getVueOutputChannel,
    getTsOutputChannel,
};
