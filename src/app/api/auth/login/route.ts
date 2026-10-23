import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signSessionToken, setSessionCookie } from "@/lib/auth";
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

    // 1. Protection contre le brute force
    const rateLimit = await checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Trop de tentatives infructueuses. Veuillez patienter ${rateLimit.retryAfterMinutes || 15} minute(s).`,
        },
        { status: 429 }
      );
    }

    // 2. Validation des données
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Veuillez renseigner l'identifiant et le mot de passe." },
        { status: 400 }
      );
    }

    const { username, password } = parsed.data;

    // 3. Recherche de l'utilisateur
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      await recordFailedAttempt(ip);
      return NextResponse.json(
        { error: "Identifiant ou mot de passe incorrect." },
        { status: 401 }
      );
    }

    // 4. Vérification du mot de passe
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      await recordFailedAttempt(ip);
      return NextResponse.json(
        { error: "Identifiant ou mot de passe incorrect." },
        { status: 401 }
      );
    }

    // 5. Réinitialisation des tentatives et génération de session
    await resetRateLimit(ip);

    const token = await signSessionToken({
      userId: user.id,
      username: user.username,
      name: user.name,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username, name: user.name },
    });
  } catch (error) {
    console.error("Erreur login :", error);
    return NextResponse.json(
      { error: "Une erreur interne est survenue." },
      { status: 500 }
    );
  }
}
