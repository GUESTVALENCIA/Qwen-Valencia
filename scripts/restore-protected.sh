#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# RESTAURAR ARCHIVOS CRÍTICOS DESDE SNAPSHOTS
# ═══════════════════════════════════════════════════════════════════

PROTECTED_DIR=".protected"

if [ ! -d "$PROTECTED_DIR" ]; then
    echo "❌ No se encontraron snapshots protegidos"
    exit 1
fi

echo "🔄 Restaurando archivos desde snapshots..."

# Mapeo de snapshots a archivos originales
declare -A FILE_MAP=(
    ["index.html.snapshot"]="src/app/renderer/index.html"
    ["app.js.snapshot"]="src/app/renderer/components/app.js"
    ["model-selector.js.snapshot"]="src/app/renderer/components/model-selector.js"
    ["main.css.snapshot"]="src/app/renderer/styles/main.css"
    ["liquid-glass.css.snapshot"]="src/app/renderer/styles/liquid-glass.css"
    ["chat-input.css.snapshot"]="src/app/renderer/styles/chat-input.css"
)

for snapshot in "${!FILE_MAP[@]}"; do
    snapshot_path="$PROTECTED_DIR/$snapshot"
    target_file="${FILE_MAP[$snapshot]}"
    
    if [ -f "$snapshot_path" ]; then
        cp "$snapshot_path" "$target_file"
        echo "✅ Restaurado: $target_file"
    else
        echo "⚠️  Snapshot no encontrado: $snapshot_path"
    fi
done

echo "✅ Archivos restaurados"

