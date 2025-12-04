const fs = require('fs');
const path = require('path');

/**
 * Convierte archivos de UTF-16 a UTF-8 sin BOM
 */
function fixEncoding(filePath) {
  try {
    // Leer el archivo como buffer primero para detectar encoding
    const buffer = fs.readFileSync(filePath);

    // Detectar si tiene BOM UTF-16 LE (FE FF) o UTF-16 BE (FF FE)
    let content;
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      // UTF-16 LE con BOM
      content = buffer.slice(2).toString('utf16le');
    } else if (buffer[0] === 0xfe && buffer[1] === 0xff) {
      // UTF-16 BE con BOM
      const swapped = Buffer.alloc(buffer.length - 2);
      for (let i = 2; i < buffer.length; i += 2) {
        swapped[i - 2] = buffer[i + 1];
        swapped[i - 1] = buffer[i];
      }
      content = swapped.toString('utf16le');
    } else {
      // Intentar leer como UTF-16 LE sin BOM
      try {
        content = buffer.toString('utf16le');
      } catch {
        // Si falla, leer como UTF-8
        content = buffer.toString('utf8');
      }
    }

    // Escribir como UTF-8 sin BOM
    fs.writeFileSync(filePath, content, { encoding: 'utf8' });

    console.log(`✓ Convertido: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`✗ Error en ${filePath}:`, error.message);
    return false;
  }
}

// Archivos a convertir
const files = ['src/app/renderer/components/app.js', 'src/app/renderer/utils/error-handler.js'];

files.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    fixEncoding(fullPath);
  } else {
    console.warn(`⚠ Archivo no encontrado: ${fullPath}`);
  }
});

console.log('\n✅ Conversión completada');
