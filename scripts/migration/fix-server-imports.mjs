import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, "packages/server/src/orchestration");

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);

  arrayOfFiles = arrayOfFiles || [];

  files.forEach(function (file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith(".ts")) {
        arrayOfFiles.push(path.join(dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

const files = getAllFiles(rootDir);

files.forEach((file) => {
  let content = fs.readFileSync(file, "utf8");
  let originalContent = content;

  // Fix @brainwav/cortexdx-core imports
  content = content.replace(
    /from "@brainwav\/cortexdx-core\/utils\/type-helpers\.js"/g,
    'from "@brainwav/cortexdx-core/utils/type-helpers"',
  );
  content = content.replace(
    /from "@brainwav\/cortexdx-core\/utils\/json\.js"/g,
    'from "@brainwav/cortexdx-core/utils/json"',
  );
  content = content.replace(
    /from "@brainwav\/cortexdx-core\/utils\/deterministic\.js"/g,
    'from "@brainwav/cortexdx-core/utils/deterministic"',
  );

  // Fix @brainwav/cortexdx-plugins imports
  content = content.replace(
    /from "@brainwav\/cortexdx-plugins\/plugins\/index\.js"/g,
    'from "@brainwav/cortexdx-plugins"',
  );

  // Fix relative imports that might be broken
  // (This part requires manual inspection, but I'll fix common ones if I find them)

  if (content !== originalContent) {
    console.log(`Fixing imports in ${file}`);
    fs.writeFileSync(file, content, "utf8");
  }
});

console.log("Finished fixing server orchestration imports.");
