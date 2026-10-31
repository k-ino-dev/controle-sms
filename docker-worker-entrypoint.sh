#!/bin/sh
# ==============================================================================
# Entrypoint POSIX dédié pour le Worker SMS (Alpine Linux)
# ==============================================================================
set -eu

echo "=========================================================="
echo "🚀 Contrôle SMS - Initialisation du Worker SMS"
echo "=========================================================="

# 1. Vérification minimale des variables d'environnement nécessaires au worker
if [ -z "${DATABASE_URL:-}" ]; then
  echo "⚠️ DATABASE_URL non défini, utilisation de la valeur par défaut 'file:/app/data/dev.db'."
  export DATABASE_URL="file:/app/data/dev.db"
fi

if [ -n "${ENCRYPTION_KEY:-}" ]; then
  echo "🔒 Clé de déchiffrement ENCRYPTION_KEY configurée."
else
  echo "ℹ️ ENCRYPTION_KEY non spécifiée (utilisation de la configuration par défaut ou .env)."
fi

# 2. Extraction du chemin du fichier de base de données SQLite
DB_PATH=$(echo "$DATABASE_URL" | sed 's/^file://')
echo "📦 Base de données cible : $DB_PATH"

# S'assurer que les répertoires nécessaires existent sur le volume
mkdir -p /app/data /app/data/uploads /app/data/backups

# 3. Attente active que le service web soit sain (si joignable sur le réseau)
WEB_URL="${WEB_URL:-http://web:3000/api/health}"
if command -v wget >/dev/null 2>&1; then
  if ping -c 1 -W 1 web >/dev/null 2>&1 || wget -q --spider --timeout=1 "$WEB_URL" 2>/dev/null; then
    echo "⏳ En attente de l'état sain du service web ($WEB_URL)..."
    MAX_WEB_RETRIES=30
    WEB_COUNT=0
    while [ "$WEB_COUNT" -lt "$MAX_WEB_RETRIES" ]; do
      if wget -q -O - --timeout=2 "$WEB_URL" 2>/dev/null | grep -q "healthy"; then
        echo "✓ Service web en ligne et sain."
        break
      fi
      WEB_COUNT=$((WEB_COUNT + 1))
      echo "   En attente de la réponse saine du service web ($WEB_COUNT/$MAX_WEB_RETRIES)..."
      sleep 1
    done
  fi
fi

# 4. Attente active que la base de données soit accessible et migrée par le conteneur web
echo "⏳ Vérification de la disponibilité du fichier de base de données SQLite..."
MAX_DB_RETRIES=45
DB_COUNT=0
while [ ! -f "$DB_PATH" ]; do
  DB_COUNT=$((DB_COUNT + 1))
  if [ "$DB_COUNT" -ge "$MAX_DB_RETRIES" ]; then
    echo "❌ [TIMEOUT] La base de données $DB_PATH n'a pas été créée après ${MAX_DB_RETRIES}s." >&2
    exit 1
  fi
  echo "   En attente de la création du fichier $DB_PATH ($DB_COUNT/$MAX_DB_RETRIES)..."
  sleep 1
done

# Vérification que le schéma Prisma a été déployé (table SmsQueue présente)
if command -v sqlite3 >/dev/null 2>&1; then
  echo "⏳ Vérification de l'initialisation du schéma Prisma (table SmsQueue)..."
  DB_COUNT=0
  while [ "$DB_COUNT" -lt "$MAX_DB_RETRIES" ]; do
    TABLE_CHECK=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='SmsQueue';" 2>/dev/null || echo "0")
    if [ "$TABLE_CHECK" = "1" ]; then
      echo "✓ Schéma SQLite validé (table SmsQueue prête)."
      break
    fi
    DB_COUNT=$((DB_COUNT + 1))
    echo "   En attente de la synchronisation Prisma par le service web ($DB_COUNT/$MAX_DB_RETRIES)..."
    sleep 1
  done

  if [ "$DB_COUNT" -ge "$MAX_DB_RETRIES" ]; then
    echo "❌ [TIMEOUT] Le schéma de la base de données n'est pas initialisé après ${MAX_DB_RETRIES}s." >&2
    exit 1
  fi
fi

echo "=========================================================="
echo "✓ Environnement worker validé avec succès."
echo "⚡ Démarrage immédiat du Worker SMS..."
echo "=========================================================="

# 5. Démarrage du worker SMS
if [ $# -gt 0 ]; then
  exec "$@"
else
  exec npx tsx scripts/worker.ts
fi
