import type { TsserverBridge } from './bridge';

let activeBridge: TsserverBridge | undefined;

export const setBridge = (next: TsserverBridge | undefined) => {
	activeBridge = next;
};

export const getBridge = () => activeBridge;

export const requestTsserver = async <T>(
	command: string,
	args?: unknown,
): Promise<T | undefined> => {
	const bridge = activeBridge;
	if (!bridge) {
		throw new Error('TypeScript server bridge is not ready');
	}
	return (await bridge.request(command, args)) as T | undefined;
};
