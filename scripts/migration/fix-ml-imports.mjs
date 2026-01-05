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

const mlDir = '/Users/jamiecraik/CortexDx/packages/ml/src';
const files = getAllTsFiles(mlDir);

let totalChanges = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf-8');
  const original = content;
  
  // Fix imports from types (all variations)
  content = content.replace(/from ["']\.\.\/types\.js["']/g, 'from "@brainwav/cortexdx-core"');
  content = content.replace(/from ["']\.\.\/\.\.\/types\.js["']/g, 'from "@brainwav/cortexdx-core"');
  content = content.replace(/from ["']\.\.\/\.\.\/\.\.\/types\.js["']/g, 'from "@brainwav/cortexdx-core"');
  
  // Fix imports from utils
  content = content.replace(/from ["']\.\.\/utils\//g, 'from "@brainwav/cortexdx-core/utils/');
  content = content.replace(/from ["']\.\.\/\.\.\/utils\//g, 'from "@brainwav/cortexdx-core/utils/');
  
  // Fix imports from logging
  content = content.replace(/from ["']\.\.\/logging\//g, 'from "@brainwav/cortexdx-core/logging/');
  content = content.replace(/from ["']\.\.\/\.\.\/logging\//g, 'from "@brainwav/cortexdx-core/logging/');
  
  // Fix imports from config
  content = content.replace(/from ["']\.\.\/config\//g, 'from "@brainwav/cortexdx-core/config/');
  content = content.replace(/from ["']\.\.\/\.\.\/config\//g, 'from "@brainwav/cortexdx-core/config/');
  
  // Fix imports from plugins (these should point to @brainwav/cortexdx-plugins)
  content = content.replace(/from ["']\.\.\/plugins\//g, 'from "@brainwav/cortexdx-plugins/plugins/');
  content = content.replace(/from ["']\.\.\/\.\.\/plugins\//g, 'from "@brainwav/cortexdx-plugins/plugins/');
  
  // Fix imports from adapters
  content = content.replace(/from ["']\.\.\/adapters\//g, 'from "@brainwav/cortexdx-plugins/adapters/');
  content = content.replace(/from ["']\.\.\/\.\.\/adapters\//g, 'from "@brainwav/cortexdx-plugins/adapters/');
  
  if (content !== original) {
    writeFileSync(file, content, 'utf-8');
    totalChanges++;
    console.log(`Fixed: ${file}`);
  }
}

console.log(`\nTotal files changed: ${totalChanges}`);
