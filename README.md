# Contrôle SMS - Logiciel de Gestion d'École Privée Clé en Main

Solution complète, moderne et hautement sécurisée de gestion d'établissement scolaire privé, avec système automatisé d'envoi de SMS aux parents d'élèves en arabe via **WinSMS Tunisie** (`winsms.tn`).

---

## 🌟 Points Forts & Architecture

- **Application Web ultra-fluide & tactile** : Conçue en **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, **Framer Motion**, et **Prisma avec SQLite** (base de données sous forme d'un fichier `.db` unique, rendant l'archivage, la sauvegarde et l'exportation instantanés).
- **Mobile-First pour le Directeur** : Optimisé pour le directeur qui fait le contrôle directement en classe sur son smartphone ou sa tablette (grandes cartes tactiles >= 44px, bascule Présent/Absent en un clic avec animations et retour visuel).
- **Architecture SMS WinSMS Tunisie (Envoi direct par Internet)** :
  - **Plus aucun modem GSM physique ni programme passerelle à installer sur le PC**.
  - File d'attente serveur (`smsQueue`, statuts `pending`, `sent`, `failed`).
  - Worker intégré côté serveur exécuté toutes les 5 secondes.
  - 3 tentatives automatiques espacées (10 s, 1 min, 5 min) en cas de défaillance réseau temporaire.
  - Causes de rejet claires et traduites en français (crédit insuffisant, numéro invalide, entête refusé, service indisponible, timeout, etc.).
  - Normalisation automatique des numéros au format tunisien `216XXXXXXXX`.
  - Calcul précis des segments SMS arabes (70 caractères max pour 1 segment, 67 caractères par segment pour les messages multi-segments).
  - Mode simulation (`SMS_PROVIDER=mock`) pour développer et tester sans consommer de vrais SMS.
- **Indicateur de Santé SMS en Direct** :
  - Pastille dans la barre latérale et l'en-tête mobile (Vert = Opérationnel, Orange = Solde bas sous le seuil configuré, Rouge = Erreur récente).
  - Solde en direct sur le Tableau de bord et dans les Paramètres avec bandeau d'alerte.
- **Paiements & Reçus Conformes A4** :
  - Suivi des 9 mois de scolarité (Octobre &rarr; Juin) avec code couleur (Vert = Soldé, Ambre = Acompte/Partiel, Rouge = Impayé).
  - **Modale SMS de Paiement à 2 options** au choix du directeur (Option 1 : Rappel amical de courtoisie ; Option 2 : Avertissement ferme de suspension des cours).
  - Protection anti-doublon (avertissement si un SMS a déjà été envoyé au même élève aujourd'hui).
  - **Reçu de paiement imprimable A4 double exemplaire** avec ligne de découpe pointillée et logo de l'établissement en en-tête et filigrane central.
- **Paramètres Personnalisables** :
  - 3 modèles de SMS en arabe modifiables avec insertion dynamique de variables en un clic (`[الاسم واللقب]`, `[الساعة]`, `[الشهر]`, `[المبلغ]`), aperçu en direct et compteur de segments.
  - Format d'heure pour les absences : heure entière arrondie vers le bas en fuseau `Africa/Tunis` (ex: "8h", "13h", "0h").
  - Configuration WinSMS (Sender ID, Clé API, Seuil d'alerte, Limite journalière).
  - Grille tarifaire par niveau (7ème, 8ème, 9ème, 1ère, 2ème, 3ème, Bac).
  - Archivage d'année scolaire et remise à zéro avec sauvegarde de sécurité automatique.

---

## 📁 Structure du Projet

```
controle sms/
├── docker-compose.yml       # Déploiement VPS complet (Web + Caddy HTTPS auto)
├── Dockerfile               # Build Next.js multi-stage standalone
├── docker-entrypoint.sh     # Migrations Prisma automatiques et démarrage du service web
├── docker-worker-entrypoint.sh # Initialisation isolée et démarrage du worker SMS (sans contrôles web)
├── Caddyfile                # Reverse-proxy avec certificats SSL Let's Encrypt automatiques
├── update.sh                # Script de mise à jour sécurisée sur VPS (zéro perte de données)
├── .env.example             # Exemple des variables d'environnement
├── .gitignore               # Exclusion des secrets, base .db, backups et build
│
├── data/
│   ├── db/                  # Volume persistant de la base SQLite (/app/data)
│   ├── uploads/             # Volume persistant des logos et images (/app/data/uploads)
│   └── backups/             # Volume persistant des sauvegardes (/app/data/backups)
├── scripts/
│   ├── backup.sh            # Script de sauvegarde automatique avec rotation sur 30 jours
│   └── restore.sh           # Script de restauration sécurisée avec snapshot préventif
│
├── prisma/
│   ├── schema.prisma        # Schéma SQLite (Élèves, Classes, Présence, Paiements, SMS, Paramètres)
│   └── seed.ts              # Données de démo (directeur, tarifs par niveau, élèves)
│
└── src/
    ├── app/                 # Routes Next.js App Router (Dashboard, Présence, Élèves, Classes, Paiements, SMS, Paramètres)
    ├── components/          # Composants React UI, SmsServicePill, PaymentReceiptModal, PaymentSmsModal
    └── lib/                 # Auth JWT, Prisma, utilitaires et passerelle SMS (WinSMS + Mock)
        └── sms/
            ├── index.ts     # Helpers de normalisation 216XXXXXXXX et calcul des segments
            ├── types.ts     # Interfaces SmsProvider et SmsResult
            ├── winsms.ts    # Client HTTP officiel WinSMS Tunisie (isolé pour adaptation simple)
            ├── mock.ts      # Simulateur local pour tests sans consommation
            └── worker.ts    # Moteur de traitement de la file d'attente
```

---

## ⚙️ Configuration (.env)

Créez un fichier `.env` à la racine :

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="votre_secret_jwt_tres_long_et_securise"

# Fournisseur SMS : "winsms" pour la production, "mock" pour le développement
SMS_PROVIDER="mock"
WINSMS_API_KEY="votre_cle_api_fournie_par_winsms"
WINSMS_SENDER_ID="ELIMTIAZ"
WINSMS_API_URL="https://api.winsms.tn/v1"

# Identifiants initiaux du compte directeur
INITIAL_DIRECTOR_USERNAME="directeur"
INITIAL_DIRECTOR_PASSWORD="admin"

# Déploiement VPS
DOMAIN_NAME="ecole.votre-domaine.tn"
PORT=3000
NODE_ENV="production"
```

---

## 🛠️ Développement Local

1. **Installation des dépendances** :
   ```bash
   npm install
   ```

2. **Génération et initialisation de la base SQLite** :
   ```bash
   npx prisma db push
   npx tsx prisma/seed.ts
   ```

3. **Lancement du serveur de développement** :
   ```bash
   npm run dev
   ```
   L'application est accessible sur `http://localhost:3000`.

---

## 🚀 Guide de Déploiement sur Serveur VPS (Ubuntu / Debian)

### 1. Préparation du VPS et installation de Docker

Connectez-vous en SSH à votre VPS :
```bash
ssh root@votre-ip-vps
```

Installez Docker et Docker Compose :
```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

### 2. Configuration DNS du Domaine

Chez votre registrar (OVH, Cloudflare, Namecheap, etc.), ajoutez un enregistrement DNS :
- **Type** : `A`
- **Nom** : `ecole` (ou `@`)
- **Valeur** : Adresse IP publique de votre VPS.

### 3. Cloner et Configurer l'Application

```bash
git clone https://github.com/k-ino-dev/controle-sms.git /opt/controle-sms
cd /opt/controle-sms
cp .env.example .env
nano .env
```
Renseignez votre `DOMAIN_NAME` (ex: `ecole.mon-domaine.tn`), votre `JWT_SECRET` et vos identifiants WinSMS.

### 4. Démarrer avec Docker Compose

```bash
docker compose up -d --build
```
Caddy configure automatiquement le certificat SSL **HTTPS Let's Encrypt** gratuit. Votre application est immédiatement en ligne et sécurisée !

### 5. Sauvegardes Automatiques Quotidiennes (Cron)

Pour activer une sauvegarde quotidienne de la base SQLite à 2h du matin avec conservation des 30 derniers jours :
```bash
chmod +x scripts/backup.sh
crontab -e
```
Ajoutez la ligne suivante :
```cron
0 2 * * * /opt/controle-sms/scripts/backup.sh >> /var/log/backup_ecole.log 2>&1
```

### 6. Restauration d'une Sauvegarde

Pour restaurer une sauvegarde précédente en toute sécurité (avec création automatique d'un snapshot préventif de l'état actuel) :
```bash
# 1. Rendre le script exécutable
chmod +x scripts/restore.sh

# 2. Exécuter la restauration
./scripts/restore.sh data/backups/ecole_backup_YYYY-MM-DD_HH-MM-SS.db

# 3. Redémarrer le conteneur Next.js
docker compose restart web
```

### 7. Configuration de WinSMS Tunisie

1. Créez un compte sur [winsms.tn](https://winsms.tn) et obtenez votre clé API dans votre espace client.
2. Définissez votre **Sender ID** (entête d'expéditeur, ex: `ELIMTIAZ`).
3. Dans le fichier `.env` sur le VPS :
   ```env
   SMS_PROVIDER="winsms"
   WINSMS_API_KEY="votre_cle_api_secrete"
   WINSMS_SENDER_ID="ELIMTIAZ"
   WINSMS_API_URL="https://api.winsms.tn/v1"
   ```
4. Vous pouvez également tester et ajuster ces réglages directement depuis l'interface du directeur dans **Paramètres → Passerelle WinSMS Tunisie**.

### 8. Mettre à Jour l'Application

Pour appliquer de futures mises à jour sans couper le service ni perdre de données :
```bash
chmod +x update.sh
./update.sh
```

---

## 📦 Dépôt GitHub

Dépôt officiel privé : [https://github.com/k-ino-dev/controle-sms.git](https://github.com/k-ino-dev/controle-sms.git)

---

## 📄 Licence

Propriétaire - Tous droits réservés. © 2026 k-ino-dev.
Projet commercial privé sous licence propriétaire exclusive.

