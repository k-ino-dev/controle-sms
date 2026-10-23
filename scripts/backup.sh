#!/usr/bin/env bash
# ==============================================================================
# Script de Sauvegarde Quotidienne Automatique de la Base SQLite
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$ROOT_DIR/backups"
TIMESTAMP="$(date +'%Y-%m-%d_%H-%M-%S')"
SOURCE_DB="$ROOT_DIR/data/prisma/dev.db"

# Emplacements possibles de la base SQLite
if [ ! -f "$SOURCE_DB" ]; then
    if [ -f "$ROOT_DIR/prisma/dev.db" ]; then
        SOURCE_DB="$ROOT_DIR/prisma/dev.db"
    elif [ -f "$ROOT_DIR/dev.db" ]; then
        SOURCE_DB="$ROOT_DIR/dev.db"
    fi
fi

mkdir -p "$BACKUP_DIR"

if [ ! -f "$SOURCE_DB" ]; then
    echo "[ERREUR] Fichier de base de données introuvable : $SOURCE_DB"
    exit 1
fi

TARGET_FILE="$BACKUP_DIR/ecole_backup_${TIMESTAMP}.db"

echo "[$TIMESTAMP] Création de la sauvegarde de sécurité..."
# Utilisation de sqlite3 .backup si disponible, sinon copie sécurisée
if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$SOURCE_DB" ".backup '$TARGET_FILE'"
else
    cp "$SOURCE_DB" "$TARGET_FILE"
fi

echo "✓ Sauvegarde réussie : $TARGET_FILE"

# Rotation des sauvegardes : ne conserver que les 30 dernières copies
echo "Nettoyage des sauvegardes datant de plus de 30 jours..."
find "$BACKUP_DIR" -type f -name "ecole_backup_*.db" -mtime +30 -delete

echo "Nombre total de sauvegardes conservées : $(ls -1 "$BACKUP_DIR"/ecole_backup_*.db | wc -l)"

# Optionnel : Envoi vers un stockage distant (Google Drive, Dropbox, AWS S3 via Rclone)
# Décommentez les lignes suivantes si vous avez configuré rclone :
# if command -v rclone >/dev/null 2>&1; then
#     echo "Envoi de la sauvegarde vers le cloud..."
#     rclone copy "$TARGET_FILE" remote_ecole:backups/
#     echo "✓ Sauvegarde synchronisée sur le stockage cloud distant."
# fi

echo "Terminé avec succès !"
