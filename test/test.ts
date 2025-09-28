// test.ts

for await (const chunk of Bun.stdin.stream()) {
  await Bun.stdout.write(chunk);
}

export {};