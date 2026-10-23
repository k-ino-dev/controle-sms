#!/usr/bin/env bash
# ==============================================================================
# Script de Sauvegarde Quotidienne Automatique de la Base SQLite
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TIMESTAMP="$(date +'%Y-%m-%d_%H-%M-%S')"

# 1. Détection de la base de données source
SOURCE_DB=""
if [ -n "${DATABASE_URL:-}" ]; then
    CLEANED_URL="${DATABASE_URL#file:}"
    if [ -f "$CLEANED_URL" ]; then
        SOURCE_DB="$CLEANED_URL"
    fi
fi

if [ -z "$SOURCE_DB" ]; then
    if [ -f "/app/data/dev.db" ]; then
        SOURCE_DB="/app/data/dev.db"
    elif [ -f "$ROOT_DIR/data/db/dev.db" ]; then
        SOURCE_DB="$ROOT_DIR/data/db/dev.db"
    elif [ -f "$ROOT_DIR/data/prisma/dev.db" ]; then
        SOURCE_DB="$ROOT_DIR/data/prisma/dev.db"
    elif [ -f "$ROOT_DIR/dev.db" ]; then
        SOURCE_DB="$ROOT_DIR/dev.db"
    else
        echo "[ERREUR] Base de données SQLite introuvable." >&2
        exit 1
    fi
fi

# 2. Détection du répertoire de sauvegarde
if [ -n "${BACKUPS_DIR:-}" ]; then
    BACKUP_DIR="$BACKUPS_DIR"
elif [ -d "/app/data/backups" ]; then
    BACKUP_DIR="/app/data/backups"
else
    BACKUP_DIR="$ROOT_DIR/data/backups"
fi

mkdir -p "$BACKUP_DIR"
TARGET_FILE="$BACKUP_DIR/ecole_backup_${TIMESTAMP}.db"

echo "[$TIMESTAMP] Création de la sauvegarde : $SOURCE_DB -> $TARGET_FILE"

# 3. Exécution d'un snapshot à chaud sans verrouillage via SQLite .backup
if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$SOURCE_DB" ".backup '$TARGET_FILE'"
else
    cp "$SOURCE_DB" "$TARGET_FILE"
fi

echo "✓ Sauvegarde réussie : $TARGET_FILE"

# 4. Rotation : conservation des sauvegardes sur 30 jours
echo "Nettoyage des sauvegardes datant de plus de 30 jours..."
find "$BACKUP_DIR" -type f -name "ecole_backup_*.db" -mtime +30 -delete

REMAINING_COUNT=$(find "$BACKUP_DIR" -type f -name "ecole_backup_*.db" | wc -l)
echo "Nombre de sauvegardes conservées : $REMAINING_COUNT"
echo "Sauvegarde terminée avec succès."
