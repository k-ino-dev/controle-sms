import { prisma } from "./prisma";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function checkRateLimit(ip: string): Promise<{ allowed: boolean; remainingAttempts: number; retryAfterMinutes?: number }> {
  try {
    const attempt = await prisma.loginAttempt.findUnique({
      where: { ip },
    });

    if (!attempt) {
      return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
    }

    const now = new Date();

    // Vérifier si le compte est verrouillé
    if (attempt.lockedUntil && attempt.lockedUntil > now) {
      const diffMs = attempt.lockedUntil.getTime() - now.getTime();
      const minutesRemaining = Math.ceil(diffMs / 60000);
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterMinutes: minutesRemaining,
      };
    }

    // Si le verrou est expiré, réinitialiser
    if (attempt.lockedUntil && attempt.lockedUntil <= now) {
      await prisma.loginAttempt.update({
        where: { ip },
        data: { attempts: 0, lockedUntil: null },
      });
      return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
    }

    const remaining = Math.max(0, MAX_ATTEMPTS - attempt.attempts);
    return {
      allowed: attempt.attempts < MAX_ATTEMPTS,
      remainingAttempts: remaining,
    };
  } catch (err) {
    console.error("Erreur rate limit:", err);
    // En cas d'erreur de base de données, ne pas bloquer
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS };
  }
}

export async function recordFailedAttempt(ip: string) {
  const now = new Date();
  const attempt = await prisma.loginAttempt.findUnique({ where: { ip } });

  if (!attempt) {
    await prisma.loginAttempt.create({
      data: {
        ip,
        attempts: 1,
        lastAttempt: now,
      },
    });
    return;
  }

  const nextAttempts = attempt.attempts + 1;
  const lockUntil = nextAttempts >= MAX_ATTEMPTS 
    ? new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000) 
    : null;

  await prisma.loginAttempt.update({
    where: { ip },
    data: {
      attempts: nextAttempts,
      lockedUntil: lockUntil,
      lastAttempt: now,
    },
  });
}

export async function resetRateLimit(ip: string) {
  try {
    await prisma.loginAttempt.delete({ where: { ip } }).catch(() => {});
  } catch {
    // Ignorer si inexistant
  }
}
