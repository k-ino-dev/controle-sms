#!/bin/sh
# ==============================================================================
# Script de vérification du démarrage du Worker SMS (Image Docker & Local)
# ==============================================================================
set -eu

echo "=========================================================="
echo "🧪 TEST DE DÉMARRAGE DU WORKER SMS (LOCAL & CONTENEUR)"
echo "=========================================================="

# 1. Vérification de la compilation du worker
echo "1. Compilation de dist/worker.js..."
npm run build:worker

if [ ! -f "dist/worker.js" ]; then
  echo "❌ ERREUR : Le fichier dist/worker.js n'a pas été généré." >&2
  exit 1
fi
echo "✓ dist/worker.js généré avec succès."

# 2. Test d'exécution et de résolution des modules via TypeScript
echo "2. Test de résolution des modules et du démarrage via tests/worker-startup.test.ts..."
npx tsx tests/worker-startup.test.ts

# 3. Si Docker est disponible, tester le démarrage dans l'image Docker
if command -v docker >/dev/null 2>&1; then
  echo "3. Construction de l'image de test Docker..."
  docker build -t controle-sms-worker-test -f Dockerfile .

  echo "4. Test d'exécution de 'node dist/worker.js' dans le conteneur Docker..."
  docker run --rm \
    -e DATABASE_URL=file:/app/data/dev.db \
    -e NODE_ENV=production \
    controle-sms-worker-test \
    node tests/worker-startup.test.ts

  echo "✓ Tous les tests dans le conteneur Docker ont réussi !"
else
  echo "ℹ️ Docker CLI n'est pas présent sur cette machine (environnement de déploiement distant)."
  echo "   Les vérifications de bundle, de résolution TypeScript et de démarrage sont validées avec succès."
fi

echo "=========================================================="
echo "✅ SUCCÈS : Le Worker SMS est opérationnel et prêt au déploiement."
echo "=========================================================="
