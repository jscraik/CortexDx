#!/usr/bin/env node

import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

function getAllTsFiles(dir, fileList = []) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    
    if (stat.isDirectory()) {
      getAllTsFiles(filePath, fileList);
    } else if (file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

const pluginsDir = '/Users/jamiecraik/CortexDx/packages/plugins/src';
const files = getAllTsFiles(pluginsDir);

let totalChanges = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf-8');
  const original = content;
  
  // Replace imports from ../types.js
  content = content.replace(/from ["']\.\.\/types\.js["']/g, 'from "@brainwav/cortexdx-core"');
  
  // Replace imports from ../../types.js
  content = content.replace(/from ["']\.\.\/\.\.\/types\.js["']/g, 'from "@brainwav/cortexdx-core"');
  
  // Replace imports from ../../../types.js
  content = content.replace(/from ["']\.\.\/\.\.\/\.\.\/types\.js["']/g, 'from "@brainwav/cortexdx-core"');
  
  // Replace imports from ../utils/
  content = content.replace(/from ["']\.\.\/utils\//g, 'from "@brainwav/cortexdx-core/utils/');
  
  // Replace imports from ../../utils/
  content = content.replace(/from ["']\.\.\/\.\.\/utils\//g, 'from "@brainwav/cortexdx-core/utils/');
  
  // Replace imports from ../logging/
  content = content.replace(/from ["']\.\.\/logging\//g, 'from "@brainwav/cortexdx-core/logging/');
  
  // Replace imports from ../config/
  content = content.replace(/from ["']\.\.\/config\//g, 'from "@brainwav/cortexdx-core/config/');
  
  if (content !== original) {
    writeFileSync(file, content, 'utf-8');
    totalChanges++;
    console.log(`Fixed: ${file}`);
  }
}

console.log(`\nTotal files changed: ${totalChanges}`);
