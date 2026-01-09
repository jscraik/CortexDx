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

  // Fix local imports ending without .js
  content = content.replace(/from "(\.\.?\/[^"]+)"/g, (match, p1) => {
    // Skip if already has .js
    if (p1.endsWith(".js")) return match;
    // Skip if it's a directory import (ends with /)
    if (p1.endsWith("/")) return match;
    // Add .js extension
    return `from "${p1}.js"`;
  });

  // Also fix imports that might be using single quotes
  content = content.replace(/from '(\.\.?\/[^']+)'/g, (match, p1) => {
    // Skip if already has .js
    if (p1.endsWith(".js")) return match;
    // Skip if it's a directory import (ends with /)
    if (p1.endsWith("/")) return match;
    // Add .js extension
    return `from '${p1}.js'`;
  });

  if (content !== originalContent) {
    console.log(`Fixing imports in ${file}`);
    fs.writeFileSync(file, content, "utf8");
  }
});

console.log("Finished fixing orchestration local imports.");
