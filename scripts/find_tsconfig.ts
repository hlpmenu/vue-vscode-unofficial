

import { stat } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";


const findTsconfig = async (startDir = "."): Promise<string> => {
  let dir = resolve(startDir);

  for (;;) {
    try {
      const candidate = join(dir, "tsconfig.json");
      const info = await stat(candidate);
      if (info.isFile()) {
        return candidate;
      }
    } catch {
      // not here, keep climbing
    }

    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not find tsconfig.json upwards from ${startDir}`);
    }
    dir = parent;
  }
};

if (import.meta.main) {
  const tsconfig = await findTsconfig();
  console.log(tsconfig);
}


export default findTsconfig;