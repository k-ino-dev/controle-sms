#!/bin/sh
# ==============================================================================
# Entrypoint POSIX sécurisé pour Contrôle SMS (Alpine Linux)
# ==============================================================================
set -eu

echo "=========================================================="
echo "🚀 Contrôle SMS - Initialisation et démarrage sécurisé"
echo "=========================================================="

# 1. Vérifications strictes de sécurité
JWT_LEN=$(echo "${JWT_SECRET:-}" | tr -d '\r\n' | wc -c | tr -d ' ')
if [ -z "${JWT_SECRET:-}" ] || \
   [ "$JWT_SECRET" = "changez_moi_en_production_tres_secret_cle_longue" ] || \
   [ "$JWT_SECRET" = "dev_fallback_secret_change_in_production" ] || \
   [ "$JWT_SECRET" = "votre_secret_jwt_securise_aleatoire_64_caracteres" ] || \
   [ "$JWT_SECRET" = "secret" ] || \
   [ "$JWT_SECRET" = "default" ] || \
   [ "$JWT_LEN" -lt 16 ]; then
  echo "❌ ERREUR CRITIQUE DE SÉCURITÉ :" >&2
  echo "   La variable JWT_SECRET est manquante, par défaut ou trop courte (< 16 caractères)." >&2
  echo "   Veuillez définir une clé aléatoire forte dans votre fichier .env avant de lancer l'application." >&2
  exit 1
fi

if [ "${NODE_ENV:-}" = "production" ]; then
  if [ -z "${INITIAL_DIRECTOR_PASSWORD:-}" ] || \
     [ "$INITIAL_DIRECTOR_PASSWORD" = "admin" ] || \
     [ "$INITIAL_DIRECTOR_PASSWORD" = "password" ] || \
     [ "$INITIAL_DIRECTOR_PASSWORD" = "123456" ]; then
    echo "❌ ERREUR CRITIQUE DE SÉCURITÉ :" >&2
    echo "   En environnement de production (NODE_ENV=production), le mot de passe directeur" >&2
    echo "   (INITIAL_DIRECTOR_PASSWORD) ne peut pas être 'admin', 'password', '123456' ou vide." >&2
    echo "   Définissez un mot de passe robuste dans votre fichier .env." >&2
    exit 1
  fi
fi

# 2. Création des répertoires de données persistants sur les volumes
mkdir -p /app/data /app/data/uploads /app/data/backups

# 2.5 Sauvegarde automatique datée pré-migration si la base de données existe déjà
DB_FILE="/app/data/dev.db"
if [ -f "$DB_FILE" ]; then
  PRE_MIG_DATE=$(date +'%Y-%m-%d_%H-%M-%S')
  echo "💾 Sauvegarde automatique datée pré-migration de la base SQLite..."
  if [ -f "./scripts/backup.sh" ]; then
    DATABASE_URL="file:$DB_FILE" BACKUPS_DIR="/app/data/backups" sh ./scripts/backup.sh || cp "$DB_FILE" "/app/data/backups/ecole_backup_${PRE_MIG_DATE}.db"
  else
    cp "$DB_FILE" "/app/data/backups/ecole_backup_${PRE_MIG_DATE}.db"
  fi
fi

# 3. Synchronisation du schéma SQLite (offline, sans téléchargement)
echo "📦 Synchronisation de la base de données SQLite..."
npx prisma db push --skip-generate

# 4. Initialisation idempotente (seed)
echo "🌱 Initialisation des paramètres de base (seed idempotent)..."
npx tsx prisma/seed.ts

# Si des arguments de commande sont fournis (ex: service worker dédié ou tâche manuelle)
if [ $# -gt 0 ]; then
  echo "⚡ Exécution de la commande spécifique : $*"
  exec "$@"
fi

# 5. Automatisation de la sauvegarde quotidienne à 02:00 (crond Alpine / Africa/Tunis)
if command -v crond >/dev/null 2>&1 && [ -f "./scripts/backup.sh" ]; then
  mkdir -p /etc/crontabs
  echo "0 2 * * * /bin/sh /app/scripts/backup.sh >> /app/data/backup.log 2>&1" > /etc/crontabs/root
  crond -b -l 8 || true
  echo "⏰ Service crond démarré (sauvegarde automatique programmée à 02:00)."
fi

# 6. Démarrage supervisé du worker SMS en processus séparé
if [ "${ENABLE_EMBEDDED_WORKER:-true}" = "true" ] && [ -f "./scripts/worker.ts" ]; then
  echo "🔄 Lancement du superviseur de worker SMS en tâche de fond..."
  (
    while true; do
      echo "[Worker Supervisor] Démarrage du processus worker SMS..."
      npx tsx scripts/worker.ts || true
      echo "[Worker Supervisor] Processus worker SMS terminé. Redémarrage automatique dans 5 secondes..."
      sleep 5
    done
  ) &
fi

# 7. Lancement de l'application Next.js standalone
echo "✓ Base de données prête et vérifiée. Lancement du serveur Next.js..."
exec node server.js
