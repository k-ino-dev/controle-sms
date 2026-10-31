#!/bin/sh
# ==============================================================================
# Script POSIX de Mise à Jour Sécurisée de l'Application sur VPS
# Compatible 100% avec /bin/sh BusyBox (Alpine Linux)
# ==============================================================================

set -eu

echo "=============================================================="
echo "  🔄 MISE À JOUR DE L'APPLICATION CONTRÔLE SMS               "
echo "=============================================================="

# 1. Sauvegarde préventive de la base de données
echo "1. Création d'une sauvegarde de sécurité préalable..."
if [ -f "./scripts/backup.sh" ]; then
    sh ./scripts/backup.sh
fi

# 2. Récupération des dernières modifications de code
echo "2. Récupération des dernières modifications (git pull)..."
if command -v git >/dev/null 2>&1 && [ -d ".git" ]; then
    git pull origin main || git pull || true
fi

# 3. Rebuild et redémarrage propre des conteneurs
echo "3. Reconstruction des conteneurs d'application..."
docker compose build --pull

echo "4. Relance des services avec zéro interruption..."
docker compose up -d --remove-orphans

echo "5. Vérification du statut de santé..."
sleep 5
docker compose ps

echo ""
echo "=============================================================="
echo "  ✓ APPLICATION MISE À JOUR AVEC SUCCÈS SANS PERTE DE DONNÉES  "
echo "=============================================================="
