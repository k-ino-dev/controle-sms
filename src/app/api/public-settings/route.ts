import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await prisma.setting.findMany({
      where: {
        key: { in: ["school_name", "school_name_fr", "school_logo"] },
      },
    });

    const map: Record<string, string> = {};
    settings.forEach((s) => {
      map[s.key] = s.value;
    });

    return NextResponse.json({
      school_name: map["school_name"] || "معهد الامتياز الخاص",
      school_name_fr: map["school_name_fr"] || "Institut Privé d'Excellence",
      school_logo: map["school_logo"] || "/logo-transparent.png",
    });
  } catch (error) {
    return NextResponse.json({
      school_name: "معهد الامتياز الخاص",
      school_name_fr: "Institut Privé d'Excellence",
      school_logo: "/logo-transparent.png",
    });
  }
}
