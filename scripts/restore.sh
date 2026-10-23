#!/usr/bin/env bash
# ==============================================================================
# Script de Restauration Sécurisée de la Base SQLite avec Sauvegarde Préalable
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TIMESTAMP="$(date +'%Y-%m-%d_%H-%M-%S')"

# 1. Détection du répertoire de sauvegarde
if [ -n "${BACKUPS_DIR:-}" ]; then
    BACKUP_DIR="$BACKUPS_DIR"
elif [ -d "/app/data/backups" ]; then
    BACKUP_DIR="/app/data/backups"
else
    BACKUP_DIR="$ROOT_DIR/data/backups"
fi

# 2. Vérification de l'argument
if [ $# -lt 1 ]; then
    echo "===================================================================="
    echo "  Usage : $0 <fichier_sauvegarde.db> [-y]"
    echo "===================================================================="
    echo "Sauvegardes disponibles dans $BACKUP_DIR :"
    if [ -d "$BACKUP_DIR" ]; then
        ls -lh "$BACKUP_DIR"/ecole_backup_*.db 2>/dev/null || echo "  (Aucun fichier de sauvegarde trouvé)"
    fi
    exit 1
fi

INPUT_FILE="$1"
FORCE_CONFIRM=0
if [ "${2:-}" = "-y" ] || [ "${FORCE:-0}" = "1" ]; then
    FORCE_CONFIRM=1
fi

# Résolution du fichier de sauvegarde
BACKUP_PATH=""
if [ -f "$INPUT_FILE" ]; then
    BACKUP_PATH="$INPUT_FILE"
elif [ -f "$BACKUP_DIR/$INPUT_FILE" ]; then
    BACKUP_PATH="$BACKUP_DIR/$INPUT_FILE"
else
    echo "❌ [ERREUR] Fichier de sauvegarde introuvable : $INPUT_FILE" >&2
    exit 1
fi

# 3. Détection de la base de données de destination
DEST_DB=""
if [ -n "${DATABASE_URL:-}" ]; then
    CLEANED_URL="${DATABASE_URL#file:}"
    DEST_DB="$CLEANED_URL"
elif [ -d "/app/data" ]; then
    DEST_DB="/app/data/dev.db"
elif [ -d "$ROOT_DIR/data/db" ]; then
    DEST_DB="$ROOT_DIR/data/db/dev.db"
elif [ -f "$ROOT_DIR/data/prisma/dev.db" ]; then
    DEST_DB="$ROOT_DIR/data/prisma/dev.db"
else
    DEST_DB="$ROOT_DIR/dev.db"
fi

echo "===================================================================="
echo "  RESTAURATION DE LA BASE DE DONNÉES SQLITE"
echo "===================================================================="
echo "Source       : $BACKUP_PATH"
echo "Destination  : $DEST_DB"
echo "Taille       : $(ls -lh "$BACKUP_PATH" | awk '{print $5}')"
echo "===================================================================="

# 4. Confirmation utilisateur
if [ "$FORCE_CONFIRM" -ne 1 ]; then
    echo "⚠️  ATTENTION : La restauration va remplacer l'état actuel de la base de données."
    printf "Confirmez-vous cette opération ? Tapez 'OUI' pour continuer : "
    read -r CONFIRMATION
    if [ "$CONFIRMATION" != "OUI" ]; then
        echo "Opération annulée par l'utilisateur."
        exit 0
    fi
fi

# 5. Création d'un snapshot de sécurité préventif de la base active
if [ -f "$DEST_DB" ]; then
    SAFETY_BACKUP="$BACKUP_DIR/ecole_prerestore_snapshot_${TIMESTAMP}.db"
    echo "📦 Création d'un snapshot de sécurité préventif : $SAFETY_BACKUP"
    if command -v sqlite3 >/dev/null 2>&1; then
        sqlite3 "$DEST_DB" ".backup '$SAFETY_BACKUP'" || cp "$DEST_DB" "$SAFETY_BACKUP"
    else
        cp "$DEST_DB" "$SAFETY_BACKUP"
    fi
fi

# S'assurer que le répertoire cible existe
mkdir -p "$(dirname "$DEST_DB")"

# 6. Restauration de la base
echo "🔄 Restauration en cours..."
if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$BACKUP_PATH" ".backup '$DEST_DB'"
else
    cp "$BACKUP_PATH" "$DEST_DB"
fi

# 7. Vérification d'intégrité
if command -v sqlite3 >/dev/null 2>&1; then
    INTEGRITY=$(sqlite3 "$DEST_DB" "PRAGMA integrity_check;")
    if [ "$INTEGRITY" != "ok" ]; then
        echo "❌ [ERREUR] L'intégrité de la base restaurée est anormale : $INTEGRITY" >&2
        exit 1
    fi
    echo "✓ Contrôle d'intégrité SQLite : OK ($INTEGRITY)"
fi

echo "===================================================================="
echo "  ✓ BASE DE DONNÉES RESTAURÉE AVEC SUCCÈS !"
echo "===================================================================="
echo "Si l'application tourne dans Docker, redémarrez le conteneur :"
echo "  docker compose restart web"
echo "===================================================================="
