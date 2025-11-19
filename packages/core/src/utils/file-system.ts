import * as nodeFs from "node:fs/promises";

export const fileSystem = {
  readFile: (...args: Parameters<typeof nodeFs.readFile>) => nodeFs.readFile(...args),
  writeFile: (...args: Parameters<typeof nodeFs.writeFile>) => nodeFs.writeFile(...args),
  mkdir: (...args: Parameters<typeof nodeFs.mkdir>) => nodeFs.mkdir(...args),
  access: (...args: Parameters<typeof nodeFs.access>) => nodeFs.access(...args),
};

export type FileSystem = typeof fileSystem;
