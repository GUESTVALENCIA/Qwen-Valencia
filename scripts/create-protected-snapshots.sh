#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# CREAR SNAPSHOTS PROTEGIDOS DE ARCHIVOS CRÍTICOS
# ═══════════════════════════════════════════════════════════════════

PROTECTED_DIR=".protected"
mkdir -p "$PROTECTED_DIR"

# Archivos críticos a proteger
FILES=(
    "src/app/renderer/index.html"
    "src/app/renderer/components/app.js"
    "src/app/renderer/components/model-selector.js"
    "src/app/renderer/styles/main.css"
    "src/app/renderer/styles/liquid-glass.css"
    "src/app/renderer/styles/chat-input.css"
)

echo "🔒 Creando snapshots protegidos..."

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        snapshot="$PROTECTED_DIR/$(basename $file).snapshot"
        cp "$file" "$snapshot"
        echo "✅ Snapshot creado: $snapshot"
    else
        echo "⚠️  Archivo no encontrado: $file"
    fi
done

echo "✅ Snapshots protegidos creados en $PROTECTED_DIR"

