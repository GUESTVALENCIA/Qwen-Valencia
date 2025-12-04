/**
 * ═══════════════════════════════════════════════════════════════════
 * PROTECCIÓN DE ARCHIVOS CRÍTICOS
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Este script protege archivos críticos de modificación accidental.
 * Los archivos protegidos requieren autorización explícita para modificar.
 */

const fs = require('fs');
const path = require('path');

// Archivos críticos que NO deben modificarse sin autorización
const PROTECTED_FILES = [
  'src/app/renderer/index.html',
  'src/app/renderer/components/app.js',
  'src/app/renderer/components/model-selector.js',
  'src/app/renderer/styles/main.css',
  'src/app/renderer/styles/liquid-glass.css',
  'src/app/renderer/styles/chat-input.css'
];

// Archivos de referencia (backups protegidos)
const REFERENCE_FILES = [
  'src/app/renderer/index.html.reference',
  'src/app/renderer/components/app.js.reference',
  'src/app/renderer/components/model-selector.js.reference'
];

/**
 * Verifica si un archivo está protegido
 */
function isProtected(filePath) {
  return PROTECTED_FILES.some(protectedFile => {
    const fullPath = path.resolve(protectedFile);
    const checkPath = path.resolve(filePath);
    return fullPath === checkPath || checkPath.includes(fullPath);
  });
}

/**
 * Crea archivos de referencia (snapshots)
 */
function createReference(filePath) {
  const referencePath = filePath + '.reference';
  if (fs.existsSync(filePath)) {
    fs.copyFileSync(filePath, referencePath);
    console.log(`✅ Referencia creada: ${referencePath}`);
    return true;
  }
  return false;
}

/**
 * Restaura archivo desde referencia
 */
function restoreFromReference(filePath) {
  const referencePath = filePath + '.reference';
  if (fs.existsSync(referencePath)) {
    fs.copyFileSync(referencePath, filePath);
    console.log(`✅ Archivo restaurado desde referencia: ${filePath}`);
    return true;
  }
  console.error(`❌ No se encontró referencia: ${referencePath}`);
  return false;
}

/**
 * Verifica integridad de archivos protegidos
 */
function verifyIntegrity() {
  console.log('🔍 Verificando integridad de archivos protegidos...\n');
  
  let allOk = true;
  
  for (const file of PROTECTED_FILES) {
    const filePath = path.resolve(file);
    const refPath = filePath + '.reference';
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Archivo faltante: ${file}`);
      allOk = false;
      continue;
    }
    
    if (fs.existsSync(refPath)) {
      const current = fs.readFileSync(filePath, 'utf8');
      const reference = fs.readFileSync(refPath, 'utf8');
      
      if (current !== reference) {
        console.warn(`⚠️  Archivo modificado: ${file}`);
        console.warn(`   Usa: node scripts/protect-files.js restore ${file}`);
        allOk = false;
      } else {
        console.log(`✅ ${file} - OK`);
      }
    } else {
      console.warn(`⚠️  Sin referencia: ${file}`);
      console.warn(`   Crea referencia con: node scripts/protect-files.js create ${file}`);
    }
  }
  
  return allOk;
}

// CLI
const command = process.argv[2];
const targetFile = process.argv[3];

if (command === 'create') {
  if (targetFile) {
    createReference(targetFile);
  } else {
    console.log('📸 Creando referencias de todos los archivos protegidos...\n');
    PROTECTED_FILES.forEach(createReference);
  }
} else if (command === 'restore') {
  if (targetFile) {
    if (isProtected(targetFile)) {
      restoreFromReference(targetFile);
    } else {
      console.error(`❌ Archivo no protegido: ${targetFile}`);
    }
  } else {
    console.error('❌ Especifica un archivo para restaurar');
  }
} else if (command === 'verify') {
  const ok = verifyIntegrity();
  process.exit(ok ? 0 : 1);
} else {
  console.log(`
🔒 Sistema de Protección de Archivos Críticos

Uso:
  node scripts/protect-files.js create [archivo]  - Crear referencia
  node scripts/protect-files.js restore <archivo>  - Restaurar desde referencia
  node scripts/protect-files.js verify            - Verificar integridad

Archivos protegidos:
${PROTECTED_FILES.map(f => `  - ${f}`).join('\n')}
`);
}

