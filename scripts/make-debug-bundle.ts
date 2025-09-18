#!/usr/bin/env tsx

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// Liste primaire des fichiers dans l'ordre exact de B1
const FILE_PATHS = [
  'src/lib/pressure-units.ts',
  'src/lib/length-units.ts', 
  'src/lib/geometry.ts',
  'src/lib/build-si.ts',
  'src/lib/physics.ts',
  'src/lib/physics-capillary.ts',
  'src/lib/pipeline-time-from-d.ts',
  'src/actions/compute-time-from-d.ts',
  'src/components/ResultsTimeFromD.tsx',
  'src/components/DevPanel.tsx',
  'src/lib/debug-context.tsx',
  'src/lib/schema.ts'
];

// Variantes possibles pour certains fichiers
const VARIANTS: Record<string, string[]> = {
  'src/lib/build-si.ts': ['src/lib/build-si.ts', 'src/lib/buildSi.ts'],
  'src/lib/physics-capillary.ts': ['src/lib/physics-capillary.ts', 'src/lib/physicsCapillary.ts'],
  'src/lib/pipeline-time-from-d.ts': [
    'src/lib/pipeline-time-from-d.ts', 
    'src/lib/time-from-diameter.ts', 
    'src/lib/compute-time-from-d.ts'
  ],
  'src/actions/compute-time-from-d.ts': [
    'src/actions/compute-time-from-d.ts',
    'src/actions/computeTimeFromD.ts'
  ],
  'src/lib/schema.ts': ['src/lib/schema.ts', 'src/lib/form-schema.ts']
};

function findExistingFile(path: string): string | null {
  const variants = VARIANTS[path] || [path];
  for (const variant of variants) {
    if (existsSync(variant)) {
      return variant;
    }
  }
  return null;
}

function getCurrentTimestamp(): string {
  const now = new Date();
  return now.toLocaleString('fr-FR', { 
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function generateDebugBundle(): string {
  const timestamp = getCurrentTimestamp();
  
  let content = `# Lovable Gas Calc — DEBUG_BUNDLE

**Généré le :** ${timestamp}  
**Branche :** main  
**Commit :** (auto-generated)  

> ⚠️ **Avertissement :** Généré pour diagnostic — ne pas éditer à la main.

---

`;

  for (const originalPath of FILE_PATHS) {
    const actualPath = findExistingFile(originalPath);
    
    content += `### ${originalPath}\n\n`;
    
    if (actualPath) {
      try {
        const fileContent = readFileSync(actualPath, 'utf8');
        // Détecter le langage du fichier pour le bloc de code
        const ext = actualPath.split('.').pop() || 'text';
        const lang = ext === 'ts' ? 'typescript' : ext === 'tsx' ? 'tsx' : ext;
        
        content += `\`\`\`${lang}\n${fileContent}\n\`\`\`\n\n`;
      } catch (error) {
        content += `(ERROR: ${error})\n\n`;
      }
    } else {
      content += `(MISSING)\n\n`;
    }
  }
  
  return content;
}

function main() {
  console.log('🔄 Generating DEBUG_BUNDLE.md...');
  
  const bundleContent = generateDebugBundle();
  const outputPath = join(process.cwd(), 'DEBUG_BUNDLE.md');
  
  writeFileSync(outputPath, bundleContent, 'utf8');
  
  console.log('✅ DEBUG_BUNDLE.md generated successfully');
  console.log(`📍 Output: ${outputPath}`);
  
  // Statistiques
  const sections = FILE_PATHS.length;
  const missing = FILE_PATHS.filter(path => !findExistingFile(path)).length;
  const found = sections - missing;
  
  console.log(`📊 Stats: ${found}/${sections} files found, ${missing} missing`);
  
  if (missing > 0) {
    const missingFiles = FILE_PATHS.filter(path => !findExistingFile(path));
    console.log('⚠️  Missing files:');
    missingFiles.forEach(file => console.log(`   - ${file}`));
  }
}

if (require.main === module) {
  main();
}