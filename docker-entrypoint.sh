#!/bin/sh
set -e

echo "🚀 Contrôle SMS - Démarrage du conteneur..."

# Exécuter les migrations et vérifier la base SQLite
echo "📦 Vérification et mise à jour de la base de données SQLite..."
npx prisma db push --skip-generate

# Si la base est vierge ou au premier démarrage, exécuter le seed
echo "🌱 Initialisation des paramètres et données de base..."
npx tsx prisma/seed.ts || true

echo "✓ Base de données prête. Lancement du serveur Next.js..."
exec node server.js
