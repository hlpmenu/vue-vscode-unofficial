

import {$} from 'bun';
import findTsconfig from "./find_tsconfig";
import { stat } from "node:fs/promises";


let checkDir = "./src";
let tsConfigPath = "../tsconfig.json";



const typecheck = async (configpath: string = `${tsConfigPath}`) => {
    try {
    const typeCheckResult = await $`bunx --bun tsgo --noEmit --target esnext -p ${configpath}`.nothrow().env(process.env).quiet().cwd(`${checkDir}`);
    if (typeCheckResult.exitCode !== 0) {
        Bun.stdout.write(typeCheckResult.bytes());
        process.exit(1);
    }
    Bun.stdout.write("--- No Errors Found! ---\n");
    Bun.stdout.write(typeCheckResult.bytes());

    } catch (e) {
        if (e instanceof $.ShellError) {
            const bytes = e.bytes();
            if (bytes.length > 0) {
             Bun.stdout.write(e.bytes());
            } else {
                console.log("Error:",e)
            }
            process.exit(1);
        }
        throw e;
    }
}

if (import.meta.main) {

const args = process.argv.slice(2);
if (args.includes("--root")) {
  const idx = args.indexOf("--root");
  const dir = args[idx + 1];

  if (dir && !dir.startsWith("-")) {
    try {
      const exists = await stat(dir, )
      if (exists) {
        checkDir = dir;
      } else {
        console.error(`Directory "${dir}" does not exist.`);
        process.exit(1);
      }
    } catch {
      console.error(`Failed to access "${dir}".`);
      process.exit(1);
    }
  } else {
    console.error(`Invalid usage: --root requires a directory path.`);
    process.exit(1);
  }
}
if (checkDir !== "." && checkDir !== "" && checkDir !== "./") {
  tsConfigPath = await findTsconfig(checkDir);
}
await typecheck();
}



export default typecheck;