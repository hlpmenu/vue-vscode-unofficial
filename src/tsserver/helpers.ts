

export const vueify = (command: string): string => {
    return `_vue:${command}`;
}

export const asOneBased = (index: number): number => {
    return index + 1;
}