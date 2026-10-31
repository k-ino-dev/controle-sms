#!/bin/sh
# ==============================================================================
# Script POSIX de Sauvegarde Quotidienne Automatique de la Base SQLite
# Compatible 100% avec /bin/sh BusyBox (Alpine Linux)
# ==============================================================================

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TIMESTAMP="$(date +'%Y-%m-%d_%H-%M-%S')"

# 1. Détection de la base de données source SQLite
SOURCE_DB=""
if [ -n "${DATABASE_URL:-}" ]; then
    CLEANED_URL=$(echo "$DATABASE_URL" | sed 's/^file://')
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
    elif [ -f "$ROOT_DIR/prisma/dev.db" ]; then
        SOURCE_DB="$ROOT_DIR/prisma/dev.db"
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

echo "[$TIMESTAMP] Création de la sauvegarde SQLite : $SOURCE_DB -> $TARGET_FILE"

# 3. Snapshot à chaud sans verrouillage via SQLite .backup
if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$SOURCE_DB" ".backup '$TARGET_FILE'"
else
    cp "$SOURCE_DB" "$TARGET_FILE"
fi

# 4. Permissions sécurisées (chmod 600 ou 640)
chmod 600 "$TARGET_FILE" 2>/dev/null || chmod 640 "$TARGET_FILE" 2>/dev/null || true

# 5. Contrôle d'intégrité strict : PRAGMA integrity_check;
if command -v sqlite3 >/dev/null 2>&1; then
    INTEGRITY_OUTPUT=$(sqlite3 "$TARGET_FILE" "PRAGMA integrity_check;" 2>&1 || true)
    if [ "$INTEGRITY_OUTPUT" != "ok" ]; then
        echo "❌ [ERREUR CRITIQUE] Contrôle d'intégrité SQLite échoué : $INTEGRITY_OUTPUT" >&2
        echo "   Suppression de la sauvegarde corrompue : $TARGET_FILE" >&2
        rm -f "$TARGET_FILE"
        exit 1
    fi
    echo "✓ Contrôle d'intégrité SQLite validé : OK ($INTEGRITY_OUTPUT)"
fi

echo "✓ Sauvegarde réussie avec intégrité vérifiée : $TARGET_FILE"

# 6. Rotation automatique : conservation des N sauvegardes les plus récentes (défaut : 7)
BACKUP_KEEP="${BACKUP_KEEP:-7}"
echo "Rotation des sauvegardes : conservation des $BACKUP_KEEP sauvegardes les plus récentes..."

# Lister les fichiers ordonnés par date de modification décroissante (plus récents d'abord)
# et supprimer les sauvegardes au-delà du quota
cd "$BACKUP_DIR"
# shellcheck disable=SC2012
ls -1t ecole_backup_*.db 2>/dev/null | tail -n +$((BACKUP_KEEP + 1)) | while IFS= read -r old_file; do
    if [ -f "$old_file" ]; then
        echo "Suppression de l'ancienne sauvegarde : $old_file"
        rm -f "$old_file"
    fi
done

REMAINING_COUNT=$(ls -1 ecole_backup_*.db 2>/dev/null | wc -l | tr -d ' ')
echo "Nombre de sauvegardes conservées : $REMAINING_COUNT"
echo "Sauvegarde terminée avec succès."
