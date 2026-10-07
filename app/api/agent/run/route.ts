import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent/runner";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await runAgent({ reanalyze: false });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Errore interno agente cron",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
