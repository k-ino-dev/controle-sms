# Étape 1 : Installation des dépendances complètes et hors-ligne
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Étape 2 : Construction du projet Next.js en mode standalone
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npx prisma generate
RUN npm run build

# Étape 3 : Image de production ultra-légère et autonome
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Outils système : sqlite pour les sauvegardes/restaurations et openssl pour Prisma
RUN apk add --no-cache openssl sqlite

# 1. Copier l'intégralité des node_modules depuis builder (qui contient déjà Prisma CLI, tsx, et le client généré)
COPY --from=builder /app/node_modules ./node_modules

# 2. Copier l'application Next.js standalone et les fichiers statiques
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# 3. S'assurer explicitement que le client Prisma généré et ses moteurs linux-musl sont préservés
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# 4. Copier les schémas Prisma et les scripts d'administration
COPY --from=builder /app/prisma ./prisma
COPY scripts ./scripts
COPY docker-entrypoint.sh ./docker-entrypoint.sh
COPY docker-worker-entrypoint.sh ./docker-worker-entrypoint.sh

# Permissions d'exécution
RUN chmod +x ./docker-entrypoint.sh ./docker-worker-entrypoint.sh ./scripts/*.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
