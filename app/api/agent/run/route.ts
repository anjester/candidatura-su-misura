import { NextResponse } from "next/server";
import { runAgent } from "@/lib/agent/runner";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    let reanalyze = false;

    try {
      const body = await req.json();
      reanalyze = body?.reanalyze === true;
    } catch {
      reanalyze = false;
    }

    const result = await runAgent({ reanalyze });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Errore interno agente",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
