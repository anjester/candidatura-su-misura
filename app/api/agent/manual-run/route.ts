import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET non configurato su Vercel." },
      { status: 500 }
    );
  }

  const runUrl = new URL("/api/agent/run", req.nextUrl.origin);

  try {
    const response = await fetch(runUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({
      error: "Risposta non valida dalla route agent/run.",
    }));

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Errore durante l'esecuzione manuale dell'agente.",
      },
      { status: 500 }
    );
  }
}
