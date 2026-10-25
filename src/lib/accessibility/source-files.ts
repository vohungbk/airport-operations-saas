import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Every `.ts` and `.tsx` file under `dir` that is not a test. Test support only. */
export function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    const isSource = /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name);
    return isSource ? [full] : [];
  });
}
