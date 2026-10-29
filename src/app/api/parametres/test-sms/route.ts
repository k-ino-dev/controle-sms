import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { POST as handleTestSms } from "@/app/api/sms/test/route";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  return handleTestSms(req);
}
